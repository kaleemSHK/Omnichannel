import { createHash, randomUUID } from 'node:crypto';
import express from 'express';
import { createLogger } from '../lib/logger.js';
import { createStore } from '../lib/store.js';
import { ok, fail, bearerAuth, requestId, errorHandler, healthRouter, gracefulShutdown } from '../lib/http.js';

const log   = createLogger('platform');
const PORT  = parseInt(process.env.PORT || '8790', 10);
const TOKEN = (process.env.TOKEN || '').trim();
const store = createStore(process.env.DATA_DIR || './data', () => ({
  tenants: [{ id: 1, name: 'Default', slug: 'default', plan: 'trial', status: 'active', chatwootAccountIds: [], features: {}, createdAt: new Date().toISOString() }],
  apiKeys: [],
  auditLog: [],
  seq: { nextTenantId: 2 },
}));

const auth = bearerAuth(TOKEN);
const app  = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '256kb' }));
app.use(requestId);
healthRouter(app, 'platform');

// Tenants
app.get('/v1/tenants', (_, res) => ok(res, store.load().tenants));

app.post('/v1/tenants', auth, async (req, res) => {
  const { name, slug, plan = 'trial' } = req.body ?? {};
  if (!name?.trim() || !slug?.trim()) return fail(res, 'VALIDATION_ERROR', 'name and slug are required');
  try {
    ok(res, await store.withStore(s => {
      if (s.tenants.some(t => t.slug === slug)) throw Object.assign(new Error(), { code: 409 });
      const t = { id: s.seq.nextTenantId++, name: name.trim(), slug: slug.trim().toLowerCase(), plan, status: 'active', chatwootAccountIds: [], features: {}, createdAt: new Date().toISOString() };
      s.tenants.push(t); return t;
    }), 201);
  } catch (e) {
    if (e.code === 409) return fail(res, 'CONFLICT', 'Slug already taken', 409);
    log.error(e); fail(res, 'INTERNAL_ERROR', 'Failed', 500);
  }
});

app.get('/v1/tenants/:id', (req, res) => {
  const t = store.load().tenants.find(x => x.id === Number(req.params.id));
  return t ? ok(res, t) : fail(res, 'NOT_FOUND', 'Tenant not found', 404);
});

app.patch('/v1/tenants/:id', auth, async (req, res) => {
  try {
    ok(res, await store.withStore(s => {
      const t = s.tenants.find(x => x.id === Number(req.params.id));
      if (!t) throw Object.assign(new Error(), { code: 404 });
      const { name, plan, status, chatwootAccountIds, features } = req.body ?? {};
      if (name) t.name = name.trim();
      if (plan) t.plan = plan;
      if (status) t.status = status;
      if (Array.isArray(chatwootAccountIds)) t.chatwootAccountIds = chatwootAccountIds;
      if (features && typeof features === 'object') t.features = { ...t.features, ...features };
      return t;
    }));
  } catch (e) {
    if (e.code === 404) return fail(res, 'NOT_FOUND', 'Tenant not found', 404);
    log.error(e); fail(res, 'INTERNAL_ERROR', 'Failed', 500);
  }
});

// API Keys
app.post('/v1/api-keys', auth, async (req, res) => {
  const { tenantId, name } = req.body ?? {};
  if (!tenantId || !name?.trim()) return fail(res, 'VALIDATION_ERROR', 'tenantId and name required');
  const rawKey  = randomUUID().replace(/-/g, '') + randomUUID().replace(/-/g, '');
  const keyHash = createHash('sha256').update(rawKey).digest('hex');
  try {
    const meta = await store.withStore(s => {
      const row = { id: randomUUID(), tenantId, name: name.trim(), keyHash, prefix: rawKey.slice(0, 8), createdAt: new Date().toISOString() };
      s.apiKeys = s.apiKeys ?? []; s.apiKeys.push(row); return { ...row, keyHash: undefined };
    });
    ok(res, { ...meta, key: rawKey }, 201);
  } catch (e) { log.error(e); fail(res, 'INTERNAL_ERROR', 'Failed', 500); }
});

app.get('/v1/api-keys', auth, (req, res) => {
  const keys = (store.load().apiKeys ?? []).filter(k => String(k.tenantId) === String(req.query.tenant_id)).map(({ keyHash: _, ...k }) => k);
  ok(res, keys);
});

// Audit log
app.post('/v1/audit', async (req, res) => {
  const { action, resourceType = 'unknown', tenantId, actorEmail } = req.body ?? {};
  if (!action) return fail(res, 'VALIDATION_ERROR', 'action required');
  const id = randomUUID();
  await store.withStore(s => {
    s.auditLog = s.auditLog ?? [];
    s.auditLog.push({ id, ts: new Date().toISOString(), action, resourceType, tenantId: tenantId ?? null, actorEmail: actorEmail ?? null });
    if (s.auditLog.length > 5000) s.auditLog = s.auditLog.slice(-5000);
  });
  ok(res, { id }, 201);
});

app.get('/v1/audit', auth, (req, res) => {
  const limit = Math.min(200, Number(req.query.limit) || 50);
  const events = [...(store.load().auditLog ?? [])].reverse().slice(0, limit);
  ok(res, events);
});

app.use(errorHandler(log));
const server = app.listen(PORT, '0.0.0.0', () => log.info({ port: PORT }, 'platform started'));
gracefulShutdown(server, log);
