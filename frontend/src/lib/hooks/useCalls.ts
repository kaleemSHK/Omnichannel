'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  listActiveSessions,
  listCDR,
  listIncomingCalls,
  answerCall,
} from '@/lib/api/calls';
import { bnFetch } from '@/lib/api/client';
import { DEMO_CDR } from '@/lib/demo/callingFixture';
import { DEMO_CALLS } from '@/lib/demo/callsFixture';
import type { CallSession, CDRFilters, CDRRecord } from '@/types';

export function useActiveSessions() {
  return useQuery({
    queryKey: ['activeSessions'],
    queryFn: async () => {
      try {
        const data = await listActiveSessions();
        const live = data.filter(c => c.status === 'connected' || c.status === 'ringing');
        if (live.length) return live;
      } catch {
        /* demo fallback */
      }
      return DEMO_CALLS.filter(c => c.status === 'connected' || c.status === 'ringing');
    },
    refetchInterval: 5_000,
  });
}

export function useCDR(filters?: CDRFilters) {
  const limit = filters?.limit ?? 20;
  return useQuery({
    queryKey: ['cdr', filters],
    queryFn: async () => {
      try {
        const res = await listCDR({ page: filters?.page ?? 1, ...filters });
        const rows = (res as { data?: CDRRecord[] }).data ?? [];
        if (rows.length) return rows.slice(0, limit);
      } catch {
        /* demo */
      }
      return DEMO_CDR.slice(0, limit);
    },
  });
}

async function fetchAllCalls(): Promise<CallSession[]> {
  try {
    const [incoming, listed] = await Promise.all([
      listIncomingCalls().catch(() => [] as CallSession[]),
      bnFetch<{ data: CallSession[] }>('calls', '/v1/calls').then(r => r.data ?? []),
    ]);
    const map = new Map<string, CallSession>();
    for (const c of [...incoming, ...listed]) map.set(c.id, c);
    const merged = [...map.values()];
    return merged.length ? merged : DEMO_CALLS;
  } catch {
    return DEMO_CALLS;
  }
}

export function useCallsList() {
  return useQuery({
    queryKey: ['calls', 'all'],
    queryFn: fetchAllCalls,
    refetchInterval: 5_000,
  });
}

export function useAnswerCall() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => answerCall(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['calls'] }),
  });
}

export async function declineCall(id: string): Promise<void> {
  await bnFetch<void>('calls', `/v1/calls/${id}/decline`, { method: 'POST', body: '{}' });
}
