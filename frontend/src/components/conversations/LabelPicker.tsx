'use client';

import { useState } from 'react';
import { Tag } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { DEFAULT_LABEL_COLOR } from '@/lib/labels/normalize';
import { useConversationLabels, useLabels } from '@/lib/hooks/useChatwootExtras';

interface Props {
  conversationId: number;
  currentLabels: string[];
}

export function LabelPicker({ conversationId, currentLabels }: Props) {
  const [open, setOpen] = useState(false);
  const { data: allLabels = [] } = useLabels();
  const mutation = useConversationLabels(conversationId, currentLabels);

  function toggle(title: string) {
    const next = currentLabels.includes(title)
      ? currentLabels.filter(l => l !== title)
      : [...currentLabels, title];
    mutation.mutate(next);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded border hover:border-brand-primary transition-colors"
        >
          <Tag size={12} />
          {currentLabels.length > 0 ? currentLabels.join(', ') : 'Add label'}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-2">
        <p className="text-xs font-semibold text-muted-foreground mb-2">Labels</p>
        {allLabels
          .filter(label => label?.id && label?.title)
          .map(label => (
          <button
            key={label.id}
            type="button"
            onClick={() => toggle(label.title)}
            className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted text-sm"
          >
            <div
              className="w-3 h-3 rounded-full shrink-0"
              style={{ backgroundColor: label.color ?? DEFAULT_LABEL_COLOR }}
            />
            {label.title}
            {currentLabels.includes(label.title) && (
              <span className="ms-auto text-brand-primary text-xs">✓</span>
            )}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}
