const GATEWAY_URL = (process.env.GATEWAY_URL || 'http://gateway:8787').replace(/\/$/, '');
const PLATFORM_TOKEN = (process.env.PLATFORM_TOKEN || process.env.TOKEN || '').trim();

/**
 * Ask gateway to FCM-push registered mobile devices when a call rings.
 * No-op unless PUSH_CALLS_ENABLED=1 and gateway/FCM are configured.
 */
export async function notifyIncomingCallPush(session) {
  if (process.env.PUSH_CALLS_ENABLED !== '1' || !PLATFORM_TOKEN) return;
  const tenantId = String(session.chatwootAccountId ?? session.tenantId ?? 'default');
  try {
    await fetch(`${GATEWAY_URL}/api/internal/push/call-ringing`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${PLATFORM_TOKEN}`,
      },
      body: JSON.stringify({
        tenantId,
        session: {
          id: session.id,
          customerPhone: session.customerPhone,
          transport: session.transport,
          conversationId: session.conversationId,
          agentLabel: session.agentLabel,
          direction: session.direction,
        },
      }),
    });
  } catch {
    /* optional — web Action Cable + SIP still handle ringing */
  }
}
