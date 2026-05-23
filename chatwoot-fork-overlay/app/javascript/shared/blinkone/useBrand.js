/**
 * BlinkOne brand composable — fetches /blinkone/api/v1/branding (account-scoped).
 * Copy into Chatwoot fork: app/javascript/shared/blinkone/
 */

let cache = { key: null, payload: null, at: 0 };
const TTL_MS = 60_000;

function cacheKey(accountId) {
  return accountId == null ? 'global' : String(accountId);
}

export function invalidateBrandingCache() {
  cache = { key: null, payload: null, at: 0 };
}

export async function fetchBranding(accountId = null) {
  const key = cacheKey(accountId);
  if (cache.key === key && cache.payload && Date.now() - cache.at < TTL_MS) {
    return cache.payload;
  }
  const qs = accountId != null ? `?accountId=${encodeURIComponent(accountId)}` : '';
  const res = await fetch(`/blinkone/api/v1/branding${qs}`, {
    credentials: 'same-origin',
    headers: { Accept: 'application/json' },
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error?.message || `HTTP ${res.status}`);
  const payload = json.data ?? json;
  cache = { key, payload, at: Date.now() };
  return payload;
}

/**
 * Vue composable — use in dashboard/widget after Pinia is available.
 */
export function useBrand(accountId = null) {
  const state = {
    loaded: false,
    branding: null,
  };

  async function ensureLoaded(id = accountId) {
    if (state.loaded && state.branding) return state.branding;
    state.branding = await fetchBranding(id);
    state.loaded = true;
    return state.branding;
  }

  function logoUrl(variant = 'full') {
    const logos = state.branding?.logoUrl || {};
    return logos[variant] ?? logos.full ?? '/blinkone-brand/logo-full.svg';
  }

  return {
    ensureLoaded,
    logoUrl,
    get productName() {
      return state.branding?.productName ?? 'BlinkOne';
    },
    get primaryColor() {
      return state.branding?.primaryColor ?? '#0B5FFF';
    },
    get secondaryColor() {
      return state.branding?.secondaryColor ?? '#0A0F1C';
    },
    get tagline() {
      return state.branding?.tagline ?? '';
    },
    get copyrightLine() {
      return state.branding?.copyrightLine ?? '';
    },
    refresh: async (id = accountId) => {
      invalidateBrandingCache();
      state.loaded = false;
      return ensureLoaded(id);
    },
  };
}
