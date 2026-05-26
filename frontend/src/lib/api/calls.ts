/**
 * BlinkOne Calls sidecar — /api/calls
 * Gateway route: gateway → services/calls
 */

import { bnFetch } from './client';
import type { CallSession, CDRRecord, ApiResponse } from '@/types';

const SVC = 'calls';

export async function listActiveSessions(): Promise<CallSession[]> {
  const res = await bnFetch<{ data: CallSession[] }>(SVC, '/v1/sessions');
  return res.data;
}

export async function getSession(id: string): Promise<CallSession> {
  const res = await bnFetch<{ data: CallSession }>(SVC, `/v1/sessions/${id}`);
  return res.data;
}

export async function createSession(payload: {
  roomId: string;
  chatwootAccountId: number;
  channel?: string;
  agentLabel: string;
  customerPhone: string;
  transport?: 'pstn' | 'whatsapp';
  direction?: 'inbound' | 'outbound';
}): Promise<CallSession> {
  const res = await bnFetch<{ data: CallSession }>(SVC, '/v1/sessions', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
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

export async function endCall(sessionId: string, outcome = 'completed'): Promise<void> {
  await bnFetch<void>(SVC, `/v1/calls/${sessionId}`, {
    method: 'PATCH',
    body: JSON.stringify({ status: 'ended', outcome }),
  });
}

export async function holdCall(sessionId: string, hold: boolean): Promise<void> {
  await bnFetch<void>(SVC, `/v1/calls/${sessionId}`, {
    method: 'PATCH',
    body: JSON.stringify({ status: hold ? 'on_hold' : 'connected' }),
  });
}

export async function listIncomingCalls(): Promise<CallSession[]> {
  const res = await bnFetch<{ data: CallSession[] }>(SVC, '/v1/calls/incoming');
  return res.data;
}

export async function addCallNotes(
  sessionId: string,
  data: { outcome: string; notes?: string },
): Promise<void> {
  await bnFetch<void>(SVC, `/v1/calls/${sessionId}`, {
    method: 'PATCH',
    body: JSON.stringify({ outcome: data.outcome, metadata: { notes: data.notes ?? '' } }),
  });
}

export async function listCDR(filters: {
  page?: number;
  from?: string;
  to?: string;
  agentId?: string;
}): Promise<ApiResponse<CDRRecord[]>> {
  const params = new URLSearchParams();
  if (filters.page)    params.set('page', String(filters.page));
  if (filters.from)    params.set('from', filters.from);
  if (filters.to)      params.set('to', filters.to);
  if (filters.agentId) params.set('agent_id', filters.agentId);
  return bnFetch<ApiResponse<CDRRecord[]>>(SVC, `/v1/cdr?${params}`);
}
