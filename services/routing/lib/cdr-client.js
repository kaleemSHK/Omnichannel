/**
 * POST CDR to calls service (step 6).
 * Updates an existing WebRTC leg when present — avoids duplicate PSTN shadow rows.
 */
export async function writeCdr(payload) {
  const base = (process.env.CALLS_URL || 'http://calls:8792').replace(/\/$/, '');
  const token = (process.env.CALLS_TOKEN || '').trim();
  const headers = {
    'Content-Type': 'application/json',
    'X-Blinkone-Tenant-Id': String(payload.tenantId ?? '1'),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const callId = payload.callId ? String(payload.callId) : '';
  const body = {
    channel: 'voice',
    chatwootAccountId: Number(payload.tenantId) || 0,
    roomId: callId,
    sessionId: payload.sessionId ?? payload.cdrSessionId ?? callId,
    agentLabel: payload.agentId,
    customerPhone: payload.callerName || payload.callerPhone || payload.callerId || null,
    callerName: payload.callerName ?? null,
    callerPhone: payload.callerPhone ?? payload.callerId ?? null,
    queueKey: payload.queueKey,
    disposition: payload.disposition,
    startedAt: payload.startedAt,
    endedAt: payload.endedAt,
    durationMs: payload.durationMs,
    asteriskChannelId: callId,
    transport: payload.transport ?? 'webrtc',
    metadata: {
      externalCallId: callId,
      callerName: payload.callerName ?? undefined,
      callerPhone: payload.callerPhone ?? payload.callerId ?? undefined,
    },
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
