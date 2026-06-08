import { createHmac, timingSafeEqual } from 'node:crypto';
import { randomUUID } from 'node:crypto';
import { verifyTOTP } from '../lib/totp.js';
import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import jwt from 'jsonwebtoken';
import pino from 'pino';
import { tenantHasFeature, fetchTenantFeatures, normalizeFeatureEnabled } from './tenant-features.js';
import { piiSerializer, pinoMixin, PII_REDACT, maskString } from '../../services/_shared/lib/pii-masker.js';
import { rateLimitMiddleware, authRateLimitMiddleware } from './rate-limiter.js';
import { mountMetrics } from '../../services/_shared/lib/metrics-middleware.js';
import { mountCustomerRoutes } from '../lib/customer-routes.js';
import { rbacApiGuard } from '../lib/rbac-guard.js';
import { mountDeviceRoutes } from '../lib/device-routes.js';

const log = pino({
  name: 'gateway',
  level: process.env.LOG_LEVEL || 'info',
  base: { service: 'gateway' },
  serializers: piiSerializer,
  mixin: pinoMixin,
  redact: PII_REDACT,
});
const PORT = parseInt(process.env.PORT || '8787', 10);
const STARTED = Date.now();

// ─── Upstream map ─────────────────────────────────────────────────────────────
function u(key, fallback = '') {
  return (process.env[key] || fallback).replace(/\/$/, '');
}

const U = {
  chatwoot:    u('CHATWOOT_UPSTREAM',    'http://chatwoot:3000'),
  platform:    u('PLATFORM_UPSTREAM',   'http://platform:8790'),
  tickets:     u('TICKETS_UPSTREAM',    'http://tickets:8791'),
  calls:       u('CALLS_UPSTREAM',      'http://calls:8792'),
  ai:          u('AI_UPSTREAM',         'http://ai:8793'),
  billing:     u('BILLING_UPSTREAM',    'http://billing:8794'),
  ivr:         u('IVR_UPSTREAM',        'http://ivr:8795'),
  sla:         u('SLA_UPSTREAM',        'http://sla:8796'),
  escalation:  u('ESCALATION_UPSTREAM', 'http://escalation:8797'),
  routing:     u('ROUTING_UPSTREAM',    'http://routing:8798'),
  recording:   u('RECORDING_UPSTREAM',  'http://recording:8799'),
  integration: u('INTEGRATION_UPSTREAM','http://integration:8800'),
  tenant:      u('TENANT_UPSTREAM',      'http://tenant:8802'),
  whatsappCalls: u('WHATSAPP_CALLS_UPSTREAM', 'http://whatsapp-calls:8803'),
};

const TOKENS = {
  ai:          (process.env.AI_TOKEN || '').trim(),
  ticket:      (process.env.TICKET_TOKEN || '').trim(),
  calls:       (process.env.CALLS_TOKEN || '').trim(),
  routing:     (process.env.ROUTING_TOKEN || '').trim(),
  sla:         (process.env.SLA_TOKEN || '').trim(),
  escalation:  (process.env.ESCALATION_TOKEN || '').trim(),
  integration: (process.env.INTEGRATION_TOKEN || '').trim(),
  billing:     (process.env.BILLING_TOKEN || '').trim(),
  ivr:         (process.env.IVR_TOKEN || '').trim(),
  recording:   (process.env.RECORDING_TOKEN || '').trim(),
  platform:    (process.env.PLATFORM_TOKEN || '').trim(),
  tenant:      (process.env.TENANT_TOKEN || process.env.PLATFORM_TOKEN || '').trim(),
  whatsappCalls: (process.env.WHATSAPP_CALLS_TOKEN || process.env.CALLS_TOKEN || '').trim(),
};

const PLATFORM_ADMIN_EMAILS = (process.env.PLATFORM_ADMIN_EMAILS
  || 'admin@blinkone.ai,admin@labbik.om,admin@blinksone.com')
  .split(',')
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

const IVR_DEFAULT_TENANT = (process.env.IVR_DEFAULT_TENANT || '1').trim();

function isTwilioVoiceWebhook(path) {
  return (
    path === '/api/ivr/v1/ivr/inbound' ||
    path === '/api/ivr/v1/ivr/status' ||
    path.startsWith('/api/ivr/v1/ivr/respond/')
  );
}

const JWT_SECRET = (process.env.JWT_SECRET || '').trim();

// ─── Fail-fast: critical secrets must be present at startup ───────────────────
if (!JWT_SECRET) {
  // eslint-disable-next-line no-console
  console.error('[FATAL] JWT_SECRET is not set. Gateway cannot start without it.');
  process.exit(1);
}

// ─── CORS allowed origins (locked-down for production) ────────────────────────
const CORS_ORIGINS = new Set(
  (process.env.CORS_ORIGINS || process.env.FRONTEND_URL || 'http://localhost')
    .split(',')
    .map((o) => o.trim().replace(/\/$/, ''))
    .filter(Boolean),
);

