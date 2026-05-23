'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { TicketDetail } from '@/components/tickets/TicketDetail';
import { TicketList } from '@/components/tickets/TicketList';
import { TicketNav } from '@/components/tickets/TicketNav';
import { DemoBanner } from '@/components/ui/DemoBanner';
import { countHighPriority, countOpen, type TicketNavView, type TicketTeam } from '@/lib/utils/tickets';
import { useTicketsDemoMode, useTicketsList } from '@/lib/hooks/useTickets';

export function TicketsWorkspace() {
  const searchParams = useSearchParams();
  const { data: tickets = [] } = useTicketsList();
  const demoMode = useTicketsDemoMode();

  const [navView, setNavView] = useState<TicketNavView>('all_open');
  const [team, setTeam] = useState<TicketTeam | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const openCount = useMemo(() => countOpen(tickets), [tickets]);
  const highCount = useMemo(() => countHighPriority(tickets), [tickets]);

  useEffect(() => {
    const contactId = searchParams.get('contact_id');
    if (contactId && tickets.length > 0 && !selectedId) {
      const match = tickets.find(t => String(t.contactId) === contactId);
      if (match) setSelectedId(match.id);
    }
  }, [searchParams, tickets, selectedId]);

  return (
    <div className="flex flex-col h-full min-h-[calc(100vh-3rem)] bg-surface-tertiary">
      <header className="shrink-0 bg-white border-b border-gray-200 px-4 py-3">
        <h1 className="text-base font-semibold text-gray-900">Tickets</h1>
        <p className="text-xs text-gray-500 mt-0.5">Track and resolve customer issues across teams</p>
      </header>

      {demoMode && (
        <div className="px-4 py-2">
          <DemoBanner label="Tickets demo data" />
        </div>
      )}

      <div className="flex flex-1 min-h-0 overflow-hidden">
        <TicketNav
          navView={navView}
          team={team}
          openCount={openCount}
          highCount={highCount}
          onNavChange={setNavView}
          onTeamChange={setTeam}
        />
        <TicketList
          navView={navView}
          team={team}
          selectedId={selectedId}
          onSelect={setSelectedId}
        />
        <TicketDetail ticketId={selectedId} />
      </div>
    </div>
  );
}
