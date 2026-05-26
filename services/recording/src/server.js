import { createHmac, randomUUID } from 'node:crypto';
import express from 'express';
import multer from 'multer';
import { createLogger } from '../lib/logger.js';
import { createStore } from '../lib/store.js';
import { ok, fail, bearerAuth, requestId, errorHandler, healthRouter, gracefulShutdown } from '../lib/http.js';
import {
  putObject,
  recordingKey,
  presignedGetUrl,
  getObjectStream,
  storageUrlFromKey,
  objectKeyFromStorageUrl,
} from '../lib/minio.js';

const log = createLogger('recording');
const PORT = parseInt(process.env.PORT || '8799', 10);
const TOKEN = (process.env.TOKEN || '').trim();
const PLAY_TTL = Math.min(86400, Math.max(60, parseInt(process.env.PLAY_TTL_SEC || '3600', 10)));
const STORAGE = (process.env.STORAGE_BACKEND || 'minio').toLowerCase();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

const store = createStore(process.env.DATA_DIR || './data', () => ({
  recordings: [],
  playSecret: randomUUID(),
  seq: { next: 1 },
}));

(function initSecret() {
  const s = store.load();
  if (!s.playSecret) {
    s.playSecret = randomUUID();
    store.save(s);
  }
})();

function getSecret() {
  return store.load().playSecret;
}

function sign(recordingId, ttl) {
  const exp = Math.floor(Date.now() / 1000) + ttl;
  const sig = createHmac('sha256', getSecret()).update(`${recordingId}:${exp}`).digest('hex');
  return Buffer.from(`${recordingId}:${exp}:${sig}`).toString('base64url');
}

function verify(token) {
  try {
    const [id, exp, sig] = Buffer.from(token, 'base64url').toString().split(':');
    if (parseInt(exp, 10) < Date.now() / 1000) return null;
    if (sig !== createHmac('sha256', getSecret()).update(`${id}:${exp}`).digest('hex')) return null;
    return id;
  } catch {
    return null;
  }
}

function resolveTenantId(req) {
  const header = req.headers['x-blinkone-tenant-id'];
  if (typeof header === 'string' && header.trim()) return header.trim();
  if (req.query?.chatwoot_account_id) return String(req.query.chatwoot_account_id);
  if (req.body?.tenantId) return String(req.body.tenantId);
  if (req.body?.chatwootAccountId) return String(req.body.chatwootAccountId);
  return 'default';
}

function mapRecording(r) {
  const durationMs = r.durationMs ?? (r.duration_sec != null ? r.duration_sec * 1000 : null);
  return {
    id: r.id,
    tenant_id: String(r.tenantId ?? r.chatwootAccountId ?? r.tenant_id),
    tenantId: String(r.tenantId ?? r.chatwootAccountId ?? r.tenant_id),
    call_id: r.callSessionId ?? r.call_id ?? r.callId,
    call_session_id: r.callSessionId ?? r.call_session_id,
    callSessionId: r.callSessionId ?? r.call_session_id,
    agent_id: r.agentId ?? r.agent_id,
    channel: r.channel ?? 'voice',
    duration_sec: r.duration_sec ?? (durationMs != null ? Math.round(durationMs / 1000) : null),
    duration_ms: durationMs,
    direction: r.direction ?? 'inbound',
    storage_url: r.storageUrl ?? r.storage_url ?? (r.storageKey ? `minio://${r.storageKey}` : null),
    storage_key: r.storageKey ?? r.storage_key,
    created_at: r.createdAt ?? r.created_at,
    createdAt: r.createdAt ?? r.created_at,
    status: r.storageKey || r.storage_url ? 'ready' : 'pending',
    recording_paused: r.recordingPaused ?? false,
    pci_pause_segments: r.pciPauseSegments ?? [],
  };
}

async function presignRecording(rec) {
  const storageUrl = rec.storageUrl ?? rec.storage_url ?? '';
  if (process.env.MINIO_STUB === '1' || storageUrl.startsWith('stub://') || !rec.storageKey) {
    return { url: null, stub: true };
  }
  const objectKey = objectKeyFromStorageUrl(rec.storageKey ?? storageUrl);
  const url = await presignedGetUrl(objectKey, PLAY_TTL);
  return { url, stub: false, expiresInSec: PLAY_TTL };
}

const auth = bearerAuth(TOKEN);
const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '2mb' }));
app.use(requestId);
healthRouter(app, 'recording');

app.get('/v1/recordings', auth, (req, res) => {
  const tenantId = resolveTenantId(req);
  let recs = store.load().recordings ?? [];
  recs = recs.filter(
    (r) => String(r.chatwootAccountId ?? r.tenantId ?? r.tenant_id) === String(tenantId),
  );
  ok(res, recs.map(mapRecording).reverse());
});

