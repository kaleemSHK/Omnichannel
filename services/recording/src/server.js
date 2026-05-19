import { createHmac, randomUUID } from 'node:crypto';
import express from 'express';
import { createLogger } from '../lib/logger.js';
import { createStore } from '../lib/store.js';
import { ok, fail, bearerAuth, requestId, errorHandler, healthRouter, gracefulShutdown } from '../lib/http.js';

const log        = createLogger('recording');
const PORT       = parseInt(process.env.PORT || '8799', 10);
const TOKEN      = (process.env.TOKEN || '').trim();
const PLAY_TTL   = Math.min(86400, Math.max(60, parseInt(process.env.PLAY_TTL_SEC || '3600', 10)));
const STORAGE    = (process.env.STORAGE_BACKEND || 'local').toLowerCase();

const store = createStore(process.env.DATA_DIR || './data', () => ({ recordings: [], playSecret: randomUUID(), seq: { next: 1 } }));
// Persist play secret on first boot
(function initSecret() { const s = store.load(); if (!s.playSecret) { s.playSecret = randomUUID(); store.save(s); } })();

function getSecret() { return store.load().playSecret; }
function sign(recordingId, ttl) {
  const exp = Math.floor(Date.now() / 1000) + ttl;
  const sig = createHmac('sha256', getSecret()).update(`${recordingId}:${exp}`).digest('hex');
  return Buffer.from(`${recordingId}:${exp}:${sig}`).toString('base64url');
}
function verify(token) {
  try {
    const [id, exp, sig] = Buffer.from(token, 'base64url').toString().split(':');
    if (parseInt(exp) < Date.now() / 1000) return null;
    if (sig !== createHmac('sha256', getSecret()).update(`${id}:${exp}`).digest('hex')) return null;
    return id;
  } catch { return null; }
}

const auth = bearerAuth(TOKEN);
const app  = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '512kb' }));
app.use(requestId);
healthRouter(app, 'recording');

app.get('/v1/recordings', auth, (req, res) => {
  let recs = store.load().recordings ?? [];
  if (req.query.chatwoot_account_id) recs = recs.filter(r => String(r.chatwootAccountId) === String(req.query.chatwoot_account_id));
  ok(res, recs.slice().reverse());
});

app.post('/v1/recordings', auth, async (req, res) => {
  const { chatwootAccountId, callSessionId, channel = 'voice', durationMs, startedAt, endedAt } = req.body ?? {};
  if (!Number.isFinite(Number(chatwootAccountId))) return fail(res, 'VALIDATION_ERROR', 'chatwootAccountId required');
  ok(res, await store.withStore(s => {
    const r = { id: `rec-${s.seq.next++}`, chatwootAccountId: Number(chatwootAccountId), callSessionId: callSessionId ?? null, channel, durationMs: durationMs ?? null, startedAt: startedAt ?? null, endedAt: endedAt ?? null, storageBackend: STORAGE, storageKey: null, createdAt: new Date().toISOString() };
    s.recordings = s.recordings ?? []; s.recordings.push(r);
    log.info({ recordingId: r.id }, 'recording created');
    return r;
  }), 201);
});

app.get('/v1/recordings/:id', auth, (req, res) => {
  const r = (store.load().recordings ?? []).find(x => x.id === req.params.id);
  return r ? ok(res, r) : fail(res, 'NOT_FOUND', 'Recording not found', 404);
});

app.get('/v1/recordings/:id/playback-url', auth, (req, res) => {
  const r = (store.load().recordings ?? []).find(x => x.id === req.params.id);
  if (!r) return fail(res, 'NOT_FOUND', 'Recording not found', 404);
  const ttl   = Math.min(86400, Math.max(60, parseInt(req.query.ttl_sec || String(PLAY_TTL), 10)));
  const token = sign(r.id, ttl);
  ok(res, { recordingId: r.id, playbackUrl: `/v1/play/${token}`, expiresInSec: ttl });
});

app.get('/v1/play/:token', (req, res) => {
  const id = verify(req.params.token);
  if (!id) return fail(res, 'UNAUTHORIZED', 'Invalid or expired token', 401);
  const r = (store.load().recordings ?? []).find(x => x.id === id);
  if (!r) return fail(res, 'NOT_FOUND', 'Recording not found', 404);
  ok(res, { recordingId: r.id, storageBackend: r.storageBackend, storageKey: r.storageKey });
});

app.use(errorHandler(log));
const server = app.listen(PORT, '0.0.0.0', () => log.info({ port: PORT, storage: STORAGE }, 'recording started'));
gracefulShutdown(server, log);
