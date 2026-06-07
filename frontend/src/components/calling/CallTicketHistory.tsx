'use client';

import Link from 'next/link';
import { ExternalLink, Ticket } from 'lucide-react';
import { useCallTickets } from '@/lib/hooks/useCallTickets';
import { ticketDisplayId, ticketPriorityClass } from '@/lib/utils/contacts';
import { cn } from '@/lib/utils/cn';

const STATUS_CLS: Record<string, string> = {
  open: 'bg-green-100 text-green-800',
  resolved: 'bg-gray-100 text-gray-600',
  pending: 'bg-amber-100 text-amber-800',
  closed: 'bg-gray-100 text-gray-500',
  'in-progress': 'bg-blue-100 text-blue-800',
};

interface Props {
  customerPhone?: string | null;
  conversationId?: string | null;
  className?: string;
}

export function CallTicketHistory({ customerPhone, conversationId, className }: Props) {
  const { data, isLoading } = useCallTickets({ customerPhone, conversationId });

  const tickets = data?.tickets ?? [];
  const contactId = data?.contactId;
  const latest = tickets[0];

  return (
    <div className={cn('rounded-xl border border-gray-100 p-4 bg-white shadow-sm mt-3', className)}>
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <Ticket size={16} className="text-brand-primary shrink-0" aria-hidden />
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider truncate">
            Tickets
          </p>
        </div>
        <Link
          href={
            latest
              ? `/tickets?ticket_id=${encodeURIComponent(latest.id)}`
              : contactId
                ? `/tickets?contact_id=${contactId}`
                : '/tickets'
          }
          className="text-xs text-brand-primary hover:underline flex items-center gap-1 shrink-0"
        >
          View all <ExternalLink className="w-3 h-3" />
        </Link>
      </div>

      {isLoading ? (
        <p className="text-xs text-muted-foreground py-1">Loading tickets…</p>
      ) : tickets.length === 0 ? (
        <p className="text-xs text-muted-foreground py-1">No tickets for this caller yet.</p>
      ) : (
        <div className="space-y-1">
          {tickets.map(t => (
            <Link
              key={t.id}
              href={`/tickets?ticket_id=${encodeURIComponent(t.id)}`}
              className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-50 transition-colors group"
            >
              <span className="text-xs font-mono text-muted-foreground shrink-0">
                #{ticketDisplayId(t.id)}
              </span>
              <span className="text-xs text-gray-800 flex-1 truncate">{t.subject}</span>
              <span
                className={cn(
                  'text-[10px] px-1.5 py-0.5 rounded-full font-semibold capitalize shrink-0',
                  STATUS_CLS[t.status] ?? 'bg-gray-100 text-gray-600',
                )}
              >
                {t.status}
              </span>
              <span
                className={cn(
                  'text-[10px] font-semibold px-1.5 py-0.5 rounded shrink-0',
                  ticketPriorityClass(t.priority),
                )}
              >
                {t.priority}
              </span>
              <ExternalLink className="w-3 h-3 text-gray-300 group-hover:text-brand-primary shrink-0 transition-colors" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
