'use client';

import { Loader2, Plus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { TicketListItem } from '@/components/tickets/TicketListItem';
import { NewTicketModal } from '@/components/tickets/NewTicketModal';
import {
  currentAssigneeId,
  useTicketsList,
} from '@/lib/hooks/useTickets';
import {
  filterTickets,
  type TicketNavView,
  type TicketPriorityUi,
  type TicketStatusUi,
  type TicketTeam,
  type TicketView,
} from '@/lib/utils/tickets';
import { useAuthStore } from '@/lib/store/auth';

interface Props {
  navView: TicketNavView;
  team: TicketTeam | null;
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function TicketList({ navView, team, selectedId, onSelect }: Props) {
  const { data: tickets = [], isLoading } = useTicketsList();
  const user = useAuthStore(s => s.user);
  const assigneeId = currentAssigneeId(user?.id);

  const [statusFilter, setStatusFilter] = useState<TicketStatusUi | 'all'>('all');
  const [priorityFilter, setPriorityFilter] = useState<TicketPriorityUi | 'all'>('all');
  const [modalOpen, setModalOpen] = useState(false);

  const filtered = useMemo(
    () =>
      filterTickets(tickets, {
        navView,
        team,
        status: statusFilter,
        priority: priorityFilter,
        assigneeId,
      }),
    [tickets, navView, team, statusFilter, priorityFilter, assigneeId],
  );

  return (
    <section className="w-[300px] shrink-0 flex flex-col bg-white border-e border-gray-200">
      <div className="shrink-0 px-3 py-2.5 border-b border-gray-100 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-gray-900">Tickets</h2>
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-[#0B5FFF] text-white rounded-md hover:bg-blue-700"
        >
          <Plus size={14} />
          New
        </button>
      </div>

      <div className="shrink-0 flex gap-2 px-3 py-2 border-b border-gray-50">
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value as TicketStatusUi | 'all')}
          className="flex-1 text-xs border border-gray-200 rounded-md px-2 py-1.5 bg-white"
        >
          <option value="all">All status</option>
          <option value="open">Open</option>
          <option value="pending">Pending</option>
          <option value="resolved">Resolved</option>
        </select>
        <select
          value={priorityFilter}
          onChange={e => setPriorityFilter(e.target.value as TicketPriorityUi | 'all')}
          className="flex-1 text-xs border border-gray-200 rounded-md px-2 py-1.5 bg-white"
        >
          <option value="all">All priority</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
      </div>

      <div className="flex-1 overflow-y-auto">
        {isLoading && (
          <div className="flex justify-center py-10">
            <Loader2 className="animate-spin text-gray-400" size={22} />
          </div>
        )}
        {!isLoading && filtered.length === 0 && (
          <p className="text-xs text-gray-500 text-center py-10 px-3">No tickets match these filters</p>
        )}
        {!isLoading &&
          filtered.map((t: TicketView) => (
            <TicketListItem
              key={t.id}
              ticket={t}
              selected={selectedId === t.id}
              onSelect={() => onSelect(t.id)}
            />
          ))}
      </div>

      <NewTicketModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </section>
  );
}
