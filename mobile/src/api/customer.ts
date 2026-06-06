import { GATEWAY_URL } from '@/lib/env';
import { loadCustomerSession } from '@/lib/storage';
import type { CWMessage, Ticket, ApiResponse } from '@/types';

export class CustomerApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
    this.name = 'CustomerApiError';
  }
}

async function customerToken(): Promise<string> {
  const session = await loadCustomerSession();
  if (!session.token) throw new CustomerApiError('Customer session required', 401);
  return session.token;
}

async function customerFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await customerToken();
  const res = await fetch(`${GATEWAY_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) {
    let msg = `Request failed: ${res.status}`;
    try {
      const body = await res.json();
      msg = body?.error?.message ?? body?.message ?? msg;
    } catch {
      /* ignore */
    }
    throw new CustomerApiError(msg, res.status);
  }
  if (res.status === 204) return undefined as T;
  const json = (await res.json()) as T & { data?: T };
  return (json?.data ?? json) as T;
}

export interface CustomerSessionResponse {
  token: string;
  contactId: number;
  accountId: number;
  conversationId: number;
  inboxId: number;
  name: string;
}

export async function startCustomerSession(body: {
  name: string;
  email?: string;
  phone?: string;
  contactId?: number;
  conversationId?: number;
  accountId?: number;
}): Promise<CustomerSessionResponse> {
  const res = await fetch(`${GATEWAY_URL}/api/customer/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    let msg = `Session failed: ${res.status}`;
    try {
      const err = await res.json();
      msg = err?.error?.message ?? msg;
    } catch {
      /* ignore */
    }
    throw new CustomerApiError(msg, res.status);
  }
  return res.json() as Promise<CustomerSessionResponse>;
}

export async function listCustomerTickets(filters: { status?: string } = {}): Promise<ApiResponse<Ticket[]>> {
  const params = new URLSearchParams();
  if (filters.status) params.set('status', filters.status);
  const qs = params.toString();
  const body = await customerFetch<{ data?: Ticket[] } | Ticket[]>(
    `/api/customer/tickets${qs ? `?${qs}` : ''}`,
  );
  if (Array.isArray(body)) return { data: body };
  return { data: body.data ?? [] };
}

export async function createCustomerTicket(data: {
  subject: string;
  description?: string;
  priority: string;
}): Promise<Ticket> {
  const res = await customerFetch<{ data: Ticket }>('/api/customer/tickets', {
    method: 'POST',
    body: JSON.stringify({
      title: data.subject,
      subject: data.subject,
      priority: data.priority,
      customFields: data.description ? { description: data.description } : undefined,
    }),
  });
  return res.data;
}

export async function getCustomerTicket(id: string): Promise<Ticket> {
  const res = await customerFetch<{ data: Ticket }>(`/api/customer/tickets/${encodeURIComponent(id)}`);
  return res.data;
}

export async function getCustomerMessages(conversationId: number): Promise<{ payload: CWMessage[] }> {
  const data = await customerFetch<{ payload?: CWMessage[]; data?: CWMessage[] }>(
    `/api/customer/conversations/${conversationId}/messages`,
  );
  return { payload: data.payload ?? data.data ?? [] };
}

export async function sendCustomerMessage(conversationId: number, content: string): Promise<CWMessage> {
  return customerFetch<CWMessage>(`/api/customer/conversations/${conversationId}/messages`, {
    method: 'POST',
    body: JSON.stringify({ content }),
  });
}

export async function getCustomerConversation(conversationId: number): Promise<{ id: number }> {
  return customerFetch<{ id: number }>(`/api/customer/conversations/${conversationId}`);
}

export type CustomerCallRouteStatus = {
  callId: string;
  status: 'queued' | 'assigned' | 'routing' | 'pending' | 'unknown';
  eventType?: string;
  position?: number;
  depth?: number;
  queueKey?: string;
  agentId?: string;
  /** SIP user to dial when assigned (e.g. blinkone for web desk) */
  dialTarget?: string;
  sessionId?: string | null;
  /** IVR entry prompt — shown while waiting in queue */
  welcomeMessage?: string;
};

export async function requestCustomerCall(body: {
  queueKey?: string;
  callId?: string;
  callerId?: string;
  callerName?: string;
  callerPhone?: string;
  contactId?: number;
}): Promise<CustomerCallRouteStatus & { sessionId?: string | null }> {
  return customerFetch(`/api/customer/call/request`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function getCustomerCallStatus(callId: string): Promise<CustomerCallRouteStatus> {
  return customerFetch(`/api/customer/call/${encodeURIComponent(callId)}/status`);
}

export async function cancelCustomerCall(callId: string): Promise<{ callId: string; status: string }> {
  return customerFetch(`/api/customer/call/${encodeURIComponent(callId)}/cancel`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
}
