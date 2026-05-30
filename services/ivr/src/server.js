import express from 'express';
import { randomUUID } from 'node:crypto';
import { createLogger } from '../lib/logger.js';
import { createStore } from '../lib/store.js';
import { ok, fail, bearerAuth, requestId, errorHandler, healthRouter, gracefulShutdown } from '../lib/http.js';
import { mountMetrics } from '../_shared/lib/metrics-middleware.js';
import { callState, startAriApp } from './ari-app.js';
import { bridgeCallToAgent } from './bridge.js';
import { applySuperviseMode } from './supervise.js';
import { dbEnabled, runMigrations, closePool, getPool } from '../lib/db.js';
import { resolveTenantId } from '../lib/tenant.js';
import { requireFeature } from '../_shared/lib/features.js';
import { validateGraph } from '../lib/graph.js';
import * as flowRepo from '../lib/flow-repo.js';
import { twilioVoicebotRouter } from '../lib/twilio-voicebot.js';

const log   = createLogger('ivr');
const PORT  = parseInt(process.env.PORT || '8795', 10);
const TOKEN = (process.env.TOKEN || '').trim();

const defaultFlow = {
  id: 1,
  name: 'Default IVR',
  graph: flowRepo.DEFAULT_GRAPH,
  versions: [{ version: 1, graph: flowRepo.DEFAULT_GRAPH, createdAt: new Date().toISOString() }],
  activeVersion: 1,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};
const fileStore = createStore(process.env.DATA_DIR || './data', () => ({
  flows: [defaultFlow],
  routeLog: [],
  seq: { next: 2 },
}));

const auth = bearerAuth(TOKEN);
const telephonyFeature = requireFeature('telephony', resolveTenantId, fail);
const app  = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '2mb' }));
app.use(requestId);
healthRouter(app, 'ivr');
mountMetrics(app, 'ivr');

app.use(twilioVoicebotRouter);

app.get('/readyz', async (_req, res) => {
  if (!dbEnabled()) return res.json({ status: 'ready', db: false });
  try {
    await getPool().query('SELECT 1');
    return res.json({ status: 'ready', db: true });
  } catch (e) {
    return res.status(503).json({ status: 'not_ready', db: false, error: e.message });
  }
});

// ─── File-store fallback (no BLINKONE_DATABASE_URL) ───────────────────────────
function fileListFlows() {
  return fileStore.load().flows.map((f) => {
    const ver = f.versions?.find((v) => v.version === f.activeVersion) ?? f.versions?.[0];
    return { ...f, graph: ver?.graph ?? f.graph, activeVersion: ver?.version ?? 1 };
  });
}

function fileGetFlow(id) {
  return fileListFlows().find((x) => String(x.id) === String(id)) ?? null;
}

// ─── Flows API ────────────────────────────────────────────────────────────────
app.get('/v1/flows', async (req, res) => {
  const tenantId = resolveTenantId(req);
  if (dbEnabled()) {
    try {
      return ok(res, await flowRepo.listFlows(tenantId));
    } catch (e) {
      log.error({ err: e.message }, 'list flows');
      return fail(res, 'INTERNAL_ERROR', 'Failed to list flows', 500);
    }
  }
  return ok(res, fileListFlows());
});

app.get('/v1/flows/:id', async (req, res) => {
  const tenantId = resolveTenantId(req);
  if (dbEnabled()) {
    try {
      const f = await flowRepo.getFlow(tenantId, req.params.id);
      return f ? ok(res, f) : fail(res, 'NOT_FOUND', 'Flow not found', 404);
    } catch (e) {
      log.error({ err: e.message, id: req.params.id }, 'get flow');
      return fail(res, 'INTERNAL_ERROR', 'Failed to load flow', 500);
    }
  }
  const f = fileGetFlow(req.params.id);
  return f ? ok(res, f) : fail(res, 'NOT_FOUND', 'Flow not found', 404);
});

