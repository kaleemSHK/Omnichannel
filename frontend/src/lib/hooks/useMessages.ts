'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { sendMessage } from '@/lib/api/conversations';
import { useMessages } from '@/lib/hooks/useConversations';

export { useMessages };

export function useSendMessage(conversationId: number | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (content: string) => sendMessage(conversationId!, content),
    onSuccess: () => {
      if (conversationId) {
        qc.invalidateQueries({ queryKey: ['messages', conversationId] });
      }
      qc.invalidateQueries({ queryKey: ['conversations'] });
    },
  });
}
