import { randomUUID } from 'node:crypto';
import express from 'express';
import { createLogger } from '../lib/logger.js';
import { createStore } from '../lib/store.js';
import { ok, fail, bearerAuth, requestId, errorHandler, healthRouter, gracefulShutdown } from '../lib/http.js';
import { dbEnabled, runMigrations, closePool, getPool } from '../lib/db.js';
import * as cdrRepo from '../lib/cdr-repo.js';
import { requireFeature } from '../_shared/lib/features.js';
import { broadcastCallEvent } from '../lib/chatwoot-broadcast.js';

const log = createLogger('calls');
const PORT = parseInt(process.env.PORT || '8792', 10);
const TOKEN = (process.env.TOKEN || '').trim();
const REC_URL = (process.env.RECORDING_URL || 'http://recording:8799').replace(/\/$/, '');
const REC_TOKEN = (process.env.RECORDING_TOKEN || '').trim();

const TRANSITIONS = { ringing: ['connected', 'missed'], connected: ['ended'], missed: [], ended: [] };
const CHATWOOT_URL = (process.env.CHATWOOT_URL || 'http://chatwoot:3000').replace(/\/$/, '');
const CHATWOOT_TOKEN = (process.env.CHATWOOT_BOT_TOKEN || '').trim();
const BILLING_URL = (process.env.BILLING_URL || 'http://billing:8794').replace(/\/$/, '');
const BILLING_TOKEN = (process.env.BILLING_TOKEN || '').trim();

async function meterCallMinutes(tenantId, minutes) {
  if (!BILLING_TOKEN || !minutes || minutes <= 0) return;
  try {
    await fetch(`${BILLING_URL}/v1/usage/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${BILLING_TOKEN}` },
      body: JSON.stringify({
        tenantId: String(tenantId),
        dimension: 'minute',
        quantity: minutes,
        sourceService: 'calls',
        sourceEventId: `call-min-${tenantId}-${Date.now()}`,
      }),
    });
  } catch (e) {
    log.warn({ err: e.message }, 'billing meter failed');
  }
}