app.post('/v1/flows', auth, telephonyFeature, async (req, res) => {
  const { name, description, graph } = req.body ?? {};
  if (!name?.trim()) return fail(res, 'VALIDATION_ERROR', 'name required');
  const gErr = validateGraph(graph);
  if (gErr) return fail(res, 'VALIDATION_ERROR', gErr);

  const tenantId = resolveTenantId(req);
  if (dbEnabled()) {
    try {
      const { flow, version } = await flowRepo.createFlow(tenantId, {
        name: name.trim(),
        description,
        graph,
        createdBy: req.headers['x-blinkone-user-id'] ?? null,
      });
      return ok(res, { ...flow, graph, createdVersion: version }, 201);
    } catch (e) {
      if (e.code === '23505') return fail(res, 'CONFLICT', 'Flow name already exists', 409);
      log.error({ err: e.message }, 'create flow');
      return fail(res, 'INTERNAL_ERROR', 'Failed to create flow', 500);
    }
  }

  const created = await fileStore.withStore((s) => {
    const f = {
      id: s.seq.next++,
      tenantId,
      name: name.trim(),
      graph,
      versions: [{ version: 1, graph, createdAt: new Date().toISOString() }],
      activeVersion: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    s.flows.push(f);
    return f;
  });
  return ok(res, created, 201);
});

app.patch('/v1/flows/:id', auth, telephonyFeature, async (req, res) => {
  if (req.body?.graph) {
    return fail(
      res,
      'VALIDATION_ERROR',
      'graph is immutable — POST /v1/flows/{id}/versions to publish a new version',
      400,
    );
  }

  const tenantId = resolveTenantId(req);
  const { name, description, isDefault, activeVersionId } = req.body ?? {};

  if (dbEnabled()) {
    try {
      const updated = await flowRepo.patchFlow(tenantId, req.params.id, {
        name: name?.trim(),
        description,
        isDefault,
        activeVersionId,
      });
      if (!updated) return fail(res, 'NOT_FOUND', 'Flow not found', 404);
      return ok(res, updated);
    } catch (e) {
      if (e.code === 'VERSION_NOT_FOUND') return fail(res, 'NOT_FOUND', e.message, 404);
      log.error({ err: e.message }, 'patch flow');
      return fail(res, 'INTERNAL_ERROR', 'Failed to update flow', 500);
    }
  }

  try {
    const f = await fileStore.withStore((s) => {
      const flow = s.flows.find((x) => String(x.id) === String(req.params.id));
      if (!flow) throw Object.assign(new Error(), { code: 404 });
      if (name) flow.name = name.trim();
      if (description !== undefined) flow.description = description;
      flow.updatedAt = new Date().toISOString();
      return flow;
    });
    return ok(res, f);
  } catch (e) {
    if (e.code === 404) return fail(res, 'NOT_FOUND', 'Flow not found', 404);
    return fail(res, 'INTERNAL_ERROR', 'Failed', 500);
  }
});

app.get('/v1/flows/:id/versions', async (req, res) => {
  const tenantId = resolveTenantId(req);
  if (dbEnabled()) {
    const versions = await flowRepo.listVersions(tenantId, req.params.id);
    if (versions === null) return fail(res, 'NOT_FOUND', 'Flow not found', 404);
    return ok(res, versions);
  }
  const f = fileGetFlow(req.params.id);
  if (!f) return fail(res, 'NOT_FOUND', 'Flow not found', 404);
  return ok(res, f.versions ?? []);
});

app.get('/v1/flows/:id/versions/:version', async (req, res) => {
  const tenantId = resolveTenantId(req);
  const verNum = parseInt(req.params.version, 10);
  if (!Number.isFinite(verNum)) return fail(res, 'VALIDATION_ERROR', 'version must be a number', 400);

  if (dbEnabled()) {
    const v = await flowRepo.getVersion(tenantId, req.params.id, verNum);
    return v ? ok(res, v) : fail(res, 'NOT_FOUND', 'Version not found', 404);
  }
  const f = fileGetFlow(req.params.id);
  const v = f?.versions?.find((x) => x.version === verNum);
  return v ? ok(res, v) : fail(res, 'NOT_FOUND', 'Version not found', 404);
});

app.post('/v1/flows/:id/versions', auth, telephonyFeature, async (req, res) => {
  const { graph, comment, setActive } = req.body ?? {};
  const gErr = validateGraph(graph);
  if (gErr) return fail(res, 'VALIDATION_ERROR', gErr);

  const tenantId = resolveTenantId(req);
  if (dbEnabled()) {
    try {
      const result = await flowRepo.createVersion(tenantId, req.params.id, {
        graph,
        comment,
        setActive: setActive !== false,
        createdBy: req.headers['x-blinkone-user-id'] ?? null,
      });
      if (!result) return fail(res, 'NOT_FOUND', 'Flow not found', 404);
      return ok(res, result, 201);
    } catch (e) {
      log.error({ err: e.message }, 'create version');
      return fail(res, 'INTERNAL_ERROR', 'Failed to save version', 500);
    }
  }

  try {
    const out = await fileStore.withStore((s) => {
      const flow = s.flows.find((x) => String(x.id) === String(req.params.id));
      if (!flow) throw Object.assign(new Error(), { code: 404 });
      flow.versions = flow.versions ?? [];
      const next = (flow.versions.at(-1)?.version ?? 0) + 1;
      const row = { version: next, graph, comment, createdAt: new Date().toISOString() };
      flow.versions.push(row);
      if (setActive !== false) {
        flow.activeVersion = next;
        flow.graph = graph;
      }
      flow.updatedAt = new Date().toISOString();
      return { version: row, flow };
    });
    return ok(res, out, 201);
  } catch (e) {
    if (e.code === 404) return fail(res, 'NOT_FOUND', 'Flow not found', 404);
    return fail(res, 'INTERNAL_ERROR', 'Failed', 500);
  }
});

// Publish = snapshot the flow's current active graph as a new active version.
// The frontend's Publish button hits this; an optional `graph` in the body lets
// callers publish edited content, otherwise the current active graph is promoted.
app.post('/v1/flows/:id/publish', auth, telephonyFeature, async (req, res) => {
  const tenantId = resolveTenantId(req);
  const bodyGraph = req.body && typeof req.body === 'object' ? req.body.graph : undefined;

  if (dbEnabled()) {
    try {
      const flow = await flowRepo.getFlow(tenantId, req.params.id);
      if (!flow) return fail(res, 'NOT_FOUND', 'Flow not found', 404);

      const graph = bodyGraph ?? flow.graph ?? flowRepo.DEFAULT_GRAPH;
      const gErr = validateGraph(graph);
      if (gErr) return fail(res, 'VALIDATION_ERROR', gErr);

      const result = await flowRepo.createVersion(tenantId, req.params.id, {
        graph,
        comment: 'Published',
        setActive: true,
        createdBy: req.headers['x-blinkone-user-id'] ?? null,
      });
      if (!result) return fail(res, 'NOT_FOUND', 'Flow not found', 404);
      return ok(res, result.flow ?? result);
    } catch (e) {
      log.error({ err: e.message, id: req.params.id }, 'publish flow');
      return fail(res, 'INTERNAL_ERROR', 'Failed to publish flow', 500);
    }
  }

  // File-store fallback: mark the flow active.
  try {
    const out = await fileStore.withStore((s) => {
      const flow = s.flows.find((x) => String(x.id) === String(req.params.id));
      if (!flow) throw Object.assign(new Error(), { code: 404 });
      flow.updatedAt = new Date().toISOString();
      return flow;
    });
    return ok(res, out);
  } catch (e) {
    if (e.code === 404) return fail(res, 'NOT_FOUND', 'Flow not found', 404);
    return fail(res, 'INTERNAL_ERROR', 'Failed to publish flow', 500);
  }
});

app.post('/v1/route', auth, async (req, res) => {
  const { flowId, digit, callerId } = req.body ?? {};
  const tenantId = resolveTenantId(req);
  let flow;
  if (dbEnabled()) {
    flow = flowId
      ? await flowRepo.getFlow(tenantId, flowId)
      : (await flowRepo.listFlows(tenantId)).find((f) => f.isDefault);
  } else {
    const s = fileStore.load();
    flow = s.flows.find((f) => String(f.id) === String(flowId)) ?? s.flows[0];
  }
  if (!flow?.graph) return fail(res, 'NOT_FOUND', 'No IVR flow found', 404);

  let node = flow.graph.nodes.find((n) => n.id === flow.graph.entry);
  if (digit) {
    const dn = flow.graph.nodes.find((n) => n.digit === String(digit));
    if (dn) node = dn;
  }
  const decision = {
    flowId: flow.id,
    node: node?.id,
    type: node?.type,
    queue: node?.queue ?? null,
    decidedAt: new Date().toISOString(),
    callerId,
  };
  if (!dbEnabled()) {
    await fileStore.withStore((ss) => {
      ss.routeLog = ss.routeLog ?? [];
      ss.routeLog.push(decision);
      if (ss.routeLog.length > 100) ss.routeLog = ss.routeLog.slice(-100);
    });
  }
  log.info({ node: node?.id, type: node?.type }, 'route decision');
  ok(res, decision);
});

app.get('/v1/route-log', auth, (_req, res) => {
  if (dbEnabled()) return ok(res, []);
  return ok(res, (fileStore.load().routeLog ?? []).slice().reverse());
});

app.post('/v1/supervise', auth, async (req, res) => {
  const { callId, mode, supervisorId } = req.body ?? {};
  if (!callId || !mode) return fail(res, 'VALIDATION_ERROR', 'callId and mode required');
  try {
    return ok(res, await applySuperviseMode({ callId, mode, supervisorId }));
  } catch (e) {
    if (e.code === 'NOT_FOUND') return fail(res, 'NOT_FOUND', e.message, 404);
    return fail(res, 'INTERNAL_ERROR', e.message, 500);
  }
});

app.post('/v1/bridge', auth, async (req, res) => {
  const { callId, agentId, queueKey } = req.body ?? {};
  if (!callId || !agentId) return fail(res, 'VALIDATION_ERROR', 'callId and agentId required');
  try {
    const result = await bridgeCallToAgent({ callId, agentId, queueKey });
    return ok(res, result);
  } catch (e) {
    if (e.code === 'NOT_FOUND') return fail(res, 'NOT_FOUND', e.message, 404);
    log.error({ err: e.message }, 'bridge');
    return fail(res, 'INTERNAL_ERROR', e.message, 500);
  }
});

app.get('/v1/calls/:callId/state', auth, (req, res) => {
  const state = callState.get(req.params.callId);
  return state ? ok(res, state) : fail(res, 'NOT_FOUND', 'Call not found or ended', 404);
});

// ─── Time-of-Day Routing helpers (C50) ───────────────────────────────────────

/** Gulf Standard Time offset: UTC+4 */
const GULF_OFFSET_MS = 4 * 60 * 60 * 1000;

/**
 * Business hours: Sunday–Thursday, 08:00–18:00 Gulf time.
 * Returns { open: boolean, nextOpen: ISO string }.
 */
function getBusinessHoursStatus() {
  const nowUtc = Date.now();
  const gulfMs = nowUtc + GULF_OFFSET_MS;
  const gulf = new Date(gulfMs);
  const dayOfWeek = gulf.getUTCDay(); // 0=Sun … 6=Sat
  const hour = gulf.getUTCHours();
  const minute = gulf.getUTCMinutes();
  const minuteOfDay = hour * 60 + minute;

  const isWorkDay = dayOfWeek >= 0 && dayOfWeek <= 4; // Sun=0 … Thu=4
  const isWorkHours = minuteOfDay >= 8 * 60 && minuteOfDay < 18 * 60;
  const open = isWorkDay && isWorkHours;

  let nextOpen;
  if (!open) {
    // Calculate next Sunday–Thursday at 08:00 Gulf time
    let daysAhead = 0;
    let candidate = dayOfWeek;
    do {
      daysAhead++;
      candidate = (candidate + 1) % 7;
    } while (candidate > 4 && daysAhead < 7);
    // If currently a work day but outside hours and before 08:00, next open is today at 08:00
    if (isWorkDay && minuteOfDay < 8 * 60) daysAhead = 0;
    const nextOpenGulf = new Date(gulfMs);
    nextOpenGulf.setUTCDate(nextOpenGulf.getUTCDate() + daysAhead);
    nextOpenGulf.setUTCHours(8, 0, 0, 0);
    nextOpen = new Date(nextOpenGulf.getTime() - GULF_OFFSET_MS).toISOString();
  } else {
    nextOpen = null;
  }

  return { open, nextOpen };
}

/**
 * GET /v1/schedule — Returns whether the contact centre is currently open.
 */
app.get('/v1/schedule', async (_req, res) => {
  return ok(res, getBusinessHoursStatus());
});

/**
 * POST /v1/inbound/check-hours — TwiML after-hours gate.
 * Returns TwiML if outside business hours so callers can be informed and disconnected.
 */
app.post('/v1/inbound/check-hours', async (req, res) => {
  const { open } = getBusinessHoursStatus();
  if (open) {
    res.type('text/xml');
    return res.send('<Response/>');
  }
  res.type('text/xml');
  return res.send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say language="ar-SA">شكراً لاتصالك. مكتبنا مغلق حالياً. ساعات العمل من الأحد إلى الخميس، من الثامنة صباحاً حتى السادسة مساءً.</Say>
  <Say>Thank you for calling. Our office is currently closed. Business hours are Sunday through Thursday, 8am to 6pm.</Say>
  <Hangup/>
</Response>`);
});

// ─── Callback Scheduling (C74) ────────────────────────────────────────────────

/** In-memory callback queue — replace with DB persistence in production. */
const callbackQueue = [];

/**
 * POST /v1/callback — Schedule a callback request.
 */
app.post('/v1/callback', auth, async (req, res) => {
  const { phoneNumber, preferredTime, name, reason } = req.body ?? {};
  if (!phoneNumber) return fail(res, 'VALIDATION_ERROR', 'phoneNumber required');
  const tenantId = resolveTenantId(req);
  const cb = {
    id: randomUUID(),
    tenantId,
    phoneNumber,
    preferredTime: preferredTime ?? null,
    name: name ?? null,
    reason: reason ?? null,
    status: 'pending',
    createdAt: new Date().toISOString(),
  };
  callbackQueue.push(cb);
  return ok(res, cb, 201);
});

/**
 * GET /v1/callbacks — List all pending/completed callbacks for the tenant.
 */
app.get('/v1/callbacks', auth, async (req, res) => {
  const tenantId = resolveTenantId(req);
  return ok(res, callbackQueue.filter((c) => String(c.tenantId) === String(tenantId)));
});

/**
 * PATCH /v1/callbacks/:id — Update callback status or details (e.g. mark as completed).
 */
app.patch('/v1/callbacks/:id', auth, async (req, res) => {
  const cb = callbackQueue.find((c) => c.id === req.params.id);
  if (!cb) return fail(res, 'NOT_FOUND', 'Callback not found', 404);
  Object.assign(cb, req.body ?? {});
  return ok(res, cb);
});

// ─── Post-Call Surveys (C144) ─────────────────────────────────────────────────

// In-memory survey store (replace with DB later)
const surveys = new Map(); // tenantId -> []
const surveyResponses = new Map(); // tenantId -> []

app.post('/v1/surveys', auth, async (req, res) => {
  const tenantId = String(resolveTenantId(req));
  const { name, type = 'csat', questions = [] } = req.body ?? {};
  if (!name) return fail(res, 'VALIDATION_ERROR', 'name required');
  const survey = {
    id: randomUUID(),
    tenantId, name, type, questions,
    active: true,
    createdAt: new Date().toISOString(),
  };
  if (!surveys.has(tenantId)) surveys.set(tenantId, []);
  surveys.get(tenantId).push(survey);
  return ok(res, survey, 201);
});

app.get('/v1/surveys', auth, async (req, res) => {
  const tenantId = String(resolveTenantId(req));
  return ok(res, surveys.get(tenantId) ?? []);
});

app.post('/v1/surveys/:id/respond', async (req, res) => {
  // Public — called from IVR DTMF or chat link (tenantId from header or query)
  const { score, comment, conversationId } = req.body ?? {};
  const tenantId = req.headers['x-blinkone-tenant-id'] ?? req.query.tenant ?? req.body?.tenantId ?? 'default';
  const response = {
    id: randomUUID(),
    surveyId: req.params.id,
    tenantId,
    conversationId: conversationId ?? null,
    score: score != null ? Number(score) : null,
    comment: comment ?? null,
    createdAt: new Date().toISOString(),
  };
  if (!surveyResponses.has(String(tenantId))) surveyResponses.set(String(tenantId), []);
  surveyResponses.get(String(tenantId)).push(response);
  return ok(res, response, 201);
});

app.get('/v1/surveys/:id/responses', auth, async (req, res) => {
  const tenantId = String(resolveTenantId(req));
  const all = surveyResponses.get(tenantId) ?? [];
  return ok(res, all.filter(r => r.surveyId === req.params.id));
});

app.get('/v1/surveys/summary', auth, async (req, res) => {
  const tenantId = String(resolveTenantId(req));
  const all = surveyResponses.get(tenantId) ?? [];
  const scored = all.filter(r => r.score != null);
  const avg = scored.length ? scored.reduce((s, r) => s + r.score, 0) / scored.length : null;
  return ok(res, {
    totalResponses: all.length,
    avgScore: avg != null ? Math.round(avg * 10) / 10 : null,
    csatPercent: scored.length ? Math.round(scored.filter(r => r.score >= 4).length / scored.length * 100) : null,
  });
});

// IVR TwiML for post-call survey
app.post('/v1/ivr/survey-twiml', async (req, res) => {
  const { surveyId } = req.query;
  res.type('text/xml');
  res.send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Gather numDigits="1" action="/ivr/v1/ivr/survey-record?surveyId=${surveyId}" method="POST">
    <Say language="ar-SA">كيف تقيّم خدمتنا اليوم؟ اضغط ١ لممتاز، ٢ لجيد، ٣ لمقبول، ٤ لضعيف</Say>
    <Say>Rate our service: Press 1 for Excellent, 2 for Good, 3 for Fair, 4 for Poor</Say>
  </Gather>
  <Hangup/>
</Response>`);
});

