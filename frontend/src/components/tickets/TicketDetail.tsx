'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { TicketReplyBox } from '@/components/tickets/TicketReplyBox';
import { TicketThread } from '@/components/tickets/TicketThread';
import { ConversationLink } from '@/components/tickets/ConversationLink';
import { EmailReplyForm } from '@/components/tickets/EmailReplyForm';
import {
  useTicketAgents,
  useTicketsList,
  useUpdateTicketMeta,
} from '@/lib/hooks/useTickets';
import { getTicket } from '@/lib/api/tickets';
import {
  formatDateTime,
  isSlaBreached,
  type TicketStatusUi,
  type TicketView,
} from '@/lib/utils/tickets';
import { cn } from '@/lib/utils/cn';
import type { Ticket } from '@/types';

interface Props {
  ticketId: string | null;
}

function Chip({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={cn('text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-700', className)}>
      {children}
    </span>
  );
}

export function TicketDetail({ ticketId }: Props) {
  const { data: tickets = [] } = useTicketsList();
  const { data: agents = [] } = useTicketAgents();
  const update = useUpdateTicketMeta(ticketId);

  const ticket = useMemo(
    () => tickets.find((t: TicketView) => t.id === ticketId) ?? null,
    [tickets, ticketId],
  );

  // Raw Ticket for ConversationLink (needs chatwootConversationId, timeline, etc.)
  const { data: rawTicket } = useQuery<Ticket>({
    queryKey: ['ticket', ticketId],
    queryFn: () => getTicket(ticketId!),
    enabled: Boolean(ticketId),
    staleTime: 30_000,
  });

  if (!ticket) {
    return (
      <section className="flex-1 flex items-center justify-center bg-gray-50/50 text-sm text-gray-500">
        Select a ticket
      </section>
    );
  }

  const slaBreached = isSlaBreached(ticket.slaDeadline);

  return (
    <section className="flex-1 min-w-0 flex flex-col bg-white">
      <header className="shrink-0 px-5 py-4 border-b border-gray-100">
        <h1 className="text-lg font-semibold text-gray-900">{ticket.subject}</h1>
        <div className="flex flex-wrap items-center gap-2 mt-2">
          <Chip className="capitalize">{ticket.status}</Chip>
          <Chip className="capitalize">{ticket.priority}</Chip>
          {ticket.contactId != null ? (
            <Link href={`/contacts?id=${ticket.contactId}`} className="text-xs text-[#0B5FFF] hover:underline">
              {ticket.contactName}
            </Link>
          ) : (
            <Chip>{ticket.contactName}</Chip>
          )}
          {ticket.assigneeName && <Chip>{ticket.assigneeName}</Chip>}
        </div>

        <div className="flex flex-wrap items-center gap-2 mt-3">
          <label className="text-xs text-gray-500 flex items-center gap-1">
            Change status
            <select
              value={ticket.status}
              onChange={e =>
                void update.mutateAsync({ status: e.target.value as TicketStatusUi })
              }
              className="text-xs border border-gray-200 rounded-md px-2 py-1 bg-white"
            >
              <option value="open">Open</option>
              <option value="pending">Pending</option>
              <option value="resolved">Resolved</option>
            </select>
          </label>
          <button
            type="button"
            onClick={() => {
              const next = agents[(agents.findIndex(a => a.id === ticket.assigneeId) + 1) % agents.length];
              if (next) void update.mutateAsync({ assigneeId: next.id });
            }}
            className="text-xs px-2.5 py-1 border border-gray-200 rounded-md hover:bg-gray-50"
          >
            Reassign
          </button>
        </div>
      </header>

      <div className="shrink-0 grid grid-cols-2 gap-3 px-5 py-3 border-b border-gray-50">
        <InfoCard label="Created at" value={formatDateTime(ticket.createdAt)} />
        <InfoCard
          label="SLA deadline"
          value={formatDateTime(ticket.slaDeadline)}
          valueClassName={slaBreached ? 'text-red-600 font-medium' : undefined}
        />
        <InfoCard label="Inbox type" value={ticket.inboxType} />
        <InfoCard
          label="Contact"
          value={ticket.contactName}
          href={ticket.contactId != null ? `/contacts?id=${ticket.contactId}` : undefined}
        />
      </div>

      {/* Chatwoot conversation link (T01) */}
      {rawTicket && (
        <div className="shrink-0 px-5 py-3 border-b border-gray-50">
          <ConversationLink ticket={rawTicket} />
        </div>
      )}

      {/* Email thread + reply form (E01) — shown only for Email-channel tickets */}
      {rawTicket?.channel?.toLowerCase() === 'email' && (
        <div className="shrink-0 px-5 py-4 border-b border-gray-100">
          <EmailReplyForm ticket={rawTicket} />
        </div>
      )}

      <TicketThread ticketId={ticketId} />
      <TicketReplyBox ticketId={ticketId} />
    </section>
  );
}

function InfoCard({
  label,
  value,
  href,
  valueClassName,
  className,
}: {
  label: string;
  value: string;
  href?: string;
  valueClassName?: string;
  className?: string;
}) {
  return (
    <div className={cn('rounded-lg border border-gray-100 bg-gray-50/50 px-3 py-2', className)}>
      <p className="text-[10px] uppercase tracking-wide text-gray-500">{label}</p>
      {href ? (
        <Link href={href} className={cn('text-sm text-[#0B5FFF] hover:underline mt-0.5', valueClassName)}>
          {value}
        </Link>
      ) : (
        <p className={cn('text-sm text-gray-900 mt-0.5', valueClassName)}>{value}</p>
      )}
    </div>
  );
}
