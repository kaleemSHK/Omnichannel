import express from 'express';
import { createLogger } from '../lib/logger.js';
import { createStore } from '../lib/store.js';
import { ok, fail, bearerAuth, requestId, errorHandler, healthRouter, gracefulShutdown } from '../lib/http.js';
import { mountMetrics } from '../_shared/lib/metrics-middleware.js';
import { dbEnabled, runMigrations, closePool, getPool } from '../lib/db.js';
import { resolveTenantId } from '../lib/tenant.js';
import { tenantSuspendedMiddleware } from '../lib/tenant-guard.js';
import { requireFeature } from '../_shared/lib/features.js';
import * as repo from '../lib/sla-repo.js';
import { handleChatwootEvent } from '../lib/event-handler.js';
import { startSlaWorker } from '../lib/worker.js';

const log = createLogger('sla');
const PORT = parseInt(process.env.PORT || '8796', 10);
const TOKEN = (process.env.TOKEN || '').trim();

const legacyStore = createStore(process.env.DATA_DIR || './data', () => ({
  policies: [{ id: 1, name: 'Default', firstResponseMinutes: 60, resolveMinutes: 480 }],
  instances: [],
  seq: { nextPolicy: 2, nextInstance: 1 },
}));

const auth = bearerAuth(TOKEN);
const slaFeature = requireFeature('sla', resolveTenantId, fail);
const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '512kb' }));
app.use(requestId);
app.use(tenantSuspendedMiddleware(resolveTenantId, fail));
healthRouter(app, 'sla');
mountMetrics(app, 'sla');

app.get('/readyz', async (_req, res) => {
  if (!dbEnabled()) return res.json({ status: 'ready', db: false });
  try {
    await getPool().query('SELECT 1');
    return res.json({ status: 'ready', db: true });
  } catch (e) {
    return res.status(503).json({ status: 'not_ready', error: e.message });
  }
});

// ─── Postgres API (Prompt 6) ─────────────────────────────────────────────────
app.get('/v1/calendars', auth, slaFeature, async (req, res) => {
  if (!dbEnabled()) return fail(res, 'NOT_CONFIGURED', 'Postgres required', 501);
  return ok(res, await repo.listCalendars(resolveTenantId(req)));
});

app.post('/v1/calendars', auth, slaFeature, async (req, res) => {
  if (!dbEnabled()) return fail(res, 'NOT_CONFIGURED', 'Postgres required', 501);
  const { name } = req.body ?? {};
  if (!name?.trim()) return fail(res, 'VALIDATION_ERROR', 'name required');
  try {
    return ok(res, await repo.createCalendar(resolveTenantId(req), req.body), 201);
  } catch (e) {
    if (e.code === '23505') return fail(res, 'CONFLICT', 'Calendar name exists', 409);
    throw e;
  }
});

app.get('/v1/policies', auth, slaFeature, async (req, res) => {
  if (!dbEnabled()) return legacyPolicies(req, res);
  return ok(res, await repo.listPolicies(resolveTenantId(req)));
});

app.post('/v1/policies', auth, slaFeature, async (req, res) => {
  if (!dbEnabled()) return legacyCreatePolicy(req, res);
  const { name, targets } = req.body ?? {};
  if (!name?.trim()) return fail(res, 'VALIDATION_ERROR', 'name required');
  if (!targets?.length) return fail(res, 'VALIDATION_ERROR', 'targets required');
  try {
    return ok(res, await repo.createPolicy(resolveTenantId(req), req.body), 201);
  } catch (e) {
    if (e.code === '23505') return fail(res, 'CONFLICT', 'Policy name exists', 409);
    log.error(e);
    return fail(res, 'INTERNAL_ERROR', e.message, 500);
  }
});

app.get('/v1/conversations/:id/sla', auth, slaFeature, async (req, res) => {
  if (!dbEnabled()) return fail(res, 'NOT_CONFIGURED', 'Postgres required', 501);
  const tenantId = resolveTenantId(req);
  return ok(res, await repo.listInstancesForConversation(tenantId, Number(req.params.id)));
});

app.get('/v1/dashboard', auth, slaFeature, async (req, res) => {
  if (!dbEnabled()) return fail(res, 'NOT_CONFIGURED', 'Postgres required', 501);
  return ok(res, await repo.getDashboard(resolveTenantId(req)));
});

app.post('/v1/events', slaFeature, async (req, res) => {
  const tenantId = resolveTenantId(req);
  if (dbEnabled()) {
    const result = await handleChatwootEvent(tenantId, req.body ?? {});
    return ok(res, result);
  }
  return ok(res, { handled: false, legacy: true });
});

app.post('/v1/sla/recalculate', auth, slaFeature, async (req, res) => {
  if (!dbEnabled()) return fail(res, 'NOT_CONFIGURED', 'Postgres required', 501);
  return ok(res, { status: 'accepted', message: 'Recalculate queued (stub)' });
});

// Legacy file-store compatibility
function legacyPolicies(req, res) {
  let policies = legacyStore.load().policies;
  if (req.query.chatwoot_account_id) {
    policies = policies.filter((p) => !p.chatwootAccountId || String(p.chatwootAccountId) === String(req.query.chatwoot_account_id));
  }
  ok(res, policies);
}

async function legacyCreatePolicy(req, res) {
  const { name, firstResponseMinutes, resolveMinutes } = req.body ?? {};
  if (!name?.trim()) return fail(res, 'VALIDATION_ERROR', 'name required');
  ok(
    res,
    await legacyStore.withStore((s) => {
      const p = {
        id: s.seq.nextPolicy++,
        name: name.trim(),
        firstResponseMinutes: Number(firstResponseMinutes),
        resolveMinutes: Number(resolveMinutes),
        createdAt: new Date().toISOString(),
      };
      s.policies.push(p);
      return p;
    }),
    201,
  );
}

app.use(errorHandler(log));

async function boot() {
  if (dbEnabled()) {
    await runMigrations(log);
    log.info('SLA Postgres ready');
    startSlaWorker();
  } else {
    log.warn('BLINKONE_DATABASE_URL not set — legacy file store only');
  }
  const server = app.listen(PORT, '0.0.0.0', () => log.info({ port: PORT, db: dbEnabled() }, 'sla started'));
  process.on('SIGTERM', () => closePool());
  gracefulShutdown(server, log);
}

boot().catch((e) => {
  log.error(e);
  process.exit(1);
});
