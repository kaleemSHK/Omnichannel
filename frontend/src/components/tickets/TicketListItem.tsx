'use client';

import type { TicketView } from '@/lib/utils/tickets';
import { formatTicketTime } from '@/lib/utils/tickets';
import { cn } from '@/lib/utils/cn';

interface Props {
  ticket: TicketView;
  selected?: boolean;
  onSelect: () => void;
}

function PriorityChip({ priority }: { priority: TicketView['priority'] }) {
  const styles = {
    high: 'bg-red-100 text-red-700',
    medium: 'bg-amber-100 text-amber-700',
    low: 'bg-gray-100 text-gray-600',
  };
  const labels = { high: 'High', medium: 'Medium', low: 'Low' };
  return (
    <span className={cn('text-[10px] font-medium px-1.5 py-0.5 rounded capitalize', styles[priority])}>
      {labels[priority]}
    </span>
  );
}

function StatusChip({ status }: { status: TicketView['status'] }) {
  const styles = {
    open: 'bg-blue-100 text-blue-700',
    pending: 'bg-amber-100 text-amber-700',
    resolved: 'bg-green-100 text-green-700',
  };
  const labels = { open: 'Open', pending: 'Pending', resolved: 'Resolved' };
  return (
    <span className={cn('text-[10px] font-medium px-1.5 py-0.5 rounded', styles[status])}>
      {labels[status]}
    </span>
  );
}

export function TicketListItem({ ticket, selected, onSelect }: Props) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'w-full text-start px-3 py-3 border-b border-gray-50 hover:bg-gray-50/80 transition-colors border-s-4',
        selected ? 'border-s-[#0B5FFF] bg-blue-50/40' : 'border-s-transparent',
      )}
    >
      <p className="text-xs text-gray-500 font-mono">#{ticket.displayId}</p>
      <div className="flex items-center gap-1.5 mt-1 flex-wrap">
        <PriorityChip priority={ticket.priority} />
        <StatusChip status={ticket.status} />
      </div>
      <p className="text-sm font-medium text-gray-900 truncate mt-1">{ticket.subject}</p>
      <p className="text-xs text-gray-500 mt-1 truncate">
        {ticket.contactName} · {ticket.slaTier}
      </p>
      <p className="text-[10px] text-gray-400 mt-1">{formatTicketTime(ticket.updatedAt)}</p>
    </button>
  );
}
