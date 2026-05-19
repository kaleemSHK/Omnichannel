import { createHmac, timingSafeEqual } from 'node:crypto';
import { randomUUID } from 'node:crypto';
import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import pino from 'pino';

const log  = pino({ name: 'gateway', level: process.env.LOG_LEVEL || 'info', base: { service: 'gateway' } });
const PORT = parseInt(process.env.PORT || '8787', 10);
const STARTED = Date.now();

// ─── Upstream map ─────────────────────────────────────────────────────────────
function u(key, fallback = '') {
  return (process.env[key] || fallback).replace(/\/$/, '');
}

const U = {
  chatwoot:    u('CHATWOOT_UPSTREAM',    'http://chatwoot:3000'),
  platform:    u('PLATFORM_UPSTREAM',   'http://platform:8790'),
  tickets:     u('TICKETS_UPSTREAM',    'http://tickets:8791'),
  calls:       u('CALLS_UPSTREAM',      'http://calls:8792'),
  ai:          u('AI_UPSTREAM',         'http://ai:8793'),
  billing:     u('BILLING_UPSTREAM',    'http://billing:8794'),
  ivr:         u('IVR_UPSTREAM',        'http://ivr:8795'),
  sla:         u('SLA_UPSTREAM',        'http://sla:8796'),
  escalation:  u('ESCALATION_UPSTREAM', 'http://escalation:8797'),
  routing:     u('ROUTING_UPSTREAM',    'http://routing:8798'),
  recording:   u('RECORDING_UPSTREAM',  'http://recording:8799'),
  integration: u('INTEGRATION_UPSTREAM','http://integration:8800'),
};

const TOKENS = {
  ai:          (process.env.AI_TOKEN || '').trim(),
  ticket:      (process.env.TICKET_TOKEN || '').trim(),
  sla:         (process.env.SLA_TOKEN || '').trim(),
  integration: (process.env.INTEGRATION_TOKEN || '').trim(),
};

const WEBHOOK_SECRET = (process.env.CHATWOOT_WEBHOOK_SECRET || '').trim();

// ─── App ──────────────────────────────────────────────────────────────────────
const app = express();
app.disable('x-powered-by');

// Correlation ID + request logger
app.use((req, res, next) => {
  req.requestId = req.headers['x-request-id'] || randomUUID();
  res.setHeader('X-Request-Id', req.requestId);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  const t = Date.now();
  res.on('finish', () => log.info({ method: req.method, url: req.originalUrl, status: res.statusCode, ms: Date.now() - t }, 'req'));
  next();
});

// ─── Health ───────────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'gateway', uptime: Math.floor((Date.now() - STARTED) / 1000) }));

// ─── Proxy factory ────────────────────────────────────────────────────────────
function proxy(target, prefix, overrideToken) {
  return createProxyMiddleware({
    target,
    pathRewrite: (p) => p.replace(new RegExp(`^${prefix}`), '') || '/',
    on: {
      proxyReq: (pr, req) => {
        pr.setHeader('X-Request-Id', req.requestId || '');
        if (overrideToken) pr.setHeader('Authorization', `Bearer ${overrideToken}`);
      },
      proxyRes: (_pr, req, res) => res.setHeader('X-Request-Id', req.requestId || ''),
      error: (e, req, res) => {
        log.error({ url: target, err: e.message }, 'proxy error');
        if (!res.headersSent) res.status(502).json({ error: { code: 'BAD_GATEWAY', message: 'Upstream unavailable' } });
      },
    },
  });
}

// Pass-through proxy: Express strips the mount prefix, so we restore it via pathRewrite
// e.g. app.use('/api/v1', passthroughProxy(target, '/api/v1')) → forwards /api/v1/... intact
function passthroughProxy(target, prefix) {
  return createProxyMiddleware({
    target,
    pathRewrite: (path) => prefix + path,
    on: {
      proxyReq: (pr, req) => { pr.setHeader('X-Request-Id', req.requestId || ''); },
      proxyRes: (_pr, req, res) => res.setHeader('X-Request-Id', req.requestId || ''),
      error: (e, _req, res) => {
        log.error({ url: target, err: e.message }, 'proxy error');
        if (!res.headersSent) res.status(502).json({ error: { code: 'BAD_GATEWAY', message: 'Upstream unavailable' } });
      },
    },
  });
}

function notImpl(name) {
  return (_req, res) => res.status(501).json({ error: { code: 'NOT_CONFIGURED', message: `${name} upstream not configured` } });
}

// ─── Routes ───────────────────────────────────────────────────────────────────
const route = (path, target, token) =>
  app.use(path, target ? proxy(target, path, token) : notImpl(path));

