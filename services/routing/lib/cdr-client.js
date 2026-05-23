/**
 * POST CDR to calls service (step 6).
 */
export async function writeCdr(payload) {
  const base = (process.env.CALLS_URL || 'http://calls:8792').replace(/\/$/, '');
  const token = (process.env.CALLS_TOKEN || '').trim();
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  const body = {
    channel: 'voice',
    chatwootAccountId: Number(payload.tenantId) || 0,
    roomId: payload.callId,
    agentLabel: payload.agentId,
    customerPhone: payload.callerId,
    queueKey: payload.queueKey,
    disposition: payload.disposition,
    startedAt: payload.startedAt,
    endedAt: payload.endedAt,
    durationMs: payload.durationMs,
    asteriskChannelId: payload.callId,
  };

  try {
    const res = await fetch(`${base}/v1/cdr`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: json.error?.message };
    return { ok: true, session: json.data ?? json };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}
