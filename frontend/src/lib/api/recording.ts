/**
 * BlinkOne Recording sidecar — /api/recordings
 */

import { bnFetch } from './client';

const SVC = 'recordings';

export interface Recording {
  id: string;
  tenantId: string;
  callSessionId: string;
  durationSec: number;
  sizeBytes: number;
  status: 'pending' | 'ready' | 'failed';
  createdAt: string;
}

export async function listRecordings(filters: {
  callSessionId?: string;
  page?: number;
} = {}): Promise<Recording[]> {
  const params = new URLSearchParams();
  if (filters.callSessionId) params.set('call_session_id', filters.callSessionId);
  if (filters.page)          params.set('page', String(filters.page));
  const res = await bnFetch<{ data: Recording[] }>(SVC, `/v1/recordings?${params}`);
  return res.data;
}

export async function getRecordingPlaybackUrl(id: string): Promise<{ url: string; expiresAt: string }> {
  const res = await bnFetch<{ data: unknown }>(SVC, `/v1/recordings/${id}/playback-url`);
  return res.data as { url: string; expiresAt: string };
}
