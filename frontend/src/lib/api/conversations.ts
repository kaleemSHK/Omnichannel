/**
 * Chatwoot Conversations API — /api/v2/accounts/:accountId/conversations
 */

import { cwFetch } from './client';
import type { CWConversation, CWInbox, CWMessage, ApiResponse } from '@/types';
import { useAuthStore } from '@/lib/store/auth';

function accountId() {
  return useAuthStore.getState().user?.chatwootAccountId ?? 0;
}

export interface ConversationFilters {
  status?: 'open' | 'resolved' | 'pending' | 'all';
  assigneeType?: 'assigned' | 'unassigned' | 'all';
  page?: number;
  labels?: string[];
  teamId?: number;
  inboxId?: number;
}

export async function listConversations(
  filters: ConversationFilters = {},
): Promise<ApiResponse<CWConversation[]>> {
  const params = new URLSearchParams();
  if (filters.status)       params.set('status', filters.status);
  if (filters.assigneeType) params.set('assignee_type', filters.assigneeType);
  if (filters.page)         params.set('page', String(filters.page));
  if (filters.teamId)       params.set('team_id', String(filters.teamId));
  if (filters.inboxId)      params.set('inbox_id', String(filters.inboxId));

  return cwFetch<ApiResponse<CWConversation[]>>(
    `/accounts/${accountId()}/conversations?${params}`,
  );
}

export async function getConversation(id: number): Promise<CWConversation> {
  return cwFetch<CWConversation>(`/accounts/${accountId()}/conversations/${id}`);
}

export async function getMessages(conversationId: number): Promise<{ payload: CWMessage[] }> {
  return cwFetch<{ payload: CWMessage[] }>(
    `/accounts/${accountId()}/conversations/${conversationId}/messages`,
  );
}

export async function sendMessage(
  conversationId: number,
  content: string,
  opts: { private?: boolean; attachments?: File[] } = {},
): Promise<CWMessage> {
  if (opts.attachments?.length) {
    const fd = new FormData();
    fd.append('content', content);
    if (opts.private) fd.append('private', 'true');
    opts.attachments.forEach((f) => fd.append('attachments[]', f));
    return cwFetch<CWMessage>(
      `/accounts/${accountId()}/conversations/${conversationId}/messages`,
      { method: 'POST', body: fd, headers: {} }, // let browser set multipart
    );
  }

  return cwFetch<CWMessage>(
    `/accounts/${accountId()}/conversations/${conversationId}/messages`,
    {
      method: 'POST',
      body: JSON.stringify({ content, private: opts.private ?? false }),
    },
  );
}

export async function assignConversation(
  conversationId: number,
  assigneeId: number | null,
  teamId?: number | null,
): Promise<void> {
  await cwFetch<void>(
    `/accounts/${accountId()}/conversations/${conversationId}/assignments`,
    {
      method: 'POST',
      body: JSON.stringify({ assignee_id: assigneeId, team_id: teamId }),
    },
  );
}

export async function updateConversationStatus(
  conversationId: number,
  status: 'open' | 'resolved' | 'pending',
): Promise<CWConversation> {
  return cwFetch<CWConversation>(
    `/accounts/${accountId()}/conversations/${conversationId}/toggle_status`,
    { method: 'POST', body: JSON.stringify({ status }) },
  );
}

export async function listInboxes(): Promise<CWInbox[]> {
  const res = await cwFetch<{ payload?: CWInbox[] }>(`/accounts/${accountId()}/inboxes`);
  return res.payload ?? [];
}