app.post('/v1/recordings', auth, upload.single('audio'), async (req, res) => {
  const tenantId = resolveTenantId(req);
  const body = req.body ?? {};
  const chatwootAccountId = body.chatwootAccountId ?? body.tenantId ?? tenantId;
  const callSessionId = body.callSessionId ?? body.callId ?? body.call_id;
  const channel = body.channel ?? 'voice';
  const durationMs = body.durationMs ?? (body.duration ? Number(body.duration) * 1000 : null);
  const direction = body.direction ?? 'inbound';
  const agentId = body.agentId ?? body.agent_id;

  if (!Number.isFinite(Number(chatwootAccountId))) {
    return fail(res, 'VALIDATION_ERROR', 'chatwootAccountId or tenantId required');
  }

  let storageKey = null;
  let storageUrl = null;
  let storageBackend = STORAGE;

  const audioBuf =
    req.file?.buffer ??
    (body.audioBase64 ? Buffer.from(body.audioBase64, 'base64') : null);

  if (audioBuf?.length && callSessionId) {
    try {
      const key = recordingKey(String(chatwootAccountId), callSessionId);
      const put = await putObject(key, audioBuf, req.file?.mimetype ?? 'audio/wav');
      storageKey = put.storageKey;
      storageUrl = storageUrlFromKey(put.objectKey);
      storageBackend = 'minio';
    } catch (e) {
      log.error({ err: e.message }, 'minio upload failed');
      return fail(res, 'INTERNAL_ERROR', 'Upload failed', 500);
    }
  } else if (process.env.MINIO_STUB === '1' && callSessionId) {
    storageUrl = `stub://recordings/${callSessionId}.wav`;
    storageBackend = 'stub';
  }

  const row = await store.withStore((s) => {
    const r = {
      id: `rec-${s.seq.next++}`,
      chatwootAccountId: Number(chatwootAccountId),
      tenantId: String(chatwootAccountId),
      callSessionId: callSessionId ?? null,
      callId: callSessionId ?? null,
      agentId: agentId ?? null,
      channel,
      direction,
      durationMs: durationMs ?? null,
      duration_sec: durationMs != null ? Math.round(durationMs / 1000) : null,
      startedAt: body.startedAt ?? null,
      endedAt: body.endedAt ?? null,
      storageBackend,
      storageKey,
      storageUrl,
      createdAt: new Date().toISOString(),
    };
    s.recordings = s.recordings ?? [];
    s.recordings.push(r);
    log.info({ recordingId: r.id, storageKey, storageUrl }, 'recording created');
    return r;
  });

  return ok(res, mapRecording(row), 201);
});

app.get('/v1/recordings/:id', auth, (req, res) => {
  const tenantId = resolveTenantId(req);
  const r = (store.load().recordings ?? []).find(
    (x) =>
      x.id === req.params.id &&
      String(x.chatwootAccountId ?? x.tenantId) === String(tenantId),
  );
  return r ? ok(res, mapRecording(r)) : fail(res, 'NOT_FOUND', 'Recording not found', 404);
});

app.get('/v1/recordings/:id/play', auth, async (req, res) => {
  const tenantId = resolveTenantId(req);
  const r = (store.load().recordings ?? []).find(
    (x) =>
      x.id === req.params.id &&
      String(x.chatwootAccountId ?? x.tenantId) === String(tenantId),
  );
  if (!r) return fail(res, 'NOT_FOUND', 'Recording not found', 404);
  try {
    return ok(res, await presignRecording(r));
  } catch (e) {
    log.error({ err: e.message }, 'presign recording');
    return fail(res, 'INTERNAL_ERROR', 'Failed to generate play URL', 500);
  }
});

app.get('/v1/recordings/:id/stream', auth, async (req, res) => {
  const tenantId = resolveTenantId(req);
  const r = (store.load().recordings ?? []).find(
    (x) =>
      x.id === req.params.id &&
      String(x.chatwootAccountId ?? x.tenantId) === String(tenantId),
  );
  if (!r) return fail(res, 'NOT_FOUND', 'Recording not found', 404);
  if (process.env.MINIO_STUB === '1' || !r.storageKey) {
    return fail(res, 'NOT_AVAILABLE', 'No audio stored', 404);
  }
  try {
    const objectKey = objectKeyFromStorageUrl(r.storageKey ?? r.storageUrl ?? '');
    const stream = await getObjectStream(objectKey);
    if (!stream) return fail(res, 'NOT_AVAILABLE', 'Storage unavailable', 404);
    res.setHeader('Content-Type', 'audio/wav');
    res.setHeader('Cache-Control', 'private, max-age=60');
    stream.on('error', (e) => {
      log.error({ err: e.message }, 'stream recording');
      if (!res.headersSent) fail(res, 'INTERNAL_ERROR', 'Stream failed', 500);
    });
    stream.pipe(res);
  } catch (e) {
    log.error({ err: e.message }, 'stream recording');
    return fail(res, 'INTERNAL_ERROR', 'Stream failed', 500);
  }
});

