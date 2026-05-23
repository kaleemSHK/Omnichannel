'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import { ConversationListItem } from '@/components/conversations/ConversationListItem';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useQuery } from '@tanstack/react-query';
import { useConversations } from '@/lib/hooks/useConversations';
import { conversationContactName } from '@/lib/utils/conversations';
import { listInboxes } from '@/lib/api/conversations';
import { DEMO_INBOXES } from '@/lib/demo/inboxesFixture';
import { isDemoDataEnabled } from '@/lib/demo/config';
import type { ConversationFilters } from '@/lib/api/conversations';
import type { CWConversation } from '@/types';

type StatusTab = 'all' | 'open' | 'pending' | 'resolved';

interface Props {
  selectedId: number | null;
  onSelect: (conv: CWConversation) => void;
}

const TABS: { id: StatusTab; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'open', label: 'Open' },
  { id: 'pending', label: 'Pending' },
  { id: 'resolved', label: 'Resolved' },
];

export function ConversationList({ selectedId, onSelect }: Props) {
  const [activeTab, setActiveTab] = useState<StatusTab>('open');
  const [search, setSearch] = useState('');
  const [inboxFilter, setInboxFilter] = useState('');
  const sentinelRef = useRef<HTMLDivElement>(null);

  const { data: inboxes = [] } = useQuery({
    queryKey: ['inboxes', 'filter', isDemoDataEnabled()],
    queryFn: async () => {
      try {
        const data = await listInboxes();
        return data.length ? data : isDemoDataEnabled() ? DEMO_INBOXES : [];
      } catch {
        return isDemoDataEnabled() ? DEMO_INBOXES : [];
      }
    },
    staleTime: 60_000,
  });

  const filters: ConversationFilters = useMemo(
    () => ({
      status: activeTab === 'all' ? undefined : activeTab,
      inboxId: inboxFilter ? Number(inboxFilter) : undefined,
    }),
    [activeTab, inboxFilter],
  );

  const { data, isLoading, isError, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useConversations(filters);

  const conversations = useMemo(
    () => data?.pages.flatMap(p => p.data) ?? [],
    [data],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return conversations;
    return conversations.filter(c =>
      conversationContactName(c).toLowerCase().includes(q),
    );
  }, [conversations, search]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(entries => {
      if (entries[0]?.isIntersecting && hasNextPage && !isFetchingNextPage) {
        void fetchNextPage();
      }
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  return (
    <div className="w-[280px] border-r flex flex-col h-full bg-white shrink-0">
      <div className="border-b p-3 space-y-2 shrink-0">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search…"
            className="pl-8"
          />
        </div>
        <select
          value={inboxFilter}
          onChange={e => setInboxFilter(e.target.value)}
          className="text-xs border rounded px-2 py-1 w-full"
        >
          <option value="">All inboxes</option>
          {inboxes.map(inbox => (
            <option key={inbox.id} value={String(inbox.id)}>
              {inbox.name}
            </option>
          ))}
        </select>
        <div className="flex gap-1">
          {TABS.map(tab => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={
                activeTab === tab.id
                  ? 'flex-1 text-xs py-1.5 border-b-2 border-brand-primary text-brand-primary font-medium'
                  : 'flex-1 text-xs py-1.5 text-muted-foreground hover:text-gray-900'
              }
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto min-h-0">
        {isLoading &&
          Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-16 mx-3 my-1 rounded-lg" />
          ))}

        {isError && (
          <div className="p-4 text-sm text-destructive">
            Failed to load.{' '}
            <button type="button" className="underline" onClick={() => void refetch()}>
              Retry
            </button>
          </div>
        )}

        {!isLoading &&
          !isError &&
          filtered.map(conv => (
            <ConversationListItem
              key={conv.id}
              conversation={conv}
              selected={selectedId === conv.id}
              onClick={() => onSelect(conv)}
            />
          ))}

        {!isLoading && !isError && filtered.length === 0 && (
          <p className="p-4 text-sm text-muted-foreground text-center">No conversations</p>
        )}

        <div ref={sentinelRef} className="h-2" />
        {isFetchingNextPage && <Skeleton className="h-12 mx-3 my-1 rounded-lg" />}
      </div>
    </div>
  );
}
