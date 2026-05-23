'use client';

import { useState } from 'react';
import { AlarmClock } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { toast } from 'sonner';
import { useSnoozeConversation } from '@/lib/hooks/useChatwootExtras';

const SNOOZE_OPTIONS = [
  { label: '30 minutes', minutes: 30 as number | null },
  { label: '1 hour', minutes: 60 },
  { label: '3 hours', minutes: 180 },
  { label: 'Tomorrow 9am', minutes: null },
  { label: 'Next week', minutes: null },
];

interface Props {
  conversationId: number;
}

export function SnoozeButton({ conversationId }: Props) {
  const [open, setOpen] = useState(false);
  const mutation = useSnoozeConversation(conversationId);

  function snooze(minutes: number | null, label: string) {
    let until: Date;
    if (minutes !== null) {
      until = new Date(Date.now() + minutes * 60_000);
    } else if (label.includes('Tomorrow')) {
      until = new Date();
      until.setDate(until.getDate() + 1);
      until.setHours(9, 0, 0, 0);
    } else {
      until = new Date();
      until.setDate(until.getDate() + 7);
      until.setHours(9, 0, 0, 0);
    }
    mutation.mutate(until.toISOString(), {
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
            onClick={() => snooze(opt.minutes, opt.label)}
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
