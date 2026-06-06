/**
 * Chatwoot Conversations API — /api/v2/accounts/:accountId/conversations
 */

import { cwFetch } from './client';
import {
  chatwootFileType,
  normalizeMessages,
  unwrapMessageResponse,
} from '@/lib/utils/messages';
import type { CWConversation, CWInbox, CWMessage, ApiResponse } from '@/types';
import { useAuthStore } from '@/lib/store/auth';

function accountId() {
  const id = useAuthStore.getState().user?.chatwootAccountId;
  if (!id) throw new Error('Not signed in — log in again to send messages');
  return id;
}

export interface ConversationFilters {
  status?: 'open' | 'resolved' | 'pending' | 'all';
  assigneeType?: 'assigned' | 'unassigned' | 'all';
  page?: number;
  labels?: string[];
  teamId?: number;
  inboxId?: number;
  search?: string;
}

export interface CWAgent {
  id: number;
  name: string;
  email: string;
  availability_status?: string;
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
  if (filters.search)       params.set('q', filters.search);

  return cwFetch<ApiResponse<CWConversation[]>>(
    `/accounts/${accountId()}/conversations?${params}`,
  );
}

export async function getConversation(id: number): Promise<CWConversation> {
  return cwFetch<CWConversation>(`/accounts/${accountId()}/conversations/${id}`);
}

export async function getMessages(conversationId: number): Promise<{ payload: CWMessage[] }> {
  const res = await cwFetch<unknown>(
    `/accounts/${accountId()}/conversations/${conversationId}/messages`,
  );
  return { payload: normalizeMessages(res) };
}

export async function sendMessage(
  conversationId: number,
  content: string,
  opts: { private?: boolean; attachments?: File[] } = {},
): Promise<CWMessage> {
  if (opts.attachments?.length) {
    const fd = new FormData();
    fd.append('content', content);
    fd.append('message_type', 'outgoing');
    if (opts.private) fd.append('private', 'true');
    fd.append('file_type', chatwootFileType(opts.attachments[0]!));
    opts.attachments.forEach(f => fd.append('attachments[]', f, f.name || 'attachment'));

    const res = await cwFetch<unknown>(
      `/accounts/${accountId()}/conversations/${conversationId}/messages`,
      { method: 'POST', body: fd },
    );
    return unwrapMessageResponse(res);
  }

  const res = await cwFetch<unknown>(
    `/accounts/${accountId()}/conversations/${conversationId}/messages`,
    {
      method: 'POST',
      body: JSON.stringify({
        content,
        message_type: 'outgoing',
        private: opts.private ?? false,
      }),
    },
  );
  return unwrapMessageResponse(res);
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

/** Clears agent unread count for this conversation (Chatwoot update_last_seen). */
export async function markConversationAsRead(conversationId: number): Promise<void> {
  await cwFetch<void>(
    `/accounts/${accountId()}/conversations/${conversationId}/update_last_seen`,
    { method: 'POST' },
  );
}

export async function listInboxes(): Promise<CWInbox[]> {
  const res = await cwFetch<{ payload?: CWInbox[] }>(`/accounts/${accountId()}/inboxes`);
  return res.payload ?? [];
}

export async function listChatwootAgents(): Promise<CWAgent[]> {
  const res = await cwFetch<CWAgent[] | { payload?: CWAgent[] }>(
    `/accounts/${accountId()}/agents`,
  );
  return Array.isArray(res) ? res : (res.payload ?? []);
}
