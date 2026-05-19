import { randomUUID } from 'node:crypto';
import express from 'express';
import { createLogger } from '../lib/logger.js';
import { createStore } from '../lib/store.js';
import { ok, fail, bearerAuth, requestId, errorHandler, healthRouter, gracefulShutdown } from '../lib/http.js';

const log   = createLogger('calls');
const PORT  = parseInt(process.env.PORT || '8792', 10);
const TOKEN = (process.env.TOKEN || '').trim();
const REC_URL   = (process.env.RECORDING_URL   || 'http://recording:8799').replace(/\/$/, '');
const REC_TOKEN = (process.env.RECORDING_TOKEN || '').trim();

const TRANSITIONS = { ringing: ['connected','missed'], connected: ['ended'], missed: [], ended: [] };

const store = createStore(process.env.DATA_DIR || './data', { sessions: [] });
const auth  = bearerAuth(TOKEN);
const app   = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '256kb' }));
app.use(requestId);
healthRouter(app, 'calls');

function notifyRecording(session) {
  if (process.env.NOTIFY_RECORDING !== '1') return;
  const headers = { 'Content-Type': 'application/json', ...(REC_TOKEN ? { Authorization: `Bearer ${REC_TOKEN}` } : {}) };
  fetch(`${REC_URL}/v1/recordings`, { method: 'POST', headers, body: JSON.stringify({ chatwootAccountId: session.chatwootAccountId, callSessionId: session.id, channel: session.channel, durationMs: session.durationMs, startedAt: session.startedAt, endedAt: session.endedAt }) })
    .catch(e => log.warn({ err: e.message }, 'recording notify failed'));
}

app.get('/v1/sessions', auth, (req, res) => {
  let sessions = store.load().sessions ?? [];
  if (req.query.chatwoot_account_id) sessions = sessions.filter(s => String(s.chatwootAccountId) === String(req.query.chatwoot_account_id));
  ok(res, sessions.slice().reverse());
});

app.get('/v1/sessions/:id', auth, (req, res) => {
  const s = (store.load().sessions ?? []).find(x => x.id === req.params.id);
  return s ? ok(res, s) : fail(res, 'NOT_FOUND', 'Session not found', 404);
});

app.post('/v1/sessions', auth, async (req, res) => {
  const { roomId, chatwootAccountId, channel = 'voice', agentLabel, customerPhone } = req.body ?? {};
  if (!roomId?.trim()) return fail(res, 'VALIDATION_ERROR', 'roomId required');
  if (!Number.isFinite(Number(chatwootAccountId))) return fail(res, 'VALIDATION_ERROR', 'chatwootAccountId required');
  ok(res, await store.withStore(s => {
    const session = { id: randomUUID(), roomId: roomId.trim().slice(0,128), chatwootAccountId: Number(chatwootAccountId), channel, agentLabel: agentLabel ?? null, customerPhone: customerPhone ?? null, status: 'ringing', startedAt: new Date().toISOString(), connectedAt: null, endedAt: null, durationMs: null, outcome: null };
    s.sessions = s.sessions ?? []; s.sessions.push(session);
    log.info({ sessionId: session.id }, 'session created');
    return session;
  }), 201);
});

app.patch('/v1/sessions/:id', auth, async (req, res) => {
  const newStatus = (req.body?.status || '').trim();
  try {
    ok(res, await store.withStore(s => {
      const session = (s.sessions ?? []).find(x => x.id === req.params.id);
      if (!session) throw Object.assign(new Error(), { code: 404 });
      if (newStatus) {
        if (!TRANSITIONS[session.status]?.includes(newStatus)) throw Object.assign(new Error(), { code: 422, msg: `Cannot go from ${session.status} to ${newStatus}` });
        session.status = newStatus;
        if (newStatus === 'connected') session.connectedAt = new Date().toISOString();
        if (newStatus === 'ended' || newStatus === 'missed') {
          session.endedAt = new Date().toISOString();
          const from = session.connectedAt ?? session.startedAt;
          session.durationMs = Date.now() - new Date(from).getTime();
          session.outcome = (req.body.outcome || newStatus).slice(0,80);
          notifyRecording(session);
        }
      }
      return session;
    }));
  } catch (e) {
    if (e.code === 404) return fail(res, 'NOT_FOUND', 'Session not found', 404);
    if (e.code === 422) return fail(res, 'BAD_STATE', e.msg, 422);
    log.error(e); fail(res, 'INTERNAL_ERROR', 'Failed', 500);
  }
});

app.use(errorHandler(log));
const server = app.listen(PORT, '0.0.0.0', () => log.info({ port: PORT }, 'calls started'));
gracefulShutdown(server, log);
