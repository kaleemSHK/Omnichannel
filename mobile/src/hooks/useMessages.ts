import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getMessages, sendMessage } from '@/api/conversations';
import { getCustomerMessages, sendCustomerMessage } from '@/api/customer';
import { loadPrefs } from '@/lib/storage';
import { normalizeMessages } from '@/lib/message-sender';
import type { CWMessage } from '@/types';

async function fetchMessages(conversationId: number): Promise<{ payload: CWMessage[] }> {
  const prefs = await loadPrefs();
  const res =
    prefs.role === 'customer'
      ? await getCustomerMessages(conversationId)
      : await getMessages(conversationId);
  return {
    payload: normalizeMessages(res.payload as Array<Record<string, unknown>>) as CWMessage[],
  };
}

async function postMessage(conversationId: number, content: string) {
  const prefs = await loadPrefs();
  if (prefs.role === 'customer') return sendCustomerMessage(conversationId, content);
  return sendMessage(conversationId, content);
}

export function useMessages(conversationId: number) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['messages', conversationId],
    queryFn: () => fetchMessages(conversationId),
    enabled: conversationId > 0,
    refetchInterval: 2000,
    refetchIntervalInBackground: true,
    staleTime: 500,
  });

  const mutation = useMutation({
    mutationFn: (content: string) => postMessage(conversationId, content),
    onMutate: async content => {
      const prefs = await loadPrefs();
      const isCustomer = prefs.role === 'customer';
      await queryClient.cancelQueries({ queryKey: ['messages', conversationId] });
      const previous = queryClient.getQueryData<{ payload: CWMessage[] }>(['messages', conversationId]);
      const optimistic: CWMessage = {
        id: Date.now(),
        content,
        message_type: isCustomer ? 0 : 1,
        content_type: 'text',
        created_at: Math.floor(Date.now() / 1000),
        sender: {
          id: 0,
          name: 'You',
          type: isCustomer ? 'contact' : 'user',
        },
      };
      queryClient.setQueryData<{ payload: CWMessage[] }>(
        ['messages', conversationId],
        (old?: { payload: CWMessage[] }) => ({
          payload: [...(old?.payload ?? []), optimistic],
        }),
      );
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

  const error =
    query.error instanceof Error
      ? query.error.message
      : mutation.error instanceof Error
        ? mutation.error.message
        : null;

  return {
    messages: query.data?.payload ?? [],
    isLoading: query.isLoading,
    error,
    refetch: query.refetch,
    send: mutation.mutateAsync,
    isSending: mutation.isPending,
  };
}
