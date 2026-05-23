'use client';

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getMessages, listConversations, sendMessage } from '@/lib/api/conversations';
import type { ConversationFilters } from '@/lib/api/conversations';
import {
  DEMO_CONVERSATIONS,
  DEMO_MESSAGES,
  isFixtureConversationId,
} from '@/lib/demo/conversationsFixture';
import { isDemoDataEnabled } from '@/lib/demo/config';
import { useAuthStore } from '@/lib/store/auth';
import {
  extractConversationMeta,
  parseConversationList,
} from '@/lib/utils/conversations';
import type { CWMessage } from '@/types';

export type ConversationPage = {
  data: ReturnType<typeof parseConversationList>;
  meta: { next_page?: number };
};

async function fetchConversationPage(
  filters: ConversationFilters,
  page: number,
): Promise<ConversationPage> {
  if (isDemoDataEnabled()) {
    let rows = [...DEMO_CONVERSATIONS];
    const status = filters.status;
    if (status && status !== 'all') {
      rows = rows.filter(c => c.status === status);
    }
    if (filters.inboxId) {
      rows = rows.filter(c => c.inbox_id === filters.inboxId);
    }
    return { data: rows, meta: {} };
  }
  try {
    const res = await listConversations({ ...filters, page });
    const data = parseConversationList(res);
    const meta = extractConversationMeta(res);
    if (data.length) return { data, meta };
    return { data: DEMO_CONVERSATIONS, meta: {} };
  } catch {
    return { data: DEMO_CONVERSATIONS, meta: {} };
  }
}

export function useConversations(filters: ConversationFilters) {
  return useInfiniteQuery({
    queryKey: ['conversations', filters, isDemoDataEnabled()],
    queryFn: ({ pageParam = 1 }) => fetchConversationPage(filters, pageParam as number),
    getNextPageParam: last => last.meta?.next_page ?? undefined,
    initialPageParam: 1,
  });
}

export function useMessages(conversationId: number | null) {
  return useQuery({
    queryKey: ['messages', conversationId, isDemoDataEnabled()],
    queryFn: async () => {
      if (!conversationId) return [] as CWMessage[];
      if (isDemoDataEnabled()) {
        return DEMO_MESSAGES[conversationId] ?? [];
      }
      try {
        const res = await getMessages(conversationId);
        const rows = (res.payload ?? []) as CWMessage[];
        return rows.length ? rows : (DEMO_MESSAGES[conversationId] ?? []);
      } catch {
        return DEMO_MESSAGES[conversationId] ?? [];
      }
    },
    enabled: !!conversationId,
  });
}

export interface SendMessageInput {
  content: string;
  private?: boolean;
}

export function useSendMessage(conversationId: number) {
  const qc = useQueryClient();
  const user = useAuthStore(s => s.user);
  const demo = isDemoDataEnabled();

  return useMutation({
    mutationFn: async ({ content, private: isPrivate }: SendMessageInput) => {
      if (demo || isFixtureConversationId(conversationId)) {
        await new Promise(r => setTimeout(r, 200));
        const msg: CWMessage = {
          id: Date.now(),
          content,
          message_type: 1,
          content_type: isPrivate ? 'private_note' : 'text',
          created_at: Math.floor(Date.now() / 1000),
          sender: { id: user?.id ?? 1, name: user?.name ?? 'Agent', type: 'user' },
        };
        return msg;
      }
      return sendMessage(conversationId, content, { private: isPrivate });
    },
    onSuccess: msg => {
      if (demo || isFixtureConversationId(conversationId)) {
        qc.setQueryData<CWMessage[]>(['messages', conversationId, demo], old => [
          ...(old ?? []),
          msg,
        ]);
      } else {
        qc.invalidateQueries({ queryKey: ['messages', conversationId] });
      }
      qc.invalidateQueries({ queryKey: ['conversations'] });
    },
  });
}
