export function resolveTenantId(req) {
  const header = req.headers['x-blinkone-tenant-id'];
  if (typeof header === 'string' && header.trim()) return header.trim();
  const q = req.query?.tenant_id ?? req.query?.tenantId;
  if (typeof q === 'string' && q.trim()) return q.trim();
  const body = req.body?.tenantId ?? req.body?.tenant_id;
  if (body != null && body !== '') return String(body);
  return (process.env.BILLING_DEFAULT_TENANT || 'default').trim();
}
