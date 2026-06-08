/**
 * Resolve tenant-scoped Chatwoot API tokens for automation (escalation, tickets, etc.).
 * One automation user per tenant — agents never need manual token updates.
 */

const TENANT_URL = (process.env.TENANT_URL || 'http://tenant:8802').replace(/\/$/, '');
const TENANT_TOKEN = (process.env.TENANT_TOKEN || process.env.PLATFORM_TOKEN || '').trim();
const CACHE_MS = parseInt(process.env.CHATWOOT_TENANT_TOKEN_CACHE_MS || '300000', 10);

/** @type {Map<string, { token: string, at: number }>} */
const cache = new Map();

function globalFallbackToken() {
  return (
    process.env.CHATWOOT_BOT_TOKEN
    || process.env.CHATWOOT_API_ACCESS_TOKEN
    || process.env.CHATWOOT_API_TOKEN
    || ''
  ).trim();
}

async function fetchTenantToken(accountId, force = false) {
  if (!TENANT_URL || !TENANT_TOKEN) return null;
  const qs = force ? '&refresh=1' : '';
  const res = await fetch(
    `${TENANT_URL}/v1/internal/chatwoot-service-token?tenant_id=${encodeURIComponent(String(accountId))}${qs}`,
    {
      headers: {
        Authorization: `Bearer ${TENANT_TOKEN}`,
        Accept: 'application/json',
      },
    },
  );
  if (!res.ok) return null;
  const body = await res.json();
  return body?.data?.accessToken ?? body?.accessToken ?? null;
}

/**
 * @param {number|string} accountId Chatwoot account id (= BlinkOne tenant id)
 */
export async function getChatwootTokenForAccount(accountId, { force = false } = {}) {
  const id = String(accountId ?? '').trim();
  if (!id) {
    const fallback = globalFallbackToken();
    if (fallback) return fallback;
    throw new Error('accountId required for tenant Chatwoot token');
  }

  if (!force) {
    const hit = cache.get(id);
    if (hit && Date.now() - hit.at < CACHE_MS) return hit.token;
  }

  let token = await fetchTenantToken(id, force);
  if (!token && force !== true) {
    token = await fetchTenantToken(id, true);
  }

  if (token) {
    cache.set(id, { token, at: Date.now() });
    return token;
  }

  const fallback = globalFallbackToken();
  if (fallback) return fallback;

  throw new Error(`No Chatwoot service token for tenant ${id}`);
}

export function clearChatwootTokenCache(accountId) {
  if (accountId != null) cache.delete(String(accountId));
  else cache.clear();
}