async function tryAssignConversation(accountId, conversationId, agentId) {
  if (!conversationId || !CHATWOOT_TOKEN) return;
  try {
    await fetch(`${CHATWOOT_URL}/api/v1/accounts/${accountId}/conversations/${conversationId}/assignments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', api_access_token: CHATWOOT_TOKEN },
      body: JSON.stringify({ assignee_id: Number(agentId) || agentId }),
    });
  } catch (e) {
    log.warn({ err: e.message }, 'chatwoot assign failed');
  }
}

const fileStore = createStore(process.env.DATA_DIR || './data', { sessions: [] });
const auth = bearerAuth(TOKEN);

function resolveTenantId(req) {
  return String(req.query.tenant_id ?? req.headers['x-blinkone-tenant-id'] ?? req.body?.tenantId ?? 'default');
}

const pstnFeature = requireFeature('calling.pstn', resolveTenantId, fail);
const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '256kb' }));
app.use(requestId);
healthRouter(app, 'calls');

function notifyRecording(session) {
  if (process.env.NOTIFY_RECORDING !== '1') return;
  const headers = { 'Content-Type': 'application/json', ...(REC_TOKEN ? { Authorization: `Bearer ${REC_TOKEN}` } : {}) };
  fetch(`${REC_URL}/v1/recordings`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      chatwootAccountId: session.chatwootAccountId,
      callSessionId: session.id,
      channel: session.channel,
      durationMs: session.durationMs,
      startedAt: session.startedAt,
      endedAt: session.endedAt,
    }),
  }).catch((e) => log.warn({ err: e.message }, 'recording notify failed'));
}

app.get('/readyz', async (_req, res) => {
  if (!dbEnabled()) return res.json({ status: 'ready', db: false });
  try {
    await getPool().query('SELECT 1');
    return res.json({ status: 'ready', db: true });
  } catch (e) {
    return res.status(503).json({ status: 'not_ready', error: e.message });
  }
});

app.get('/v1/sessions', auth, async (req, res) => {
  const tenantId = resolveTenantId(req);
  if (dbEnabled()) {
    try {
      let sessions = await cdrRepo.listSessions(tenantId);
      if (req.query.chatwoot_account_id) {
        sessions = sessions.filter((s) => String(s.chatwootAccountId) === String(req.query.chatwoot_account_id));
      }
      return ok(res, sessions);
    } catch (e) {
      log.error({ err: e.message }, 'list sessions');
      return fail(res, 'INTERNAL_ERROR', 'Failed', 500);
    }
  }
  let sessions = fileStore.load().sessions ?? [];
  if (req.query.chatwoot_account_id) {
    sessions = sessions.filter((s) => String(s.chatwootAccountId) === String(req.query.chatwoot_account_id));
  }
  ok(res, sessions.slice().reverse());
});

app.get('/v1/sessions/:id', auth, async (req, res) => {
  const tenantId = resolveTenantId(req);
  if (dbEnabled()) {
    const s = await cdrRepo.getSession(tenantId, req.params.id);
    return s ? ok(res, s) : fail(res, 'NOT_FOUND', 'Session not found', 404);
  }
  const s = (fileStore.load().sessions ?? []).find((x) => x.id === req.params.id);
  return s ? ok(res, s) : fail(res, 'NOT_FOUND', 'Session not found', 404);
});

app.post('/v1/sessions', auth, pstnFeature, async (req, res) => {
  const { roomId, chatwootAccountId, channel = 'voice', agentLabel, customerPhone } = req.body ?? {};
  if (!roomId?.trim()) return fail(res, 'VALIDATION_ERROR', 'roomId required');
  if (!Number.isFinite(Number(chatwootAccountId))) return fail(res, 'VALIDATION_ERROR', 'chatwootAccountId required');

  if (dbEnabled()) {
    try {
      const session = await cdrRepo.insertCdr({
        chatwootAccountId,
        roomId,
        channel,
        agentLabel,
        customerPhone,
        status: 'ringing',
        startedAt: new Date().toISOString(),
        disposition: 'ringing',
      });
      log.info({ sessionId: session.id }, 'session created');
      return ok(res, session, 201);
    } catch (e) {
      log.error({ err: e.message }, 'create session');
      return fail(res, 'INTERNAL_ERROR', 'Failed', 500);
    }
  }

  ok(
    res,
    await fileStore.withStore((s) => {
      const session = {
        id: randomUUID(),
        roomId: roomId.trim().slice(0, 128),
        chatwootAccountId: Number(chatwootAccountId),
        channel,
        agentLabel: agentLabel ?? null,
        customerPhone: customerPhone ?? null,
        status: 'ringing',
        startedAt: new Date().toISOString(),
        connectedAt: null,
        endedAt: null,
        durationMs: null,
        outcome: null,
      };
      s.sessions = s.sessions ?? [];
      s.sessions.push(session);
      log.info({ sessionId: session.id }, 'session created');
      return session;
    }),
    201,
  );
});

/** CDR ingest from routing (Prompt 5 step 6). */
app.post('/v1/cdr', auth, async (req, res) => {
  const {
    chatwootAccountId,
    roomId,
    channel = 'voice',
    agentLabel,
    customerPhone,
    queueKey,
    disposition,
    startedAt,
    endedAt,
    durationMs,
    asteriskChannelId,
  } = req.body ?? {};
  const accountId = Number(chatwootAccountId);
  if (!Number.isFinite(accountId)) return fail(res, 'VALIDATION_ERROR', 'chatwootAccountId required');

  if (dbEnabled()) {
    try {
      const session = await cdrRepo.insertCdr({
        chatwootAccountId: accountId,
        roomId: roomId || asteriskChannelId,
        channel,
        agentLabel,
        customerPhone,
        queueKey,
        disposition,
        startedAt,
        endedAt,
        durationMs,
        asteriskChannelId,
        status: 'ended',
      });
      log.info({ sessionId: session.id, disposition: session.outcome }, 'CDR recorded');
      notifyRecording(session);
      return ok(res, session, 201);
    } catch (e) {
      log.error({ err: e.message }, 'cdr');
      return fail(res, 'INTERNAL_ERROR', 'Failed', 500);
    }
  }

  ok(
    res,
    await fileStore.withStore((s) => {
      const session = {
        id: randomUUID(),
        roomId: (roomId || asteriskChannelId || randomUUID()).toString().slice(0, 128),
        chatwootAccountId: accountId,
        channel,
        agentLabel: agentLabel ?? null,
        customerPhone: customerPhone ?? null,
        queueKey: queueKey ?? null,
        status: 'ended',
        startedAt: startedAt ?? new Date().toISOString(),
        connectedAt: startedAt ?? null,
        endedAt: endedAt ?? new Date().toISOString(),
        durationMs: durationMs ?? null,
        outcome: disposition ?? 'completed',
        asteriskChannelId: asteriskChannelId ?? null,
      };
      s.sessions = s.sessions ?? [];
      s.sessions.push(session);
      log.info({ sessionId: session.id, disposition: session.outcome }, 'CDR recorded');
      notifyRecording(session);
      return session;
    }),
    201,
  );
});

// ─── Unified calls API (agent view) ───────────────────────────────────────────
app.get('/v1/calls/incoming', auth, async (req, res) => {
  const tenantId = resolveTenantId(req);
  if (!dbEnabled()) return fail(res, 'NOT_CONFIGURED', 'Postgres required', 501);
  try {
    const calls = await cdrRepo.listCalls(tenantId, {
      status: 'ringing',
      scope: req.query.scope,
      agentId: req.query.agent_id,
    });
    return ok(res, calls);
  } catch (e) {
    log.error({ err: e.message }, 'list incoming');
    return fail(res, 'INTERNAL_ERROR', 'Failed', 500);
  }
});

app.get('/v1/calls', auth, async (req, res) => {
  const tenantId = resolveTenantId(req);
  if (!dbEnabled()) return fail(res, 'NOT_CONFIGURED', 'Postgres required', 501);
  try {
    const calls = await cdrRepo.listCalls(tenantId, {
      status: req.query.status,
      transport: req.query.transport,
      scope: req.query.scope,
      agentId: req.query.agent_id,
    });
    return ok(res, calls);
  } catch (e) {
    log.error({ err: e.message }, 'list calls');
    return fail(res, 'INTERNAL_ERROR', 'Failed', 500);
  }
});

app.get('/v1/calls/:id', auth, async (req, res) => {
  const tenantId = resolveTenantId(req);
  if (!dbEnabled()) return fail(res, 'NOT_CONFIGURED', 'Postgres required', 501);
  const c = await cdrRepo.getCall(tenantId, req.params.id);
  return c ? ok(res, c) : fail(res, 'NOT_FOUND', 'Call not found', 404);
});

app.post('/v1/calls', auth, pstnFeature, async (req, res) => {
  const tenantId = resolveTenantId(req);
  if (!dbEnabled()) return fail(res, 'NOT_CONFIGURED', 'Postgres required', 501);
  try {
    const session = await cdrRepo.createCall({ ...req.body, chatwootAccountId: req.body?.chatwootAccountId ?? tenantId });
    await broadcastCallEvent(session.chatwootAccountId, {
      type: 'incoming',
      callId: session.id,
      conversationId: session.conversationId,
    });
    return ok(res, session, 201);
  } catch (e) {
    log.error({ err: e.message }, 'create call');
    return fail(res, 'INTERNAL_ERROR', 'Failed', 500);
  }
});

async function callAction(req, res, status, eventType) {
  const tenantId = resolveTenantId(req);
  if (!dbEnabled()) return fail(res, 'NOT_CONFIGURED', 'Postgres required', 501);
  const agentId = req.body?.agentId ?? req.headers['x-blinkone-user-id'];
  try {
    const session = await cdrRepo.transitionCall(tenantId, req.params.id, {
      status,
      outcome: req.body?.outcome,
      agentId: agentId ? String(agentId) : null,
      metadata: req.body?.metadata ?? {},
    });
    if (!session) return fail(res, 'NOT_FOUND', 'Call not found', 404);
    if (status === 'connected' && session.conversationId) {
      await tryAssignConversation(session.chatwootAccountId, session.conversationId, agentId);
    }
    if (status === 'ended') {
      notifyRecording(session);
      const ms = session.durationMs ?? (session.endedAt && session.startedAt
        ? new Date(session.endedAt) - new Date(session.startedAt)
        : 0);
      const minutes = Math.max(0, Math.ceil(Number(ms) / 60000));
      if (minutes > 0) await meterCallMinutes(session.chatwootAccountId ?? tenantId, minutes);
    }
    const eventType =
      status === 'connected' ? 'answered' : status === 'missed' ? 'declined' : status === 'ended' ? 'ended' : status;
    await broadcastCallEvent(session.chatwootAccountId, {
      type: eventType,
      callId: session.id,
      conversationId: session.conversationId,
    });
    return ok(res, session);
  } catch (e) {
    log.error({ err: e.message }, eventType);
    return fail(res, 'INTERNAL_ERROR', 'Failed', 500);
  }
}

app.post('/v1/calls/:id/answer', auth, pstnFeature, (req, res) => callAction(req, res, 'connected', 'answer'));
app.post('/v1/calls/:id/decline', auth, pstnFeature, (req, res) => callAction(req, res, 'missed', 'decline'));
app.post('/v1/calls/:id/hangup', auth, pstnFeature, (req, res) => callAction(req, res, 'ended', 'hangup'));
app.post('/v1/calls/:id/transfer', auth, pstnFeature, async (req, res) => {
  const tenantId = resolveTenantId(req);
  if (!dbEnabled()) return fail(res, 'NOT_CONFIGURED', 'Postgres required', 501);
  try {
    await cdrRepo.appendCallEvent(tenantId, req.params.id, {
      eventType: 'transfer',
      actorId: req.body?.agentId,
      metadata: req.body ?? {},
    });
    const session = await cdrRepo.getCall(tenantId, req.params.id);
    return session ? ok(res, session) : fail(res, 'NOT_FOUND', 'Call not found', 404);
  } catch (e) {
    return fail(res, 'INTERNAL_ERROR', 'Failed', 500);
  }
});

app.patch('/v1/sessions/:id', auth, pstnFeature, async (req, res) => {
  const newStatus = (req.body?.status || '').trim();
  try {
    ok(
      res,
      await fileStore.withStore((s) => {
        const session = (s.sessions ?? []).find((x) => x.id === req.params.id);
        if (!session) throw Object.assign(new Error(), { code: 404 });
        if (newStatus) {
          if (!TRANSITIONS[session.status]?.includes(newStatus)) {
            throw Object.assign(new Error(), { code: 422, msg: `Cannot go from ${session.status} to ${newStatus}` });
          }
          session.status = newStatus;
          if (newStatus === 'connected') session.connectedAt = new Date().toISOString();
          if (newStatus === 'ended' || newStatus === 'missed') {
            session.endedAt = new Date().toISOString();
            const from = session.connectedAt ?? session.startedAt;
            session.durationMs = Date.now() - new Date(from).getTime();
            session.outcome = (req.body.outcome || newStatus).slice(0, 80);
            notifyRecording(session);
          }
        }
        return session;
      }),
    );
  } catch (e) {
    if (e.code === 404) return fail(res, 'NOT_FOUND', 'Session not found', 404);
    if (e.code === 422) return fail(res, 'BAD_STATE', e.msg, 422);
    log.error(e);
    fail(res, 'INTERNAL_ERROR', 'Failed', 500);
  }
});

app.use(errorHandler(log));

async function main() {
  if (dbEnabled()) {
    await runMigrations(log);
    log.info('Postgres CDR enabled');
  }
  const server = app.listen(PORT, '0.0.0.0', () => log.info({ port: PORT, db: dbEnabled() }, 'calls started'));
  process.on('SIGTERM', async () => {
    await closePool();
    server.close(() => process.exit(0));
  });
  gracefulShutdown(server, log);
}

main().catch((e) => {
  log.error(e);
  process.exit(1);
});
