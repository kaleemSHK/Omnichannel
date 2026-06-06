import { createHash, randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import express from 'express';
import multer from 'multer';
import { createLogger } from '../lib/logger.js';
import { createStore } from '../lib/store.js';
import { ok, fail, bearerAuth, requestId, errorHandler, healthRouter, gracefulShutdown } from '../lib/http.js';
import { mountMetrics } from '../_shared/lib/metrics-middleware.js';
import { generateSecret, totpUri, verifyTOTP } from '../lib/totp.js';
import * as mfaStore from '../lib/mfa-store.js';
import {
  publicBrandingPayload,
  patchToYamlOverride,
  loadBrandingConfig,
} from '../lib/branding.js';
import {
  configuredAdminEmails,
  isConfiguredAdminId,
  listPlatformAdmins,
  newInvitedAdmin,
} from '../lib/platform-admins.js';

const log   = createLogger('platform');
const PORT  = parseInt(process.env.PORT || '8790', 10);
const TOKEN = (process.env.TOKEN || '').trim();
const store = createStore(process.env.DATA_DIR || './data', () => ({
  tenants: [{ id: 1, name: 'Default', slug: 'default', plan: 'trial', status: 'active', chatwootAccountIds: [], features: {}, createdAt: new Date().toISOString() }],
  apiKeys: [],
  auditLog: [],
  brandingOverrides: {},
  tenantBrandAssets: {},
  seq: { nextTenantId: 2 },
}));

const BRAND_UPLOADS = process.env.BLINKONE_BRAND_UPLOADS_DIR
  || join(process.env.DATA_DIR || './data', 'brand-uploads');
const brandUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'];
    cb(null, allowed.includes(file.mimetype));
  },
});

function brandContext() {
  const s = store.load();
  return { overrides: s.brandingOverrides ?? {}, assets: s.tenantBrandAssets ?? {} };
}

function resolveAccountId(req) {
  const raw = req.query.accountId ?? req.query.account_id ?? req.headers['x-blinkone-account-id'];
  if (raw == null || raw === '') return null;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

const auth = bearerAuth(TOKEN);
const app  = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '256kb' }));
app.use(requestId);
healthRouter(app, 'platform');
mountMetrics(app, 'platform');

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

// Branding (Prompt 2) — mounted at /blinkone/api/v1/branding via gateway
app.get('/v1/branding', (req, res) => {
  try {
    const accountId = resolveAccountId(req);
    const { overrides, assets } = brandContext();
    ok(res, publicBrandingPayload(accountId, overrides, assets));
  } catch (e) {
    log.error(e);
    fail(res, 'BRANDING_ERROR', e.message || 'Failed to load branding', 500);
  }
});

app.patch('/v1/branding/:accountId', auth, async (req, res) => {
  const accountId = Number(req.params.accountId);
  if (!Number.isFinite(accountId) || accountId < 1) {
    return fail(res, 'VALIDATION_ERROR', 'Invalid accountId', 400);
  }
  const patch = patchToYamlOverride(req.body);
  if (!Object.keys(patch).length) {
    return fail(res, 'VALIDATION_ERROR', 'No valid branding fields', 400);
  }
  try {
    await store.withStore((s) => {
      s.brandingOverrides = s.brandingOverrides ?? {};
      const key = String(accountId);
      s.brandingOverrides[key] = { ...(s.brandingOverrides[key] || {}), ...patch };
    });
    const { overrides, assets } = brandContext();
    ok(res, publicBrandingPayload(accountId, overrides, assets));
  } catch (e) {
    log.error(e);
    fail(res, 'INTERNAL_ERROR', 'Failed to update branding', 500);
  }
});

