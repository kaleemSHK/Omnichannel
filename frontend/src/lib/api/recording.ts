/**
 * BlinkOne Recording sidecar — /api/recordings
 */

import { bnFetch } from './client';
import { useAuthStore } from '@/lib/store/auth';
import { GATEWAY_URL } from '@/lib/env';

const SVC = 'recordings';

export interface Recording {
  id: string;
  tenantId?: string;
  callSessionId: string;
  call_id?: string;
  agentId?: string;
  durationSec: number;
  duration_sec?: number;
  direction?: 'inbound' | 'outbound';
  sizeBytes?: number;
  status: 'pending' | 'ready' | 'failed';
  createdAt: string;
  created_at?: string;
}

function mapRow(row: Record<string, unknown>): Recording {
  const durationSec = Number(row.duration_sec ?? row.durationSec ?? 0);
  return {
    id: String(row.id ?? ''),
    tenantId: String(row.tenant_id ?? row.tenantId ?? ''),
    callSessionId: String(row.call_session_id ?? row.callSessionId ?? row.call_id ?? ''),
    call_id: row.call_id != null ? String(row.call_id) : undefined,
    agentId: row.agent_id != null ? String(row.agent_id) : undefined,
    durationSec,
    direction: (row.direction as 'inbound' | 'outbound') ?? 'inbound',
    status: (row.status as Recording['status']) ?? 'ready',
    createdAt: String(row.created_at ?? row.createdAt ?? new Date().toISOString()),
  };
}

export async function listRecordings(filters: {
  callSessionId?: string;
  page?: number;
} = {}): Promise<Recording[]> {
  const params = new URLSearchParams();
  if (filters.callSessionId) params.set('call_session_id', filters.callSessionId);
  if (filters.page) params.set('page', String(filters.page));
  const qs = params.toString();
  const res = await bnFetch<{ data: unknown[] }>(SVC, `/v1/recordings${qs ? `?${qs}` : ''}`);
  return (res.data ?? []).map(r => mapRow(r as Record<string, unknown>));
}

export async function getRecordingPlayUrl(
  id: string,
): Promise<{ url: string | null; stub?: boolean; expiresInSec?: number }> {
  const res = await bnFetch<{ data: { url?: string | null; stub?: boolean; expiresInSec?: number } }>(
    SVC,
    `/v1/recordings/${encodeURIComponent(id)}/play`,
  );
  return {
    url: res.data?.url ?? null,
    stub: res.data?.stub,
    expiresInSec: res.data?.expiresInSec,
  };
}

export async function getRecordingPlaybackUrl(id: string): Promise<{
  url: string;
  expiresAt: string;
}> {
  const play = await getRecordingPlayUrl(id);
  const expires = new Date(Date.now() + (play.expiresInSec ?? 3600) * 1000).toISOString();
  return { url: play.url ?? '', expiresAt: expires };
}

/** Fetch recording audio through the gateway (JWT); use with URL.createObjectURL for playback. */
export async function fetchRecordingAudioBlob(id: string): Promise<Blob> {
  const { tokens } = useAuthStore.getState();
  const res = await fetch(
    `${GATEWAY_URL}/api/${SVC}/v1/recordings/${encodeURIComponent(id)}/stream`,
    {
      headers: tokens?.gatewayJwt
        ? { Authorization: `Bearer ${tokens.gatewayJwt}` }
        : {},
    },
  );
  if (!res.ok) {
    throw new Error(`Recording stream failed (${res.status})`);
  }
  return res.blob();
}
