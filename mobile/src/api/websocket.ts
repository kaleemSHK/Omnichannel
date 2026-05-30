import ActionCable from 'react-native-actioncable';
import { useAuthStore } from '@/store/auth';
import { WS_URL } from '@/lib/env';

type Subscription = {
  unsubscribe: () => void;
};

type Cable = {
  subscriptions: {
    create: (
      params: Record<string, unknown>,
      handlers: { received?: (data: unknown) => void },
    ) => Subscription;
  };
  disconnect: () => void;
};

let cable: Cable | null = null;
let cableAccessToken: string | null = null;
const subscriptions = new Map<string, Subscription>();

function getCable(): Cable {
  const { tokens } = useAuthStore.getState();
  const accessToken = tokens?.accessToken ?? '';

  if (cable && cableAccessToken === accessToken) return cable;

  if (cable) {
    subscriptions.forEach((sub) => sub.unsubscribe());
    subscriptions.clear();
    cable.disconnect();
    cable = null;
  }

  const url = accessToken
    ? `${WS_URL}?access_token=${encodeURIComponent(accessToken)}`
    : WS_URL;
  cable = ActionCable.createConsumer(url) as Cable;
  cableAccessToken = accessToken;
  return cable;
}

export function disconnectCable() {
  subscriptions.forEach((sub) => sub.unsubscribe());
  subscriptions.clear();
  cable?.disconnect();
  cable = null;
  cableAccessToken = null;
}

export function subscribeToCallEvents(
  accountId: number,
  onCallEvent: (event: {
    eventType: 'call.ringing' | 'call.connected' | 'call.ended' | 'call.missed';
    callSession: unknown;
  }) => void,
): () => void {
  const key = `blinkone_calls_${accountId}`;
  subscriptions.get(key)?.unsubscribe();

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

export function subscribeToConversation(
  accountId: number,
  conversationId: number,
  callbacks: {
    onMessage?: (data: unknown) => void;
    onStatusChange?: (data: unknown) => void;
    onTyping?: (data: unknown) => void;
  },
): () => void {
  const key = `conversation_${conversationId}`;
  subscriptions.get(key)?.unsubscribe();

  const sub = getCable().subscriptions.create(
    { channel: 'RoomChannel', id: accountId, conversation_id: conversationId },
    {
      received(data: unknown) {
        const evt = data as { event?: string };
        if (!evt?.event) return;
        if (evt.event === 'message.created' || evt.event === 'message.updated') {
          callbacks.onMessage?.(data);
        } else if (evt.event === 'conversation.status_changed') {
          callbacks.onStatusChange?.(data);
        } else if (evt.event === 'conversation.typing_on') {
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
