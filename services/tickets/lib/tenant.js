export function resolveTenantId(req) {
  const header = req.headers['x-blinkone-tenant-id'];
  if (typeof header === 'string' && header.trim()) return header.trim();
  const q = req.query?.tenant_id ?? req.query?.tenantId;
  if (typeof q === 'string' && q.trim()) return q.trim();
  const body = req.body?.tenantId ?? req.body?.tenant_id;
  if (body != null && body !== '') return String(body);
  return (process.env.TICKETS_DEFAULT_TENANT || 'default').trim();
}

export function resolveAccountId(req) {
  const fromQuery = Number(req.query?.chatwoot_account_id);
  if (Number.isFinite(fromQuery) && fromQuery > 0) return fromQuery;
  const header = Number(req.headers['x-blinkone-account-id']);
  if (Number.isFinite(header) && header > 0) return header;
  const tenant = Number(resolveTenantId(req));
  if (Number.isFinite(tenant) && tenant > 0) return tenant;
  return NaN;
}
