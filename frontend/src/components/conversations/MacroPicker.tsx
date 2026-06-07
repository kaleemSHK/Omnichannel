'use client';

import { useState } from 'react';
import { BookOpen, Loader2 } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { executeMacro, listMacros } from '@/lib/api/settings';
import { useTenantAccountId } from '@/lib/hooks/useTenantAccountId';

interface Props {
  conversationId: number;
}

export function MacroPicker({ conversationId }: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const accountId = useTenantAccountId();
  const qc = useQueryClient();

  const { data: macros = [], isLoading } = useQuery({
    queryKey: ['macros', accountId],
    queryFn: async () => {
      const res = await listMacros();
      return res.payload ?? [];
    },
    staleTime: 60_000,
    enabled: open,
  });

  const runMutation = useMutation({
    mutationFn: (macroId: number) => executeMacro(macroId, [conversationId]),
    onSuccess: (_data, macroId) => {
      const name = macros.find(m => m.id === macroId)?.name ?? 'Macro';
      qc.invalidateQueries({ queryKey: ['conversations'] });
      qc.invalidateQueries({ queryKey: ['messages', conversationId] });
      qc.invalidateQueries({ queryKey: ['conversation', conversationId] });
      toast.success(`"${name}" applied`);
      setOpen(false);
      setSearch('');
    },
    onError: () => toast.error('Could not run macro'),
  });

  const filtered = macros.filter(m =>
    m.name.toLowerCase().includes(search.trim().toLowerCase()),
  );

  return (
    <Popover
      open={open}
      onOpenChange={next => {
        setOpen(next);
        if (!next) setSearch('');
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded border hover:border-brand-primary transition-colors"
        >
          <BookOpen size={12} />
          Macros
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-0" align="start">
        <div className="p-2 border-b">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search macros…"
            className="w-full text-xs px-2 py-1.5 rounded border bg-background outline-none focus:ring-1 focus:ring-brand-primary"
          />
        </div>
        <div className="max-h-56 overflow-y-auto p-1">
          {isLoading && (
            <div className="flex items-center justify-center gap-2 py-6 text-xs text-muted-foreground">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Loading…
            </div>
          )}
          {!isLoading && filtered.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-6 px-2">
              {macros.length === 0
                ? 'No macros yet. Create them in Settings → Macros.'
                : 'No matching macros'}
            </p>
          )}
          {!isLoading &&
            filtered.map(macro => (
              <button
                key={macro.id}
                type="button"
                disabled={runMutation.isPending}
                onClick={() => runMutation.mutate(macro.id)}
                className="w-full flex flex-col items-start gap-0.5 px-2 py-2 rounded hover:bg-muted text-start disabled:opacity-50"
              >
                <span className="text-xs font-medium text-foreground">{macro.name}</span>
                <span className="text-[10px] text-muted-foreground">
                  {macro.actions.length} action{macro.actions.length === 1 ? '' : 's'}
                  {macro.visibility === 'personal' ? ' · Personal' : ''}
                </span>
              </button>
            ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