/** Paths where browser sends gateway JWT; upstream expects service TOKEN + tenant headers. */
const JWT_PROXY_PREFIXES = [
  ['/api/calls', 'calls'],
  ['/api/routing', 'routing'],
  ['/api/tickets', 'ticket'],
  ['/api/platform', 'platform'],
  ['/api/billing', 'billing'],
  ['/api/ivr', 'ivr'],
  ['/api/sla', 'sla'],
  ['/api/escalations', 'escalation'],
  ['/api/recordings', 'recording'],
  ['/api/integrations', 'integration'],
  ['/api/tenant', 'tenant'],
];

function signTenantHeaders(payload) {
  const tenantId = String(payload.tenant_id ?? '');
  const userId = String(payload.sub ?? '');
  const roles = Array.isArray(payload.roles) ? payload.roles.join(',') : '';
  // JWT_SECRET is validated non-empty at startup; guard here prevents silent
  // unsigned header bypass if called in an unexpected code path.
  if (!JWT_SECRET) throw new Error('JWT_SECRET not configured');
  const sig = createHmac('sha256', JWT_SECRET)
    .update(`${tenantId}:${userId}:${roles}`)
    .digest('hex');
  const headers = {
    'x-blinkone-tenant-id': tenantId,
    'x-blinkone-user-id': userId,
    'x-blinkone-roles': roles,
    'x-blinkone-context-sig': sig,
    ...(payload.account_id ? { 'x-blinkone-account-id': String(payload.account_id) } : {}),
  };
  if ((payload.roles || []).includes('platform_admin')) {
    headers['x-blinkone-platform-role'] = 'platform_admin';
  }
  if (Array.isArray(payload.permissions) && payload.permissions.length) {
    headers['x-blinkone-permissions'] = payload.permissions.join(',');
  }
  if (Array.isArray(payload.pages) && payload.pages.length) {
    headers['x-blinkone-pages'] = payload.pages.join(',');
  }
  return headers;
}

async function tenantFeaturesPayload(tenantId) {
  const raw = await fetchTenantFeatures(String(tenantId));
  return Object.fromEntries(
    Object.entries(raw).map(([k, v]) => [k, normalizeFeatureEnabled(v)]),
  );
}

