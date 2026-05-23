/**
 * Tenant suspension guard (Prompt 8) — returns 423 when tenant is suspended.
 */
const cache = new Map();
const TTL_MS = parseInt(process.env.TENANT_STATUS_CACHE_MS || '60000', 10);

const TENANT_URL = (process.env.TENANT_URL || 'http://tenant:8802').replace(/\/$/, '');
const TENANT_TOKEN = (process.env.TENANT_TOKEN || process.env.PLATFORM_TOKEN || '').trim();

export async function getTenantStatus(tenantId) {
  const key = String(tenantId);
  const hit = cache.get(key);
  if (hit && hit.exp > Date.now()) return hit.status;

  if (!TENANT_TOKEN) return 'active';

  try {
    const res = await fetch(`${TENANT_URL}/v1/tenants/${encodeURIComponent(key)}`, {
      headers: { Authorization: `Bearer ${TENANT_TOKEN}` },
    });
    if (!res.ok) return 'active';
    const json = await res.json();
    const status = json.data?.status ?? json.status ?? 'active';
    cache.set(key, { status, exp: Date.now() + TTL_MS });
    return status;
  } catch {
    return 'active';
  }
}

export function invalidateTenantStatusCache(tenantId) {
  cache.delete(String(tenantId));
}

export function tenantSuspendedMiddleware(resolveTenantId, failFn) {
  return async (req, res, next) => {
    const tenantId = resolveTenantId(req);
    const status = await getTenantStatus(tenantId);
    if (status === 'suspended' || status === 'terminated') {
      return failFn(res, 'TENANT_SUSPENDED', 'This workspace is suspended', 423);
    }
    next();
  };
}
