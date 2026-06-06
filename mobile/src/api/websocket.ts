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
      handlers: {
        received?: (data: unknown) => void;
        connected?: () => void;
        disconnected?: () => void;
      },
    ) => Subscription;
  };
  disconnect: () => void;
};

let cable: Cable | null = null;
let cableAccessToken: string | null = null;
const subscriptions = new Map<string, Subscription>();

function getCable(forceNew = false): Cable {
  const { tokens } = useAuthStore.getState();
  const accessToken = tokens?.accessToken ?? '';

  if (!forceNew && cable && cableAccessToken === accessToken) return cable;

  if (cable) {
    subscriptions.forEach(sub => sub.unsubscribe());
    subscriptions.clear();
    cable.disconnect();
    cable = null;
  }

  const url = accessToken
    ? `${WS_URL}?user_access_token=${encodeURIComponent(accessToken)}`
    : WS_URL;
  cable = ActionCable.createConsumer(url) as Cable;
  cableAccessToken = accessToken;
  return cable;
}

export function disconnectCable() {
  subscriptions.forEach(sub => sub.unsubscribe());
  subscriptions.clear();
  cable?.disconnect();
  cable = null;
  cableAccessToken = null;
}

function ensureAgentRoom(accountId: number, userId: number, force = false): boolean {
  const key = 'agent_room';
  if (force) {
    subscriptions.get(key)?.unsubscribe();
    subscriptions.delete(key);
  }
  if (subscriptions.has(key)) return true;

  const { tokens } = useAuthStore.getState();
  const pubsubToken = tokens?.pubsubToken ?? '';
  if (!pubsubToken || !userId) return false;

  const sub = getCable(force).subscriptions.create(
    { channel: 'RoomChannel', pubsub_token: pubsubToken, account_id: accountId, user_id: userId },
    {
      connected() {
        if (__DEV__) console.info('[ActionCable] RoomChannel connected');
      },
      disconnected() {
        subscriptions.delete(key);
      },
      received(data: unknown) {
        const evt = data as { event?: string };
        if (!evt?.event) return;
        const handlers = roomHandlers.get(key);
        handlers?.forEach(fn => fn(data));
      },
    },
  );

  subscriptions.set(key, sub);
  return true;
}

const roomHandlers = new Map<string, Set<(data: unknown) => void>>();

export function reconnectAgentRoom(): void {
  const { user } = useAuthStore.getState();
  if (!user?.chatwootAccountId || !user.id) return;
  getCable(true);
  ensureAgentRoom(user.chatwootAccountId, user.id, true);
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
  const { user } = useAuthStore.getState();
  if (!user?.id) return () => undefined;

  const roomKey = 'agent_room';
  ensureAgentRoom(accountId, user.id);

  if (!roomHandlers.has(roomKey)) roomHandlers.set(roomKey, new Set());

  const handler = (data: unknown) => {
    const evt = data as { event?: string; data?: { conversation_id?: number } };
    const convId = Number(evt.data?.conversation_id);
    if (convId !== conversationId) return;

    if (evt.event === 'message.created' || evt.event === 'message.updated') {
      callbacks.onMessage?.(data);
    } else if (evt.event === 'conversation.status_changed') {
      callbacks.onStatusChange?.(data);
    } else if (evt.event === 'conversation.typing_on') {
      callbacks.onTyping?.(data);
    }
  };

  roomHandlers.get(roomKey)!.add(handler);
  return () => {
    roomHandlers.get(roomKey)?.delete(handler);
  };
}
