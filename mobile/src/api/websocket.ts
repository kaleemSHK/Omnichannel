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
const subscriptions = new Map<string, Subscription>();

function getCable(): Cable {
  if (cable) return cable;
  const { tokens } = useAuthStore.getState();
  const url = tokens?.accessToken
    ? `${WS_URL}?access_token=${encodeURIComponent(tokens.accessToken)}`
    : WS_URL;
  cable = ActionCable.createConsumer(url) as Cable;
  return cable;
}

export function disconnectCable() {
  subscriptions.forEach((sub) => sub.unsubscribe());
  subscriptions.clear();
  cable?.disconnect();
  cable = null;
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
