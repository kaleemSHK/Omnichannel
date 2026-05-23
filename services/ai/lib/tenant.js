export function resolveTenantId(req) {
  const h = req.headers['x-blinkone-tenant-id'];
  if (typeof h === 'string' && h.trim()) return h.trim();
  const q = req.query?.tenant_id ?? req.body?.tenant_id;
  if (q != null && String(q).trim()) return String(q).trim();
  return (process.env.AI_DEFAULT_TENANT || 'default').trim();
}
