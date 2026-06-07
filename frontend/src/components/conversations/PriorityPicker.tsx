'use client';

import { useState } from 'react';
import { Flag } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { updateConversationPriority } from '@/lib/api/conversations';
import { cn } from '@/lib/utils/cn';
import type { ConversationPriority } from '@/types';

const PRIORITIES: { value: ConversationPriority; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
];

const PRIORITY_STYLE: Record<ConversationPriority, string> = {
  none: 'text-muted-foreground border-gray-200',
  low: 'text-blue-700 border-blue-200 bg-blue-50',
  medium: 'text-amber-700 border-amber-200 bg-amber-50',
  high: 'text-orange-700 border-orange-200 bg-orange-50',
  urgent: 'text-red-700 border-red-200 bg-red-50',
};

interface Props {
  conversationId: number;
  currentPriority?: ConversationPriority | null;
}

export function PriorityPicker({ conversationId, currentPriority }: Props) {
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();
  const active = currentPriority && currentPriority !== 'none' ? currentPriority : null;

  const mutation = useMutation({
    mutationFn: (priority: ConversationPriority) =>
      updateConversationPriority(conversationId, priority),
    onSuccess: (_data, priority) => {
      qc.invalidateQueries({ queryKey: ['conversations'] });
      qc.invalidateQueries({ queryKey: ['conversation', conversationId] });
      toast.success(priority === 'none' ? 'Priority cleared' : `Priority set to ${priority}`);
      setOpen(false);
    },
    onError: () => toast.error('Could not update priority'),
  });

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={mutation.isPending}
          className={cn(
            'flex items-center gap-1 text-xs px-2 py-1 rounded border transition-colors hover:border-brand-primary',
            active ? PRIORITY_STYLE[active] : 'text-muted-foreground hover:text-foreground',
          )}
        >
          <Flag size={12} />
          {active ? PRIORITIES.find(p => p.value === active)?.label : 'Priority'}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-44 p-1" align="start">
        <p className="text-xs font-semibold text-muted-foreground px-2 py-1.5">Priority</p>
        {PRIORITIES.map(p => (
          <button
            key={p.value}
            type="button"
            onClick={() => mutation.mutate(p.value)}
            className={cn(
              'w-full flex items-center gap-2 px-2 py-1.5 text-xs rounded hover:bg-muted text-start capitalize',
              (currentPriority ?? 'none') === p.value && 'bg-muted/60 font-medium',
            )}
          >
            <span
              className={cn(
                'w-2 h-2 rounded-full shrink-0',
                p.value === 'none' && 'bg-gray-300',
                p.value === 'low' && 'bg-blue-500',
                p.value === 'medium' && 'bg-amber-500',
                p.value === 'high' && 'bg-orange-500',
                p.value === 'urgent' && 'bg-red-500',
              )}
            />
            {p.label}
            {(currentPriority ?? 'none') === p.value && (
              <span className="ms-auto text-brand-primary">✓</span>
            )}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}
