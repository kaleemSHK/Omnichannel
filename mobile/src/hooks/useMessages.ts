import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getMessages, sendMessage } from '@/api/conversations';
import type { CWMessage } from '@/types';

export function useMessages(conversationId: number) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['messages', conversationId],
    queryFn: () => getMessages(conversationId),
    enabled: conversationId > 0,
  });

  const mutation = useMutation({
    mutationFn: (content: string) => sendMessage(conversationId, content),
    onMutate: async (content) => {
      await queryClient.cancelQueries({ queryKey: ['messages', conversationId] });
      const previous = queryClient.getQueryData<{ payload: CWMessage[] }>(['messages', conversationId]);
      const optimistic: CWMessage = {
        id: Date.now(),
        content,
        message_type: 1,
        content_type: 'text',
        created_at: Math.floor(Date.now() / 1000),
        sender: { id: 0, name: 'You', type: 'user' },
      };
      queryClient.setQueryData<{ payload: CWMessage[] }>(['messages', conversationId], (old?: { payload: CWMessage[] }) => ({
        payload: [...(old?.payload ?? []), optimistic],
      }));
      return { previous };
    },
    onError: (_err, _content, ctx) => {
      if (ctx?.previous) {
        queryClient.setQueryData(['messages', conversationId], ctx.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['messages', conversationId] });
    },
  });

  return {
    messages: query.data?.payload ?? [],
    isLoading: query.isLoading,
    refetch: query.refetch,
    send: mutation.mutateAsync,
    isSending: mutation.isPending,
  };
}
