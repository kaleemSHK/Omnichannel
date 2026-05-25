'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Download, Search, Upload, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { ContactListItem } from '@/components/contacts/ContactListItem';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { exportContactsCsv } from '@/lib/api/contacts';
import { useContactsList, useImportContacts } from '@/lib/hooks/useContacts';
import { can } from '@/lib/rbac';
import { useAuthStore } from '@/lib/store/auth';
import { isDemoDataEnabled } from '@/lib/demo/config';

interface Props {
  selectedId: number | null;
  onSelect: (id: number) => void;
  onNewContact: () => void;
  onFirstContact?: (id: number) => void;
}

export function ContactList({
  selectedId,
  onSelect,
  onNewContact,
  onFirstContact,
}: Props) {
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
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

  const contacts = useMemo(() => data?.pages.flatMap(p => p.contacts) ?? [], [data]);

  useEffect(() => {
    if (notified.current || !onFirstContact) return;
    const first = contacts[0];
    if (first) {
      notified.current = true;
      onFirstContact(first.id);
    }
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
    if (isDemoDataEnabled()) {
      toast.error('Export is not available in demo mode');
      return;
    }
    try {
      const blob = await exportContactsCsv();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `contacts-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Export failed');
    }
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

  return (
    <div className="w-[280px] shrink-0 border-e border-gray-200 bg-white flex flex-col h-full">
      <div className="p-3 space-y-2 border-b border-gray-100 shrink-0">
        <div className="relative">
          <Search
            className="absolute start-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
            size={16}
          />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search contacts…"
            className="ps-9"
            aria-label="Search contacts"
          />
        </div>
        <button
          type="button"
          onClick={onNewContact}
          className="w-full flex items-center justify-center gap-1.5 py-2 text-sm border border-gray-200 rounded-lg hover:bg-muted transition-colors"
        >
          <UserPlus size={16} /> New contact
        </button>
        <div className="flex gap-2">
          <input
            ref={csvInputRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={handleImportFile}
          />
          <button
            type="button"
            title="Export contacts as CSV"
            onClick={handleExport}
            className="flex-1 flex items-center justify-center gap-1 py-1.5 text-xs border border-gray-200 rounded-lg hover:bg-muted transition-colors"
          >
            <Download size={14} /> Export
          </button>
          {can(role, 'manageTeam') && (
            <button
              type="button"
              title="Import contacts from CSV"
              disabled={importMutation.isPending}
              onClick={() => csvInputRef.current?.click()}
              className="flex-1 flex items-center justify-center gap-1 py-1.5 text-xs border border-gray-200 rounded-lg hover:bg-muted transition-colors disabled:opacity-50"
            >
              <Upload size={14} />
              {importMutation.isPending ? 'Importing…' : 'Import'}
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto min-h-0" role="listbox" aria-label="Contacts">
        {isLoading &&
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="px-3 py-2.5 flex gap-2.5">
              <Skeleton className="size-9 rounded-full shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3.5 w-2/3" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </div>
          ))}

        {isError && !isLoading && (
          <div className="p-4 text-sm text-destructive text-center">
            Failed to load contacts.{' '}
            <button type="button" className="underline" onClick={() => void refetch()}>
              Retry
            </button>
          </div>
        )}

        {!isLoading && !isError && contacts.length === 0 && (
          <div className="text-center py-12 px-4">
            <Search className="mx-auto text-muted-foreground/40 mb-2" size={32} />
            <p className="text-sm text-muted-foreground">No contacts found</p>
          </div>
        )}

        {!isLoading &&
          !isError &&
          contacts.map(c => (
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