async function loadEffectiveRbac({ tenantId, userId, roles, email, name, chatwootRole }) {
  if (!U.tenant || !TOKENS.tenant) return null;
  const isPlatformAdmin = roles.includes('platform_admin');
  const qs = new URLSearchParams({
    user_id: String(userId),
    ...(chatwootRole ? { chatwoot_role: chatwootRole } : {}),
    ...(email ? { email } : {}),
    ...(name ? { name } : {}),
  });
  try {
    const res = await fetch(`${U.tenant}/v1/rbac/effective?${qs}`, {
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${TOKENS.tenant}`,
        'X-Blinkone-Tenant-Id': String(tenantId),
        'X-Blinkone-User-Id': String(userId),
        ...(isPlatformAdmin ? { 'X-Blinkone-Platform-Role': 'platform_admin' } : {}),
      },
    });
    if (!res.ok) return null;
    const body = await res.json();
    return body?.data ?? body;
  } catch {
    return null;
  }
}

function isPlatformAdminPayload(payload) {
  return (payload?.roles || []).includes('platform_admin');
}

function requiresPlatformAdminForTenantRoute(path, method) {
  if (path === '/api/tenant/v1/tenants' || path.startsWith('/api/tenant/v1/tenants?')) {
    return true;
  }
  if (method === 'GET' && /^\/api\/tenant\/v1\/tenants\/[^/]+$/.test(path)) return true;
  if (method === 'PATCH' && /^\/api\/tenant\/v1\/tenants\/[^/]+$/.test(path)) return true;
  if (method === 'POST' && /^\/api\/tenant\/v1\/tenants\/[^/]+\/suspend$/.test(path)) return true;
  if (method === 'POST' && /^\/api\/tenant\/v1\/tenants\/[^/]+\/impersonate$/.test(path)) return true;
  if (method === 'POST' && /^\/api\/tenant\/v1\/tenants\/[^/]+\/domains$/.test(path)) return true;
  if (method === 'POST' && /^\/api\/tenant\/v1\/domains\/[^/]+\/verify-acme$/.test(path)) return true;
  return false;
}

function requirePlatformAdmin(req, res, next) {
  const path = (req.originalUrl || req.url).split('?')[0];
  // Agents may read their own tenant branding + feature entitlements.
  const tenantSelfRead =
    req.method === 'GET' &&
    /^\/api\/tenant\/v1\/tenants\/[^/]+\/(branding|features)$/.test(path);
  if (tenantSelfRead) {
    const jwtTenant = String(req.gatewayAuth?.payload?.tenant_id ?? '');
    const accountId = String(req.gatewayAuth?.payload?.account_id ?? '');
    const pathTenant = path.match(/\/tenants\/([^/]+)\/(?:branding|features)$/)?.[1] ?? '';
    if (pathTenant && (jwtTenant === pathTenant || accountId === pathTenant)) return next();
  }
  const platformMutate =
    path.startsWith('/api/platform') && ['POST', 'PATCH', 'PUT', 'DELETE'].includes(req.method);
  const tenantPlatformOnly = requiresPlatformAdminForTenantRoute(path, req.method);
  if (!platformMutate && !tenantPlatformOnly) return next();
  if (isPlatformAdminPayload(req.gatewayAuth?.payload)) return next();
  return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Platform admin required' } });
}

function tenantIdFromJwt(req) {
  const auth = String(req.headers.authorization || '');
  if (!auth.startsWith('Bearer ') || !JWT_SECRET) return '';
  const bearer = auth.slice(7).trim();
  for (const [, key] of JWT_PROXY_PREFIXES) {
    const svc = key ? TOKENS[key] : '';
    if (svc && bearer === svc) return req.headers['x-blinkone-tenant-id'] || '';
  }
  try {
    const payload = jwt.verify(bearer, JWT_SECRET);
    return String(payload.tenant_id ?? '');
  } catch {
    return '';
  }
}

function authenticateGatewayJwt(req, res, next) {
  const path = (req.originalUrl || req.url).split('?')[0];
  const entry = JWT_PROXY_PREFIXES.find(([prefix]) => path.startsWith(prefix));
  if (!entry) return next();

  const [, tokenKey] = entry;
  const serviceToken = tokenKey ? TOKENS[tokenKey] : '';

  if (isTwilioVoiceWebhook(path) && serviceToken) {
    req.gatewayAuth = { serviceToken };
    if (!req.headers['x-blinkone-tenant-id']) {
      req.headers['x-blinkone-tenant-id'] = IVR_DEFAULT_TENANT;
    }
    return next();
  }

  const auth = String(req.headers.authorization || '');
  if (!auth.startsWith('Bearer ')) {
    return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Bearer token required' } });
  }
  const bearer = auth.slice(7).trim();

  if (serviceToken && bearer === serviceToken) {
    req.gatewayAuth = { service: true };
    return next();
  }

  try {
    const payload = jwt.verify(bearer, JWT_SECRET);
    const headerTenant = req.headers['x-blinkone-tenant-id'];
    const jwtTenant = String(payload.tenant_id ?? '');
    if (
      typeof headerTenant === 'string' &&
      headerTenant &&
      jwtTenant &&
      headerTenant !== jwtTenant &&
      !(payload.roles || []).includes('platform_admin')
    ) {
      return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Cross-tenant access denied' } });
    }
    req.gatewayAuth = { payload, serviceToken };
    let signed;
    try {
      signed = signTenantHeaders(payload);
    } catch (sigErr) {
      log.error({ err: sigErr.message }, 'signTenantHeaders failed');
      return res.status(500).json({ error: { code: 'CONFIG_ERROR', message: 'Gateway misconfigured' } });
    }
    for (const [k, v] of Object.entries(signed)) {
      req.headers[k] = v;
    }
    next();
  } catch {
    return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Invalid or expired token' } });
  }
}

const LIMIT_CHECK_PREFIXES = ['/api/ai', '/api/calls', '/api/routing', '/api/sla', '/api/escalations'];

const WEBHOOK_SECRET = (process.env.CHATWOOT_WEBHOOK_SECRET || '').trim();

// ─── App ──────────────────────────────────────────────────────────────────────
const app = express();
app.disable('x-powered-by');
// Trust the single nginx reverse-proxy in front of us so that
// req.ip and X-Forwarded-For reflect the real client address.
app.set('trust proxy', 1);
mountMetrics(app, 'gateway');

// ─── CORS (locked to CORS_ORIGINS) ───────────────────────────────────────────
app.use((req, res, next) => {
  const origin = req.headers.origin || '';
  if (origin && CORS_ORIGINS.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Authorization,Content-Type,X-Request-Id,api_access_token,api-access-token,x-api-access-token,X-Blinkone-Tenant-Id');
    res.setHeader('Access-Control-Max-Age', '86400');
  }
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// Correlation ID + request logger
app.use((req, res, next) => {
  req.requestId = req.headers['x-request-id'] || randomUUID();
  res.setHeader('X-Request-Id', req.requestId);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  const t = Date.now();
  res.on('finish', () => log.info({ method: req.method, url: maskString(req.originalUrl), status: res.statusCode, ms: Date.now() - t }, 'req'));
  next();
});

// ─── Health ───────────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'gateway', uptime: Math.floor((Date.now() - STARTED) / 1000) }));

// ─── Proxy factory ────────────────────────────────────────────────────────────
function proxy(target, prefix, overrideToken) {
  return createProxyMiddleware({
    target,
    changeOrigin: true,
    pathRewrite: (p) => p.replace(new RegExp(`^${prefix}`), '') || '/',
    on: {
      proxyReq: (pr, req) => {
        pr.setHeader('X-Request-Id', req.requestId || '');
        const svcToken = req.gatewayAuth?.serviceToken || overrideToken;
        if (svcToken) pr.setHeader('Authorization', `Bearer ${svcToken}`);
        else if (overrideToken) pr.setHeader('Authorization', `Bearer ${overrideToken}`);
        if (req.gatewayAuth?.payload) {
          for (const [k, v] of Object.entries(signTenantHeaders(req.gatewayAuth.payload))) {
            pr.setHeader(k, v);
          }
        }
      },
      proxyRes: (_pr, req, res) => res.setHeader('X-Request-Id', req.requestId || ''),
      error: (e, req, res) => {
        log.error({ url: target, err: e.message }, 'proxy error');
        if (!res.headersSent) res.status(502).json({ error: { code: 'BAD_GATEWAY', message: 'Upstream unavailable' } });
      },
    },
  });
}

// Pass-through proxy: Express strips the mount prefix, so we restore it via pathRewrite
// e.g. app.use('/api/v1', passthroughProxy(target, '/api/v1')) → forwards /api/v1/... intact
function passthroughProxy(target, prefix) {
  return createProxyMiddleware({
    target,
    changeOrigin: true,
    pathRewrite: (path) => prefix + path,
    on: {
      proxyReq: (pr, req) => { pr.setHeader('X-Request-Id', req.requestId || ''); },
      proxyRes: (_pr, req, res) => res.setHeader('X-Request-Id', req.requestId || ''),
      error: (e, _req, res) => {
        log.error({ url: target, err: e.message }, 'proxy error');
        if (!res.headersSent) res.status(502).json({ error: { code: 'BAD_GATEWAY', message: 'Upstream unavailable' } });
      },
    },
  });
}

function notImpl(name) {
  return (_req, res) => res.status(501).json({ error: { code: 'NOT_CONFIGURED', message: `${name} upstream not configured` } });
}

async function usageLimitGuard(req, res, next) {
  const path = req.originalUrl || req.url;
  if (!LIMIT_CHECK_PREFIXES.some((p) => path.startsWith(p))) return next();
  const tenantId = req.headers['x-blinkone-tenant-id'] || tenantIdFromJwt(req);
  if (!tenantId || !U.billing || !TOKENS.billing) return next();
  try {
    const r = await fetch(`${U.billing}/v1/tenants/${encodeURIComponent(tenantId)}/usage/limits`, {
      headers: { Authorization: `Bearer ${TOKENS.billing}`, Accept: 'application/json' },
    });
    if (r.ok) {
      const json = await r.json();
      const data = json.data ?? json;
      if (data.blocked) {
        return res.status(402).json({
          error: { code: 'LIMIT_EXCEEDED', message: data.reason || 'Usage limit exceeded' },
        });
      }
    }
  } catch (e) {
    log.warn({ err: e.message }, 'usage limit check skipped');
  }
  next();
}

// Public customer session + authenticated device push registration (before JWT proxy)
mountCustomerRoutes(app, { JWT_SECRET, log, U, TOKENS });
mountDeviceRoutes(app, { JWT_SECRET, log, jwt });

app.use(authenticateGatewayJwt);
app.use(rbacApiGuard());
app.use(requirePlatformAdmin);
app.use(usageLimitGuard);

// ─── Routes ───────────────────────────────────────────────────────────────────
const route = (path, target, token) =>
  app.use(path, target ? proxy(target, path, token) : notImpl(path));

// Exchange Chatwoot user token → BlinkOne gateway JWT (Next.js frontend login step 2)
app.post('/api/auth/token', authRateLimitMiddleware(), express.json(), async (req, res) => {
  const auth = String(req.headers.authorization || '');
  const bearer = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  const cwToken = String(
    req.headers['api_access_token'] ||
      req.headers['api-access-token'] ||
      req.headers['x-api-access-token'] ||
      bearer ||
      '',
  ).trim();
  if (!cwToken) {
    return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'api_access_token header required' } });
  }
  // JWT_SECRET is guaranteed non-empty (fail-fast at startup)

  try {
    const profileRes = await fetch(`${U.chatwoot}/api/v1/profile`, {
      headers: { api_access_token: cwToken, Accept: 'application/json' },
    });
    if (!profileRes.ok) {
      log.warn({ status: profileRes.status }, 'chatwoot profile validation failed');
      return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Invalid Chatwoot token' } });
    }
    const body = await profileRes.json();
    const user = body?.data ?? body;
    const userId = user?.id;
    if (!userId) {
      return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Invalid profile payload' } });
    }

    const accountId = user.account_id ?? user.active_account_id ?? userId;
    const tenantId = String(accountId);
    const roles = mapChatwootRoles(user.role);
    const email = String(user.email || '').trim().toLowerCase();
    if (isChatwootSuperAdmin(user) || (email && PLATFORM_ADMIN_EMAILS.includes(email))) {
      if (!roles.includes('platform_admin')) roles.push('platform_admin');
    }
    const rbac = await loadEffectiveRbac({
      tenantId,
      userId,
      roles,
      email: user.email,
      name: user.name,
      chatwootRole: user.role,
    });
    const expiresIn = 12 * 60 * 60;

    // ── MFA check (Sprint 2 M01) ───────────────────────────────────────────
    if (U.platform && process.env.MFA_ENABLED !== '0') {
      try {
        const mfaRes = await fetch(
          `${U.platform}/v1/mfa/status?user_id=${encodeURIComponent(userId)}&tenant_id=${encodeURIComponent(tenantId)}`,
          { headers: { Accept: 'application/json', ...(TOKENS.platform ? { Authorization: `Bearer ${TOKENS.platform}` } : {}) } },
        );
        if (mfaRes.ok) {
          const mfaBody = await mfaRes.json();
          if (mfaBody?.data?.enabled) {
            // Issue short-lived MFA challenge token (5 minutes)
            const challengeToken = jwt.sign(
              {
                mfa_challenge: true,
                sub:           String(userId),
                tenant_id:     tenantId,
                account_id:    accountId,
                cw_token:      cwToken,
                roles,
              },
              JWT_SECRET,
              { expiresIn: 5 * 60, issuer: 'blinkone-gateway' },
            );
            return res.status(200).json({ mfa_required: true, mfa_token: challengeToken });
          }
        }
      } catch (mfaErr) {
        // MFA check failed (platform down) — fall through to normal token
        log.warn({ err: mfaErr.message }, 'MFA status check failed, skipping');
      }
    }

    const token = jwt.sign(
      {
        sub: String(userId),
        tenant_id: tenantId,
        roles,
        account_id: accountId,
        permissions: rbac?.permissions ?? [],
        pages: rbac?.pages ?? [],
      },
      JWT_SECRET,
      { expiresIn, issuer: 'blinkone-gateway' },
    );

    const features = await tenantFeaturesPayload(tenantId);

    return res.json({
      token,
      expiresIn,
      roles,
      permissions: rbac?.permissions ?? [],
      pages: rbac?.pages ?? [],
      rbacRoles: rbac?.roles ?? [],
      features,
    });
  } catch (e) {
    log.error({ err: e.message }, 'auth token exchange failed');
    return res.status(502).json({ error: { code: 'BAD_GATEWAY', message: 'Token exchange failed' } });
  }
});

function mapChatwootRoles(role) {
  if (role === 'administrator') return ['admin'];
  if (role === 'supervisor') return ['supervisor'];
  if (role === 'agent') return ['agent'];
  return ['viewer'];
}

/** Chatwoot SuperAdmin (platform operator) → BlinkOne platform_admin. */
function isChatwootSuperAdmin(user) {
  return String(user?.type ?? '').trim() === 'SuperAdmin';
}

// ─── MFA step-up — Sprint 2 M01 ─────────────────────────────────────────────
// Called after /api/auth/token returns { mfa_required: true, mfa_token }.
// Client sends mfa_token + the 6-digit code from their authenticator app.
// Returns the full gateway JWT on success.
app.post('/api/auth/mfa', authRateLimitMiddleware(), express.json(), async (req, res) => {
  const { mfa_token: mfaToken, code } = req.body ?? {};
  if (!mfaToken || !String(code ?? '').trim()) {
    return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'mfa_token and code required' } });
  }
  // JWT_SECRET is guaranteed non-empty (fail-fast at startup)
  let challenge;
  try {
    challenge = jwt.verify(mfaToken, JWT_SECRET, { issuer: 'blinkone-gateway' });
  } catch {
    return res.status(401).json({ error: { code: 'INVALID_TOKEN', message: 'Invalid or expired MFA challenge token' } });
  }
  if (!challenge.mfa_challenge) {
    return res.status(401).json({ error: { code: 'INVALID_TOKEN', message: 'Token is not an MFA challenge' } });
  }

  const { sub: userId, tenant_id: tenantId, account_id: accountId, roles, cw_token: cwToken } = challenge;

  // Verify TOTP code via platform service
  let valid = false;
  if (U.platform) {
    try {
      const verRes = await fetch(`${U.platform}/v1/mfa/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(TOKENS.platform ? { Authorization: `Bearer ${TOKENS.platform}` } : {}) },
        body: JSON.stringify({ userId, tenantId, code: String(code).trim() }),
      });
      const verBody = await verRes.json().catch(() => ({}));
      valid = verBody?.data?.valid === true;
    } catch (e) {
      log.error({ err: e.message }, 'MFA verify call failed');
      return res.status(502).json({ error: { code: 'BAD_GATEWAY', message: 'MFA verification service unavailable' } });
    }
  } else {
    // Fallback: no platform service — use local TOTP (only works if secret is embedded in token, not stored)
    return res.status(503).json({ error: { code: 'NOT_CONFIGURED', message: 'Platform service required for MFA' } });
  }

  if (!valid) {
    return res.status(401).json({ error: { code: 'INVALID_MFA_CODE', message: 'Incorrect TOTP code' } });
  }

  const expiresIn = 12 * 60 * 60;
  const token = jwt.sign(
    { sub: String(userId), tenant_id: tenantId, roles, account_id: accountId },
    JWT_SECRET,
    { expiresIn, issuer: 'blinkone-gateway' },
  );

  log.info({ userId, tenantId }, 'MFA verified — JWT issued');
  const features = await tenantFeaturesPayload(tenantId);
  return res.json({ token, expiresIn, features });
});

