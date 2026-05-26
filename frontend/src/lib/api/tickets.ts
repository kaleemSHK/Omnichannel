/**
 * BlinkOne Tickets sidecar — /api/tickets
 */

import { bnFetch } from './client';
import { useAuthStore } from '@/lib/store/auth';
import type { Ticket, ApiResponse } from '@/types';

const SVC = 'tickets';

function accountQuery(): string {
  const accountId = useAuthStore.getState().user?.chatwootAccountId;
  return accountId != null ? `chatwoot_account_id=${accountId}` : '';
}

export async function listTickets(filters: {
  status?: string;
  priority?: string;
  assigneeId?: string;
  assigned_to?: string;
  contact_id?: string | number;
  contactId?: string | number;
  team?: string;
  page?: number;
} = {}): Promise<ApiResponse<Ticket[]>> {
  const params = new URLSearchParams();
  if (filters.status) params.set('status', filters.status);
  if (filters.priority) params.set('priority', filters.priority);
  const assignee = filters.assigneeId ?? filters.assigned_to;
  if (assignee) params.set('assignee_id', assignee);
  const contact = filters.contact_id ?? filters.contactId;
  if (contact != null) params.set('contact_id', String(contact));
  if (filters.team) params.set('team', filters.team);
  if (filters.page) params.set('page', String(filters.page));
  const account = accountQuery();
  const qs = params.toString();
  const path = `/v1/tickets?${[qs, account].filter(Boolean).join('&')}`;
  return bnFetch<ApiResponse<Ticket[]>>(SVC, path);
}

export async function getTicket(id: string): Promise<Ticket> {
  const res = await bnFetch<{ data: Ticket }>(SVC, `/v1/tickets/${id}`);
  return res.data;
}

export async function createTicket(data: {
  subject: string;
  title?: string;
  description?: string;
  priority: Ticket['priority'] | string;
  assigneeId?: string;
  contactId?: string;
  contactName?: string;
  customerEmail?: string;
  conversationId?: string;
  team?: string;
  department?: string;
  customFields?: Record<string, string | number | boolean>;
}): Promise<Ticket> {
  const accountId = useAuthStore.getState().user?.chatwootAccountId;
  const customFields: Record<string, string | number | boolean> = {
    ...(data.customFields ?? {}),
  };
  if (data.description?.trim()) {
    customFields.description = data.description.trim();
  }

  const res = await bnFetch<{ data: Ticket }>(SVC, '/v1/tickets', {
    method: 'POST',
    body: JSON.stringify({
      title: data.title ?? data.subject,
      subject: data.subject,
      chatwootAccountId: accountId,
      chatwootConversationId: data.conversationId ? Number(data.conversationId) : undefined,
      priority: data.priority,
      assigneeId: data.assigneeId,
      contactId: data.contactId,
      customerName: data.contactName,
      customerEmail: data.customerEmail,
      conversationId: data.conversationId,
      department: data.department ?? data.team,
      customFields: Object.keys(customFields).length ? customFields : undefined,
    }),
  });
  return res.data;
}

export async function getTicketMessages(ticketId: string): Promise<
  {
    id: string;
    authorName: string;
    direction: 'inbound' | 'outbound';
    content: string;
    createdAt: string;
  }[]
> {
  try {
    const res = await bnFetch<{
      data: {
        id: string;
        at: string;
        type: string;
        message: string;
        actor: string;
      }[];
    }>(SVC, `/v1/tickets/${encodeURIComponent(ticketId)}/messages`);
    return (res.data ?? []).map((row, i) => ({
      id: row.id ?? `msg-${i}`,
      authorName: row.actor ?? 'Agent',
      direction: row.actor === 'customer' || row.type === 'inbound' ? 'inbound' : 'outbound',
      content: row.message,
      createdAt: row.at,
    }));
  } catch {
    const ticket = await getTicket(ticketId);
    const timeline = (ticket as Ticket & { timeline?: { at: string; message: string; actor: string; type: string }[] })
      .timeline;
    return (timeline ?? []).map((row, i) => ({
      id: `tl-${i}`,
      authorName: row.actor ?? 'Agent',
      direction:
        row.actor === 'customer' || row.type === 'inbound' ? ('inbound' as const) : ('outbound' as const),
      content: row.message,
      createdAt: row.at,
    }));
  }
}

export async function createTicketMessage(
  ticketId: string,
  payload: { content: string },
): Promise<void> {
  await bnFetch(SVC, `/v1/tickets/${encodeURIComponent(ticketId)}/timeline`, {
    method: 'POST',
    body: JSON.stringify({
      type: 'comment',
      message: payload.content,
      actor: 'agent',
    }),
  });
}

export async function updateTicket(id: string, data: Partial<Ticket>): Promise<Ticket> {
  const res = await bnFetch<{ data: Ticket }>(SVC, `/v1/tickets/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
  return res.data;
}

export async function getTicketTimeline(id: string): Promise<unknown[]> {
  const res = await bnFetch<{ data: unknown[] }>(SVC, `/v1/tickets/${id}/timeline`);
  return res.data;
}

// ─── Conversation Link — Sprint 2 T01 ────────────────────────────────────────

/**
 * Find the ticket linked to a specific Chatwoot conversation ID.
 * Returns null if no ticket is linked.
 */
export async function getTicketByConversation(conversationId: number): Promise<Ticket | null> {
  const accountId = useAuthStore.getState().user?.chatwootAccountId;
  if (!accountId) return null;
  try {
    const res = await bnFetch<{ data: Ticket }>(
      SVC,
      `/v1/tickets/by-conversation/${conversationId}?chatwoot_account_id=${accountId}`,
    );
    return res.data ?? null;
  } catch {
    return null;
  }
}

/**
 * Link an existing ticket to a Chatwoot conversation.
 * Posts an activity note to the conversation announcing the link.
 */
export async function linkTicketToConversation(
  ticketId: string,
  conversationId: number,
): Promise<Ticket> {
  const res = await bnFetch<{ data: Ticket }>(
    SVC,
    `/v1/tickets/${encodeURIComponent(ticketId)}/link-conversation`,
    { method: 'PATCH', body: JSON.stringify({ conversationId }) },
  );
  return res.data;
}
