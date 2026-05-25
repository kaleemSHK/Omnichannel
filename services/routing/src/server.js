import express from 'express';
import { createLogger } from '../lib/logger.js';
import { createStore } from '../lib/store.js';
import { ok, fail, bearerAuth, requestId, errorHandler, healthRouter, gracefulShutdown } from '../lib/http.js';
import { dbEnabled, runMigrations, closePool, getPool } from '../lib/db.js';
import { redisEnabled, connectRedis, closeRedis } from '../lib/redis-state.js';
import { resolveTenantId } from '../lib/tenant.js';
import { requireFeature } from '../_shared/lib/features.js';
import { tenantSuspendedMiddleware } from '../lib/tenant-guard.js';
import * as queueRepo from '../lib/queue-repo.js';
import * as agentRepo from '../lib/agent-repo.js';
import { handleRouteRequest, processQueue } from '../lib/route-request.js';
import { assignCall } from '../lib/route-assign.js';
import { completeCall } from '../lib/route-complete.js';
import { getRealtimeDashboard } from '../lib/dashboards.js';
import { getAgentReports } from '../lib/reports.js';
import { superviseSetMode, listSuperviseSessions } from '../lib/supervise.js';
import { getQueueStats, listAgentStates } from '../lib/redis-state.js';
import { startQueueWorker } from '../lib/queue-worker.js';
import { attachRealtimeWs } from '../lib/realtime-ws.js';

const log = createLogger('routing');
const PORT = parseInt(process.env.PORT || '8798', 10);
const TOKEN = (process.env.TOKEN || '').trim();
const AGENT_TIMEOUT = parseInt(process.env.AGENT_TIMEOUT_SEC || '60', 10) * 1000;

const fileStore = createStore(process.env.DATA_DIR || './data', { agents: {}, cursors: {} });
const auth = bearerAuth(TOKEN);
const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '512kb' }));
app.use(requestId);
healthRouter(app, 'routing');
app.use(tenantSuspendedMiddleware(resolveTenantId, fail));

const telephonyFeature = requireFeature('telephony', resolveTenantId, fail);
function telephonyWrite(req, res, next) {
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') return next();
  return telephonyFeature(req, res, next);
}

const STATUSES = ['available', 'busy', 'away', 'offline'];

function useDbRedis() {
  return dbEnabled() && redisEnabled();
}

function pruneFileAgents(s) {
  const now = Date.now();
  for (const [k, a] of Object.entries(s.agents ?? {})) {
    if (now - new Date(a.updatedAt).getTime() > AGENT_TIMEOUT) delete s.agents[k];
  }
}

app.get('/readyz', async (_req, res) => {
  const out = { status: 'ready', db: false, redis: false };
  if (dbEnabled()) {
    try {
      await getPool().query('SELECT 1');
      out.db = true;
    } catch (e) {
      return res.status(503).json({ ...out, status: 'not_ready', error: e.message });
    }
  }
  if (redisEnabled()) {
    try {
      await connectRedis(log);
      out.redis = true;
    } catch (e) {
      return res.status(503).json({ ...out, status: 'not_ready', error: e.message });
    }
  }
  return res.json(out);
});

// ─── Queues (Postgres) ───────────────────────────────────────────────────────
app.get('/v1/queues', async (req, res) => {
  if (!dbEnabled()) return fail(res, 'NOT_CONFIGURED', 'Postgres required for queues', 501);
  try {
    return ok(res, await queueRepo.listQueues(resolveTenantId(req)));
  } catch (e) {
    log.error({ err: e.message }, 'list queues');
    return fail(res, 'INTERNAL_ERROR', 'Failed to list queues', 500);
  }
});

app.get('/v1/queues/:id', async (req, res) => {
  if (!dbEnabled()) return fail(res, 'NOT_CONFIGURED', 'Postgres required', 501);
  const q = await queueRepo.getQueue(resolveTenantId(req), req.params.id);
  return q ? ok(res, q) : fail(res, 'NOT_FOUND', 'Queue not found', 404);
});

