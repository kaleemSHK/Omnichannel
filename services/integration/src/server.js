import { createHash, createHmac, randomUUID } from 'node:crypto';
import express from 'express';
import { createLogger } from '../lib/logger.js';
import { createStore } from '../lib/store.js';
import { ok, fail, bearerAuth, requestId, errorHandler, healthRouter, gracefulShutdown } from '../lib/http.js';

const log   = createLogger('integration');
const PORT  = parseInt(process.env.PORT || '8800', 10);
const TOKEN = (process.env.TOKEN || '').trim();
const MAX_RETRIES = 5;

const store = createStore(process.env.DATA_DIR || './data', { webhooks: [], deliveries: [], deadLetters: [], connectors: [] });
const auth  = bearerAuth(TOKEN);
const app   = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '512kb' }));
app.use(requestId);
healthRouter(app, 'integration');

// Webhooks
app.get('/v1/webhooks', auth, (req, res) => {
  let hooks = store.load().webhooks;
  if (req.query.tenant_id) hooks = hooks.filter(h => String(h.tenantId) === String(req.query.tenant_id));
  ok(res, hooks.map(({ secretHash: _, ...h }) => h));
});

app.post('/v1/webhooks', auth, async (req, res) => {
  const { url, tenantId = 0, events = ['*'], secret } = req.body ?? {};
  if (!url?.trim()) return fail(res, 'VALIDATION_ERROR', 'url required');
  ok(res, await store.withStore(s => {
    const h = { id: randomUUID(), url: url.trim(), tenantId: Number(tenantId), events, secretHash: secret ? createHash('sha256').update(secret).digest('hex') : null, active: true, createdAt: new Date().toISOString() };
    s.webhooks = s.webhooks ?? []; s.webhooks.push(h);
    return { ...h, secretHash: undefined };
  }), 201);
});

app.delete('/v1/webhooks/:id', auth, async (req, res) => {
  try {
    await store.withStore(s => {
      const idx = (s.webhooks ?? []).findIndex(h => h.id === req.params.id);
      if (idx === -1) throw Object.assign(new Error(), { code: 404 });
      s.webhooks.splice(idx, 1);
    });
    res.status(204).end();
  } catch (e) {
    if (e.code === 404) return fail(res, 'NOT_FOUND', 'Webhook not found', 404);
    log.error(e); fail(res, 'INTERNAL_ERROR', 'Failed', 500);
  }
});

// Dispatch (called by gateway fan-out)
app.post('/v1/webhooks/dispatch', async (req, res) => {
  res.status(200).json({ ok: true });
  const { event, tenantId = 0, payload } = req.body ?? {};
  const hooks = (store.load().webhooks ?? []).filter(h => h.active && (h.tenantId === 0 || h.tenantId === Number(tenantId)) && (h.events.includes('*') || h.events.includes(event)));
  for (const hook of hooks) {
    (async () => {
      for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
          const headers = { 'Content-Type': 'application/json', 'X-BlinkOne-Event': event ?? '' };
          const r = await fetch(hook.url, { method: 'POST', headers, body: JSON.stringify({ event, tenantId, payload }) });
          if (r.ok) { log.info({ url: hook.url, event, attempt }, 'webhook delivered'); store.withStore(s => { s.deliveries = s.deliveries ?? []; s.deliveries.push({ id: randomUUID(), endpointId: hook.id, event, status: 'ok', attempt, at: new Date().toISOString() }); if (s.deliveries.length > 200) s.deliveries = s.deliveries.slice(-200); }).catch(() => {}); return; }
          log.warn({ url: hook.url, status: r.status, attempt }, 'webhook non-2xx');
        } catch (e) { log.warn({ url: hook.url, err: e.message, attempt }, 'webhook error'); }
        if (attempt < MAX_RETRIES) await new Promise(r => setTimeout(r, Math.min(30000, attempt * 5000)));
      }
      log.error({ url: hook.url, event }, 'max retries reached — dead letter');
      store.withStore(s => { s.deadLetters = s.deadLetters ?? []; s.deadLetters.push({ id: randomUUID(), url: hook.url, event, payload, failedAt: new Date().toISOString() }); if (s.deadLetters.length > 100) s.deadLetters = s.deadLetters.slice(-100); }).catch(() => {});
    })();
  }
});

app.get('/v1/deliveries',  auth, (_req, res) => ok(res, (store.load().deliveries  ?? []).slice().reverse()));
app.get('/v1/dead-letters', auth, (_req, res) => ok(res, (store.load().deadLetters ?? []).slice().reverse()));

// SSO (stub)
app.post('/v1/sso', auth, async (req, res) => {
  const { tenantId, provider, clientId, discoveryUrl } = req.body ?? {};
  if (!provider || !clientId) return fail(res, 'VALIDATION_ERROR', 'provider and clientId required');
  ok(res, { id: randomUUID(), tenantId, provider, clientId, discoveryUrl, status: 'configured', createdAt: new Date().toISOString() }, 201);
});

// ERP connectors (stub)
app.post('/v1/connectors', auth, async (req, res) => {
  const SUPPORTED = ['salesforce','sap','odoo','microsoft_dynamics','custom'];
  const { connectorType, tenantId = 0 } = req.body ?? {};
  if (!SUPPORTED.includes(connectorType)) return fail(res, 'VALIDATION_ERROR', `connectorType must be: ${SUPPORTED.join(', ')}`);
  ok(res, { id: randomUUID(), connectorType, tenantId, status: 'configured_stub', createdAt: new Date().toISOString() }, 201);
});

app.get('/v1/connectors', auth, (_req, res) => ok(res, store.load().connectors ?? []));

app.use(errorHandler(log));
const server = app.listen(PORT, '0.0.0.0', () => log.info({ port: PORT }, 'integration started'));
gracefulShutdown(server, log);
