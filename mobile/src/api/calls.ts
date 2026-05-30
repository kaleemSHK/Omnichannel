import { bnFetch } from './client';
import type { CallSession, CDRRecord, ApiResponse, CallDirection, CallTransport } from '@/types';

const SVC = 'calls';

export async function createCall(payload: {
  chatwootAccountId?: number;
  customerPhone?: string;
  agentLabel?: string;
  direction?: CallDirection;
  transport?: CallTransport;
  assignedAgentId?: string;
}): Promise<CallSession> {
  const res = await bnFetch<{ data: CallSession }>(SVC, '/v1/calls', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return res.data;
}

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

export async function declineCall(sessionId: string): Promise<void> {
  await bnFetch<void>(SVC, `/v1/calls/${sessionId}/decline`, {
    method: 'POST',
    body: '{}',
  });
}

export async function hangupCall(sessionId: string): Promise<void> {
  await bnFetch<void>(SVC, `/v1/calls/${sessionId}/hangup`, {
    method: 'POST',
    body: '{}',
  });
}

export async function endCall(_sessionId: string, _outcome = 'completed'): Promise<void> {
  await hangupCall(_sessionId);
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
