'use client';

import { useEffect, useRef, useState } from 'react';
import { Smile } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils/cn';

const EMOJI_GROUPS: { label: string; emojis: string[] }[] = [
  {
    label: 'Smileys',
    emojis: ['😀', '😊', '🙂', '😉', '😍', '🥰', '😘', '😎', '🤔', '😅', '😂', '🤣', '😢', '😭', '😡', '🙏'],
  },
  {
    label: 'Gestures',
    emojis: ['👍', '👎', '👋', '🤝', '💪', '✅', '❌', '⭐', '🔥', '💯', '🎉', '❤️', '💙', '💚', '⚡', '✨'],
  },
  {
    label: 'Support',
    emojis: ['📞', '📱', '💬', '📧', '📎', '📁', '🕐', '📍', '🔔', '💡', '🛠️', '📋', '✔️', '⏳', '🚀', '🇴🇲'],
  },
];

interface Props {
  onSelect: (emoji: string) => void;
  disabled?: boolean;
}

export function EmojiPicker({ onSelect, disabled }: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  return (
    <div ref={rootRef} className="relative shrink-0">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={cn('shrink-0 mb-0.5', open && 'bg-muted')}
        aria-label="Insert emoji"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => setOpen(v => !v)}
      >
        <Smile className="w-4 h-4" />
      </Button>

      {open && (
        <div className="absolute bottom-full start-0 mb-1 w-64 bg-white border rounded-lg shadow-lg z-50 p-2 max-h-52 overflow-y-auto">
          {EMOJI_GROUPS.map(group => (
            <div key={group.label}>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase px-1 mb-1">
                {group.label}
              </p>
              <div className="grid grid-cols-8 gap-0.5 mb-2">
                {group.emojis.map(emoji => (
                  <button
                    key={emoji}
                    type="button"
                    className="text-lg leading-none p-1 rounded hover:bg-muted"
                    aria-label={`Insert ${emoji}`}
                    onMouseDown={e => e.preventDefault()}
                    onClick={() => {
                      onSelect(emoji);
                      setOpen(false);
                    }}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
