const CHATWOOT_URL = (process.env.CHATWOOT_URL || 'http://chatwoot:3000').replace(/\/$/, '');
const BROADCAST_TOKEN = (process.env.CHATWOOT_INTERNAL_TOKEN || process.env.CHATWOOT_BOT_TOKEN || '').trim();

export async function broadcastCallEvent(accountId, { type, callId, conversationId }) {
  if (!BROADCAST_TOKEN || !accountId) return;
  try {
    await fetch(`${CHATWOOT_URL}/blinkone/api/v1/calls/broadcast`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Blinkone-Internal-Token': BROADCAST_TOKEN,
      },
      body: JSON.stringify({ accountId, type, callId, conversationId }),
    });
  } catch {
    /* optional */
  }
}
