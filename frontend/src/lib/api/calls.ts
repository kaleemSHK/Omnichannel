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

// ─── PCI Recording Pause / Resume — Sprint 1 G02 ─────────────────────────────

export interface PciRecordingAction {
  callId: string;
  paused: boolean;
  pciPauseStart?: string;
  pciPauseEnd?: string;
}

/**
 * Enter PCI secure payment mode: pauses call recording.
 * PCI DSS §3.2 — must be called before collecting card number / CVV.
 */
export async function pauseCallRecording(callId: string): Promise<PciRecordingAction> {
  const res = await bnFetch<{ data: PciRecordingAction }>(
    SVC,
    `/v1/calls/${encodeURIComponent(callId)}/recording/pause`,
    { method: 'POST', body: JSON.stringify({}) },
  );
  return res.data;
}

/**
 * Exit PCI secure payment mode: resumes call recording.
 * Must be called once the sensitive card data collection window has closed.
 */
export async function resumeCallRecording(callId: string): Promise<PciRecordingAction> {
  const res = await bnFetch<{ data: PciRecordingAction }>(
    SVC,
    `/v1/calls/${encodeURIComponent(callId)}/recording/resume`,
    { method: 'POST', body: JSON.stringify({}) },
  );
  return res.data;
}

// ─── MOS Voice Quality Scoring — Sprint 1 G03 ────────────────────────────────

export interface RtpStats {
  roundTripTimeMs?: number;
  jitterMs?: number;
  packetsLost?: number;
  packetsSent?: number;
  packetsReceived?: number;
  codec?: string;
}

export interface MosResult {
  mos: number;
  grade: 'excellent' | 'good' | 'fair' | 'poor' | 'bad';
  label: string;
  color: string;
  inputs: RtpStats;
}

export interface MosHistory {
  samples: Array<{
    ts: string;
    mos: number;
    grade: string;
    rtt?: number;
    jitter?: number;
    loss?: number;
  }>;
  avg: number | null;
  min: number | null;
  max: number | null;
}

/**
 * Submit RTP stats sample and receive computed MOS score.
 * Call this every ~5s during an active call using JsSIP getStats().
 */
export async function reportMosSample(callId: string, stats: RtpStats): Promise<MosResult> {
  const res = await bnFetch<{ data: MosResult }>(
    SVC,
    `/v1/calls/${encodeURIComponent(callId)}/mos`,
    { method: 'POST', body: JSON.stringify(stats) },
  );
  return res.data;
}

/** Retrieve MOS history for a completed call (all samples). */
export async function getMosHistory(callId: string): Promise<MosHistory> {
  const res = await bnFetch<{ data: MosHistory }>(SVC, `/v1/calls/${encodeURIComponent(callId)}/mos`);
  return res.data;
}
