/**
 * Gateway API permission guard — enforces JWT permissions[] on proxied routes.
 * Skipped when permissions absent (legacy/dev) or user is platform_admin.
 */

const READ_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/** Longest-prefix match: API path → { read, write } permission keys */
const RULES = [
  { prefix: '/api/tenant/v1/rbac/roles', read: 'roles.view', write: 'roles.edit' },
  { prefix: '/api/tenant/v1/rbac/users', read: 'users.view', write: 'users.edit' },
  { prefix: '/api/billing', read: 'billing.view', write: 'billing.edit' },
  { prefix: '/api/ivr', read: 'ivr.view', write: 'ivr.edit' },
  { prefix: '/api/sla', read: 'reports.view', write: 'settings.edit' },
  { prefix: '/api/escalations', read: 'workflows.view', write: 'workflows.edit' },
  { prefix: '/api/ai', read: 'ai.view', write: 'ai.use' },
  { prefix: '/api/calls', read: 'calling.view', write: 'calling.make_call' },
  { prefix: '/api/routing', read: 'queues.view', write: 'queues.edit' },
  { prefix: '/api/tickets', read: 'tickets.view', write: 'tickets.create' },
  { prefix: '/api/integrations', read: 'integrations.view', write: 'integrations.configure' },
  { prefix: '/api/recordings', read: 'calling.view', write: 'calling.record_call' },
  { prefix: '/api/platform', read: 'settings.view', write: 'settings.edit' },
];

const SKIP_PREFIXES = [
  '/api/auth',
  '/api/customer',
  '/api/devices',
  '/api/webhooks',
  '/api/chatwoot',
  '/api/tenant/v1/rbac/effective',
  '/api/tenant/v1/rbac/catalog',
  '/api/tenant/v1/health',
  '/api/tenant/v1/resolve-host',
];

function requiredPermission(path, method) {
  const rule = [...RULES].sort((a, b) => b.prefix.length - a.prefix.length).find(r => path.startsWith(r.prefix));
  if (!rule) return null;
  return READ_METHODS.has(method) ? rule.read : rule.write;
}

export function rbacApiGuard() {
  return (req, res, next) => {
    const path = (req.originalUrl || req.url).split('?')[0];
    if (SKIP_PREFIXES.some(p => path.startsWith(p))) return next();

    const payload = req.gatewayAuth?.payload;
    if (!payload) return next();
    if ((payload.roles || []).includes('platform_admin')) return next();

    const permissions = payload.permissions;
    if (!Array.isArray(permissions) || permissions.length === 0) return next();

    const needed = requiredPermission(path, req.method);
    if (!needed) return next();
    if (permissions.includes(needed)) return next();

    return res.status(403).json({
      error: { code: 'FORBIDDEN', message: `Missing permission: ${needed}` },
    });
  };
}
