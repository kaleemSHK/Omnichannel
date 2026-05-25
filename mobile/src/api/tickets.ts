import { bnFetch } from './client';
import type { Ticket, ApiResponse } from '@/types';

const SVC = 'tickets';

export async function listTickets(
  filters: {
    status?: string;
    priority?: string;
    contactId?: string | number;
    page?: number;
  } = {},
): Promise<ApiResponse<Ticket[]>> {
  const params = new URLSearchParams();
  if (filters.status) params.set('status', filters.status);
  if (filters.priority) params.set('priority', filters.priority);
  if (filters.contactId != null) params.set('contact_id', String(filters.contactId));
  if (filters.page) params.set('page', String(filters.page));
  return bnFetch<ApiResponse<Ticket[]>>(SVC, `/v1/tickets?${params}`);
}

export async function getTicket(id: string): Promise<Ticket> {
  const res = await bnFetch<{ data: Ticket }>(SVC, `/v1/tickets/${id}`);
  return res.data;
}

export async function createTicket(data: {
  subject: string;
  description?: string;
  priority: Ticket['priority'];
  contactId?: string;
}): Promise<Ticket> {
  const res = await bnFetch<{ data: Ticket }>(SVC, '/v1/tickets', {
    method: 'POST',
    body: JSON.stringify({
      title: data.subject,
      subject: data.subject,
      priority: data.priority,
      contactId: data.contactId,
      customFields: data.description ? { description: data.description } : undefined,
    }),
  });
  return res.data;
}
