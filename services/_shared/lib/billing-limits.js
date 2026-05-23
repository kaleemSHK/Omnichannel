const BILLING_URL = (process.env.BILLING_URL || 'http://billing:8794').replace(/\/$/, '');
const TOKEN = (process.env.BILLING_TOKEN || '').trim();

/** @returns {Promise<{ blocked: boolean, reason?: string }>} */
export async function fetchUsageLimits(tenantId) {
  if (!TOKEN || !tenantId) return { blocked: false };
  try {
    const res = await fetch(`${BILLING_URL}/v1/tenants/${encodeURIComponent(tenantId)}/usage/limits`, {
      headers: { Authorization: `Bearer ${TOKEN}`, Accept: 'application/json' },
    });
    if (!res.ok) return { blocked: false };
    const json = await res.json();
    const data = json.data ?? json;
    return { blocked: !!data.blocked, reason: data.reason };
  } catch {
    return { blocked: false };
  }
}