/** Platform admin — switch JWT tenant context (impersonation). */
app.post('/api/auth/impersonate-tenant', authRateLimitMiddleware(), express.json(), async (req, res) => {
  const auth = String(req.headers.authorization || '');
  if (!auth.startsWith('Bearer ')) {
    return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Bearer token required' } });
  }
  let payload;
  try {
    payload = jwt.verify(auth.slice(7).trim(), JWT_SECRET);
  } catch {
    return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Invalid or expired token' } });
  }
  if (!isPlatformAdminPayload(payload)) {
    return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Platform admin required' } });
  }
  const targetTenantId = String(req.body?.tenant_id ?? req.body?.tenantId ?? '');
  if (!targetTenantId) {
    return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'tenant_id required' } });
  }
  if (!U.tenant || !TOKENS.tenant) {
    return res.status(501).json({ error: { code: 'NOT_CONFIGURED', message: 'Tenant service unavailable' } });
  }
  try {
    const tenantRes = await fetch(`${U.tenant}/v1/tenants/${encodeURIComponent(targetTenantId)}`, {
      headers: { Accept: 'application/json', Authorization: `Bearer ${TOKENS.tenant}` },
    });
    if (!tenantRes.ok) {
      return res.status(tenantRes.status === 404 ? 404 : 502).json({
        error: { code: 'NOT_FOUND', message: 'Tenant not found' },
      });
    }
    const tenantBody = await tenantRes.json();
    const tenant = tenantBody?.data ?? tenantBody;
    const accountId = Number(tenant.chatwootAccountId ?? tenant.chatwoot_account_id ?? targetTenantId);
    const roles = Array.isArray(payload.roles) ? [...payload.roles] : [];
    if (!roles.includes('platform_admin')) roles.push('platform_admin');
    const rbac = await loadEffectiveRbac({
      tenantId: targetTenantId,
      userId: payload.sub,
      roles,
      email: payload.email,
      name: payload.name,
      chatwootRole: 'administrator',
    });
    const expiresIn = 12 * 60 * 60;
    const token = jwt.sign(
      {
        sub: String(payload.sub),
        tenant_id: targetTenantId,
        account_id: accountId,
        roles,
        permissions: rbac?.permissions ?? payload.permissions ?? [],
        pages: rbac?.pages ?? payload.pages ?? [],
        impersonating: true,
        impersonated_from: payload.tenant_id,
      },
      JWT_SECRET,
      { expiresIn, issuer: 'blinkone-gateway' },
    );
    log.info({ actor: payload.sub, targetTenantId }, 'tenant impersonation JWT issued');
    return res.json({
      token,
      expiresIn,
      tenantId: targetTenantId,
      chatwootAccountId: accountId,
      roles,
      permissions: rbac?.permissions ?? [],
      pages: rbac?.pages ?? [],
    });
  } catch (e) {
    log.error({ err: e.message }, 'impersonate-tenant failed');
    return res.status(502).json({ error: { code: 'BAD_GATEWAY', message: 'Impersonation failed' } });
  }
});