app.post('/v1/ivr/survey-record', async (req, res) => {
  const { surveyId } = req.query;
  const digit = req.body?.Digits ?? '';
  const scoreMap = { '1': 5, '2': 4, '3': 3, '4': 2 };
  const score = scoreMap[digit] ?? null;
  if (score && surveyId) {
    const tenantId = req.headers['x-blinkone-tenant-id'] ?? req.query.tenant ?? 'default';
    if (!surveyResponses.has(tenantId)) surveyResponses.set(tenantId, []);
    surveyResponses.get(tenantId).push({
      id: randomUUID(), surveyId, tenantId,
      score, comment: null, conversationId: null,
      createdAt: new Date().toISOString(),
    });
  }
  res.type('text/xml');
  res.send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say language="ar-SA">شكراً لتقييمك. وداعاً.</Say>
  <Say>Thank you for your feedback. Goodbye.</Say>
  <Hangup/>
</Response>`);
});

app.use(errorHandler(log));

const ariEnabled = process.env.ASTERISK_ARI_ENABLED === '1' || process.env.ASTERISK_ARI_ENABLED === 'true';
let ariConnectTimer;

function connectAriWithRetry() {
  startAriApp()
    .then(() => log.info('ARI app running'))
    .catch((err) => {
      log.warn({ err: err.message }, 'ARI connect failed, retry in 5s');
      ariConnectTimer = setTimeout(connectAriWithRetry, 5000);
    });
}

async function boot() {
  if (dbEnabled()) {
    try {
      await runMigrations(log);
      await flowRepo.ensureDefaultFlow(process.env.IVR_DEFAULT_TENANT || 'default');
      log.info('IVR Postgres ready');
    } catch (e) {
      log.error({ err: e.message }, 'database init failed');
      process.exit(1);
    }
  } else {
    log.warn('BLINKONE_DATABASE_URL not set — using file store (dev only)');
  }

  const server = app.listen(PORT, '0.0.0.0', () => {
    log.info({ port: PORT, ariEnabled, db: dbEnabled() }, 'ivr started');
    if (ariEnabled) connectAriWithRetry();
  });

  process.on('SIGTERM', async () => {
    if (ariConnectTimer) clearTimeout(ariConnectTimer);
    await closePool();
  });

  gracefulShutdown(server, log);
}

boot().catch((e) => {
  log.error(e);
  process.exit(1);
});
