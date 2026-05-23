/** Resolve tenant id from gateway headers or query (dev). */
export function resolveTenantId(req) {
  const header = req.headers['x-blinkone-tenant-id'];
  if (typeof header === 'string' && header.trim()) return header.trim();
  const q = req.query?.tenant_id;
  if (typeof q === 'string' && q.trim()) return q.trim();
  return (process.env.IVR_DEFAULT_TENANT || 'default').trim();
}
