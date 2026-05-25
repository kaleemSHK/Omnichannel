'use client';

import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils/cn';
import { Search, Check, UserPlus } from 'lucide-react';
import { useAllAgents, useInboxMembers, useUpdateInboxMembers } from '@/hooks/useInboxAdmin';

const STATUS_DOT: Record<string, string> = {
  online: 'bg-green-500',
  busy: 'bg-amber-500',
  offline: 'bg-gray-400',
};

interface Props {
  inboxId: number;
}

export function InboxAgentsPanel({ inboxId }: Props) {
  const { data: allAgents = [], isLoading: loadingAll } = useAllAgents();
  const { data: members = [], isLoading: loadingMembers } = useInboxMembers(inboxId);
  const { mutate: saveMembers, isPending } = useUpdateInboxMembers();

  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<number>>(() => new Set());

  useEffect(() => {
    setSelected(new Set(members.map(m => m.id)));
  }, [members]);

  const filtered = allAgents.filter(
    a =>
      a.name.toLowerCase().includes(search.toLowerCase()) ||
      a.email.toLowerCase().includes(search.toLowerCase()),
  );

  function toggle(id: number) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function save() {
    saveMembers({ inboxId, userIds: Array.from(selected) });
  }

  const isDirty =
    JSON.stringify([...selected].sort()) !== JSON.stringify(members.map(m => m.id).sort());

  if (loadingAll || loadingMembers) {
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

      <div className="max-h-64 overflow-y-auto space-y-1 border rounded-lg p-1">
        {filtered.length === 0 && (
          <p className="text-sm text-center text-muted-foreground py-6">No agents found</p>
        )}
        {filtered.map(agent => {
          const isSelected = selected.has(agent.id);
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
              <div className="relative shrink-0">
                <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 text-xs font-medium flex items-center justify-center">
                  {agent.name.slice(0, 2).toUpperCase()}
                </div>
                <span
                  className={cn(
                    'absolute -bottom-0.5 -end-0.5 w-2.5 h-2.5 rounded-full border-2 border-white',
                    STATUS_DOT[agent.availability_status],
                  )}
                />
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

      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {selected.size} agent{selected.size !== 1 ? 's' : ''} assigned
        </p>
        <Button
          size="sm"
          disabled={!isDirty || isPending}
          onClick={save}
          className="bg-brand-primary hover:bg-brand-primary/90"
        >
          {isPending ? 'Saving…' : 'Save agents'}
        </Button>
      </div>
    </div>
  );
}
