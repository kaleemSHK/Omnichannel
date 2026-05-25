'use client';

import { useMemo, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { ConversationListItem } from '@/components/conversations/ConversationListItem';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { useConversations } from '@/lib/hooks/useConversations';
import { listInboxes } from '@/lib/api/conversations';
import { DEMO_INBOXES } from '@/lib/demo/inboxesFixture';
import { isDemoDataEnabled } from '@/lib/demo/config';
import type { ConversationFilters } from '@/lib/api/conversations';
import type { CWConversation } from '@/types';

type StatusTab = 'all' | 'open' | 'pending' | 'resolved';

const TABS: { id: StatusTab; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'open', label: 'Open' },
  { id: 'pending', label: 'Pending' },
  { id: 'resolved', label: 'Resolved' },
];

interface Props {
  selectedId: number | null;
  onSelect: (conv: CWConversation) => void;
}

export function ConversationList({ selectedId, onSelect }: Props) {
  const [activeTab, setActiveTab] = useState<StatusTab>('open');
  const [rawSearch, setRawSearch] = useState('');
  const [inboxFilter, setInboxFilter] = useState('');
  const search = useDebouncedValue(rawSearch, 300);

  const { data: inboxes = [] } = useQuery({
    queryKey: ['inboxes', 'filter', isDemoDataEnabled()],
    queryFn: async () => {
      if (isDemoDataEnabled()) return DEMO_INBOXES;
      try {
        const data = await listInboxes();
        return data.length ? data : [];
      } catch {
        return [];
      }
    },
    staleTime: 60_000,
  });

  const filters: ConversationFilters = {
    status: activeTab === 'all' ? undefined : activeTab,
    inboxId: inboxFilter ? Number(inboxFilter) : undefined,
    search: search || undefined,
  };

  const { data, isLoading, isError, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useConversations(filters);

  const conversations = useMemo(() => data?.pages.flatMap(p => p.data) ?? [], [data]);

  const obsRef = useRef<IntersectionObserver | null>(null);
  const sentinelCallback = (el: HTMLDivElement | null) => {
    obsRef.current?.disconnect();
    if (!el) return;
    obsRef.current = new IntersectionObserver(entries => {
      if (entries[0]?.isIntersecting && hasNextPage && !isFetchingNextPage) {
        void fetchNextPage();
      }
    });
    obsRef.current.observe(el);
  };

  return (
    <div className="w-[280px] border-e flex flex-col h-full bg-white shrink-0">
      <div className="border-b p-3 space-y-2 shrink-0">
        <div className="relative">
          <Search className="absolute start-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={rawSearch}
            onChange={e => setRawSearch(e.target.value)}
            placeholder="Search conversations…"
            className="ps-8"
            aria-label="Search conversations"
          />
        </div>

        <Select
          value={inboxFilter}
          onChange={e => setInboxFilter(e.target.value)}
          className="text-xs"
          aria-label="Filter by inbox"
        >
          <option value="">All inboxes</option>
          {inboxes.map(inbox => (
            <option key={inbox.id} value={String(inbox.id)}>
              {inbox.name}
            </option>
          ))}
        </Select>

        <div className="flex gap-1" role="tablist" aria-label="Conversation status">
          {TABS.map(tab => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
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

      <div className="flex-1 overflow-y-auto min-h-0" role="listbox" aria-label="Conversations">
        {isLoading &&
          Array.from({ length: 4 }).map((_, i) => (
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

        {!isLoading && !isError && conversations.length === 0 && (
          <p className="p-4 text-sm text-muted-foreground text-center">
            {search ? `No results for "${search}"` : 'No conversations'}
          </p>
        )}

        {!isLoading &&
          !isError &&
          conversations.map(conv => (
            <ConversationListItem
              key={conv.id}
              conversation={conv}
              selected={selectedId === conv.id}
              onClick={() => onSelect(conv)}
            />
          ))}

        <div ref={sentinelCallback} className="h-2" />
        {isFetchingNextPage && <Skeleton className="h-12 mx-3 my-1 rounded-lg" />}
      </div>
    </div>
  );
}
