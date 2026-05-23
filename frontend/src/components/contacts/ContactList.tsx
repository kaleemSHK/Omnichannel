'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Search, UserPlus } from 'lucide-react';
import { ContactListItem } from '@/components/contacts/ContactListItem';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useContactsList } from '@/lib/hooks/useContacts';

interface Props {
  selectedId: number | null;
  onSelect: (id: number) => void;
  onNewContact: () => void;
}

export function ContactList({ selectedId, onSelect, onNewContact }: Props) {
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const sentinel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useContactsList(debounced);

  const contacts = useMemo(
    () => data?.pages.flatMap(p => p.contacts) ?? [],
    [data],
  );

  useEffect(() => {
    const el = sentinel.current;
    if (!el || !hasNextPage) return;
    const obs = new IntersectionObserver(entries => {
      if (entries[0]?.isIntersecting) void fetchNextPage();
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, [fetchNextPage, hasNextPage, contacts.length]);

  return (
    <div className="w-[280px] shrink-0 border-e border-gray-200 bg-white flex flex-col h-full">
      <div className="p-3 space-y-2 border-b border-gray-100 shrink-0">
        <div className="relative">
          <Search className="absolute start-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search contacts…"
            className="ps-9"
          />
        </div>
        <button
          type="button"
          onClick={onNewContact}
          className="w-full flex items-center justify-center gap-1.5 py-2 text-sm border border-gray-200 rounded-lg hover:bg-muted transition-colors"
        >
          <UserPlus size={16} /> New contact
        </button>
      </div>

      <div className="flex-1 overflow-y-auto min-h-0">
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

        {!isLoading && contacts.length === 0 && (
          <div className="text-center py-12 px-4">
            <Search className="mx-auto text-muted-foreground/40 mb-2" size={32} />
            <p className="text-sm text-muted-foreground">No contacts found</p>
          </div>
        )}

        {contacts.map(c => (
          <ContactListItem
            key={c.id}
            contact={c}
            selected={selectedId === c.id}
            onSelect={() => onSelect(c.id)}
          />
        ))}

        <div ref={sentinel} className="h-4" />
        {isFetchingNextPage && (
          <p className="text-xs text-center text-muted-foreground py-2">Loading more…</p>
        )}
      </div>
    </div>
  );
}
