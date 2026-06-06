/**
 * Action Cable WebSocket client — Chatwoot realtime push.
 *
 * RoomChannel requires pubsub_token + user_id for agent subscriptions.
 * Presence heartbeat keeps agents "online" in Chatwoot (20s Redis TTL).
 */

import { useAuthStore } from '@/lib/store/auth';
import { isActionCableReady, getConfiguredWsUrl } from '@/lib/env/telephony';

let cable: ActionCable.Cable | null = null;
let subscriptions: Map<string, ActionCable.Subscription> = new Map();

/** Chatwoot Redis presence TTL defaults to 20s — heartbeat before expiry. */
const PRESENCE_INTERVAL_MS = 20_000;
const AGENT_ROOM_KEY = 'agent_room';

export type CablePayload = { event?: string; data?: Record<string, unknown> };
const roomHandlers = new Set<(payload: CablePayload) => void>();
let presenceTimer: ReturnType<typeof setInterval> | null = null;

type PerformSubscription = ActionCable.Subscription & {
  perform: (action: string, data?: Record<string, unknown>) => void;
};

function wsUrl(): string {
  const base = getConfiguredWsUrl();
  const { tokens } = useAuthStore.getState();
  return tokens?.accessToken
    ? `${base}?user_access_token=${encodeURIComponent(tokens.accessToken)}`
    : base;
}

function getCable(forceNew = false): ActionCable.Cable {
  if (!isActionCableReady()) {
    throw new Error('ActionCable not configured — set NEXT_PUBLIC_WS_URL');
  }
  if (typeof window === 'undefined') throw new Error('ActionCable requires browser');

  if (forceNew && cable) {
    stopPresenceHeartbeat();
    subscriptions.forEach(sub => sub.unsubscribe());
    subscriptions.clear();
    cable.disconnect();
    cable = null;
  }

  if (cable) return cable;

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const ActionCable = require('actioncable');
  cable = ActionCable.createConsumer(wsUrl());
  return cable!;
}

function stopPresenceHeartbeat() {
  if (presenceTimer) {
    clearInterval(presenceTimer);
    presenceTimer = null;
  }
}

function startPresenceHeartbeat(sub: PerformSubscription) {
  stopPresenceHeartbeat();
  const ping = () => {
    try {
      sub.perform('update_presence');
    } catch {
      /* non-fatal */
    }
  };
  ping();
  presenceTimer = setInterval(ping, PRESENCE_INTERVAL_MS);
}

export function disconnectCable() {
  stopPresenceHeartbeat();
  subscriptions.forEach(sub => sub.unsubscribe());
  subscriptions.clear();
  roomHandlers.clear();
  cable?.disconnect();
  cable = null;
}

function parseCablePayload(raw: unknown): CablePayload | null {
  if (!raw || typeof raw !== 'object') return null;
  const payload = raw as CablePayload;
  return payload.event ? payload : null;
}

function dropAgentRoomSubscription(): void {
  stopPresenceHeartbeat();
  subscriptions.get(AGENT_ROOM_KEY)?.unsubscribe();
  subscriptions.delete(AGENT_ROOM_KEY);
}

function ensureAgentRoomSubscription(accountId: number, userId: number, force = false): boolean {
  if (!isActionCableReady()) return false;
  if (force) dropAgentRoomSubscription();
  if (subscriptions.has(AGENT_ROOM_KEY)) return true;

  const { tokens } = useAuthStore.getState();
  const pubsubToken = tokens?.pubsubToken ?? '';
  if (!pubsubToken || !userId) return false;

  const sub = getCable(force).subscriptions.create(
    { channel: 'RoomChannel', pubsub_token: pubsubToken, account_id: accountId, user_id: userId },
    {
      connected(this: PerformSubscription) {
        startPresenceHeartbeat(this);
      },
      disconnected() {
        dropAgentRoomSubscription();
      },
      received(raw: unknown) {
        const payload = parseCablePayload(raw);
        if (!payload) return;
        roomHandlers.forEach(handler => handler(payload));
      },
    },
  ) as PerformSubscription;

  subscriptions.set(AGENT_ROOM_KEY, sub);
  return true;
}

/** Reconnect after pubsub token is loaded or refreshed. */
export function reconnectAgentRoom(): boolean {
  const { user } = useAuthStore.getState();
  if (!user?.chatwootAccountId || !user.id) return false;
  getCable(true);
  return ensureAgentRoomSubscription(user.chatwootAccountId, user.id, true);
}

export function onAgentRoomEvent(handler: (payload: CablePayload) => void): () => void {
  const { user } = useAuthStore.getState();
  if (!user?.chatwootAccountId || !user.id || !isActionCableReady()) return () => undefined;

  ensureAgentRoomSubscription(user.chatwootAccountId, user.id);
  roomHandlers.add(handler);
  return () => roomHandlers.delete(handler);
}

/** Register Chatwoot RoomChannel presence (same subscription as agent room). */
export function subscribeToAccountPresence(
  accountId: number,
  userId: number,
  onPresenceUpdate?: (data: unknown) => void,
): () => void {
  ensureAgentRoomSubscription(accountId, userId);
  if (!onPresenceUpdate) return () => undefined;

  return onAgentRoomEvent(payload => {
    if (payload.event === 'presence.update') {
      onPresenceUpdate(payload.data);
    }
  });
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

  ensureAgentRoomSubscription(accountId, user.id);

  return onAgentRoomEvent(payload => {
    const convId = Number(payload.data?.conversation_id);
    if (convId !== conversationId) return;

    if (payload.event === 'message.created' || payload.event === 'message.updated') {
      callbacks.onMessage?.(payload);
    } else if (payload.event === 'conversation.status_changed') {
      callbacks.onStatusChange?.(payload);
    } else if (payload.event === 'conversation.typing_on') {
      callbacks.onTyping?.(payload);
    }
  });
}

export function subscribeToNotifications(
  accountId: number,
  userId: number,
  onNotification: (data: unknown) => void,
): () => void {
  ensureAgentRoomSubscription(accountId, userId);
  return onAgentRoomEvent(payload => {
    if (payload.event === 'notification.created' || payload.event === 'notification.updated') {
      onNotification(payload);
    }
  });
}

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
