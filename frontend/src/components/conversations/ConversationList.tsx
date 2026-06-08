'use client';

import { useMemo, useRef, useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { Search, SlidersHorizontal, Plus, X, ArrowUpDown } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { ConversationListItem } from '@/components/conversations/ConversationListItem';
import { Skeleton } from '@/components/ui/skeleton';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { useConversations } from '@/lib/hooks/useConversations';
import { listInboxes } from '@/lib/api/conversations';
import { DEMO_INBOXES } from '@/lib/demo/inboxesFixture';
import { isDemoDataEnabled } from '@/lib/demo/config';
import { cn } from '@/lib/utils/cn';
import type { ConversationFilters } from '@/lib/api/conversations';
import type { CWConversation } from '@/types';

// ─── Types ─────────────────────────────────────────────────────────────────────

type StatusTab   = 'all' | 'open' | 'pending' | 'resolved';
type AssigneeTab = 'all' | 'assigned' | 'unassigned';
type SortKey     = 'last_activity_at' | 'created_at';

const STATUS_TABS: { id: StatusTab; label: string }[] = [
  { id: 'all',      label: 'All' },
  { id: 'open',     label: 'Open' },
  { id: 'pending',  label: 'Pending' },
  { id: 'resolved', label: 'Resolved' },
];

const ASSIGNEE_CHIPS: { id: AssigneeTab; label: string }[] = [
  { id: 'all',        label: 'All' },
  { id: 'assigned',   label: 'Mine' },
  { id: 'unassigned', label: 'Unassigned' },
];

// ─── Label colour (deterministic hash) ─────────────────────────────────────────

const LABEL_COLORS = [
  'bg-blue-100 text-blue-700',
  'bg-green-100 text-green-700',
  'bg-purple-100 text-purple-700',
  'bg-amber-100 text-amber-700',
  'bg-pink-100 text-pink-700',
  'bg-teal-100 text-teal-700',
  'bg-orange-100 text-orange-700',
  'bg-indigo-100 text-indigo-700',
];

export function labelColor(label: string): string {
  let h = 0;
  for (let i = 0; i < label.length; i++) h = (h * 31 + label.charCodeAt(i)) >>> 0;
  return LABEL_COLORS[h % LABEL_COLORS.length]!;
}

// ─── Empty state ────────────────────────────────────────────────────────────────

function EmptyState({ hasFilter }: { hasFilter: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center gap-2">
      <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center mb-1">
        <Search className="w-5 h-5 text-gray-400" />
      </div>
      <p className="text-sm font-medium text-gray-700">
        {hasFilter ? 'No matches' : 'No conversations'}
      </p>
      <p className="text-xs text-muted-foreground">
        {hasFilter ? 'Try adjusting your filters' : 'Conversations will appear here'}
      </p>
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

interface Props {
  selectedId: number | null;
  onSelect: (conv: CWConversation) => void;
  onNewConversation?: () => void;
}

export function ConversationList({ selectedId, onSelect, onNewConversation }: Props) {
  const searchParams = useSearchParams();
  const [statusTab,    setStatusTab]    = useState<StatusTab>('open');
  const [assigneeTab, setAssigneeTab]  = useState<AssigneeTab>('all');
  const [rawSearch,   setRawSearch]    = useState('');
  const [inboxFilter, setInboxFilter]  = useState('');
  const [labelFilter, setLabelFilter]  = useState<string | null>(null);
  const [sortKey,     setSortKey]      = useState<SortKey>('last_activity_at');
  const [showFilters, setShowFilters]  = useState(false);
  const search = useDebouncedValue(rawSearch, 300);

  useEffect(() => {
    const inboxId = searchParams.get('inbox_id');
    if (inboxId) {
      setInboxFilter(inboxId);
      setShowFilters(true);
    }
  }, [searchParams]);

  const { data: inboxes = [] } = useQuery({
    queryKey: ['inboxes', 'filter', isDemoDataEnabled()],
    queryFn: async () => {
      if (isDemoDataEnabled()) return DEMO_INBOXES;
      try {
        const data = await listInboxes();
        return data.length ? data : [];
      } catch { return []; }
    },
    staleTime: 60_000,
  });

  const filters: ConversationFilters = {
    status:       statusTab === 'all' ? undefined : statusTab,
    assigneeType: assigneeTab === 'all' ? undefined : assigneeTab,
    inboxId:      inboxFilter ? Number(inboxFilter) : undefined,
    labels:       labelFilter ? [labelFilter] : undefined,
    search:       search || undefined,
  };

  const { data, isLoading, isError, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useConversations(filters);

  const allConversations = useMemo(() => data?.pages.flatMap(p => p.data) ?? [], [data]);

  // Sort client-side
  const conversations = useMemo(() => {
    const sorted = [...allConversations].sort((a, b) => {
      const av = sortKey === 'created_at' ? a.created_at : a.last_activity_at;
      const bv = sortKey === 'created_at' ? b.created_at : b.last_activity_at;
      return Number(bv) - Number(av);
    });
    return sorted;
  }, [allConversations, sortKey]);

  // Collect all labels for filter chips
  const allLabels = useMemo(() => {
    const set = new Set<string>();
    allConversations.forEach(c => (c.labels ?? []).forEach(l => set.add(l)));
    return [...set].sort();
  }, [allConversations]);

  const inboxNameById = useMemo(() => {
    const map = new Map<number, string>();
    for (const inbox of inboxes) map.set(inbox.id, inbox.name);
    return map;
  }, [inboxes]);

  // Tab counts from loaded data
  const counts = useMemo(() => {
    const c = { open: 0, pending: 0, resolved: 0, all: 0 };
    allConversations.forEach(conv => {
      c.all++;
      if (conv.status === 'open') c.open++;
      else if (conv.status === 'pending') c.pending++;
      else if (conv.status === 'resolved') c.resolved++;
    });
    return c;
  }, [allConversations]);

  const sentinelRef = useRef<HTMLDivElement>(null);
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

  const hasActiveFilter = !!(search || inboxFilter || labelFilter || assigneeTab !== 'all');
  const unreadTotal = conversations.reduce((n, c) => n + (c.unread_count > 0 ? 1 : 0), 0);

  return (
    <div className="w-[300px] border-e flex flex-col h-full bg-white shrink-0">
      {/* ── Header ── */}
      <div className="px-3 pt-3 pb-2 border-b shrink-0 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-gray-900">Conversations</h2>
            {unreadTotal > 0 && (
              <span className="bg-brand-primary text-white text-[10px] font-bold rounded-full px-1.5 min-w-[18px] text-center">
                {unreadTotal}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setShowFilters(v => !v)}
              title="Filters"
              className={cn(
                'p-1.5 rounded-md transition-colors',
                showFilters || hasActiveFilter
                  ? 'bg-blue-50 text-brand-primary'
                  : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50',
              )}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
            </button>
            {onNewConversation && (
              <button
                type="button"
                onClick={onNewConversation}
                title="New conversation"
                className="p-1.5 rounded-md text-gray-400 hover:text-brand-primary hover:bg-blue-50 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute start-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input
            value={rawSearch}
            onChange={e => setRawSearch(e.target.value)}
            placeholder="Search…"
            className="w-full ps-8 pe-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-primary bg-gray-50"
          />
          {rawSearch && (
            <button
              type="button"
              onClick={() => setRawSearch('')}
              className="absolute end-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        {/* Quick filters — assignee type */}
        <div className="flex gap-1">
          {ASSIGNEE_CHIPS.map(chip => (
            <button
              key={chip.id}
              type="button"
              onClick={() => setAssigneeTab(chip.id)}
              className={cn(
                'flex-1 text-[11px] py-1 rounded-md font-medium transition-colors',
                assigneeTab === chip.id
                  ? 'bg-brand-primary text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200',
              )}
            >
              {chip.label}
            </button>
          ))}
        </div>

        {/* Advanced filters (collapsible) */}
        {showFilters && (
          <div className="space-y-2 pt-1">
            {/* Inbox filter */}
            <select
              value={inboxFilter}
              onChange={e => setInboxFilter(e.target.value)}
              className="w-full text-xs border border-gray-200 rounded-md px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-brand-primary"
            >
              <option value="">All inboxes</option>
              {inboxes.map(inbox => (
                <option key={inbox.id} value={String(inbox.id)}>{inbox.name}</option>
              ))}
            </select>

            {/* Sort */}
            <div className="flex items-center gap-1.5">
              <ArrowUpDown className="w-3 h-3 text-muted-foreground shrink-0" />
              <select
                value={sortKey}
                onChange={e => setSortKey(e.target.value as SortKey)}
                className="flex-1 text-xs border border-gray-200 rounded-md px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-brand-primary"
              >
                <option value="last_activity_at">Last activity</option>
                <option value="created_at">Date created</option>
              </select>
            </div>

            {/* Label filter */}
            {allLabels.length > 0 && (
              <div>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                  Labels
                </p>
                <div className="flex flex-wrap gap-1">
                  {allLabels.map(l => (
                    <button
                      key={l}
                      type="button"
                      onClick={() => setLabelFilter(labelFilter === l ? null : l)}
                      className={cn(
                        'text-[10px] px-2 py-0.5 rounded-full font-medium transition-colors',
                        labelFilter === l
                          ? labelColor(l) + ' ring-1 ring-inset ring-current'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200',
                      )}
                    >
                      {l}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {hasActiveFilter && (
              <button
                type="button"
                onClick={() => {
                  setAssigneeTab('all');
                  setInboxFilter('');
                  setLabelFilter(null);
                  setRawSearch('');
                }}
                className="w-full text-[11px] text-red-600 hover:text-red-700 py-1 text-center"
              >
                Clear all filters
              </button>
            )}
          </div>
        )}

        {/* Status tabs */}
        <div className="flex gap-0.5 -mx-0.5" role="tablist">
          {STATUS_TABS.map(tab => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={statusTab === tab.id}
              onClick={() => setStatusTab(tab.id)}
              className={cn(
                'flex-1 flex items-center justify-center gap-1 text-[11px] py-1.5 rounded-md font-medium transition-colors',
                statusTab === tab.id
                  ? 'bg-blue-50 text-brand-primary'
                  : 'text-muted-foreground hover:text-gray-700 hover:bg-gray-50',
              )}
            >
              {tab.label}
              {counts[tab.id] > 0 && (
                <span className={cn(
                  'text-[9px] rounded-full px-1 min-w-[14px] text-center font-bold',
                  statusTab === tab.id ? 'bg-brand-primary text-white' : 'bg-gray-200 text-gray-600',
                )}>
                  {counts[tab.id]}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── List ── */}
      <div className="flex-1 overflow-y-auto min-h-0" role="listbox" aria-label="Conversations">
        {isLoading && Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="px-3 py-2">
            <Skeleton className="h-14 rounded-lg" />
          </div>
        ))}

        {isError && (
          <div className="p-4 text-sm text-destructive text-center">
            Failed to load.{' '}
            <button type="button" className="underline" onClick={() => void refetch()}>
              Retry
            </button>
          </div>
        )}

        {!isLoading && !isError && conversations.length === 0 && (
          <EmptyState hasFilter={hasActiveFilter} />
        )}

        {!isLoading && !isError && conversations.map(conv => (
          <ConversationListItem
            key={conv.id}
            conversation={conv}
            inboxName={inboxNameById.get(conv.inbox_id)}
            selected={selectedId === conv.id}
            onClick={() => onSelect(conv)}
          />
        ))}

        <div ref={sentinelCallback} className="h-2" />
        {isFetchingNextPage && (
          <div className="px-3 py-1">
            <Skeleton className="h-12 rounded-lg" />
          </div>
        )}
      </div>
    </div>
  );
}
