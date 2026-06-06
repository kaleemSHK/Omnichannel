import express from 'express';
import { createLogger } from '../lib/logger.js';
import { ok, fail, bearerAuth, platformAdminOnly, requestId, errorHandler, healthRouter, gracefulShutdown } from '../lib/http.js';
import { mountMetrics } from '../_shared/lib/metrics-middleware.js';
import { dbEnabled, runMigrations, closePool, getPool } from '../lib/db.js';
import * as repo from '../lib/repo.js';
import { provisionTenant } from '../lib/provision.js';
import { resolveHost } from '../lib/resolve-host.js';
import { startAcmeWorker } from '../lib/acme.js';
import { mountRbacRoutes } from '../lib/rbac-routes.js';
import { ensureRbacCatalog, seedTenantRoles } from '../lib/rbac-repo.js';
import { randomUUID } from 'node:crypto';

const log = createLogger('tenant');
const PORT = parseInt(process.env.PORT || '8802', 10);
const TOKEN = (process.env.TOKEN || process.env.PLATFORM_TOKEN || '').trim();

const auth = bearerAuth(TOKEN);
const platform = [auth, platformAdminOnly];

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '512kb' }));
app.use(requestId);
healthRouter(app, 'tenant');
mountMetrics(app, 'tenant');

app.get('/readyz', async (_req, res) => {
  if (!dbEnabled()) return res.status(503).json({ status: 'not_ready', db: false });
  try {
    await getPool().query('SELECT 1');
    return res.json({ status: 'ready', db: true });
  } catch (e) {
    return res.status(503).json({ status: 'not_ready', error: e.message });
  }
});

app.get('/v1/health', (_req, res) => res.json({ status: 'ok', service: 'tenant' }));

app.get('/v1/resolve-host', async (req, res) => {
  if (!dbEnabled()) return fail(res, 'NOT_CONFIGURED', 'Postgres required', 501);
  const host = req.query.host || req.headers.host;
  if (!host) return fail(res, 'VALIDATION_ERROR', 'host required', 400);
  const resolved = await resolveHost(String(host));
  if (!resolved) return fail(res, 'NOT_FOUND', 'Unknown host', 404);
  return ok(res, resolved);
});

app.get('/v1/tenants/:id/branding', auth, async (req, res) => {
  if (!dbEnabled()) return fail(res, 'NOT_CONFIGURED', 'Postgres required', 501);
  const b = await repo.getBranding(req.params.id);
  return ok(res, b);
});

app.patch('/v1/tenants/:id/branding', auth, async (req, res) => {
  if (!dbEnabled()) return fail(res, 'NOT_CONFIGURED', 'Postgres required', 501);
  const { brand, subdomain } = req.body ?? {};
  return ok(res, await repo.patchBranding(req.params.id, brand ?? {}, subdomain));
});

app.post('/v1/tenants/:id/impersonate', ...platform, async (req, res) => {
  if (!dbEnabled()) return fail(res, 'NOT_CONFIGURED', 'Postgres required', 501);
  const t = await repo.getTenantPlatform(req.params.id);
  if (!t) return fail(res, 'NOT_FOUND', 'Tenant not found', 404);
  const auditId = randomUUID();
  log.info({ auditId, tenantId: req.params.id, actor: req.headers['x-blinkone-platform-role'] }, 'tenant.impersonate');
  return ok(res, {
    tenantId: t.id,
    chatwootAccountId: t.chatwootAccountId,
    impersonationToken: auditId,
    note: 'Use platform_admin JWT with tenant_id claim override in gateway',
  });
});

app.post('/v1/domains/:domainId/verify-acme', ...platform, async (req, res) => {
  if (!dbEnabled()) return fail(res, 'NOT_CONFIGURED', 'Postgres required', 501);
  const { processPendingAcme } = await import('../lib/acme.js');
  await processPendingAcme(log);
  return ok(res, { processed: true });
});

app.get('/v1/tenants', ...platform, async (_req, res) => {
  if (!dbEnabled()) return fail(res, 'NOT_CONFIGURED', 'Postgres required', 501);
  return ok(res, await repo.listTenantsPlatform());
});

