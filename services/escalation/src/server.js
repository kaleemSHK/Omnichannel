import express from 'express';
import { createLogger } from '../lib/logger.js';
import { createStore } from '../lib/store.js';
import { ok, fail, bearerAuth, requestId, errorHandler, healthRouter, gracefulShutdown } from '../lib/http.js';
import { dbEnabled, runMigrations, closePool, getPool } from '../lib/db.js';
import { requireFeature } from '../_shared/lib/features.js';
import * as repo from '../lib/escalation-repo.js';
import { simulateRule } from '../lib/json-logic-safe.js';
import { processEvent } from '../lib/engine.js';

const log = createLogger('escalation');
const PORT = parseInt(process.env.PORT || '8797', 10);
const TOKEN = (process.env.TOKEN || '').trim();

const legacyStore = createStore(process.env.DATA_DIR || './data', () => ({
  rules: [{ id: 1, name: 'SLA breach', triggerType: 'sla_breach', tenantId: 0 }],
  incidents: [],
  seq: { nextRule: 2 },
}));

const auth = bearerAuth(TOKEN);
const escFeature = requireFeature('escalation', repo.resolveTenantId, fail);
const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '512kb' }));
app.use(requestId);
healthRouter(app, 'escalation');

app.get('/readyz', async (_req, res) => {
  if (!dbEnabled()) return res.json({ status: 'ready', db: false });
  try {
    await getPool().query('SELECT 1');
    return res.json({ status: 'ready', db: true });
  } catch (e) {
    return res.status(503).json({ status: 'not_ready', error: e.message });
  }
});

app.get('/v1/rulesets', auth, escFeature, async (req, res) => {
  if (!dbEnabled()) return ok(res, legacyStore.load().rules);
  return ok(res, await repo.listRulesets(repo.resolveTenantId(req)));
});

app.post('/v1/rulesets', auth, escFeature, async (req, res) => {
  if (!dbEnabled()) return fail(res, 'NOT_CONFIGURED', 'Postgres required', 501);
  const { name } = req.body ?? {};
  if (!name?.trim()) return fail(res, 'VALIDATION_ERROR', 'name required');
  try {
    return ok(res, await repo.createRuleset(repo.resolveTenantId(req), req.body), 201);
  } catch (e) {
    if (e.code === '23505') return fail(res, 'CONFLICT', 'Ruleset exists', 409);
    return fail(res, 'INTERNAL_ERROR', e.message, 500);
  }
});

app.get('/v1/rulesets/:id/rules', auth, escFeature, async (req, res) => {
  if (!dbEnabled()) return fail(res, 'NOT_CONFIGURED', 'Postgres required', 501);
  return ok(res, await repo.listRules(repo.resolveTenantId(req), req.params.id));
});

app.post('/v1/rulesets/:id/rules', auth, escFeature, async (req, res) => {
  if (!dbEnabled()) return fail(res, 'NOT_CONFIGURED', 'Postgres required', 501);
  try {
    return ok(res, await repo.createRule(repo.resolveTenantId(req), req.params.id, req.body), 201);
  } catch (e) {
    if (e.code === 'VALIDATION_ERROR') return fail(res, 'VALIDATION_ERROR', e.message, 400);
    if (e.code === 'NOT_FOUND') return fail(res, 'NOT_FOUND', e.message, 404);
    return fail(res, 'INTERNAL_ERROR', e.message, 500);
  }
});

app.post('/v1/rules/simulate', auth, escFeature, async (req, res) => {
  const { rule, event } = req.body ?? {};
  if (!rule) return fail(res, 'VALIDATION_ERROR', 'rule required');
  try {
    return ok(res, simulateRule(rule, event ?? {}));
  } catch (e) {
    return fail(res, 'VALIDATION_ERROR', e.message, 400);
  }
});

app.post('/v1/events', escFeature, async (req, res) => {
  const tenantId = repo.resolveTenantId(req);
  if (dbEnabled()) {
    const results = await processEvent(tenantId, req.body ?? {});
    return ok(res, { processed: results.length, results });
  }
  return ok(res, { processed: 0, legacy: true });
});

// Legacy incidents API
app.post('/v1/incidents', async (req, res) => {
  const { triggerType, title, tenantId = 0, metadata } = req.body ?? {};
  if (!triggerType?.trim()) return fail(res, 'VALIDATION_ERROR', 'triggerType required');
  if (dbEnabled()) {
    await processEvent(String(tenantId), { event_type: triggerType, title, metadata });
  }
  ok(
    res,
    {
      id: `ESC-${Date.now()}`,
      triggerType,
      title: title || triggerType,
      status: 'open',
      metadata: metadata ?? {},
    },
    201,
  );
});

app.use(errorHandler(log));

async function boot() {
  if (dbEnabled()) {
    await runMigrations(log);
    log.info('Escalation Postgres ready');
  }
  const server = app.listen(PORT, '0.0.0.0', () => log.info({ port: PORT, db: dbEnabled() }, 'escalation started'));
  process.on('SIGTERM', () => closePool());
  gracefulShutdown(server, log);
}

boot().catch((e) => {
  log.error(e);
  process.exit(1);
});
