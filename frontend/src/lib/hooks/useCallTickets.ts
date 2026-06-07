'use client';

import { useQuery } from '@tanstack/react-query';
import { getTicketByConversation, listTickets } from '@/lib/api/tickets';
import { isDemoDataEnabled } from '@/lib/demo/config';
import { findContactByPhone } from '@/lib/utils/find-contact-by-phone';
import { isJunkCallPhone } from '@/lib/utils/call-inbox-map';
import type { Ticket } from '@/types';

export interface CallTicketHistory {
  contactId: number | null;
  tickets: Ticket[];
}

function dedupeTickets(rows: Ticket[]): Ticket[] {
  const seen = new Set<string>();
  const out: Ticket[] = [];
  for (const t of rows) {
    if (seen.has(t.id)) continue;
    seen.add(t.id);
    out.push(t);
  }
  return out.sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );
}

async function loadTickets(
  phone: string | null | undefined,
  conversationId: string | null | undefined,
): Promise<CallTicketHistory> {
  if (isDemoDataEnabled()) {
    const { DEMO_TICKETS } = await import('@/lib/demo/ticketsFixture');
    const tickets = DEMO_TICKETS.slice(0, 5).map(t => ({
      id: t.id,
      tenantId: 'demo',
      subject: t.subject,
      status: t.status === 'resolved' ? ('resolved' as const) : ('open' as const),
      priority:
        t.priority === 'high' ? ('p1' as const) : t.priority === 'low' ? ('p3' as const) : ('p2' as const),
      contactId: String(t.contactId),
      chatwootConversationId: t.conversationId,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
    }));
    return { contactId: DEMO_TICKETS[0]?.contactId ?? null, tickets };
  }

  const collected: Ticket[] = [];
  let contactId: number | null = null;

  if (conversationId && /^\d+$/.test(conversationId)) {
    const linked = await getTicketByConversation(Number(conversationId));
    if (linked) collected.push(linked);
  }

  const phoneOk = phone && !isJunkCallPhone(phone);
  if (phoneOk) {
    contactId = await findContactByPhone(phone);
    if (contactId) {
      try {
        const res = await listTickets({ contact_id: contactId, page: 1 });
        const rows = (res as { data?: Ticket[] }).data ?? [];
        collected.push(...rows);
      } catch {
        /* best-effort */
      }
    }
  }

  return {
    contactId,
    tickets: dedupeTickets(collected).slice(0, 5),
  };
}

export function useCallTickets(opts: {
  customerPhone?: string | null;
  conversationId?: string | null;
  enabled?: boolean;
}) {
  const enabled = opts.enabled !== false;
  return useQuery({
    queryKey: [
      'call-tickets',
      opts.customerPhone ?? '',
      opts.conversationId ?? '',
      isDemoDataEnabled(),
    ],
    queryFn: () => loadTickets(opts.customerPhone, opts.conversationId ?? undefined),
    enabled,
    staleTime: 30_000,
  });
}