app.get('/v1/recordings/:id/playback-url', auth, async (req, res) => {
  const tenantId = resolveTenantId(req);
  const r = (store.load().recordings ?? []).find(
    (x) =>
      x.id === req.params.id &&
      String(x.chatwootAccountId ?? x.tenantId) === String(tenantId),
  );
  if (!r) return fail(res, 'NOT_FOUND', 'Recording not found', 404);
  try {
    const play = await presignRecording(r);
    if (play.url) return ok(res, { recordingId: r.id, playbackUrl: play.url, url: play.url, expiresInSec: play.expiresInSec });
    const ttl = Math.min(86400, Math.max(60, parseInt(req.query.ttl_sec || String(PLAY_TTL), 10)));
    const token = sign(r.id, ttl);
    return ok(res, { recordingId: r.id, playbackUrl: `/api/recordings/v1/play/${token}`, expiresInSec: ttl, stub: true });
  } catch (e) {
    log.error({ err: e.message }, 'playback-url');
    return fail(res, 'INTERNAL_ERROR', 'Failed', 500);
  }
});

// ─── PCI Recording Pause / Resume — Sprint 1 G02 ─────────────────────────────

/**
 * PATCH /v1/recordings/:id/pause
 * Called by calls service when an agent enters PCI payment mode.
 * Stores a pciPauseStart timestamp; actual audio capture is controlled
 * by the SIP/WebRTC layer — this is the compliance audit trail.
 */
app.patch('/v1/recordings/:id/pause', auth, (req, res) => {
  const tenantId = resolveTenantId(req);
  const { pciPauseStart, agentId } = req.body ?? {};
  const now = pciPauseStart ?? new Date().toISOString();

  try {
    const updated = store.withStore((s) => {
      const r = (s.recordings ?? []).find(
        (x) =>
          x.id === req.params.id &&
          String(x.chatwootAccountId ?? x.tenantId) === String(tenantId),
      );
      if (!r) return null;
      r.recordingPaused = true;
      r.pciPauseStart = now;
      r.pciAgentId = agentId ?? r.agentId;
      log.info({ recordingId: r.id, pciPauseStart: now }, 'PCI pause applied');
      return r;
    });
    if (!updated) return fail(res, 'NOT_FOUND', 'Recording not found', 404);
    return ok(res, { id: updated.id, paused: true, pciPauseStart: now });
  } catch (e) {
    log.error({ err: e.message }, 'recording pause');
    return fail(res, 'INTERNAL_ERROR', 'Failed', 500);
  }
});

/**
 * PATCH /v1/recordings/:id/resume
 * Called by calls service when PCI payment collection ends.
 * Appends {start, end} to pauseSegments[] for audit trail.
 */
app.patch('/v1/recordings/:id/resume', auth, (req, res) => {
  const tenantId = resolveTenantId(req);
  const { pciPauseEnd } = req.body ?? {};
  const now = pciPauseEnd ?? new Date().toISOString();

  try {
    const updated = store.withStore((s) => {
      const r = (s.recordings ?? []).find(
        (x) =>
          x.id === req.params.id &&
          String(x.chatwootAccountId ?? x.tenantId) === String(tenantId),
      );
      if (!r) return null;
      const pauseStart = r.pciPauseStart ?? null;
      r.recordingPaused = false;
      r.pciPauseStart = null;
      r.pciPauseSegments = r.pciPauseSegments ?? [];
      if (pauseStart) {
        r.pciPauseSegments.push({ start: pauseStart, end: now });
      }
      log.info({ recordingId: r.id, pciPauseEnd: now, totalSegments: r.pciPauseSegments.length }, 'PCI resume applied');
      return r;
    });
    if (!updated) return fail(res, 'NOT_FOUND', 'Recording not found', 404);
    return ok(res, {
      id: updated.id,
      paused: false,
      pciPauseEnd: now,
      pauseSegments: updated.pciPauseSegments ?? [],
    });
  } catch (e) {
    log.error({ err: e.message }, 'recording resume');
    return fail(res, 'INTERNAL_ERROR', 'Failed', 500);
  }
});

app.get('/v1/recordings/:id/url', auth, (req, res) => {
  const r = (store.load().recordings ?? []).find((x) => x.id === req.params.id);
  if (!r) return fail(res, 'NOT_FOUND', 'Recording not found', 404);
  const ttl = Math.min(300, Math.max(60, parseInt(req.query.ttl_sec || '300', 10)));
  const token = sign(r.id, ttl);
  ok(res, { recordingId: r.id, url: `/api/recordings/v1/play/${token}`, expiresInSec: ttl });
});

app.get('/v1/play/:token', (req, res) => {
  const id = verify(req.params.token);
  if (!id) return fail(res, 'UNAUTHORIZED', 'Invalid or expired token', 401);
  const r = (store.load().recordings ?? []).find((x) => x.id === id);
  if (!r) return fail(res, 'NOT_FOUND', 'Recording not found', 404);
  ok(res, { recordingId: r.id, storageBackend: r.storageBackend, storageKey: r.storageKey });
});

app.use(errorHandler(log));
const server = app.listen(PORT, '0.0.0.0', () =>
  log.info({ port: PORT, storage: STORAGE, minioStub: process.env.MINIO_STUB }, 'recording started'),
);
gracefulShutdown(server, log);