app.post('/v1/queues', auth, telephonyWrite, async (req, res) => {
  if (!dbEnabled()) return fail(res, 'NOT_CONFIGURED', 'Postgres required', 501);
  const { queueKey, key, name, skills, selectionAlgorithm, maxWaitSec, maxDepth, overflowQueueId, config } =
    req.body ?? {};
  const qk = (queueKey ?? key ?? '').trim();
  if (!qk || !name?.trim()) return fail(res, 'VALIDATION_ERROR', 'queueKey and name required');
  try {
    const q = await queueRepo.createQueue(resolveTenantId(req), {
      queueKey: qk,
      name: name.trim(),
      skills: skills ?? [],
      selectionAlgorithm,
      maxWaitSec,
      maxDepth,
      overflowQueueId,
      config,
    });
    return ok(res, q, 201);
  } catch (e) {
    if (e.code === '23505') return fail(res, 'CONFLICT', 'Queue key already exists', 409);
    log.error({ err: e.message }, 'create queue');
    return fail(res, 'INTERNAL_ERROR', 'Failed to create queue', 500);
  }
});

app.patch('/v1/queues/:id', auth, telephonyWrite, async (req, res) => {
  if (!dbEnabled()) return fail(res, 'NOT_CONFIGURED', 'Postgres required', 501);
  const updated = await queueRepo.patchQueue(resolveTenantId(req), req.params.id, req.body ?? {});
  return updated ? ok(res, updated) : fail(res, 'NOT_FOUND', 'Queue not found', 404);
});

app.get('/v1/queues/:id/stats', auth, async (req, res) => {
  const tenantId = resolveTenantId(req);
  if (dbEnabled()) {
    const q = await queueRepo.getQueue(tenantId, req.params.id);
    if (!q) return fail(res, 'NOT_FOUND', 'Queue not found', 404);
    const live = redisEnabled() ? await getQueueStats(tenantId, q.queueKey) : { waiting: 0, calls: [] };
    const agents = redisEnabled() ? await listAgentStates(tenantId) : [];
    const forQueue = agents.filter(
      (a) => a.queueKeys?.includes(q.queueKey) || !a.queueKeys?.length,
    );
    return ok(res, {
      queueId: q.id,
      queueKey: q.queueKey,
      waiting: live.waiting,
      calls: live.calls,
      agents: {
        available: forQueue.filter((a) => a.status === 'available').length,
        busy: forQueue.filter((a) => a.status === 'busy').length,
        total: forQueue.length,
      },
    });
  }
  const s = fileStore.load();
  pruneFileAgents(s);
  const agents = Object.values(s.agents).filter((a) => a.queue === req.params.id);
  return ok(res, {
    queue: req.params.id,
    available: agents.filter((a) => a.status === 'available').length,
    busy: agents.filter((a) => a.status === 'busy').length,
    total: agents.length,
  });
});

// Stats by queue key (legacy path)
app.get('/v1/queues/key/:queueKey/stats', auth, async (req, res) => {
  const tenantId = resolveTenantId(req);
  const queueKey = req.params.queueKey;
  if (!dbEnabled()) {
    const s = fileStore.load();
    pruneFileAgents(s);
    const agents = Object.values(s.agents).filter((a) => a.queue === queueKey);
    return ok(res, {
      queue: queueKey,
      available: agents.filter((a) => a.status === 'available').length,
      busy: agents.filter((a) => a.status === 'busy').length,
      total: agents.length,
    });
  }
  const q = await queueRepo.getQueueByKey(tenantId, queueKey);
  if (!q) return fail(res, 'NOT_FOUND', 'Queue not found', 404);
  const live = await getQueueStats(tenantId, queueKey);
  return ok(res, { queueId: q.id, queueKey, waiting: live.waiting, calls: live.calls });
});

// ─── Agents ───────────────────────────────────────────────────────────────────
app.get('/v1/agents', auth, async (req, res) => {
  const tenantId = resolveTenantId(req);
  if (useDbRedis()) {
    try {
      return ok(res, await agentRepo.listAgents(tenantId));
    } catch (e) {
      log.error({ err: e.message }, 'list agents');
      return fail(res, 'INTERNAL_ERROR', 'Failed to list agents', 500);
    }
  }
  const s = fileStore.load();
  pruneFileAgents(s);
  let agents = Object.values(s.agents ?? {});
  if (req.query.tenant_id) agents = agents.filter((a) => String(a.tenantId) === String(req.query.tenant_id));
  return ok(res, agents);
});