// Chatwoot pass-through (must be after /api/auth/token)
app.use('/api/chatwoot', proxy(U.chatwoot, '/api/chatwoot'));
app.use('/api/auth',     proxy(U.chatwoot, '/api/auth'));

// Chatwoot native API — nginx /api/ catches these before they reach Chatwoot,
// so we relay them here preserving the full /api/v1/... path
app.use('/api/v1', passthroughProxy(U.chatwoot, '/api/v1'));
app.use('/api/v2', passthroughProxy(U.chatwoot, '/api/v2'));

// ─── Per-route rate limiting ──────────────────────────────────────────────────
app.use('/api/ai',         rateLimitMiddleware('ai'));
app.use('/api/calls',      rateLimitMiddleware('calls'));
app.use('/api/recordings', rateLimitMiddleware('recording'));
app.use('/api/routing',    rateLimitMiddleware('routing'));
app.use('/api/whatsapp-calls', rateLimitMiddleware('calls'));
app.use('/api/tickets',    rateLimitMiddleware('tickets'));
app.use('/api/sla',        rateLimitMiddleware('sla'));
app.use('/api/billing',    rateLimitMiddleware('billing'));
app.use('/api/platform',   rateLimitMiddleware('platform'));
app.use('/api/tenant',     rateLimitMiddleware('platform'));
app.use('/api/webhooks',   rateLimitMiddleware('webhooks'));

