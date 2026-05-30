import { Platform } from 'react-native';
import { GATEWAY_URL } from '@/lib/env';
import { useAuthStore } from '@/store/auth';

export async function registerPushDevice(pushToken: string): Promise<void> {
  const { tokens } = useAuthStore.getState();
  if (!tokens?.gatewayJwt) return;

  const res = await fetch(`${GATEWAY_URL}/api/devices/register`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${tokens.gatewayJwt}`,
    },
    body: JSON.stringify({
      pushToken,
      platform: Platform.OS,
    }),
  });

  if (!res.ok) {
    let msg = `Device registration failed: ${res.status}`;
    try {
      const body = await res.json();
      msg = body?.error?.message ?? msg;
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }
}
