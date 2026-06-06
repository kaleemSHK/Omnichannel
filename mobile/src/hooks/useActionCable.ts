import { useEffect } from 'react';
import { subscribeToConversation, reconnectAgentRoom } from '@/api/websocket';
import { useAuthStore } from '@/store/auth';

export function useActionCable(
  conversationId: number,
  callbacks: {
    onMessage?: () => void;
    onStatusChange?: () => void;
    onTyping?: () => void;
  },
) {
  const accountId = useAuthStore(s => s.user?.chatwootAccountId ?? 0);
  const userId = useAuthStore(s => s.user?.id ?? 0);
  const token = useAuthStore(s => s.tokens?.accessToken);
  const pubsubToken = useAuthStore(s => s.tokens?.pubsubToken);

  useEffect(() => {
    if (!conversationId || !accountId || !userId || !token || !pubsubToken) return;

    reconnectAgentRoom();
    const unsubscribe = subscribeToConversation(accountId, conversationId, {
      onMessage: () => callbacks.onMessage?.(),
      onStatusChange: () => callbacks.onStatusChange?.(),
      onTyping: () => callbacks.onTyping?.(),
    });
    return unsubscribe;
  }, [
    conversationId,
    accountId,
    userId,
    token,
    pubsubToken,
    callbacks.onMessage,
    callbacks.onStatusChange,
    callbacks.onTyping,
  ]);
}
