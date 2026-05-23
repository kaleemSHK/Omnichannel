import express from 'express';
import { createLogger } from '../lib/logger.js';
import { ok, fail, bearerAuth, requestId, errorHandler, healthRouter, gracefulShutdown } from '../lib/http.js';
import { dbEnabled, runMigrations, closePool, getPool } from '../lib/db.js';
import { resolveTenantId } from '../lib/tenant.js';
import * as repo from '../lib/billing-repo.js';
import { startBillingWorkers } from '../lib/workers.js';
import { createStore } from '../lib/store.js';

const log = createLogger('billing');
const PORT = parseInt(process.env.PORT || '8794', 10);
const TOKEN = (process.env.TOKEN || '').trim();
const auth = bearerAuth(TOKEN);
const platformAdmin = (req, res, next) => {
  const role = req.headers['x-blinkone-platform-role'];
  if (role === 'platform_admin' || role === 'platform_billing' || role === 'platform_support') return next();
  return fail(res, 'FORBIDDEN', 'Platform role required', 403);
};

const legacyStore = createStore(process.env.DATA_DIR || './data', () => ({
  plans: [],
  subscriptions: [],
  usageEvents: {},
  signups: [],
  seq: { next: 1 },
}));

const app = express();
app.disable('x-powered-by');
app.use(requestId);
healthRouter(app, 'billing');

app.post('/v1/webhooks/psp', express.raw({ type: 'application/json' }), async (req, res) => {
  let body = req.body;
  if (Buffer.isBuffer(body)) {
    try {
      body = JSON.parse(body.toString());
    } catch {
      return fail(res, 'VALIDATION_ERROR', 'Invalid JSON', 400);
    }
  }
  const sig = req.headers['x-psp-signature'] || req.headers['x-thawani-signature'];
  if (process.env.PSP_WEBHOOK_SECRET && sig !== process.env.PSP_WEBHOOK_SECRET) {
    return fail(res, 'UNAUTHORIZED', 'Invalid signature', 401);
  }
  if (dbEnabled() && body?.status === 'succeeded' && body?.invoice_id) {
    await repo.markInvoicePaid(body.invoice_id, { method: 'card', providerRef: body.charge_id });
  }
  return ok(res, { received: true });
});

app.use(express.json({ limit: '512kb' }));

app.get('/readyz', async (_req, res) => {
  if (!dbEnabled()) return res.json({ status: 'ready', db: false, mode: 'legacy' });
  try {
    await getPool().query('SELECT 1');
    return res.json({ status: 'ready', db: true, currency: process.env.CURRENCY || 'OMR' });
  } catch (e) {
    return res.status(503).json({ status: 'not_ready', error: e.message });
  }
});

// ─── Plans (platform) ────────────────────────────────────────────────────────
app.get('/v1/plans', async (_req, res) => {
  if (!dbEnabled()) return ok(res, legacyStore.load().plans);
  return ok(res, await repo.listPlans());
});

app.post('/v1/plans', auth, platformAdmin, async (req, res) => {
  if (!dbEnabled()) return fail(res, 'NOT_CONFIGURED', 'Postgres required', 501);
  try {
    return ok(res, await repo.createPlan(req.body ?? {}), 201);
  } catch (e) {
    if (e.code === '23505') return fail(res, 'CONFLICT', 'Plan id exists', 409);
    return fail(res, 'ERROR', e.message, 500);
  }
});

app.patch('/v1/plans/:planId', auth, platformAdmin, async (req, res) => {
  if (!dbEnabled()) return fail(res, 'NOT_CONFIGURED', 'Postgres required', 501);
  try {
    const plan = await repo.updatePlan(req.params.planId, req.body ?? {});
    if (!plan) return fail(res, 'NOT_FOUND', 'Plan not found', 404);
    return ok(res, plan);
  } catch (e) {
    if (e.code === 'NOT_FOUND') return fail(res, 'NOT_FOUND', e.message, 404);
    return fail(res, 'ERROR', e.message, 500);
  }
});

// ─── Subscriptions ───────────────────────────────────────────────────────────
app.post('/v1/tenants/:tenantId/subscription', auth, async (req, res) => {
  if (!dbEnabled()) return legacySubscribe(req, res);
  try {
    return ok(res, await repo.assignSubscription(req.params.tenantId, req.body ?? {}), 201);
  } catch (e) {
    if (e.code === 'NOT_FOUND') return fail(res, 'NOT_FOUND', e.message, 404);
    return fail(res, 'ERROR', e.message, 500);
  }
});

app.post('/v1/tenants/:tenantId/subscription/cancel', auth, async (req, res) => {
  if (!dbEnabled()) return fail(res, 'NOT_CONFIGURED', 'Postgres required', 501);
  return ok(res, await repo.cancelSubscription(req.params.tenantId, req.body ?? {}));
});

app.get('/v1/tenants/:tenantId/subscription', auth, async (req, res) => {
  if (!dbEnabled()) return fail(res, 'NOT_CONFIGURED', 'Postgres required', 501);
  const sub = await repo.getActiveSubscription(req.params.tenantId);
  if (!sub) return fail(res, 'NOT_FOUND', 'No subscription', 404);
  return ok(res, sub);
});

// Legacy alias
app.post('/v1/subscriptions', auth, async (req, res) => {
  const tenantId = req.body?.tenantId ?? req.body?.tenant_id;
  const planId = req.body?.planId ?? req.body?.plan_id;
  if (!dbEnabled()) return legacySubscribe(req, res);
  try {
    return ok(res, await repo.assignSubscription(tenantId, { ...req.body, planId }), 201);
  } catch (e) {
    if (e.code === 'NOT_FOUND') return fail(res, 'NOT_FOUND', e.message, 404);
    return fail(res, 'ERROR', e.message, 500);
  }
});

