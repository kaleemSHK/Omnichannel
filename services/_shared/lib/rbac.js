/**
 * Express-side RBAC (mirrors @blinkone/rbac permission map).
 * Enforced when x-blinkone-roles is present (user JWT / gateway context).
 * Service-token calls without roles skip checks for backward compatibility.
 */

const PERMISSIONS = {
  'integrations.view': ['admin', 'supervisor', 'viewer'],
  'integrations.configure': ['admin'],
  'settings.view': ['admin', 'supervisor', 'agent', 'viewer'],
  'settings.edit': ['admin', 'supervisor'],
  'audit.view': ['admin', 'supervisor'],
  'billing.view': ['admin', 'supervisor', 'viewer'],
  'billing.edit': ['admin'],
  'queues.view': ['admin', 'supervisor', 'agent', 'viewer'],
  'queues.edit': ['admin', 'supervisor'],
  'reports.view': ['admin', 'supervisor', 'agent', 'viewer'],
  'workflows.view': ['admin', 'supervisor', 'viewer'],
  'workflows.edit': ['admin', 'supervisor'],
  'ai.view': ['admin', 'supervisor', 'agent', 'viewer'],
  'ai.use': ['admin', 'supervisor', 'agent'],
  'calling.view': ['admin', 'supervisor', 'agent', 'viewer'],
  'calling.make_call': ['admin', 'supervisor', 'agent'],
  'calling.transfer_call': ['admin', 'supervisor', 'agent'],
  'calling.record_call': ['admin', 'supervisor'],
  'calling.monitor_call': ['admin', 'supervisor'],
  'ivr.view': ['admin', 'supervisor', 'viewer'],
  'ivr.edit': ['admin', 'supervisor'],
  'ivr.publish': ['admin', 'supervisor'],
  'ivr.delete': ['admin', 'supervisor'],
  'roles.view': ['admin', 'supervisor'],
  'users.view': ['admin', 'supervisor'],
  'users.edit': ['admin'],
};

const READ_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

const PLATFORM_ROLES = new Set(['platform_admin', 'platform_support', 'platform_billing']);

export function parseRoles(req) {
  const raw = req.headers['x-blinkone-roles'];
  if (!raw || typeof raw !== 'string') return [];
  return raw.split(',').map((r) => r.trim()).filter(Boolean);
}

export function parsePermissions(req) {
  const raw = req.headers['x-blinkone-permissions'];
  if (!raw || typeof raw !== 'string') return [];
  return raw.split(',').map((p) => p.trim()).filter(Boolean);
}

export function hasPermission(roles, permission, req = null) {
  const dynamic = req ? parsePermissions(req) : [];
  if (dynamic.length) return dynamic.includes(permission);
  if (!roles?.length) return true;
  if (roles.some((r) => PLATFORM_ROLES.has(r))) return true;
  const allowed = PERMISSIONS[permission];
  if (!allowed) return false;
  return roles.some((r) => allowed.includes(r));
}

export function mapChatwootRole(role) {
  if (role === 'administrator') return 'admin';
  if (role === 'supervisor') return 'supervisor';
  if (role === 'agent') return 'agent';
  return 'viewer';
}

/** @param {string} permission */
export function requireRbac(permission) {
  return (req, res, next) => {
    const roles = parseRoles(req);
    if (!roles.length && !parsePermissions(req).length) return next();
    if (!hasPermission(roles, permission, req)) {
      return res.status(403).json({
        error: { code: 'FORBIDDEN', message: `Missing permission: ${permission}` },
      });
    }
    return next();
  };
}

/** Integration service: map path + method → permission */
export function integrationPermission(method, path) {
  const p = path.split('?')[0];
  if (p.startsWith('/webhooks/')) return null;
  if (p.startsWith('/v1/sso')) {
    if (p === '/v1/sso/login' || p === '/v1/sso/callback') return null;
    return method === 'GET' || method === 'HEAD' ? 'settings.view' : 'settings.edit';
  }
  if (p.startsWith('/v1/audit')) {
    return method === 'GET' || method === 'HEAD' ? 'audit.view' : 'settings.edit';
  }
  if (p.startsWith('/v1/connectors') || p.startsWith('/v1/webhooks') || p.startsWith('/v1/api-keys')) {
    return method === 'GET' || method === 'HEAD' ? 'integrations.view' : 'integrations.configure';
  }
  return method === 'GET' || method === 'HEAD' ? 'integrations.view' : 'integrations.configure';
}

export function requireIntegrationRbac() {
  return (req, res, next) => {
    const perm = integrationPermission(req.method, req.path);
    if (!perm) return next();
    return requireRbac(perm)(req, res, next);
  };
}

function readOrWrite(method, readPerm, writePerm) {
  return READ_METHODS.has(method) ? readPerm : writePerm;
}

/** Calls service: map path + method → permission (null = skip) */
export function callsPermission(method, path) {
  const p = path.split('?')[0];
  if (p.startsWith('/v1/internal/')) return null;
  if (p === '/v1/cdr') return null;
  if (p.includes('/recording/pause') || p.includes('/recording/resume') || p.includes('/recording-link')) {
    return 'calling.record_call';
  }
  if (p.includes('/transfer')) return 'calling.transfer_call';
  if (p.startsWith('/v1/campaigns')) return readOrWrite(method, 'calling.view', 'calling.make_call');
  return readOrWrite(method, 'calling.view', 'calling.make_call');
}

export function requireCallsRbac() {
  return (req, res, next) => {
    const perm = callsPermission(req.method, req.path);
    if (!perm) return next();
    return requireRbac(perm)(req, res, next);
  };
}

/** IVR service: map path + method → permission (null = skip) */
export function ivrPermission(method, path) {
  const p = path.split('?')[0];
  if (
    p.startsWith('/v1/inbound/') ||
    p.startsWith('/v1/ivr/') ||
    /\/surveys\/[^/]+\/respond$/.test(p)
  ) {
    return null;
  }
  if (p.includes('/publish')) return 'ivr.publish';
  if (method === 'DELETE') return 'ivr.delete';
  return readOrWrite(method, 'ivr.view', 'ivr.edit');
}

export function requireIvrRbac() {
  return (req, res, next) => {
    const perm = ivrPermission(req.method, req.path);
    if (!perm) return next();
    return requireRbac(perm)(req, res, next);
  };
}

/** SLA service: map path + method → permission (null = skip) */
export function slaPermission(method, path) {
  const p = path.split('?')[0];
  if (p === '/v1/events') return null;
  return readOrWrite(method, 'reports.view', 'settings.edit');
}

export function requireSlaRbac() {
  return (req, res, next) => {
    const perm = slaPermission(req.method, req.path);
    if (!perm) return next();
    return requireRbac(perm)(req, res, next);
  };
}
