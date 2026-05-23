'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  createTicket,
  createTicketMessage,
  getTicketMessages,
  listTickets,
  updateTicket,
} from '@/lib/api/tickets';
import { isDemoDataEnabled } from '@/lib/demo/config';
import {
  DEMO_TICKET_AGENTS,
  DEMO_TICKETS,
  demoMessagesFor,
} from '@/lib/demo/ticketsFixture';
import {
  mapPriority,
  mapStatus,
  priorityToApi,
  type TicketMessageView,
  type TicketPriorityUi,
  type TicketStatusUi,
  type TicketTeam,
  type TicketView,
} from '@/lib/utils/tickets';
import type { Ticket } from '@/types';

const TICKETS_KEY = ['tickets'];
const messagesKey = (id: string) => ['ticketMessages', id];

function mapApiTicket(row: Record<string, unknown>): TicketView {
  const id = String(row.id ?? '');
  const teamRaw = String(row.department ?? row.team ?? 'support').toLowerCase();
  const team: TicketTeam =
    teamRaw.includes('sales') ? 'sales' : teamRaw.includes('bill') ? 'billing' : 'support';

  return {
    id,
    displayId: `TKT-${id.replace(/\D/g, '').slice(-4) || id.slice(0, 4)}`,
    subject: String(row.subject ?? row.title ?? 'Untitled'),
    status: mapStatus(String(row.status ?? 'open')),
    priority: mapPriority(String(row.priority ?? 'medium')),
    contactId: row.contactId != null ? Number(row.contactId) : undefined,
    contactName: String(row.customerName ?? row.contactName ?? 'Unknown contact'),
    assigneeId: row.assigneeId != null ? String(row.assigneeId) : row.assignedTo != null ? String(row.assignedTo) : undefined,
    assigneeName: row.assigneeName != null ? String(row.assigneeName) : undefined,
    team,
    slaTier: String((row.customFields as Record<string, string> | undefined)?.slaTier ?? 'Silver'),
    slaDeadline: String(
      (row.customFields as Record<string, string> | undefined)?.slaDeadline ??
        row.slaDeadline ??
        new Date(Date.now() + 3600000).toISOString(),
    ),
    inboxType: String(row.channel ?? row.inboxType ?? 'Chat'),
    conversationId:
      row.conversationId != null
        ? Number(row.conversationId)
        : row.chatwootConversationId != null
          ? Number(row.chatwootConversationId)
          : undefined,
    createdAt: String(row.createdAt ?? new Date().toISOString()),
    updatedAt: String(row.updatedAt ?? new Date().toISOString()),
  };
}

async function loadTickets(): Promise<TicketView[]> {
  if (isDemoDataEnabled()) return DEMO_TICKETS;
  try {
    const res = await listTickets();
    const rows = ((res as { data?: unknown[] }).data ?? res) as Record<string, unknown>[];
    const mapped = Array.isArray(rows) ? rows.map(mapApiTicket) : [];
    return mapped.length ? mapped : DEMO_TICKETS;
  } catch {
    return DEMO_TICKETS;
  }
}

async function loadMessages(ticketId: string): Promise<TicketMessageView[]> {
  if (isDemoDataEnabled()) return demoMessagesFor(ticketId);
  try {
    const rows = await getTicketMessages(ticketId);
    return rows.length ? rows : demoMessagesFor(ticketId);
  } catch {
    return demoMessagesFor(ticketId);
  }
}

export function useTicketsDemoMode() {
  return isDemoDataEnabled();
}

export function useTicketsList() {
  return useQuery({
    queryKey: [...TICKETS_KEY, isDemoDataEnabled()],
    queryFn: loadTickets,
  });
}

export function useTicketMessages(ticketId: string | null) {
  return useQuery({
    queryKey: [...messagesKey(ticketId ?? ''), isDemoDataEnabled()],
    queryFn: () => loadMessages(ticketId!),
    enabled: Boolean(ticketId),
  });
}

export function useTicketAgents() {
  return useQuery({
    queryKey: ['ticket-agents'],
    queryFn: async () => DEMO_TICKET_AGENTS,
  });
}

