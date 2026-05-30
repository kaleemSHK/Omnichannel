const CALLS_URL = (process.env.CALLS_URL || 'http://calls:8792').replace(/\/$/, '');
const CALLS_TOKEN = (process.env.CALLS_TOKEN || '').trim();

/** Notify agent Calling UI (ActionCable) of inbound PSTN / Twilio call */
export async function notifyInboundCall(tenantId, { callId, from, to, transport = 'pstn' }) {
  if (!CALLS_TOKEN) return null;
  try {
    const res = await fetch(`${CALLS_URL}/v1/internal/calls/inbound`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${CALLS_TOKEN}`,
        'X-Blinkone-Tenant-Id': String(tenantId),
      },
      body: JSON.stringify({
        callId,
        customerPhone: from,
        queueKey: 'voicebot',
        transport,
        direction: 'inbound',
        metadata: { twilioTo: to, source: 'twilio_ivr' },
      }),
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json.data ?? json;
  } catch {
    return null;
  }
}