// Enterprise services
route('/api/platform',    U.platform);
route('/api/tickets',     U.tickets);
route('/api/calls',       U.calls);
route('/api/ai',          U.ai,         TOKENS.ai);
route('/api/billing',     U.billing);
route('/api/ivr',         U.ivr);
route('/api/sla',         U.sla);
route('/api/escalations', U.escalation);
route('/api/routing',     U.routing);
route('/api/whatsapp-calls', U.whatsappCalls, TOKENS.whatsappCalls);
route('/api/recordings',  U.recording, TOKENS.recording);
route('/api/integrations',U.integration);
route('/api/tenant',       U.tenant);

// BlinkOne API (platform: branding, tenants, …)
if (U.platform) {
  app.use('/blinkone/api/v1', passthroughProxy(U.platform, '/v1'));
} else {
  app.use('/blinkone/api/v1', notImpl('/blinkone/api/v1'));
}

// ─── Chatwoot Webhook Fan-out ─────────────────────────────────────────────────
app.use('/api/webhooks/chatwoot', express.json({ limit: '1mb' }));

app.post('/api/webhooks/chatwoot', (req, res) => {
  // Verify HMAC signature if secret configured
  if (WEBHOOK_SECRET) {
    const sig = (req.headers['x-chatwoot-signature'] || '').trim();
    const expected = 'sha256=' + createHmac('sha256', WEBHOOK_SECRET).update(JSON.stringify(req.body)).digest('hex');
    try { if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return res.status(401).json({ error: { code: 'INVALID_SIGNATURE', message: 'Webhook signature mismatch' } }); }
    catch { return res.status(401).json({ error: { code: 'INVALID_SIGNATURE', message: 'Webhook signature missing or malformed' } }); }
  }

  res.status(200).json({ ok: true });

  // Prompt 10 — normalize + bus republish via integration sidecar
  if (U.integration) {
    const headers = { 'Content-Type': 'application/json', 'X-Request-Id': req.requestId || '' };
    if (WEBHOOK_SECRET) headers['X-Chatwoot-Signature'] = req.headers['x-chatwoot-signature'] || '';
    fetch(`${U.integration}/webhooks/chatwoot`, { method: 'POST', headers, body: JSON.stringify(req.body) })
      .catch(e => log.error({ err: e.message }, 'integration inbound failed'));
  }

  const body      = req.body ?? {};
  const event     = body.event;
  const rid       = req.requestId;
  const accountId = Number(body.account?.id);
  const convId    = Number(body.conversation?.id);
  const isId      = (n) => Number.isFinite(n) && n > 0;

  async function fanout(url, payload, token, { feature } = {}) {
    const headers = { 'Content-Type': 'application/json', 'X-Request-Id': rid };
    if (token) headers.Authorization = `Bearer ${token}`;
    const tid = payload.chatwootAccountId ?? payload.tenant_id ?? payload.tenantId ?? accountId;
    if (tid != null) headers['X-Blinkone-Tenant-Id'] = String(tid);
    if (feature && !(await tenantHasFeature(tid, feature))) return;
    fetch(url, { method: 'POST', headers, body: JSON.stringify(payload) })
      .then(r => { if (!r.ok) log.warn({ url, status: r.status }, 'fanout non-2xx'); })
      .catch(e => log.error({ url, err: e.message }, 'fanout failed'));
  }

  const slaPayload = (extra = {}) => ({
    event: extra.event ?? event,
    chatwootAccountId: isId(accountId) ? accountId : 0,
    tenant_id: isId(accountId) ? accountId : 0,
    conversationId: isId(convId) ? convId : null,
    conversation_id: isId(convId) ? convId : null,
    priority: body.conversation?.priority,
    status: body.status ?? body.conversation?.status,
    inbox_id: body.conversation?.inbox_id,
    message_type: body.message?.message_type,
    sender_type: body.message?.sender_type,
    channel: body.conversation?.channel,
    ...extra,
  });

  if (event === 'conversation_created') {
    const contact = body.meta?.sender ?? body.contact ?? {};
    const inbox   = body.inbox?.name ?? 'Chat';
    // Create CRM ticket
    fanout(`${U.tickets}/v1/tickets`, {
      chatwootAccountId: isId(accountId) ? accountId : 0,
      chatwootConversationId: isId(convId) ? convId : null,
      title: `Conversation #${convId} via ${inbox}`,
      channel: inbox, customerName: contact.name || 'Unknown',
      customerEmail: contact.email || '', status: 'open', priority: 'medium',
    }, TOKENS.ticket);
    fanout(`${U.sla}/v1/events`, slaPayload({ event: 'conversation_created' }), TOKENS.sla, { feature: 'sla' });
  }

  const escSyncEvents = new Set([
    'conversation_created',
    'conversation_updated',
    'conversation_status_changed',
    'message_created',
  ]);
  const escTypeMap = {
    conversation_created: 'conversation.created',
    conversation_updated: 'conversation.updated',
    conversation_status_changed: 'conversation.status_changed',
    message_created: 'message.created',
  };
  if (U.escalation && TOKENS.escalation && escSyncEvents.has(event)) {
    fanout(
      `${U.escalation}/v1/conversations/sync`,
      { type: escTypeMap[event] || event, ...body },
      TOKENS.escalation,
    );
  }

  if (event === 'message_created') {
    fanout(`${U.sla}/v1/events`, slaPayload({ event: 'message_created' }), TOKENS.sla, { feature: 'sla' });
    // T01: mirror inbound customer messages to linked ticket timeline
    if (body.message?.message_type === 0 && U.tickets) {
      fanout(`${U.tickets}/v1/webhooks/chatwoot`, {
        event: 'message_created',
        account: body.account,
        conversation: body.conversation,
        message: body.message,
        chatwootAccountId: isId(accountId) ? accountId : 0,
        conversationId: isId(convId) ? convId : null,
      }, TOKENS.ticket);
    }
    // WhatsApp outbound — agent replies with text / voice / video → Meta Cloud API
    if (U.whatsappCalls) {
      const ch = String(body.conversation?.channel ?? '');
      const isWa = /whatsapp/i.test(ch);
      const mt = body.message?.message_type;
      const isOutgoing = mt === 1 || mt === 'outgoing';
      if (isWa && isOutgoing && !body.message?.private) {
        fanout(`${U.whatsappCalls}/v1/webhooks/chatwoot`, body, TOKENS.whatsappCalls);
      }
    }
  }

  if (event === 'conversation_status_changed') {
    const slaExtra = body.status === 'resolved'
      ? { event: 'conversation_resolved', status: 'resolved' }
      : {};
    fanout(`${U.sla}/v1/events`, slaPayload({ event: 'conversation_status_changed', ...slaExtra }), TOKENS.sla, { feature: 'sla' });
    // T01: auto-resolve linked ticket when conversation is resolved
    if (U.tickets) {
      fanout(`${U.tickets}/v1/webhooks/chatwoot`, {
        event: 'conversation_status_changed',
        status: body.status,
        account: body.account,
        conversation: body.conversation,
        chatwootAccountId: isId(accountId) ? accountId : 0,
        conversationId: isId(convId) ? convId : null,
      }, TOKENS.ticket);
    }
    if (body.status === 'resolved') {
      fanout(`${U.sla}/v1/events`, slaPayload({ event: 'conversation_resolved', status: 'resolved' }), TOKENS.sla, { feature: 'sla' });
      fanout(`${U.integration}/v1/webhooks/dispatch`, {
        event: 'conversation.resolved',
        tenantId: isId(accountId) ? accountId : 0,
        payload: { conversationId: convId, accountId },
      }, TOKENS.integration);
    }
  }

  if (event === 'conversation_updated') {
    fanout(`${U.sla}/v1/events`, slaPayload({ event: 'conversation_updated' }), TOKENS.sla, { feature: 'sla' });
  }

  if (event === 'conversation_reopened') {
    fanout(`${U.sla}/v1/events`, slaPayload({ event: 'conversation_reopened', status: 'open' }), TOKENS.sla, { feature: 'sla' });
  }
});