// Chatwoot pass-through
app.use('/api/chatwoot', proxy(U.chatwoot, '/api/chatwoot'));
app.use('/api/auth',     proxy(U.chatwoot, '/api/auth'));

// Chatwoot native API — nginx /api/ catches these before they reach Chatwoot,
// so we relay them here preserving the full /api/v1/... path
app.use('/api/v1', passthroughProxy(U.chatwoot, '/api/v1'));
app.use('/api/v2', passthroughProxy(U.chatwoot, '/api/v2'));

// Enterprise services
route('/api/platform',    U.platform);
route('/api/tickets',     U.tickets);
route('/api/calls',       U.calls);
route('/api/ai',          U.ai,         TOKENS.ai);
route('/api/billing',     U.billing);
route('/api/ivr',         U.ivr);
route('/api/sla',         U.sla);
route('/api/escalations', U.escalation);
route('/api/routing',     U.routing);
route('/api/recordings',  U.recording);
route('/api/integrations',U.integration);

// ─── Chatwoot Webhook Fan-out ─────────────────────────────────────────────────
app.use('/api/webhooks/chatwoot', express.json({ limit: '1mb' }));

app.post('/api/webhooks/chatwoot', (req, res) => {
  // Verify HMAC signature if secret configured
  if (WEBHOOK_SECRET) {
    const sig = (req.headers['x-chatwoot-signature'] || '').trim();
    const expected = 'sha256=' + createHmac('sha256', WEBHOOK_SECRET).update(JSON.stringify(req.body)).digest('hex');
    try { if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return res.status(401).json({ error: { code: 'INVALID_SIGNATURE', message: 'Webhook signature mismatch' } }); }
    catch { return res.status(401).json({ error: { code: 'INVALID_SIGNATURE', message: 'Webhook signature missing or malformed' } }); }
  }

  res.status(200).json({ ok: true });

  const body      = req.body ?? {};
  const event     = body.event;
  const rid       = req.requestId;
  const accountId = Number(body.account?.id);
  const convId    = Number(body.conversation?.id);
  const isId      = (n) => Number.isFinite(n) && n > 0;

  function fanout(url, payload, token) {
    const headers = { 'Content-Type': 'application/json', 'X-Request-Id': rid };
    if (token) headers.Authorization = `Bearer ${token}`;
    fetch(url, { method: 'POST', headers, body: JSON.stringify(payload) })
      .then(r => { if (!r.ok) log.warn({ url, status: r.status }, 'fanout non-2xx'); })
      .catch(e => log.error({ url, err: e.message }, 'fanout failed'));
  }

  if (event === 'conversation_created') {
    const contact = body.meta?.sender ?? body.contact ?? {};
    const inbox   = body.inbox?.name ?? 'Chat';
    // Create CRM ticket
    fanout(`${U.tickets}/v1/tickets`, {
      chatwootAccountId: isId(accountId) ? accountId : 0,
      chatwootConversationId: isId(convId) ? convId : null,
      title: `Conversation #${convId} via ${inbox}`,
      channel: inbox, customerName: contact.name || 'Unknown',
      customerEmail: contact.email || '', status: 'open', priority: 'medium',
    }, TOKENS.ticket);
    // Start SLA timer
    fanout(`${U.sla}/v1/events`, { event: 'conversation_created', chatwootAccountId: isId(accountId) ? accountId : 0, conversationId: isId(convId) ? convId : null }, TOKENS.sla);
  }

  if (event === 'message_created' && body.message_type === 'outgoing') {
    fanout(`${U.sla}/v1/events`, { event: 'agent_responded', chatwootAccountId: isId(accountId) ? accountId : 0, conversationId: isId(convId) ? convId : null }, TOKENS.sla);
  }

  if (event === 'conversation_status_changed' && body.status === 'resolved') {
    fanout(`${U.sla}/v1/events`, { event: 'conversation_resolved', chatwootAccountId: isId(accountId) ? accountId : 0, conversationId: isId(convId) ? convId : null }, TOKENS.sla);
    fanout(`${U.integration}/v1/webhooks/dispatch`, { event: 'conversation.resolved', tenantId: 0, payload: { conversationId: convId, accountId } }, TOKENS.integration);
  }
});

// ─── 404 ──────────────────────────────────────────────────────────────────────
app.use((_req, res) => res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Route not found' } }));

// ─── Start ────────────────────────────────────────────────────────────────────
const server = app.listen(PORT, '0.0.0.0', () => log.info({ port: PORT }, 'gateway started'));
const stop = (sig) => { log.info({ sig }, 'shutdown'); server.close(() => process.exit(0)); setTimeout(() => process.exit(1), 10_000); };
process.on('SIGTERM', () => stop('SIGTERM'));
process.on('SIGINT',  () => stop('SIGINT'));
