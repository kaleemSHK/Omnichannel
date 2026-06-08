'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils/cn';
import { Search, Check, UserPlus } from 'lucide-react';
import { useAllAgents } from '@/hooks/useInboxAdmin';
import type { InboxMember } from '@/lib/api/inboxes';

interface Props {
  selected: number[];
  onChange: (ids: number[]) => void;
}

export function InboxWizardAgentPicker({ selected, onChange }: Props) {
  const { data: allAgents = [], isLoading } = useAllAgents();
  const [search, setSearch] = useState('');

  const filtered = allAgents.filter(
    (a: InboxMember) =>
      a.name.toLowerCase().includes(search.toLowerCase()) ||
      a.email.toLowerCase().includes(search.toLowerCase()),
  );

  function toggle(id: number) {
    const set = new Set(selected);
    if (set.has(id)) set.delete(id);
    else set.add(id);
    onChange([...set]);
  }

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map(i => (
          <Skeleton key={i} className="h-11 rounded-lg" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Select agents who can access this inbox (same step as Chatwoot inbox setup).
      </p>
      <div className="relative">
        <Search
          size={14}
          className="absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          placeholder="Search agents…"
          className="ps-9"
          value={search}
          onChange={e => setSearch(e.target.value)}
          aria-label="Search agents"
        />
      </div>
      <div className="max-h-56 overflow-y-auto space-y-1 border rounded-lg p-1">
        {filtered.length === 0 && (
          <p className="text-sm text-center text-muted-foreground py-6">No agents found</p>
        )}
        {filtered.map(agent => {
          const isSelected = selected.includes(agent.id);
          return (
            <button
              key={agent.id}
              type="button"
              onClick={() => toggle(agent.id)}
              className={cn(
                'w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-start text-sm transition-colors',
                isSelected ? 'bg-brand-primary/10' : 'hover:bg-muted/40',
              )}
              aria-pressed={isSelected}
            >
              <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 text-xs font-medium flex items-center justify-center shrink-0">
                {agent.name.slice(0, 2).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{agent.name}</p>
                <p className="text-xs text-muted-foreground truncate">{agent.email}</p>
              </div>
              <span className={cn('shrink-0', isSelected ? 'text-brand-primary' : 'text-muted-foreground/30')}>
                {isSelected ? <Check size={15} /> : <UserPlus size={14} />}
              </span>
            </button>
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground">
        {selected.length} agent{selected.length !== 1 ? 's' : ''} selected
      </p>
    </div>
  );
}