async function legacySubscribe(req, res) {
  const { tenantId, planId } = req.body ?? {};
  if (!tenantId || !planId) return fail(res, 'VALIDATION_ERROR', 'tenantId and planId required');
  return ok(res, { tenantId, planId, status: 'active' }, 201);
}

// ─── Usage ───────────────────────────────────────────────────────────────────
app.post('/v1/usage/events', async (req, res) => {
  const tenantId = req.body?.tenantId ?? req.body?.tenant_id ?? resolveTenantId(req);
  const dimension = req.body?.dimension ?? req.body?.metric;
  const quantity = req.body?.quantity ?? 1;
  const sourceService = req.body?.sourceService ?? req.body?.source_service ?? 'api';
  const sourceEventId = req.body?.sourceEventId ?? req.body?.source_event_id ?? `${sourceService}-${Date.now()}-${Math.random()}`;

  if (!tenantId || !dimension) return fail(res, 'VALIDATION_ERROR', 'tenantId and dimension required');

  if (!dbEnabled()) {
    return ok(res, { tenantId, dimension, quantity }, 201);
  }
  const result = await repo.ingestUsageEvent({
    tenantId,
    dimension,
    quantity,
    sourceService,
    sourceEventId,
  });
  return ok(res, result, result.inserted ? 201 : 200);
});

app.get('/v1/tenants/:tenantId/usage', auth, async (req, res) => {
  if (!dbEnabled()) return fail(res, 'NOT_CONFIGURED', 'Postgres required', 501);
  return ok(res, await repo.getTenantUsage(req.params.tenantId));
});

app.get('/v1/tenants/:tenantId/usage/limits', auth, async (req, res) => {
  if (!dbEnabled()) return fail(res, 'NOT_CONFIGURED', 'Postgres required', 501);
  return ok(res, await repo.getUsageLimits(req.params.tenantId));
});

app.get('/v1/usage/summary', auth, async (req, res) => {
  const tenantId = String(req.query.tenant_id || resolveTenantId(req));
  if (!dbEnabled()) return ok(res, { tenantId, summary: {} });
  return ok(res, await repo.getTenantUsage(tenantId));
});

// ─── Invoices ────────────────────────────────────────────────────────────────
app.post('/v1/invoices/generate', auth, async (req, res) => {
  if (!dbEnabled()) return fail(res, 'NOT_CONFIGURED', 'Postgres required', 501);
  const tenantId = req.body?.tenantId ?? req.body?.tenant_id ?? resolveTenantId(req);
  try {
    return ok(res, await repo.generateInvoice(tenantId, req.body ?? {}), 201);
  } catch (e) {
    if (e.code === 'NOT_FOUND') return fail(res, 'NOT_FOUND', e.message, 404);
    return fail(res, 'ERROR', e.message, 500);
  }
});

app.get('/v1/tenants/:tenantId/invoices', auth, async (req, res) => {
  if (!dbEnabled()) return fail(res, 'NOT_CONFIGURED', 'Postgres required', 501);
  return ok(res, await repo.listInvoices(req.params.tenantId));
});

app.post('/v1/invoices/:id/send', auth, async (req, res) => {
  if (!dbEnabled()) return fail(res, 'NOT_CONFIGURED', 'Postgres required', 501);
  await getPool().query(
    `UPDATE billing_invoices SET status = 'sent', issued_at = COALESCE(issued_at, now()) WHERE id = $1`,
    [req.params.id],
  );
  log.info({ invoiceId: req.params.id }, 'invoice.sent');
  return ok(res, { sent: true });
});

app.post('/v1/invoices/:id/mark-paid', auth, platformAdmin, async (req, res) => {
  if (!dbEnabled()) return fail(res, 'NOT_CONFIGURED', 'Postgres required', 501);
  const inv = await repo.markInvoicePaid(req.params.id, req.body ?? {});
  if (!inv) return fail(res, 'NOT_FOUND', 'Invoice not found', 404);
  return ok(res, inv);
});

app.post('/v1/payment-methods', auth, async (req, res) => {
  if (!dbEnabled()) return fail(res, 'NOT_CONFIGURED', 'Postgres required', 501);
  const tenantId = resolveTenantId(req);
  const { type = 'card', last4, providerToken } = req.body ?? {};
  const { rows } = await getPool().query(
    `INSERT INTO billing_payment_methods (tenant_id, type, last4, provider_token, is_default)
     VALUES ($1,$2,$3,$4,true) RETURNING id, type, last4`,
    [tenantId, type, last4 ?? '4242', providerToken ?? 'stub_token'],
  );
  return ok(res, rows[0], 201);
});

// ─── Platform overview ─────────────────────────────────────────────────────────
app.get('/v1/platform/overview', auth, platformAdmin, async (_req, res) => {
  if (!dbEnabled()) return fail(res, 'NOT_CONFIGURED', 'Postgres required', 501);
  return ok(res, await repo.platformOverview());
});

app.use(errorHandler(log));

async function boot() {
  if (dbEnabled()) {
    await runMigrations(log);
    startBillingWorkers(log);
    log.info({ currency: process.env.CURRENCY || 'OMR' }, 'billing Postgres mode');
  } else {
    log.warn('BLINKONE_DATABASE_URL unset — legacy file store only');
  }
  const server = app.listen(PORT, '0.0.0.0', () => log.info({ port: PORT }, 'billing started'));
  process.on('SIGTERM', () => closePool());
  gracefulShutdown(server, log);
}

boot().catch((e) => {
  log.error(e);
  process.exit(1);
});
