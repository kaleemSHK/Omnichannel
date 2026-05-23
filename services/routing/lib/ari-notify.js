/**
 * Ask IVR service to bridge caller channel to agent (ARI).
 */
export async function notifySupervise({ tenantId, callId, mode, supervisorId }) {
  const base = (process.env.IVR_URL || 'http://ivr:8795').replace(/\/$/, '');
  const token = (process.env.IVR_TOKEN || '').trim();
  const headers = { 'Content-Type': 'application/json', 'X-Blinkone-Tenant-Id': tenantId };
  if (token) headers.Authorization = `Bearer ${token}`;
  try {
    const res = await fetch(`${base}/v1/supervise`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ callId, mode, supervisorId }),
    });
    return { ok: res.ok, status: res.status };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

export async function notifyBridge({ tenantId, callId, agentId, queueKey }) {
  const base = (process.env.IVR_URL || 'http://ivr:8795').replace(/\/$/, '');
  const token = (process.env.IVR_TOKEN || '').trim();
  const headers = { 'Content-Type': 'application/json', 'X-Blinkone-Tenant-Id': tenantId };
  if (token) headers.Authorization = `Bearer ${token}`;

  try {
    const res = await fetch(`${base}/v1/bridge`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ callId, agentId, queueKey }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      return { ok: false, error: j.error?.message || res.statusText };
    }
    return { ok: true, data: await res.json().catch(() => ({})) };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}