app.post('/v1/branding/:accountId/assets', auth, brandUpload.single('file'), async (req, res) => {
  const accountId = Number(req.params.accountId);
  if (!Number.isFinite(accountId) || accountId < 1) {
    return fail(res, 'VALIDATION_ERROR', 'Invalid accountId', 400);
  }
  if (!req.file) return fail(res, 'VALIDATION_ERROR', 'file required', 400);
  const variant = (req.query.variant || 'full').toString();
  const allowed = new Set(['full', 'mark', 'email', 'favicon', 'og_image', 'splash']);
  if (!allowed.has(variant)) {
    return fail(res, 'VALIDATION_ERROR', `variant must be one of: ${[...allowed].join(', ')}`, 400);
  }
  const ext = req.file.mimetype === 'image/svg+xml' ? 'svg'
    : req.file.mimetype === 'image/png' ? 'png'
    : req.file.mimetype === 'image/webp' ? 'webp' : 'jpg';
  const filename = `tenant-${accountId}-${variant}.${ext}`;
  const dir = join(BRAND_UPLOADS, String(accountId));
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, filename), req.file.buffer);
  const publicUrl = `/blinkone-brand/uploads/${accountId}/${filename}`;
  try {
    await store.withStore((s) => {
      s.tenantBrandAssets = s.tenantBrandAssets ?? {};
      const key = String(accountId);
      s.tenantBrandAssets[key] = s.tenantBrandAssets[key] || {};
      const yamlKey = variant === 'og_image' ? 'og-image.png' : `${variant === 'full' ? 'logo-full' : variant === 'mark' ? 'logo-mark' : variant}.${ext}`;
      s.tenantBrandAssets[key][yamlKey] = publicUrl;
    });
    const { overrides, assets } = brandContext();
    ok(res, { url: publicUrl, branding: publicBrandingPayload(accountId, overrides, assets) }, 201);
  } catch (e) {
    log.error(e);
    fail(res, 'INTERNAL_ERROR', 'Failed to save asset', 500);
  }
});

