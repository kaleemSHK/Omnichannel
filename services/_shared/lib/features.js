const cache = new Map();
const TTL_MS = parseInt(process.env.FEATURE_CACHE_MS || '60000', 10);
const TENANT_URL = (process.env.TENANT_URL || 'http://tenant:8802').replace(/\/$/, '');
const TENANT_TOKEN = (process.env.TENANT_TOKEN || process.env.PLATFORM_TOKEN || '').trim();

const ALIASES = {
  'calling.pstn': ['telephony', 'calling.pstn'],
  telephony: ['telephony', 'calling.pstn'],
};

/** @param {unknown} val */
export function normalizeFeatureEnabled(val) {
  if (val === false) return false;
  if (val === true) return true;
  if (val && typeof val === 'object' && 'enabled' in val) return val.enabled !== false;
  return val != null;
}

/**
 * @param {Record<string, unknown>} features
 * @param {string} key
 */
export function isFeatureEnabled(features, key) {
  if (key in features) return normalizeFeatureEnabled(features[key]);
  const keys = (ALIASES[key] ?? [key]).filter((k) => k !== key);
  for (const k of keys) {
    if (k in features) return normalizeFeatureEnabled(features[k]);
  }
  return false;
}

const CALLING_FAILOPEN = process.env.FEATURE_FAILOPEN === '1' || process.env.CALLING_PSTN_ENABLED === '1';

/** Demo / degraded mode when tenant service is unreachable or entitlements not loaded */
const FAILOPEN_DEMO_FEATURES = {
  telephony: true,
  'calling.pstn': true,
  'calling.whatsapp': false,
  rag: true,
  agent_assist: true,
  voice_bot: true,
  sla: true,
  escalation: true,
};

export async function fetchTenantFeatures(tenantId) {
  const key = String(tenantId);
  const hit = cache.get(key);
  if (hit && hit.exp > Date.now()) return hit.features;
  if (!TENANT_TOKEN) {
    return CALLING_FAILOPEN ? FAILOPEN_DEMO_FEATURES : {};
  }
  try {
    const res = await fetch(`${TENANT_URL}/v1/tenants/${encodeURIComponent(key)}`, {
      headers: { Authorization: `Bearer ${TENANT_TOKEN}`, Accept: 'application/json' },
    });
    if (!res.ok) return CALLING_FAILOPEN ? FAILOPEN_DEMO_FEATURES : {};
    const json = await res.json();
    const features = json.data?.features ?? {};
    cache.set(key, { features, exp: Date.now() + TTL_MS });
    return features;
  } catch {
    return CALLING_FAILOPEN ? FAILOPEN_DEMO_FEATURES : {};
  }
}

export function invalidateFeatureCache(tenantId) {
  cache.delete(String(tenantId));
}

/**
 * Express middleware — blocks when feature disabled for tenant.
 * @param {string} featureKey
 * @param {(req: import('express').Request) => string} resolveTenantId
 * @param {(res: import('express').Response, code: string, msg: string, status: number) => void} failFn
 */
export function requireFeature(featureKey, resolveTenantId, failFn) {
  return async (req, res, next) => {
    const tenantId = resolveTenantId(req);
    const features = await fetchTenantFeatures(tenantId);
    if (!isFeatureEnabled(features, featureKey)) {
      const failopenKeys = ['calling.pstn', 'telephony', 'rag', 'agent_assist', 'voice_bot', 'sla', 'escalation'];
      if (CALLING_FAILOPEN && failopenKeys.includes(featureKey)) {
        return next();
      }
      return failFn(res, 'FEATURE_DISABLED', `Feature "${featureKey}" is not enabled for this workspace`, 403);
    }
    next();
  };
}
