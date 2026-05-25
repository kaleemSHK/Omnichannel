import { bnFetch } from './client';
import type { CallSession, CDRRecord, ApiResponse } from '@/types';

const SVC = 'calls';

export async function listActiveSessions(): Promise<CallSession[]> {
  const res = await bnFetch<{ data: CallSession[] }>(SVC, '/v1/sessions');
  return res.data;
}

export async function answerCall(sessionId: string): Promise<CallSession> {
  const res = await bnFetch<{ data: CallSession }>(SVC, `/v1/calls/${sessionId}/answer`, {
    method: 'POST',
  });
  return res.data;
}

export async function endCall(sessionId: string, outcome = 'completed'): Promise<void> {
  await bnFetch<void>(SVC, `/v1/calls/${sessionId}`, {
    method: 'PATCH',
    body: JSON.stringify({ status: 'ended', outcome }),
  });
}

export async function listCDR(filters: {
  page?: number;
  from?: string;
  to?: string;
  agentId?: string;
} = {}): Promise<ApiResponse<CDRRecord[]>> {
  const params = new URLSearchParams();
  if (filters.page) params.set('page', String(filters.page));
  if (filters.from) params.set('from', filters.from);
  if (filters.to) params.set('to', filters.to);
  if (filters.agentId) params.set('agent_id', filters.agentId);
  return bnFetch<ApiResponse<CDRRecord[]>>(SVC, `/v1/cdr?${params}`);
}