app.get('/v1/agents/:agentId', auth, async (req, res) => {
  const tenantId = resolveTenantId(req);
  if (useDbRedis()) {
    const a = await agentRepo.getAgent(tenantId, req.params.agentId);
    return a ? ok(res, a) : fail(res, 'NOT_FOUND', 'Agent not found', 404);
  }
  const s = fileStore.load();
  const a = s.agents?.[`${tenantId}:${req.params.agentId}`];
  return a ? ok(res, a) : fail(res, 'NOT_FOUND', 'Agent not found', 404);
});

/** JsSIP WebRTC credentials for browser PSTN leg */
app.get('/v1/agents/:agentId/webrtc', auth, async (req, res) => {
  const tenantId = resolveTenantId(req);
  const agentId = req.params.agentId;
  const requester = req.headers['x-blinkone-user-id'] || req.query.requester_id;
  const roles = (req.headers['x-blinkone-roles'] || '').split(',').filter(Boolean);
  const isSupervisor = roles.some((r) => ['admin', 'supervisor', 'platform_admin'].includes(r));
  if (requester && String(requester) !== String(agentId) && !isSupervisor) {
    return fail(res, 'FORBIDDEN', 'Cannot fetch credentials for another agent', 403);
  }
  const domain = process.env.AST_WSS_DOMAIN || 'blinkone.local';
  const wsUri = process.env.AST_WSS_URI || 'wss://localhost/telephony/wss';
  const stunRaw = process.env.STUN_SERVERS || 'stun:stun.l.google.com:19302';
  const turnServer = process.env.TURN_SERVER || '';
  return ok(res, {
    agentId,
    tenantId,
    wsUri,
    sipUri: `sip:${agentId}@${domain}`,
    password: process.env.AST_AGENT_SIP_PASS || 'blinkone-agent-dev',
    stunServers: stunRaw.split(',').map((s) => s.trim()).filter(Boolean),
    turnServers: turnServer
      ? [{ urls: turnServer, username: process.env.TURN_USER || '', credential: process.env.TURN_PASS || '' }]
      : [],
  });
});

app.post('/v1/agents', auth, telephonyWrite, async (req, res) => {
  const tenantId = resolveTenantId(req);
  const { agentId, displayName, chatwootUserId, skills, queueKeys, status } = req.body ?? {};
  if (!agentId?.trim()) return fail(res, 'VALIDATION_ERROR', 'agentId required');

  if (useDbRedis()) {
    try {
      const a = await agentRepo.createAgent(tenantId, {
        agentId: agentId.trim(),
        displayName,
        chatwootUserId,
        skills: skills ?? [],
        queueKeys: queueKeys ?? [],
        status: status ?? 'offline',
      });
      return ok(res, a, 201);
    } catch (e) {
      if (e.code === '23505') return fail(res, 'CONFLICT', 'Agent already registered', 409);
      return fail(res, 'INTERNAL_ERROR', e.message, 500);
    }
  }

  const agent = await fileStore.withStore((s) => {
    const key = `${tenantId}:${agentId.trim()}`;
    const row = {
      agentId: agentId.trim(),
      tenantId,
      status: status ?? 'available',
      skills: skills ?? [],
      queue: queueKeys?.[0] ?? null,
      updatedAt: new Date().toISOString(),
    };
    s.agents = s.agents ?? {};
    s.agents[key] = row;
    return row;
  });
  return ok(res, agent, 201);
});

app.patch('/v1/agents/:agentId', auth, telephonyWrite, async (req, res) => {
  const tenantId = resolveTenantId(req);
  if (useDbRedis()) {
    const a = await agentRepo.patchAgent(tenantId, req.params.agentId, req.body ?? {});
    return a ? ok(res, a) : fail(res, 'NOT_FOUND', 'Agent not found', 404);
  }
  return fail(res, 'NOT_CONFIGURED', 'Postgres required', 501);
});

