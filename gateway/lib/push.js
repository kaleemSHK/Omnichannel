/**
 * FCM push dispatch for incoming calls (Android/iOS via legacy HTTP API or HTTP v1).
 * Set FCM_SERVER_KEY (legacy) or FCM_SERVICE_ACCOUNT_JSON (HTTP v1) in gateway env.
 */

function legacyKey() {
  return (process.env.FCM_SERVER_KEY || '').trim();
}

/** @returns {Promise<{ sent: number; failed: number; skipped?: boolean }>} */
export async function sendIncomingCallPush(tokens, payload) {
  const list = [...new Set(tokens.filter((t) => typeof t === 'string' && t.length > 8))];
  if (!list.length) return { sent: 0, failed: 0 };

  const key = legacyKey();
  if (!key) return { sent: 0, failed: 0, skipped: true };

  const { sessionId, customerPhone, transport, conversationId, callerName } = payload;
  const title = 'Incoming call';
  const body = callerName || customerPhone || 'Unknown caller';
  const data = {
    type: 'incoming_call',
    callSessionId: String(sessionId ?? ''),
    customerPhone: String(customerPhone ?? ''),
    transport: String(transport ?? 'pstn'),
    conversationId: conversationId != null ? String(conversationId) : '',
  };

  let sent = 0;
  let failed = 0;

  for (const token of list) {
    try {
      const res = await fetch('https://fcm.googleapis.com/fcm/send', {
        method: 'POST',
        headers: {
          Authorization: `key=${key}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to: token,
          priority: 'high',
          content_available: true,
          notification: {
            title,
            body,
            sound: 'default',
            android_channel_id: 'incoming_calls',
          },
          data,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok && json.success !== 0) sent += 1;
      else failed += 1;
    } catch {
      failed += 1;
    }
  }

  return { sent, failed };
}
