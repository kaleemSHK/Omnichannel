'use client';

import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
  type QueryClient,
} from '@tanstack/react-query';
import {
  getConversation,
  getMessages,
  listConversations,
  markConversationAsRead,
  sendMessage,
} from '@/lib/api/conversations';
import type { ConversationFilters } from '@/lib/api/conversations';
import { DEMO_CONVERSATIONS, DEMO_MESSAGES, isFixtureConversationId } from '@/lib/demo/conversationsFixture';
import { appendDemoMessage, loadDemoMessages } from '@/lib/demo/demoMessageStore';
import { isDemoDataEnabled } from '@/lib/demo/config';
import { attachmentTypeForFile } from '@/lib/utils/attachments';
import { normalizeMessage } from '@/lib/utils/messages';
import { useAuthStore } from '@/lib/store/auth';
import {
  extractConversationMeta,
  parseConversationList,
  conversationContactName,
} from '@/lib/utils/conversations';
import type { CWConversation, CWMessage } from '@/types';

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
    if (filters.search) {
      const q = filters.search.toLowerCase();
      rows = rows.filter(c => conversationContactName(c).toLowerCase().includes(q));
    }
    return { data: rows, meta: {} };
  }
  try {
    const res = await listConversations({ ...filters, page });
    const data = parseConversationList(res);
    const meta = extractConversationMeta(res);
    return { data, meta };
  } catch {
    return { data: [], meta: {} };
  }
}

/** Zero unread_count for one conversation across all cached list pages. */
export function patchConversationUnreadInCache(
  qc: QueryClient,
  conversationId: number,
  unreadCount = 0,
) {
  qc.setQueriesData<InfiniteData<ConversationPage>>(
    { queryKey: ['conversations'] },
    old => {
      if (!old?.pages?.length) return old;
      return {
        ...old,
        pages: old.pages.map(page => ({
          ...page,
          data: page.data.map(c =>
            c.id === conversationId ? { ...c, unread_count: unreadCount } : c,
          ),
        })),
      };
    },
  );
}

export function useMarkConversationRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (conversationId: number) => {
      if (isDemoDataEnabled()) return;
      await markConversationAsRead(conversationId);
    },
    onMutate: conversationId => {
      patchConversationUnreadInCache(qc, conversationId, 0);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['conversations'] });
    },
  });
}

export function useConversations(filters: ConversationFilters) {
  const { status, assigneeType, inboxId, teamId, search } = filters;
  return useInfiniteQuery({
    queryKey: [
      'conversations',
      status ?? '',
      assigneeType ?? '',
      inboxId ?? 0,
      teamId ?? 0,
      search ?? '',
      isDemoDataEnabled(),
    ],
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
        return loadDemoMessages(conversationId, DEMO_MESSAGES[conversationId] ?? []);
      }
      try {
        const res = await getMessages(conversationId);
        return res.payload;
      } catch (err) {
        if (process.env.NODE_ENV === 'development') {
          console.error('[useMessages]', conversationId, err);
        }
        throw err;
      }
    },
    enabled: !!conversationId,
    refetchInterval: isDemoDataEnabled() ? false : 3000,
    refetchIntervalInBackground: false,
    staleTime: 1000,
  });
}

export interface SendMessageInput {
  content: string;
  private?: boolean;
  attachments?: File[];
}

export function useSendMessage(conversationId: number) {
  const qc = useQueryClient();
  const user = useAuthStore(s => s.user);
  const demo = isDemoDataEnabled();

  return useMutation({
    mutationFn: async ({ content, private: isPrivate, attachments }: SendMessageInput) => {
      const body = content.trim();
      if (!body && !attachments?.length) throw new Error('Empty message');
      if (demo) {
        await new Promise(r => setTimeout(r, 200));
        const msg: CWMessage = {
          id: Date.now(),
          content: body,
          message_type: 1,
          content_type: isPrivate ? 'private_note' : 'text',
          created_at: Math.floor(Date.now() / 1000),
          sender: { id: user?.id ?? 1, name: user?.name ?? 'Agent', type: 'user' },
          attachments: attachments?.map((file, i) => ({
            id: Date.now() + i,
            file_type: attachmentTypeForFile(file),
            data_url: URL.createObjectURL(file),
          })),
        };
        return msg;
      }
      return sendMessage(conversationId, body, {
        private: isPrivate,
        attachments,
      });
    },
    onSuccess: msg => {
      const normalized = normalizeMessage(msg);
      if (demo) {
        appendDemoMessage(conversationId, normalized);
        qc.setQueryData<CWMessage[]>(['messages', conversationId, demo], old => [
          ...(old ?? []),
          normalized,
        ]);
      } else {
        qc.setQueryData<CWMessage[]>(['messages', conversationId, demo], old => {
          const existing = old ?? [];
          if (existing.some(m => m.id === normalized.id)) return existing;
          return [...existing, normalized];
        });
        qc.invalidateQueries({ queryKey: ['messages', conversationId] });
      }
      qc.invalidateQueries({ queryKey: ['conversations'] });
      qc.invalidateQueries({ queryKey: ['conversation', conversationId] });
    },
  });
}

/** Full conversation detail (priority, team, assignee) — refreshes after macros/actions. */
export function useConversationDetail(conversationId: number | null) {
  return useQuery({
    queryKey: ['conversation', conversationId, isDemoDataEnabled()],
    queryFn: async (): Promise<CWConversation> => {
      if (!conversationId) throw new Error('No conversation id');
      if (isDemoDataEnabled() || isFixtureConversationId(conversationId)) {
        const demo = DEMO_CONVERSATIONS.find(c => c.id === conversationId);
        if (demo) return demo;
      }
      return getConversation(conversationId);
    },
    enabled: !!conversationId,
    staleTime: 5_000,
  });
}