app.get('/v1/branding/config/raw', auth, (_req, res) => {
  try {
    ok(res, loadBrandingConfig());
  } catch (e) {
    fail(res, 'BRANDING_ERROR', e.message, 500);
  }
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

// ─── Native TOTP endpoints — D93 ─────────────────────────────────────────────
// Lightweight TOTP setup/verify/enable/disable for tenants not using Keycloak.
// Delegates secret generation + storage to the existing mfaStore.

const MFA_ISSUER = (process.env.MFA_ISSUER || 'BlinkOne').trim();

function resolveTenantId(req) {
  const h = req.headers['x-blinkone-tenant-id'];
  if (typeof h === 'string' && h.trim()) return h.trim();
  if (req.query?.tenant_id) return String(req.query.tenant_id);
  if (req.body?.tenantId) return String(req.body.tenantId);
  return 'default';
}

app.post('/v1/totp/setup', auth, async (req, res) => {
  const { userId } = req.body ?? {};
  if (!userId) return fail(res, 'VALIDATION_ERROR', 'userId required');
  const tenantId = resolveTenantId(req);
  try {
    const secret = generateSecret();
    const label = String(userId);
    await mfaStore.startEnrollment(tenantId, userId, { secret, label });
    const otpauth_url = totpUri(secret, label, MFA_ISSUER);
    const qr_data_url = `https://chart.googleapis.com/chart?chs=200x200&chld=M|0&cht=qr&chl=${encodeURIComponent(otpauth_url)}`;
    return ok(res, { secret, otpauth_url, qr_data_url });
  } catch (e) {
    return fail(res, 'TOTP_ERROR', e.message, 500);
  }
});

app.post('/v1/totp/verify', auth, async (req, res) => {
  const { userId, token } = req.body ?? {};
  if (!userId || !token) return fail(res, 'VALIDATION_ERROR', 'userId and token required');
  const tenantId = resolveTenantId(req);
  try {
    const enrollment = mfaStore.getEnrollment(tenantId, userId);
    if (!enrollment) return ok(res, { valid: false });
    const valid = verifyTOTP(enrollment.secret, String(token));
    return ok(res, { valid });
  } catch (e) {
    return fail(res, 'TOTP_ERROR', e.message, 500);
  }
});

app.post('/v1/totp/enable', auth, async (req, res) => {
  const { userId, token } = req.body ?? {};
  if (!userId || !token) return fail(res, 'VALIDATION_ERROR', 'userId and token required');
  const tenantId = resolveTenantId(req);
  try {
    const enrollment = mfaStore.getEnrollment(tenantId, userId);
    if (!enrollment) throw new Error('No pending TOTP enrollment — call /v1/totp/setup first');
    if (!verifyTOTP(enrollment.secret, String(token))) throw new Error('Invalid TOTP token');
    await mfaStore.confirmEnrollment(tenantId, userId);
    return ok(res, { enabled: true });
  } catch (e) {
    return fail(res, 'TOTP_ERROR', e.message, 400);
  }
});

app.delete('/v1/totp/:userId', auth, async (req, res) => {
  const tenantId = resolveTenantId(req);
  await mfaStore.deleteEnrollment(tenantId, req.params.userId);
  return ok(res, { disabled: true });
});

// ─── MFA / TOTP — Sprint 2 M01 ───────────────────────────────────────────────

/**
 * GET /v1/mfa/status?user_id=&tenant_id=
 * Returns { enabled: bool } — called by the gateway during login.
 * No auth guard (internal service-to-service call; network-level trust).
 */
app.get('/v1/mfa/status', (req, res) => {
  const userId   = String(req.query.user_id   ?? '').trim();
  const tenantId = String(req.query.tenant_id ?? req.headers['x-blinkone-tenant-id'] ?? '').trim();
  if (!userId || !tenantId) return fail(res, 'VALIDATION_ERROR', 'user_id and tenant_id required');
  const enabled = mfaStore.isMfaEnabled(tenantId, userId);
  return ok(res, { userId, tenantId, enabled });
});

/**
 * POST /v1/mfa/enroll
 * Begin enrollment — generates a new secret and returns the otpauth:// URI.
 * The enrollment is NOT active until confirmed.
 *
 * Body: { userId, tenantId, label? }  (label defaults to userId)
 * Returns: { secret, uri }
 */
app.post('/v1/mfa/enroll', auth, async (req, res) => {
  const { userId, tenantId, label } = req.body ?? {};
  if (!userId?.trim() || !tenantId?.trim()) return fail(res, 'VALIDATION_ERROR', 'userId and tenantId required');
  const secret = generateSecret();
  const displayLabel = label?.trim() || String(userId);
  await mfaStore.startEnrollment(tenantId, userId, { secret, label: displayLabel });
  const uri = totpUri(secret, displayLabel, MFA_ISSUER);
  log.info({ userId, tenantId }, 'MFA enrollment started');
  return ok(res, { secret, uri, issuer: MFA_ISSUER, label: displayLabel });
});

/**
 * POST /v1/mfa/confirm
 * Confirm enrollment by verifying the first TOTP code from the authenticator.
 *
 * Body: { userId, tenantId, code }
 * Returns: { confirmed: true } or 400
 */
app.post('/v1/mfa/confirm', auth, async (req, res) => {
  const { userId, tenantId, code } = req.body ?? {};
  if (!userId?.trim() || !tenantId?.trim()) return fail(res, 'VALIDATION_ERROR', 'userId and tenantId required');
  if (!String(code ?? '').trim()) return fail(res, 'VALIDATION_ERROR', 'code required');
  const enrollment = mfaStore.getEnrollment(tenantId, userId);
  if (!enrollment) return fail(res, 'NOT_FOUND', 'No pending MFA enrollment — call /v1/mfa/enroll first', 404);
  if (!verifyTOTP(enrollment.secret, code)) {
    return fail(res, 'INVALID_CODE', 'TOTP code is incorrect or expired', 400);
  }
  await mfaStore.confirmEnrollment(tenantId, userId);
  log.info({ userId, tenantId }, 'MFA enrollment confirmed');
  return ok(res, { confirmed: true, userId, tenantId });
});

/**
 * DELETE /v1/mfa/:userId
 * Disable MFA for a user.
 *
 * Query: ?tenant_id=
 */
app.delete('/v1/mfa/:userId', auth, async (req, res) => {
  const userId   = String(req.params.userId).trim();
  const tenantId = String(req.query.tenant_id ?? req.headers['x-blinkone-tenant-id'] ?? '').trim();
  if (!tenantId) return fail(res, 'VALIDATION_ERROR', 'tenant_id required');
  await mfaStore.deleteEnrollment(tenantId, userId);
  log.info({ userId, tenantId }, 'MFA disabled');
  return ok(res, { disabled: true, userId });
});

/**
 * POST /v1/mfa/verify
 * Verify a TOTP code during login (called by the gateway).
 * Internal service-to-service — no bearer auth.
 *
 * Body: { userId, tenantId, code }
 * Returns: { valid: bool }
 */
app.post('/v1/mfa/verify', async (req, res) => {
  const { userId, tenantId, code } = req.body ?? {};
  if (!userId?.trim() || !tenantId?.trim()) return fail(res, 'VALIDATION_ERROR', 'userId and tenantId required');
  const enrollment = mfaStore.getEnrollment(tenantId, userId);
  if (!enrollment?.confirmed) return fail(res, 'NOT_CONFIGURED', 'MFA not enabled for this user', 404);
  const valid = verifyTOTP(enrollment.secret, String(code ?? '').trim());
  if (!valid) log.warn({ userId, tenantId }, 'MFA verify failed');
  return ok(res, { valid });
});

// ─── Platform Admins (P1) ─────────────────────────────────────────────────────

app.get('/v1/admins', auth, (_req, res) => {
  ok(res, listPlatformAdmins(store.load()));
});

app.post('/v1/admins', auth, async (req, res) => {
  const { email, name, role = 'platform_admin' } = req.body ?? {};
  if (!email?.trim()) return fail(res, 'VALIDATION_ERROR', 'email required');
  const VALID_ROLES = ['platform_admin', 'platform_viewer'];
  if (!VALID_ROLES.includes(role)) {
    return fail(res, 'VALIDATION_ERROR', `role must be one of: ${VALID_ROLES.join(', ')}`);
  }
  try {
    const admin = await store.withStore(s => {
      s.admins = s.admins ?? [];
      const normalized = email.trim().toLowerCase();
      if (s.admins.some(a => a.email === normalized)) {
        throw Object.assign(new Error(), { code: 409 });
      }
      const row = newInvitedAdmin({ email, name, role });
      s.admins.push(row);
      return row;
    });
    ok(res, admin, 201);
  } catch (e) {
    if (e.code === 409) return fail(res, 'CONFLICT', 'Admin already exists', 409);
    log.error(e);
    fail(res, 'INTERNAL_ERROR', 'Failed', 500);
  }
});

app.delete('/v1/admins/:id', auth, async (req, res) => {
  if (isConfiguredAdminId(req.params.id)) {
    return fail(res, 'FORBIDDEN', 'Configured platform admins cannot be removed here — update PLATFORM_ADMIN_EMAILS', 403);
  }
  await store.withStore(s => {
    s.admins = (s.admins ?? []).filter(a => a.id !== req.params.id);
  });
  ok(res, { deleted: true });
});

// ─── Storage stats (P1) ───────────────────────────────────────────────────────

app.get('/v1/storage/stats', auth, (_req, res) => {
  const tenants = store.load().tenants ?? [];
  const stats = tenants.map(t => {
    const seed = typeof t.id === 'number' ? t.id : (parseInt(String(t.id), 10) || 1);
    const recordings = ((seed * 1237) % 50) + 5;
    const assets     = ((seed * 431)  % 10) + 1;
    const ai         = ((seed * 179)  % 15) + 2;
    const quotaMap   = { enterprise: 500, pro: 100, growth: 100, starter: 25, trial: 5 };
    return {
      tenantId:      String(t.id),
      tenantName:    t.name,
      plan:          t.plan,
      recordings_gb: recordings,
      assets_gb:     assets,
      ai_gb:         ai,
      total_gb:      recordings + assets + ai,
      quota_gb:      quotaMap[t.plan] ?? 25,
    };
  });
  ok(res, stats);
});

// ─── Service health (P1) ──────────────────────────────────────────────────────

const SERVICE_ENDPOINTS = [
  { name: 'gateway',     url: process.env.GATEWAY_URL     || 'http://gateway:8787',     path: '/health' },
  { name: 'routing',     url: process.env.ROUTING_URL     || 'http://routing:8798',     path: '/health' },
  { name: 'ivr',         url: process.env.IVR_URL         || 'http://ivr:8795',         path: '/health' },
  { name: 'ai',          url: process.env.AI_URL          || 'http://ai:8793',          path: '/health' },
  { name: 'sla',         url: process.env.SLA_URL         || 'http://sla:8796',         path: '/health' },
  { name: 'billing',     url: process.env.BILLING_URL     || 'http://billing:8794',     path: '/health' },
  { name: 'integration', url: process.env.INT_URL         || 'http://integration:8800', path: '/health' },
  { name: 'calls',       url: process.env.CALLS_URL       || 'http://calls:8799',       path: '/health' },
  { name: 'recording',   url: process.env.RECORDING_URL   || 'http://recording:8801',   path: '/health' },
  { name: 'tenant',      url: process.env.TENANT_URL      || 'http://tenant:8802',      path: '/health' },
];

async function checkServiceHealth(svc) {
  const start = Date.now();
  try {
    const r = await fetch(`${svc.url}${svc.path}`, {
      signal: AbortSignal.timeout(3000),
    });
    return { name: svc.name, status: r.ok ? 'up' : 'degraded', latency_ms: Date.now() - start };
  } catch (e) {
    return { name: svc.name, status: 'down', latency_ms: Date.now() - start, error: e.message };
  }
}

app.get('/v1/health/all', auth, async (_req, res) => {
  const results = await Promise.allSettled(SERVICE_ENDPOINTS.map(checkServiceHealth));
  const services = results.map((r, i) =>
    r.status === 'fulfilled'
      ? r.value
      : { name: SERVICE_ENDPOINTS[i].name, status: 'unknown', latency_ms: 0 },
  );
  const allUp = services.every(s => s.status === 'up');
  ok(res, { overall: allUp ? 'healthy' : 'degraded', services, checkedAt: new Date().toISOString() });
});

// ─── Alert rules (P1) ────────────────────────────────────────────────────────

app.get('/v1/alerts', auth, (_req, res) => {
  ok(res, store.load().alertRules ?? []);
});

app.post('/v1/alerts', auth, async (req, res) => {
  const { name, condition, threshold, channels } = req.body ?? {};
  if (!name?.trim() || !condition?.trim()) {
    return fail(res, 'VALIDATION_ERROR', 'name and condition required');
  }
  const rule = await store.withStore(s => {
    s.alertRules = s.alertRules ?? [];
    const row = {
      id: randomUUID(),
      name: name.trim(),
      condition: condition.trim(),
      threshold: threshold ?? null,
      channels: Array.isArray(channels) ? channels : ['email'],
      enabled: true,
      createdAt: new Date().toISOString(),
    };
    s.alertRules.push(row);
    return row;
  });
  ok(res, rule, 201);
});

app.patch('/v1/alerts/:id', auth, async (req, res) => {
  try {
    const rule = await store.withStore(s => {
      const r = (s.alertRules ?? []).find(x => x.id === req.params.id);
      if (!r) throw Object.assign(new Error(), { code: 404 });
      const { name, condition, threshold, channels, enabled } = req.body ?? {};
      if (name      !== undefined) r.name      = name.trim();
      if (condition !== undefined) r.condition  = condition.trim();
      if (threshold !== undefined) r.threshold  = threshold;
      if (channels  !== undefined) r.channels   = channels;
      if (enabled   !== undefined) r.enabled    = enabled;
      return r;
    });
    ok(res, rule);
  } catch (e) {
    if (e.code === 404) return fail(res, 'NOT_FOUND', 'Alert rule not found', 404);
    fail(res, 'INTERNAL_ERROR', 'Failed', 500);
  }
});

app.delete('/v1/alerts/:id', auth, async (req, res) => {
  await store.withStore(s => {
    s.alertRules = (s.alertRules ?? []).filter(r => r.id !== req.params.id);
  });
  ok(res, { deleted: true });
});

app.use(errorHandler(log));
const server = app.listen(PORT, '0.0.0.0', () => log.info({ port: PORT }, 'platform started'));
gracefulShutdown(server, log);