app.post('/v1/agents/:agentId/state', auth, telephonyWrite, async (req, res) => {
  const tenantId = resolveTenantId(req);
  const agentId = req.params.agentId;
  const { status, skills, queueKeys, currentCallId, occupancy } = req.body ?? {};

  if (useDbRedis()) {
    try {
      const live = await agentRepo.updateAgentLiveState(tenantId, agentId, {
        status,
        skills,
        queueKeys,
        currentCallId,
        occupancy,
      });
      if (!live) {
        const registered = await agentRepo.createAgent(tenantId, {
          agentId,
          skills: skills ?? [],
          queueKeys: queueKeys ?? [],
          status: status ?? 'available',
        });
        return ok(res, registered);
      }
      return ok(res, live);
    } catch (e) {
      if (e.code === 'VALIDATION_ERROR') return fail(res, 'VALIDATION_ERROR', e.message, 400);
      return fail(res, 'INTERNAL_ERROR', e.message, 500);
    }
  }

  const st = (status || 'available').trim();
  if (!STATUSES.includes(st)) return fail(res, 'VALIDATION_ERROR', `status must be one of: ${STATUSES.join(', ')}`);
  ok(
    res,
    await fileStore.withStore((s) => {
      const key = `${tenantId}:${agentId}`;
      const agent = {
        agentId,
        tenantId,
        status: st,
        skills: Array.isArray(skills) ? skills.filter((x) => typeof x === 'string') : [],
        queue: (req.body?.queue || '').trim() || null,
        updatedAt: new Date().toISOString(),
      };
      s.agents = s.agents ?? {};
      s.agents[key] = agent;
      return agent;
    }),
  );
});

// ─── Routing (step 4: enqueue; step 5: assign/select) ─────────────────────────
app.post('/v1/route/request', auth, telephonyWrite, async (req, res) => {
  if (!useDbRedis()) {
    return fail(res, 'NOT_CONFIGURED', 'Postgres + Redis required for route/request', 501);
  }
  try {
    const result = await handleRouteRequest(resolveTenantId(req), req.body ?? {});
    return ok(res, result, 202);
  } catch (e) {
    if (e.code === 'VALIDATION_ERROR') return fail(res, 'VALIDATION_ERROR', e.message, 400);
    if (e.code === 'NOT_FOUND') return fail(res, 'NOT_FOUND', e.message, 404);
    if (e.code === 'QUEUE_FULL') return fail(res, 'QUEUE_FULL', e.message, 503);
    log.error({ err: e.message }, 'route request');
    return fail(res, 'INTERNAL_ERROR', 'Route request failed', 500);
  }
});

app.post('/v1/route/assign', auth, telephonyWrite, async (req, res) => {
  if (!useDbRedis()) return fail(res, 'NOT_CONFIGURED', 'Postgres + Redis required', 501);
  try {
    const tenantId = resolveTenantId(req);
    const body = req.body ?? {};
    const result = body.processQueue
      ? await processQueue(tenantId, body.queueKey ?? body.queue ?? 'default')
      : await assignCall(tenantId, body);
    return ok(res, result);
  } catch (e) {
    if (e.code === 'NOT_FOUND') return fail(res, 'NOT_FOUND', e.message, 404);
    if (e.code === 'NO_AGENT' || e.code === 'NO_CALL') return fail(res, 'UNAVAILABLE', e.message, 409);
    if (e.code === 'AGENT_UNAVAILABLE') return fail(res, 'CONFLICT', e.message, 409);
    log.error({ err: e.message }, 'route assign');
    return fail(res, 'INTERNAL_ERROR', e.message, 500);
  }
});

app.post('/v1/route/complete', auth, telephonyWrite, async (req, res) => {
  if (!useDbRedis()) return fail(res, 'NOT_CONFIGURED', 'Postgres + Redis required', 501);
  try {
    const result = await completeCall(resolveTenantId(req), req.body ?? {});
    return ok(res, result);
  } catch (e) {
    log.error({ err: e.message }, 'route complete');
    return fail(res, 'INTERNAL_ERROR', e.message, 500);
  }
});

app.post('/v1/route/process-queue', auth, telephonyWrite, async (req, res) => {
  if (!useDbRedis()) return fail(res, 'NOT_CONFIGURED', 'Postgres + Redis required', 501);
  try {
    const qk = req.body?.queueKey ?? req.body?.queue ?? 'default';
    const result = await processQueue(resolveTenantId(req), qk);
    return ok(res, result);
  } catch (e) {
    if (e.code === 'NOT_FOUND') return fail(res, 'NOT_FOUND', e.message, 404);
    if (e.code === 'NO_AGENT' || e.code === 'NO_CALL') return ok(res, { status: 'no_action', reason: e.message });
    return fail(res, 'INTERNAL_ERROR', e.message, 500);
  }
});

// ─── Dashboards (step 8) ─────────────────────────────────────────────────────
app.get('/v1/dashboards/realtime', auth, async (req, res) => {
  if (!useDbRedis()) return fail(res, 'NOT_CONFIGURED', 'Redis required', 501);
  try {
    return ok(res, await getRealtimeDashboard(resolveTenantId(req)));
  } catch (e) {
    return fail(res, 'INTERNAL_ERROR', e.message, 500);
  }
});

