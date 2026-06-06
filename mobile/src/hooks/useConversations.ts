import { useInfiniteQuery } from '@tanstack/react-query';
import { listConversations, type ConversationFilters } from '@/api/conversations';
import type { CWConversation } from '@/types';

export function useConversations(filters: ConversationFilters = {}) {
  const query = useInfiniteQuery({
    queryKey: ['conversations', filters],
    queryFn: ({ pageParam = 1 }) => listConversations({ ...filters, page: pageParam }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      const meta = lastPage.meta;
      if (meta?.next_page) return meta.next_page;
      if (meta?.current_page && meta?.total_pages && meta.current_page < meta.total_pages) {
        return meta.current_page + 1;
      }
      return undefined;
    },
    staleTime: 15_000,
  });

  const conversations: CWConversation[] =
    query.data?.pages.flatMap((page) => page.data ?? []) ?? [];

  return {
    conversations,
    isLoading: query.isLoading,
    refetch: query.refetch,
    fetchNextPage: query.fetchNextPage,
    hasNextPage: query.hasNextPage,
    isFetchingNextPage: query.isFetchingNextPage,
  };
}
