/**
 * Hand off a call to the routing service (Prompt 5 step 4).
 *
 * IVR1: skillOverride = [{skill, required?}] — per-call skill requirements
 * merged with the queue's base skills before agent selection.
 *
 * @param {object} opts
 * @param {string}  opts.tenantId
 * @param {string}  opts.queue         queue key
 * @param {string}  opts.callId
 * @param {string}  [opts.callerId]
 * @param {number}  [opts.priority]
 * @param {Array<{skill:string, required?:boolean}>} [opts.skillOverride]
 */
export async function requestRoute({ tenantId, queue, callId, callerId, priority, skillOverride }) {
  const base = (process.env.ROUTING_URL || 'http://routing:8798').replace(/\/$/, '');
  const token = (process.env.ROUTING_TOKEN || '').trim();
  const headers = {
    'Content-Type': 'application/json',
    'X-Blinkone-Tenant-Id': tenantId || 'default',
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const body = { queue, callId, callerId, priority };
  if (Array.isArray(skillOverride) && skillOverride.length) {
    body.skillOverride = skillOverride;
  }

  const res = await fetch(`${base}/v1/route/request`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(json.error?.message || `routing HTTP ${res.status}`);
    err.code = json.error?.code || 'ROUTING_ERROR';
    throw err;
  }
  return json.data ?? json;
}
