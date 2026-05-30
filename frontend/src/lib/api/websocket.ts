/**
 * Action Cable WebSocket client — Chatwoot realtime push.
 *
 * Chatwoot channels:
 *   - RoomChannel          → conversation events (new message, status change, assignment)
 *   - NotificationsChannel → agent notifications
 *   - BlinkoneCallChannel  → call events (ringing, connected, ended) — custom BlinkOne channel
 *
 * Auth: Chatwoot Action Cable accepts `user_access_token` as a query param
 * on the WS URL: wss://host/cable?access_token=<token>
 *
 * NOTE: actioncable package is used. If running SSR, guard with typeof window !== 'undefined'.
 */

import { useAuthStore } from '@/lib/store/auth';
import { isActionCableReady, getConfiguredWsUrl } from '@/lib/env/telephony';

const WS_URL = getConfiguredWsUrl();

let cable: ActionCable.Cable | null = null;
let subscriptions: Map<string, ActionCable.Subscription> = new Map();

function getCable(): ActionCable.Cable {
  if (!isActionCableReady()) {
    throw new Error('ActionCable not configured — set NEXT_PUBLIC_WS_URL in .env.local');
  }
  if (cable) return cable;
  if (typeof window === 'undefined') throw new Error('ActionCable requires browser environment');

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const ActionCable = require('actioncable');
  const { tokens } = useAuthStore.getState();
  // Chatwoot ActionCable requires user_access_token query param for authentication
  const url = tokens?.accessToken
    ? `${WS_URL}?user_access_token=${encodeURIComponent(tokens.accessToken)}`
    : WS_URL;

  cable = ActionCable.createConsumer(url);
  return cable!;
}

export function disconnectCable() {
  subscriptions.forEach((sub) => sub.unsubscribe());
  subscriptions.clear();
  cable?.disconnect();
  cable = null;
}

// ─── Conversation channel ──────────────────────────────────────────────────────
export function subscribeToConversation(
  accountId: number,
  conversationId: number,
  callbacks: {
    onMessage?: (data: unknown) => void;
    onStatusChange?: (data: unknown) => void;
    onTyping?: (data: unknown) => void;
  },
): () => void {
  if (!isActionCableReady()) return () => undefined;
  const key = `conversation_${conversationId}`;
  if (subscriptions.has(key)) subscriptions.get(key)?.unsubscribe();

  // Chatwoot RoomChannel requires pubsub_token (from sign_in response) for auth
  const { tokens } = useAuthStore.getState();
  const pubsubToken = tokens?.pubsubToken ?? tokens?.accessToken ?? '';

  const sub = getCable().subscriptions.create(
    { channel: 'RoomChannel', pubsub_token: pubsubToken, account_id: accountId },
    {
      received(data: { event?: string; [k: string]: unknown }) {
        if (!data?.event) return;
        if (data.event === 'message.created' || data.event === 'message.updated') {
          callbacks.onMessage?.(data);
        } else if (data.event === 'conversation.status_changed') {
          callbacks.onStatusChange?.(data);
        } else if (data.event === 'conversation.typing_on') {
          callbacks.onTyping?.(data);
        }
      },
    },
  );

  subscriptions.set(key, sub);
  return () => {
    sub.unsubscribe();
    subscriptions.delete(key);
  };
}

// ─── Agent notifications channel ──────────────────────────────────────────────
export function subscribeToNotifications(
  accountId: number,
  userId: number,
  onNotification: (data: unknown) => void,
): () => void {
  const key = `notifications_${userId}`;
  if (subscriptions.has(key)) subscriptions.get(key)?.unsubscribe();

  const sub = getCable().subscriptions.create(
    { channel: 'NotificationsChannel', id: accountId },
    { received: onNotification },
  );

  subscriptions.set(key, sub);
  return () => {
    sub.unsubscribe();
    subscriptions.delete(key);
  };
}

// ─── BlinkOne Call channel (custom Ruby channel) ───────────────────────────────
export function subscribeToCallEvents(
  accountId: number,
  onCallEvent: (event: {
    eventType: 'call.ringing' | 'call.connected' | 'call.ended' | 'call.missed';
    callSession: unknown;
  }) => void,
): () => void {
  if (!isActionCableReady()) return () => undefined;
  const key = `blinkone_calls_${accountId}`;
  if (subscriptions.has(key)) subscriptions.get(key)?.unsubscribe();

  const sub = getCable().subscriptions.create(
    { channel: 'BlinkoneCallChannel', account_id: accountId },
    { received: onCallEvent },
  );

  subscriptions.set(key, sub);
  return () => {
    sub.unsubscribe();
    subscriptions.delete(key);
  };
}
