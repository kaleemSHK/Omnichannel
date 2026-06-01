'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Download, Search, Upload, UserPlus, SlidersHorizontal, X, ArrowUpDown } from 'lucide-react';
import { toast } from 'sonner';
import { ContactListItem } from '@/components/contacts/ContactListItem';
import { Skeleton } from '@/components/ui/skeleton';
import { exportContactsCsv } from '@/lib/api/contacts';
import { useContactsList, useImportContacts } from '@/lib/hooks/useContacts';
import { can } from '@/lib/rbac';
import { useAuthStore } from '@/lib/store/auth';
import { isDemoDataEnabled } from '@/lib/demo/config';
import { slaTierBadgeClass, type SlaTier } from '@/lib/utils/contacts';
import { cn } from '@/lib/utils/cn';

// ─── SLA filter chips ──────────────────────────────────────────────────────────

const SLA_TIERS: { id: SlaTier | 'all'; label: string }[] = [
  { id: 'all',    label: 'All' },
  { id: 'gold',   label: 'Gold' },
  { id: 'silver', label: 'Silver' },
  { id: 'bronze', label: 'Bronze' },
];

type SortKey = 'name' | 'created_at';

// ─── Empty state ────────────────────────────────────────────────────────────────

function EmptyState({ hasFilter }: { hasFilter: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center gap-2">
      <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-1">
        <Search className="w-5 h-5 text-gray-400" />
      </div>
      <p className="text-sm font-medium text-gray-700">
        {hasFilter ? 'No matches found' : 'No contacts yet'}
      </p>
      <p className="text-xs text-muted-foreground">
        {hasFilter ? 'Try clearing filters' : 'Create your first contact to get started'}
      </p>
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

interface Props {
  selectedId: number | null;
  onSelect: (id: number) => void;
  onNewContact: () => void;
  onFirstContact?: (id: number) => void;
}

export function ContactList({ selectedId, onSelect, onNewContact, onFirstContact }: Props) {
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [tierFilter, setTierFilter] = useState<SlaTier | 'all'>('all');
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [showFilters, setShowFilters] = useState(false);
  const csvInputRef = useRef<HTMLInputElement>(null);
  const notified = useRef(false);
  const role = useAuthStore(s => s.user?.role);
  const importMutation = useImportContacts();

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const { data, isLoading, isError, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useContactsList(debounced);

  const allContacts = useMemo(() => data?.pages.flatMap(p => p.contacts) ?? [], [data]);

  // Client-side tier + sort filter
  const contacts = useMemo(() => {
    let list = [...allContacts];
    if (tierFilter !== 'all') {
      list = list.filter(c => {
        const labels = (c.labels ?? []).map(l => l.toLowerCase());
        if (tierFilter === 'gold')   return labels.includes('gold') || labels.includes('vip');
        if (tierFilter === 'bronze') return labels.includes('bronze');
        if (tierFilter === 'silver') return labels.includes('silver');
        return true;
      });
    }
    list.sort((a, b) => {
      if (sortKey === 'created_at') {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
      return (a.name ?? '').localeCompare(b.name ?? '');
    });
    return list;
  }, [allContacts, tierFilter, sortKey]);

  useEffect(() => {
    if (notified.current || !onFirstContact) return;
    const first = contacts[0];
    if (first) { notified.current = true; onFirstContact(first.id); }
  }, [contacts, onFirstContact]);

  const obsRef = useRef<IntersectionObserver | null>(null);
  const sentinelRef = useCallback(
    (el: HTMLDivElement | null) => {
      obsRef.current?.disconnect();
      if (!el || !hasNextPage) return;
      obsRef.current = new IntersectionObserver(entries => {
        if (entries[0]?.isIntersecting && !isFetchingNextPage) void fetchNextPage();
      });
      obsRef.current.observe(el);
    },
    [fetchNextPage, hasNextPage, isFetchingNextPage],
  );

  async function handleExport() {
    if (isDemoDataEnabled()) { toast.error('Export not available in demo mode'); return; }
    try {
      const blob = await exportContactsCsv();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `contacts-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch { toast.error('Export failed'); }
  }

  function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    importMutation.mutate(file, {
      onSuccess: () => toast.success('Contacts imported successfully'),
      onError: err => toast.error(err instanceof Error ? err.message : 'Import failed'),
    });
  }

  const hasFilter = tierFilter !== 'all' || !!search;

  return (
    <div className="w-[300px] shrink-0 border-e border-gray-200 bg-white flex flex-col h-full">
      {/* ── Header ── */}
      <div className="px-3 pt-3 pb-2 border-b border-gray-100 shrink-0 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-gray-900">Contacts</h2>
            {allContacts.length > 0 && (
              <span className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full font-medium">
                {allContacts.length}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setShowFilters(v => !v)}
              className={cn(
                'p-1.5 rounded-md transition-colors',
                showFilters || hasFilter
                  ? 'bg-blue-50 text-brand-primary'
                  : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50',
              )}
              title="Filters"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={onNewContact}
              className="p-1.5 rounded-md text-gray-400 hover:text-brand-primary hover:bg-blue-50 transition-colors"
              title="New contact"
            >
              <UserPlus className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute start-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search contacts…"
            className="w-full ps-8 pe-8 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-primary bg-gray-50"
          />
          {search && (
            <button type="button" onClick={() => setSearch('')} className="absolute end-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        {/* Filters */}
        {showFilters && (
          <div className="space-y-2 pt-1">
            {/* SLA tier filter */}
            <div>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">SLA Tier</p>
              <div className="flex gap-1">
                {SLA_TIERS.map(t => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTierFilter(t.id)}
                    className={cn(
                      'flex-1 text-[11px] py-1 rounded-md font-medium transition-colors',
                      tierFilter === t.id
                        ? t.id === 'all'
                          ? 'bg-brand-primary text-white'
                          : slaTierBadgeClass(t.id as SlaTier) + ' ring-1 ring-current'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200',
                    )}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Sort */}
            <div className="flex items-center gap-1.5">
              <ArrowUpDown className="w-3 h-3 text-muted-foreground shrink-0" />
              <select
                value={sortKey}
                onChange={e => setSortKey(e.target.value as SortKey)}
                className="flex-1 text-xs border border-gray-200 rounded-md px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-brand-primary"
              >
                <option value="name">Name A–Z</option>
                <option value="created_at">Recently created</option>
              </select>
            </div>

            {hasFilter && (
              <button
                type="button"
                onClick={() => { setTierFilter('all'); setSearch(''); }}
                className="w-full text-[11px] text-red-600 hover:text-red-700 py-1 text-center"
              >
                Clear filters
              </button>
            )}
          </div>
        )}

        {/* Import/Export */}
        <div className="flex gap-2">
          <input ref={csvInputRef} type="file" accept=".csv" className="hidden" onChange={handleImportFile} />
          <button
            type="button"
            onClick={handleExport}
            className="flex-1 flex items-center justify-center gap-1 py-1.5 text-xs border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-muted-foreground"
          >
            <Download className="w-3 h-3" /> Export CSV
          </button>
          {can(role, 'manageTeam') && (
            <button
              type="button"
              disabled={importMutation.isPending}
              onClick={() => csvInputRef.current?.click()}
              className="flex-1 flex items-center justify-center gap-1 py-1.5 text-xs border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-muted-foreground disabled:opacity-50"
            >
              <Upload className="w-3 h-3" />
              {importMutation.isPending ? 'Importing…' : 'Import CSV'}
            </button>
          )}
        </div>
      </div>

      {/* ── List ── */}
      <div className="flex-1 overflow-y-auto min-h-0" role="listbox" aria-label="Contacts">
        {isLoading && Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="px-3 py-2.5 flex gap-2.5">
            <Skeleton className="size-10 rounded-full shrink-0" />
            <div className="flex-1 space-y-2 pt-1">
              <Skeleton className="h-3.5 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
        ))}

        {isError && !isLoading && (
          <div className="p-4 text-sm text-destructive text-center">
            Failed to load.{' '}
            <button type="button" className="underline" onClick={() => void refetch()}>Retry</button>
          </div>
        )}

        {!isLoading && !isError && contacts.length === 0 && (
          <EmptyState hasFilter={hasFilter} />
        )}

        {!isLoading && !isError && contacts.map(c => (
          <ContactListItem
            key={c.id}
            contact={c}
            selected={selectedId === c.id}
            onSelect={() => onSelect(c.id)}
          />
        ))}

        <div ref={sentinelRef} className="h-4" />
        {isFetchingNextPage && (
          <p className="text-xs text-center text-muted-foreground py-2">Loading more…</p>
        )}
      </div>
    </div>
  );
}
