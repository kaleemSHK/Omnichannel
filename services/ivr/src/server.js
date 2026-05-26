import express from 'express';
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
    const f = await flowRepo.getFlow(tenantId, req.params.id);
    return f ? ok(res, f) : fail(res, 'NOT_FOUND', 'Flow not found', 404);
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
