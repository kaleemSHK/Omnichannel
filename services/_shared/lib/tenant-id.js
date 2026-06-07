/**
 * Shared tenant resolution — prefer gateway-injected X-Blinkone-Tenant-Id.
 * In production, missing tenant header must fail (no silent 'default' bucket).
 */

export function readTenantHeader(req) {
  if (req?.tenantId) return String(req.tenantId).trim();
  const header = req.headers?.['x-blinkone-tenant-id'];
  if (typeof header === 'string' && header.trim()) return header.trim();
  return '';
}

export function resolveTenantIdFromReq(req, { allowQuery = false, allowBody = false } = {}) {
  const header = readTenantHeader(req);
  if (header) return header;

  if (allowQuery) {
    const q = req.query?.tenant_id ?? req.query?.tenantId;
    if (typeof q === 'string' && q.trim()) return q.trim();
  }

  if (allowBody) {
    const b = req.body?.tenant_id ?? req.body?.tenantId;
    if (b != null && String(b).trim()) return String(b).trim();
  }

  return '';
}

export function requireTenantId(req, opts = {}) {
  const tid = resolveTenantIdFromReq(req, opts);
  if (tid) return tid;

  const fallback = (
    process.env.DEFAULT_TENANT ||
    process.env.TICKETS_DEFAULT_TENANT ||
    process.env.ESCALATION_DEFAULT_TENANT ||
    process.env.SLA_DEFAULT_TENANT ||
    ''
  ).trim();

  const allowFallback =
    process.env.ALLOW_DEFAULT_TENANT === '1' ||
    process.env.SLA_ALLOW_DEFAULT_TENANT === '1';

  if (fallback && allowFallback) return fallback;

  const err = new Error('X-Blinkone-Tenant-Id required');
  err.code = 'TENANT_REQUIRED';
  throw err;
}