app.post('/v1/tenants', ...platform, async (req, res) => {
  if (!dbEnabled()) return fail(res, 'NOT_CONFIGURED', 'Postgres required', 501);
  try {
    const result = await provisionTenant(req.body);
    return ok(res, result, 201);
  } catch (e) {
    if (e.code === 'VALIDATION') return fail(res, 'VALIDATION_ERROR', e.message, 400);
    if (e.code === 'CONFLICT') return fail(res, 'CONFLICT', e.message, 409);
    log.error({ err: e.message }, 'provision');
    return fail(res, 'PROVISION_ERROR', e.message, 500);
  }
});

app.get('/v1/tenants/:id', auth, async (req, res) => {
  if (!dbEnabled()) return fail(res, 'NOT_CONFIGURED', 'Postgres required', 501);
  const t = await repo.getTenantPlatform(req.params.id);
  if (!t) return fail(res, 'NOT_FOUND', 'Tenant not found', 404);
  const features = await repo.listFeatures(req.params.id).catch(() => ({}));
  return ok(res, { ...t, features });
});

app.patch('/v1/tenants/:id', ...platform, async (req, res) => {
  if (!dbEnabled()) return fail(res, 'NOT_CONFIGURED', 'Postgres required', 501);
  const t = await repo.patchTenantPlatform(req.params.id, req.body ?? {});
  if (!t) return fail(res, 'NOT_FOUND', 'Tenant not found', 404);
  if (req.body?.features) await repo.upsertFeatures(req.params.id, req.body.features);
  const features = await repo.listFeatures(req.params.id).catch(() => ({}));
  return ok(res, { ...t, features });
});

/** Internal: billing service applies plan entitlements after subscription change. */
app.post('/v1/tenants/:id/features/apply', auth, async (req, res) => {
  if (!dbEnabled()) return fail(res, 'NOT_CONFIGURED', 'Postgres required', 501);
  const { features, billingPlanId } = req.body ?? {};
  if (!features || typeof features !== 'object') {
    return fail(res, 'VALIDATION_ERROR', 'features object required', 400);
  }
  await repo.upsertFeatures(req.params.id, features);
  if (billingPlanId) await repo.patchTenantPlatform(req.params.id, { billingPlanId });
  const t = await repo.getTenantPlatform(req.params.id);
  const merged = await repo.listFeatures(req.params.id);
  return ok(res, { ...t, features: merged });
});

app.post('/v1/tenants/:id/suspend', ...platform, async (req, res) => {
  if (!dbEnabled()) return fail(res, 'NOT_CONFIGURED', 'Postgres required', 501);
  const t = await repo.suspendTenant(req.params.id);
  if (!t) return fail(res, 'NOT_FOUND', 'Tenant not found', 404);
  log.info({ tenantId: req.params.id }, 'tenant.suspended');
  return ok(res, { ...t, event: 'tenant.suspended' });
});

app.get('/v1/tenants/:id/domains', auth, async (req, res) => {
  if (!dbEnabled()) return fail(res, 'NOT_CONFIGURED', 'Postgres required', 501);
  return ok(res, await repo.listDomains(req.params.id));
});

app.post('/v1/tenants/:id/domains', ...platform, async (req, res) => {
  if (!dbEnabled()) return fail(res, 'NOT_CONFIGURED', 'Postgres required', 501);
  const { domain, isPrimary } = req.body ?? {};
  if (!domain?.trim()) return fail(res, 'VALIDATION_ERROR', 'domain required');
  try {
    return ok(res, await repo.addDomain(req.params.id, domain.trim(), !!isPrimary), 201);
  } catch (e) {
    if (e.code === '23505') return fail(res, 'CONFLICT', 'Domain taken', 409);
    throw e;
  }
});

app.get('/v1/tenants/:id/usage', auth, async (req, res) => {
  if (!dbEnabled()) return fail(res, 'NOT_CONFIGURED', 'Postgres required', 501);
  return ok(res, await repo.getUsageSnapshot(req.params.id));
});

mountRbacRoutes(app, auth);

app.use(errorHandler(log));

async function boot() {
  if (dbEnabled()) {
    await runMigrations(log);
    await ensureRbacCatalog();
    log.info('tenant Postgres migrations applied');
    startAcmeWorker(120_000, log);
  } else {
    log.warn('BLINKONE_DATABASE_URL unset — tenant API disabled');
  }
  const server = app.listen(PORT, '0.0.0.0', () => log.info({ port: PORT, db: dbEnabled() }, 'tenant started'));
  process.on('SIGTERM', () => closePool());
  gracefulShutdown(server, log);
}

boot().catch((e) => {
  log.error(e);
  process.exit(1);
});
