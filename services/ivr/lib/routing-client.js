/**
 * Hand off a call to the routing service (Prompt 5 step 4).
 */
export async function requestRoute({ tenantId, queue, callId, callerId, priority }) {
  const base = (process.env.ROUTING_URL || 'http://routing:8798').replace(/\/$/, '');
  const token = (process.env.ROUTING_TOKEN || '').trim();
  const headers = {
    'Content-Type': 'application/json',
    'X-Blinkone-Tenant-Id': tenantId || 'default',
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${base}/v1/route/request`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ queue, callId, callerId, priority }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(json.error?.message || `routing HTTP ${res.status}`);
    err.code = json.error?.code || 'ROUTING_ERROR';
    throw err;
  }
  return json.data ?? json;
}
