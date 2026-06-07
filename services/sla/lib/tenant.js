/**
 * Tenant context for SLA sidecar (TR-40 / Prompt 8).
 * Always prefer X-Blinkone-Tenant-Id from gateway JWT — never trust body alone.
 */
export function resolveTenantId(req) {
  if (req?.tenantId) return String(req.tenantId);
  const header = req.headers['x-blinkone-tenant-id'];
  if (typeof header === 'string' && header.trim()) return header.trim();
  const q = req.query?.tenant_id ?? req.query?.tenantId;
  if (typeof q === 'string' && q.trim()) return q.trim();
  return '';
}

export function requireTenantId(req) {
  const tid = resolveTenantId(req);
  if (tid) return tid;
  const fallback = (process.env.SLA_DEFAULT_TENANT || '').trim();
  if (fallback && process.env.SLA_ALLOW_DEFAULT_TENANT === '1') return fallback;
  const err = new Error('X-Blinkone-Tenant-Id required');
  err.code = 'TENANT_REQUIRED';
  throw err;
}
