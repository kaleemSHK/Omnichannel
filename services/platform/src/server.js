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

// ─── MFA / TOTP — Sprint 2 M01 ───────────────────────────────────────────────

const MFA_ISSUER = (process.env.MFA_ISSUER || 'BlinkOne').trim();

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

app.use(errorHandler(log));
const server = app.listen(PORT, '0.0.0.0', () => log.info({ port: PORT }, 'platform started'));
gracefulShutdown(server, log);
