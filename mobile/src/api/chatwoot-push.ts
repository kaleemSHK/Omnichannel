import { CHATWOOT_URL } from '@/lib/env';

/** Register FCM token with Chatwoot for agent message push notifications. */
export async function registerChatwootPush(accessToken: string, fcmToken: string): Promise<void> {
  const res = await fetch(`${CHATWOOT_URL}/api/v1/notification_subscriptions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      api_access_token: accessToken,
    },
    body: JSON.stringify({
      notification_subscription: {
        subscription_type: 'fcm',
        subscription_attributes: { push_token: fcmToken },
      },
    }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const msg = (body as { message?: string })?.message ?? `Chatwoot push register failed (${res.status})`;
    throw new Error(msg);
  }
}
