'use client';

import Link from 'next/link';
import { ExternalLink, MessageSquare } from 'lucide-react';
import { useCallConversations } from '@/lib/hooks/useCallConversations';
import { cn } from '@/lib/utils/cn';
import type { CallTransport } from '@/lib/utils/call-inbox-map';

const STATUS_CLS: Record<string, string> = {
  open: 'bg-green-100 text-green-800',
  resolved: 'bg-gray-100 text-gray-600',
  pending: 'bg-amber-100 text-amber-800',
};

interface Props {
  transport: CallTransport;
  customerPhone?: string | null;
  conversationId?: string | null;
  className?: string;
}

export function CallConversationHistory({
  transport,
  customerPhone,
  conversationId,
  className,
}: Props) {
  const { data, isLoading } = useCallConversations({
    transport,
    customerPhone,
    conversationId,
  });

  const inbox = data?.inbox;
  const label = data?.inboxLabel ?? 'Inbox';
  const conversations = data?.conversations ?? [];
  const latest = conversations[0];

  return (
    <div className={cn('rounded-xl border border-gray-100 p-4 bg-white shadow-sm mt-3', className)}>
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <MessageSquare size={16} className="text-brand-primary shrink-0" aria-hidden />
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider truncate">
            {label}
          </p>
        </div>
        <Link
          href={
            latest
              ? `/conversations?conversation_id=${latest.id}`
              : inbox
                ? `/conversations?inbox_id=${inbox.id}`
                : '/conversations'
          }
          className="text-xs text-brand-primary hover:underline flex items-center gap-1 shrink-0"
        >
          Open inbox <ExternalLink className="w-3 h-3" />
        </Link>
      </div>

      {isLoading ? (
        <p className="text-xs text-muted-foreground py-1">Loading conversation history…</p>
      ) : conversations.length === 0 ? (
        <p className="text-xs text-muted-foreground py-1">
          No {label.toLowerCase()} threads for this caller yet.
        </p>
      ) : (
        <div className="space-y-1">
          {conversations.map(c => (
            <Link
              key={c.id}
              href={`/conversations?conversation_id=${c.id}`}
              className="flex items-start gap-2 p-2 rounded-lg hover:bg-gray-50 transition-colors group"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span
                    className={cn(
                      'text-[10px] px-1.5 py-0.5 rounded-full font-semibold capitalize',
                      STATUS_CLS[c.status ?? 'open'] ?? 'bg-gray-100 text-gray-600',
                    )}
                  >
                    {c.status ?? 'open'}
                  </span>
                  <span className="text-[10px] text-muted-foreground ms-auto">#{c.id}</span>
                </div>
                <p className="text-xs text-muted-foreground truncate">{c.snippet || `#${c.id}`}</p>
              </div>
              <ExternalLink className="w-3 h-3 text-gray-300 group-hover:text-brand-primary shrink-0 mt-1 transition-colors" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
