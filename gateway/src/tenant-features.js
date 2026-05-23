const cache = new Map();
const TTL_MS = parseInt(process.env.FEATURE_CACHE_MS || '60000', 10);
const TENANT_URL = (process.env.TENANT_URL || 'http://tenant:8802').replace(/\/$/, '');
const TENANT_TOKEN = (process.env.TENANT_TOKEN || process.env.PLATFORM_TOKEN || '').trim();

function normalizeFeatureEnabled(val) {
  if (val === false) return false;
  if (val === true) return true;
  if (val && typeof val === 'object' && 'enabled' in val) return val.enabled !== false;
  return val != null;
}

export function isFeatureEnabled(features, key) {
  if (!(key in features)) return false;
  return normalizeFeatureEnabled(features[key]);
}

export async function fetchTenantFeatures(tenantId) {
  const key = String(tenantId);
  const hit = cache.get(key);
  if (hit && hit.exp > Date.now()) return hit.features;
  if (!TENANT_TOKEN) return {};
  try {
    const res = await fetch(`${TENANT_URL}/v1/tenants/${encodeURIComponent(key)}`, {
      headers: { Authorization: `Bearer ${TENANT_TOKEN}`, Accept: 'application/json' },
    });
    if (!res.ok) return {};
    const json = await res.json();
    const features = json.data?.features ?? {};
    cache.set(key, { features, exp: Date.now() + TTL_MS });
    return features;
  } catch {
    return {};
  }
}

export async function tenantHasFeature(tenantId, featureKey) {
  if (!tenantId) return false;
  const features = await fetchTenantFeatures(tenantId);
  return isFeatureEnabled(features, featureKey);
}