// ─── Email Inbound Webhook — Sprint 2 E01 ────────────────────────────────────
// Forwards inbound email webhook payloads to the tickets service.
// Public URL: POST /api/webhooks/email?tenant_id=<tenantId>
// The EMAIL_INBOUND_SECRET bearer token is forwarded as-is so the tickets
// service can verify it.
app.use('/api/webhooks/email', express.json({ limit: '2mb' }), express.urlencoded({ extended: true, limit: '2mb' }));

app.post('/api/webhooks/email', (req, res) => {
  if (!U.tickets) return res.status(503).json({ error: { code: 'NOT_CONFIGURED', message: 'Tickets service unavailable' } });
  // Forward to tickets service including original auth header and tenant_id
  const qs = req.query?.tenant_id ? `?tenant_id=${encodeURIComponent(req.query.tenant_id)}` : '';
  const headers = {
    'Content-Type': 'application/json',
    ...(req.headers.authorization ? { Authorization: req.headers.authorization } : {}),
    ...(req.requestId ? { 'X-Request-Id': req.requestId } : {}),
  };
  fetch(`${U.tickets}/v1/webhooks/email${qs}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(req.body ?? {}),
  })
    .then(async (r) => {
      const body = await r.json().catch(() => ({}));
      res.status(r.ok ? 200 : r.status).json(body);
    })
    .catch((e) => {
      log.error({ err: e.message }, 'email webhook forward failed');
      res.status(502).json({ error: { code: 'BAD_GATEWAY', message: 'Email webhook upstream unavailable' } });
    });
});

// ─── 404 ──────────────────────────────────────────────────────────────────────
app.use((_req, res) => res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Route not found' } }));

// ─── Start ────────────────────────────────────────────────────────────────────
const server = app.listen(PORT, '0.0.0.0', () => log.info({ port: PORT }, 'gateway started'));
const stop = (sig) => { log.info({ sig }, 'shutdown'); server.close(() => process.exit(0)); setTimeout(() => process.exit(1), 10_000); };
process.on('SIGTERM', () => stop('SIGTERM'));
process.on('SIGINT',  () => stop('SIGINT'));
