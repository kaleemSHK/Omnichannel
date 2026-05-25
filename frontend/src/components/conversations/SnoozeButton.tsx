'use client';

import { useState } from 'react';
import { AlarmClock } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { toast } from 'sonner';
import { useSnoozeConversation } from '@/lib/hooks/useChatwootExtras';

const SNOOZE_OPTIONS: { label: string; resolve: () => Date }[] = [
  { label: '30 minutes', resolve: () => new Date(Date.now() + 30 * 60_000) },
  { label: '1 hour', resolve: () => new Date(Date.now() + 60 * 60_000) },
  { label: '3 hours', resolve: () => new Date(Date.now() + 180 * 60_000) },
  {
    label: 'Tomorrow 9 AM',
    resolve: () => {
      const d = new Date();
      d.setDate(d.getDate() + 1);
      d.setHours(9, 0, 0, 0);
      return d;
    },
  },
  {
    label: 'Next week',
    resolve: () => {
      const d = new Date();
      d.setDate(d.getDate() + 7);
      d.setHours(9, 0, 0, 0);
      return d;
    },
  },
];

interface Props {
  conversationId: number;
}

export function SnoozeButton({ conversationId }: Props) {
  const [open, setOpen] = useState(false);
  const mutation = useSnoozeConversation(conversationId);

  function snooze(opt: (typeof SNOOZE_OPTIONS)[number]) {
    mutation.mutate(opt.resolve().toISOString(), {
      onSuccess: () => {
        toast.success('Conversation snoozed');
        setOpen(false);
      },
    });
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="w-8 h-8 flex items-center justify-center rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          title="Snooze"
        >
          <AlarmClock size={15} />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-44 p-1">
        <p className="text-xs font-semibold text-muted-foreground px-2 py-1">Snooze until</p>
        {SNOOZE_OPTIONS.map(opt => (
          <button
            key={opt.label}
            type="button"
            onClick={() => snooze(opt)}
            disabled={mutation.isPending}
            className="w-full text-start px-3 py-1.5 text-sm rounded hover:bg-muted"
          >
            {opt.label}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}
