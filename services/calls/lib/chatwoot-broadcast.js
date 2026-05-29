const CHATWOOT_URL = (process.env.CHATWOOT_URL || 'http://chatwoot:3000').replace(/\/$/, '');
const BROADCAST_TOKEN = (process.env.CHATWOOT_INTERNAL_TOKEN || process.env.CHATWOOT_BOT_TOKEN || '').trim();

export async function broadcastCallEvent(accountId, payload) {
  if (!BROADCAST_TOKEN || !accountId) return;
  const { type, callId, conversationId, callSession } = payload;
  const eventType =
    payload.eventType ||
    (type === 'incoming' || type === 'ringing' ? 'call.ringing' : type === 'connected' ? 'call.connected' : type === 'ended' ? 'call.ended' : type === 'missed' ? 'call.missed' : null);
  try {
    await fetch(`${CHATWOOT_URL}/blinkone/api/v1/calls/broadcast`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Blinkone-Internal-Token': BROADCAST_TOKEN,
      },
      body: JSON.stringify({
        accountId,
        type,
        callId,
        conversationId,
        eventType,
        callSession: callSession ?? null,
      }),
    });
  } catch {
    /* optional */
  }
}

export async function broadcastCallRinging(session) {
  const accountId = session.chatwootAccountId ?? session.tenantId;
  return broadcastCallEvent(accountId, {
    type: 'incoming',
    callId: session.id,
    conversationId: session.conversationId,
    eventType: 'call.ringing',
    callSession: session,
  });
}
