import { useEffect } from 'react';
import { subscribeToConversation } from '@/api/websocket';
import { useAuthStore } from '@/store/auth';

export function useActionCable(
  conversationId: number,
  callbacks: {
    onMessage?: () => void;
    onStatusChange?: () => void;
    onTyping?: () => void;
  },
) {
  const accountId = useAuthStore((s) => s.user?.chatwootAccountId ?? 0);
  const token = useAuthStore((s) => s.tokens?.accessToken);

  useEffect(() => {
    if (!conversationId || !accountId || !token) return;
    const unsubscribe = subscribeToConversation(accountId, conversationId, {
      onMessage: () => callbacks.onMessage?.(),
      onStatusChange: () => callbacks.onStatusChange?.(),
      onTyping: () => callbacks.onTyping?.(),
    });
    return unsubscribe;
  }, [conversationId, accountId, token, callbacks.onMessage, callbacks.onStatusChange, callbacks.onTyping]);
}
