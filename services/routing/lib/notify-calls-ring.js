/**
 * Notify calls service when ACD assigns — Action Cable call.ringing + optional push.
 */
import { getCallMeta, setCallMeta } from './call-meta.js';

export async function notifyCallsAgentRing({
  tenantId,
  callId,
  agentId,
  agentLabel,
  queueKey,
  callerId,
  callerName,
  callerPhone,
  contactId,
  sessionId,
}) {
  const base = (process.env.CALLS_URL || 'http://calls:8790').replace(/\/$/, '');
  const token = (process.env.CALLS_TOKEN || process.env.TOKEN || '').trim();
  if (!token) return { ok: false, skipped: true };

  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
    'X-Blinkone-Tenant-Id': String(tenantId),
  };

  try {
    const res = await fetch(`${base}/v1/internal/calls/acd-assign`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        callId,
        agentId,
        agentLabel: agentLabel || undefined,
        queueKey,
        customerPhone: callerName || callerPhone || callerId || null,
        contactId: contactId ? String(contactId) : undefined,
        chatwootAccountId: Number(tenantId) || tenantId,
        sessionId: sessionId ?? null,
        transport: 'webrtc',
        metadata: {
          callerName: callerName || undefined,
          callerPhone: callerPhone || callerId || undefined,
          externalCallId: callId,
        },
      }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      return { ok: false, error: j.error?.message || res.statusText };
    }
    const payload = await res.json().catch(() => ({}));
    const row = payload?.data ?? payload;
    const cdrSessionId = row?.id ? String(row.id) : null;
    if (cdrSessionId && callId) {
      const prev = (await getCallMeta(tenantId, callId)) ?? {};
      await setCallMeta(tenantId, callId, { ...prev, cdrSessionId });
    }
    return { ok: true, data: payload };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}