app.get('/v1/reports/agents', auth, async (req, res) => {
  if (!dbEnabled()) return fail(res, 'NOT_CONFIGURED', 'Postgres required', 501);
  try {
    return ok(res, await getAgentReports(resolveTenantId(req), req.query));
  } catch (e) {
    return fail(res, 'INTERNAL_ERROR', e.message, 500);
  }
});

// ─── Supervisor (step 7) ─────────────────────────────────────────────────────
app.get('/v1/supervise/sessions', auth, async (req, res) => {
  if (!useDbRedis()) return fail(res, 'NOT_CONFIGURED', 'Redis required', 501);
  try {
    return ok(res, await listSuperviseSessions(resolveTenantId(req)));
  } catch (e) {
    return fail(res, 'INTERNAL_ERROR', e.message, 500);
  }
});

app.post('/v1/supervise/:callId/mode', auth, telephonyWrite, async (req, res) => {
  if (!useDbRedis()) return fail(res, 'NOT_CONFIGURED', 'Redis required', 501);
  const mode = (req.body?.mode || '').trim();
  if (!['listen', 'whisper', 'barge'].includes(mode)) {
    return fail(res, 'VALIDATION_ERROR', 'mode must be listen, whisper, or barge', 400);
  }
  try {
    const tenantId = resolveTenantId(req);
    const result = await superviseSetMode(tenantId, req.params.callId, {
      mode,
      supervisorId: req.body?.supervisorId ?? req.headers['x-blinkone-user-id'],
      supervisorTenantId: req.headers['x-blinkone-tenant-id'] ?? req.body?.supervisorTenantId,
    });
    return ok(res, result);
  } catch (e) {
    if (e.code === 'NOT_FOUND') return fail(res, 'NOT_FOUND', e.message, 404);
    if (e.code === 'FORBIDDEN') return fail(res, 'FORBIDDEN', e.message, 403);
    return fail(res, 'INTERNAL_ERROR', e.message, 500);
  }
});

/** Legacy round-robin (file store dev fallback). */
app.post('/v1/route', auth, telephonyWrite, async (req, res) => {
  const { tenantId = 0, queue, skills = [] } = req.body ?? {};
  const agent = await fileStore.withStore((s) => {
    pruneFileAgents(s);
    let pool = Object.values(s.agents ?? {}).filter(
      (a) => a.status === 'available' && a.tenantId === Number(tenantId),
    );
    if (queue) pool = pool.filter((a) => !a.queue || a.queue === queue);
    if (skills.length) pool = pool.filter((a) => skills.every((sk) => a.skills.includes(sk)));
    if (!pool.length) return null;
    const curKey = `${tenantId}:${queue || 'default'}`;
    s.cursors = s.cursors ?? {};
    const idx = (s.cursors[curKey] ?? 0) % pool.length;
    s.cursors[curKey] = idx + 1;
    const chosen = pool[idx];
    const key = `${chosen.tenantId}:${chosen.agentId}`;
    if (s.agents[key]) {
      s.agents[key].status = 'busy';
      s.agents[key].updatedAt = new Date().toISOString();
    }
    return chosen;
  });
  ok(res, { agent: agent ?? null, matched: !!agent });
});

app.use(errorHandler(log));

async function boot() {
  if (dbEnabled()) {
    await runMigrations(log);
    await queueRepo.ensureDefaultQueues(process.env.ROUTING_DEFAULT_TENANT || 'default');
    log.info('routing Postgres ready');
  } else {
    log.warn('BLINKONE_DATABASE_URL not set — queue model disabled');
  }

  if (redisEnabled()) {
    await connectRedis(log);
    log.info('routing Redis ready');
    startQueueWorker(parseInt(process.env.ROUTING_QUEUE_TICK_MS || '5000', 10));
  } else {
    log.warn('REDIS_URL not set — live agent/queue state disabled');
  }

  const server = app.listen(PORT, '0.0.0.0', () => {
    log.info({ port: PORT, db: dbEnabled(), redis: redisEnabled() }, 'routing started');
  });
  attachRealtimeWs(server, log);

  process.on('SIGTERM', async () => {
    await closeRedis();
    await closePool();
  });

  gracefulShutdown(server, log);
}

boot().catch((e) => {
  log.error(e);
  process.exit(1);
});
