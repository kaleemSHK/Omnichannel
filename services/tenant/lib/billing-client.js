const BILLING_URL = (process.env.BILLING_URL || 'http://billing:8794').replace(/\/$/, '');
const TOKEN = (process.env.BILLING_TOKEN || '').trim();

export async function assignBillingPlan(tenantId, planId) {
  if (!TOKEN || !planId) return { skipped: true };
  const res = await fetch(`${BILLING_URL}/v1/tenants/${encodeURIComponent(tenantId)}/subscription`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${TOKEN}`,
      'X-Blinkone-Tenant-Id': tenantId,
    },
    body: JSON.stringify({ planId, trialDays: 14 }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error?.message || `billing subscription ${res.status}`);
  return json.data ?? json;
}

export async function fetchTenantUsage(tenantId) {
  const headers = { Accept: 'application/json', 'X-Blinkone-Tenant-Id': tenantId };
  if (TOKEN) headers.Authorization = `Bearer ${TOKEN}`;
  const res = await fetch(`${BILLING_URL}/v1/tenants/${encodeURIComponent(tenantId)}/usage`, { headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `billing ${res.status}`);
  }
  const json = await res.json();
  return json.data ?? json;
}

/** Seat allowance from active billing plan (included_agents). */
export async function fetchSeatAllowance(tenantId) {
  try {
    const usage = await fetchTenantUsage(tenantId);
    const limit = usage?.subscription?.included?.agents;
    return {
      limit: limit != null ? Number(limit) : null,
      planName: usage?.subscription?.planName ?? null,
    };
  } catch {
    return { limit: null, planName: null };
  }
}
