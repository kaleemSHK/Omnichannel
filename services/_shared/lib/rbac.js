/**
 * Express-side RBAC (mirrors @blinkone/rbac permission map).
 * Enforced when x-blinkone-roles is present (user JWT / gateway context).
 * Service-token calls without roles skip checks for backward compatibility.
 */

const PERMISSIONS = {
  'billing:read': ['admin', 'supervisor', 'viewer'],
  'billing:write': ['admin'],
  'routing:read': ['admin', 'supervisor', 'agent', 'viewer'],
  'routing:write': ['admin', 'supervisor'],
  'sla:read': ['admin', 'supervisor', 'agent', 'viewer'],
  'sla:write': ['admin', 'supervisor'],
  'escalation:read': ['admin', 'supervisor', 'viewer'],
  'escalation:write': ['admin', 'supervisor'],
  'ai:read': ['admin', 'supervisor', 'agent', 'viewer'],
  'ai:write': ['admin', 'supervisor', 'agent'],
  'integration:read': ['admin', 'supervisor'],
  'integration:write': ['admin'],
  'branding:read': ['admin', 'supervisor', 'agent', 'viewer'],
  'branding:write': ['admin'],
  'audit:read': ['admin', 'supervisor'],
  'audit:write': ['admin', 'supervisor'],
  'calls:read': ['admin', 'supervisor', 'agent', 'viewer'],
  'calls:write': ['admin', 'supervisor', 'agent'],
  'sso:read': ['admin'],
  'sso:write': ['admin'],
};

const PLATFORM_ROLES = new Set(['platform_admin', 'platform_support', 'platform_billing']);

export function parseRoles(req) {
  const raw = req.headers['x-blinkone-roles'];
  if (!raw || typeof raw !== 'string') return [];
  return raw.split(',').map((r) => r.trim()).filter(Boolean);
}

export function hasPermission(roles, permission) {
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
    if (!roles.length) return next();
    if (!hasPermission(roles, permission)) {
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
  if (p.startsWith('/v1/sso')) {
    if (p === '/v1/sso/login' || p === '/v1/sso/callback') return null;
    return method === 'GET' || method === 'HEAD' ? 'sso:read' : 'sso:write';
  }
  if (p.startsWith('/v1/audit')) {
    return method === 'GET' || method === 'HEAD' ? 'audit:read' : 'audit:write';
  }
  if (p.startsWith('/v1/connectors') || p.startsWith('/v1/webhooks') || p.startsWith('/v1/api-keys')) {
    return method === 'GET' || method === 'HEAD' ? 'integration:read' : 'integration:write';
  }
  return method === 'GET' || method === 'HEAD' ? 'integration:read' : 'integration:write';
}

export function requireIntegrationRbac() {
  return (req, res, next) => {
    const perm = integrationPermission(req.method, req.path);
    if (!perm) return next();
    return requireRbac(perm)(req, res, next);
  };
}