export function useCreateTicket() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      subject: string;
      description?: string;
      priority: TicketPriorityUi;
      assigneeId?: string;
      contactId?: number;
      contactName?: string;
      team: TicketTeam;
    }) => {
      const assignee = DEMO_TICKET_AGENTS.find(a => a.id === input.assigneeId);
      if (isDemoDataEnabled()) {
        const id = `tkt-${Date.now()}`;
        const ticket: TicketView = {
          id,
          displayId: `TKT-${String(Date.now()).slice(-4)}`,
          subject: input.subject,
          status: 'open',
          priority: input.priority,
          contactId: input.contactId,
          contactName: input.contactName ?? 'New contact',
          assigneeId: input.assigneeId,
          assigneeName: assignee?.name,
          team: input.team,
          slaTier: 'Silver',
          slaDeadline: new Date(Date.now() + 4 * 3600000).toISOString(),
          inboxType: 'Web chat',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        if (input.description) {
          const mKey = [...messagesKey(id), true];
          qc.setQueryData<TicketMessageView[]>(mKey, [
            {
              id: 'm-new',
              authorName: 'System',
              direction: 'outbound',
              content: input.description,
              createdAt: new Date().toISOString(),
            },
          ]);
        }
        return ticket;
      }
      const created = await createTicket({
        subject: input.subject,
        description: input.description,
        priority: priorityToApi(input.priority),
        assigneeId: input.assigneeId,
        contactId: input.contactId != null ? String(input.contactId) : undefined,
        team: input.team,
      });
      return mapApiTicket(created as unknown as Record<string, unknown>);
    },
    onSuccess: ticket => {
      const key = [...TICKETS_KEY, isDemoDataEnabled()];
      qc.setQueryData<TicketView[]>(key, old => [ticket, ...(old ?? [])]);
      toast.success('Ticket created');
    },
    onError: () => toast.error('Could not create ticket'),
  });
}

export function useSendTicketMessage(ticketId: string | null) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({
      content,
      resolve,
    }: {
      content: string;
      resolve?: boolean;
    }) => {
      if (!ticketId) throw new Error('No ticket');
      const msg: TicketMessageView = {
        id: `msg-${Date.now()}`,
        authorName: 'You',
        direction: 'outbound',
        content,
        createdAt: new Date().toISOString(),
      };

      if (isDemoDataEnabled()) {
        const mKey = [...messagesKey(ticketId), isDemoDataEnabled()];
        qc.setQueryData<TicketMessageView[]>(mKey, old => [...(old ?? []), msg]);
        if (resolve) {
          const tKey = [...TICKETS_KEY, isDemoDataEnabled()];
          qc.setQueryData<TicketView[]>(tKey, old =>
            (old ?? []).map(t =>
              t.id === ticketId ? { ...t, status: 'resolved' as const, updatedAt: new Date().toISOString() } : t,
            ),
          );
        }
        return;
      }

      await createTicketMessage(ticketId, { content });
      if (resolve) {
        await updateTicket(ticketId, { status: 'resolved' } as Partial<Ticket>);
      }
    },
    onSuccess: (_d, vars) => {
      if (!ticketId) return;
      if (!isDemoDataEnabled()) {
        void qc.invalidateQueries({ queryKey: messagesKey(ticketId) });
        void qc.invalidateQueries({ queryKey: TICKETS_KEY });
      }
      toast.success(vars.resolve ? 'Reply sent and ticket resolved' : 'Reply sent');
    },
    onError: () => toast.error('Could not send reply'),
  });
}

export function useUpdateTicketMeta(ticketId: string | null) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (patch: { status?: TicketStatusUi; assigneeId?: string }) => {
      if (!ticketId) throw new Error('No ticket');
      if (isDemoDataEnabled()) {
        const tKey = [...TICKETS_KEY, isDemoDataEnabled()];
        const agents = DEMO_TICKET_AGENTS;
        qc.setQueryData<TicketView[]>(tKey, old =>
          (old ?? []).map(t => {
            if (t.id !== ticketId) return t;
            const agent = agents.find(a => a.id === patch.assigneeId);
            return {
              ...t,
              status: patch.status ?? t.status,
              assigneeId: patch.assigneeId ?? t.assigneeId,
              assigneeName: agent?.name ?? t.assigneeName,
              updatedAt: new Date().toISOString(),
            };
          }),
        );
        return;
      }
      await updateTicket(ticketId, {
        status: patch.status,
        assigneeId: patch.assigneeId,
      } as Partial<Ticket>);
    },
    onSuccess: () => {
      if (!isDemoDataEnabled() && ticketId) {
        void qc.invalidateQueries({ queryKey: TICKETS_KEY });
      }
      toast.success('Ticket updated');
    },
  });
}

export function currentAssigneeId(userId: number | undefined): string {
  return `agent-${((userId ?? 1) % 3) + 1}`;
}
