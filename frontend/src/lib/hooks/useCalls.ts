'use client';

import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import {
  listActiveSessions,
  listCDR,
  listIncomingCalls,
  answerCall,
} from '@/lib/api/calls';
import { bnFetch } from '@/lib/api/client';
import { isDemoDataEnabled, isGatewayQueryEnabled, shouldSkipGatewayFetch } from '@/lib/demo/config';
import { BlinkoneApiError } from '@/lib/api/client';
import { DEMO_CDR } from '@/lib/demo/callingFixture';
import { DEMO_CALLS } from '@/lib/demo/callsFixture';
import type { CallSession, CDRFilters, CDRRecord } from '@/types';

export function useActiveSessions() {
  const live = isGatewayQueryEnabled();
  return useQuery({
    queryKey: ['activeSessions', isDemoDataEnabled(), live],
    queryFn: async () => {
      if (isDemoDataEnabled() || !live) {
        return DEMO_CALLS.filter(c => c.status === 'connected' || c.status === 'ringing');
      }
      try {
        const data = await listActiveSessions();
        const maxRingMs = 3 * 60 * 1000;
        return data.filter(c => {
          if (c.status === 'connected') return true;
          if (c.status === 'ringing') {
            return Date.now() - new Date(c.startedAt).getTime() < maxRingMs;
          }
          return false;
        });
      } catch {
        return [];
      }
    },
    refetchInterval: live ? 5_000 : false,
  });
}

export function useCDR(filters?: CDRFilters) {
  const limit = filters?.limit ?? 20;
  const page = filters?.page ?? 1;
  const live = isGatewayQueryEnabled();
  return useQuery({
    queryKey: ['cdr', page, limit, isDemoDataEnabled(), live],
    queryFn: async () => {
      if (isDemoDataEnabled() || !live) return DEMO_CDR.slice(0, limit * page);
      try {
        const res = await listCDR({ page, ...filters });
        return (res as { data?: CDRRecord[] }).data ?? [];
      } catch {
        return [];
      }
    },
    placeholderData: keepPreviousData,
  });
}

async function fetchAllCalls(): Promise<CallSession[]> {
  if (isDemoDataEnabled()) return DEMO_CALLS;
  if (shouldSkipGatewayFetch()) return [];
  try {
    const [incoming, listed] = await Promise.all([
      listIncomingCalls().catch(err => {
        if (err instanceof BlinkoneApiError && (err.status === 401 || err.status === 403)) throw err;
        return [] as CallSession[];
      }),
      bnFetch<{ data: CallSession[] }>('calls', '/v1/calls').then(r => r.data ?? []),
    ]);
    const map = new Map<string, CallSession>();
    for (const c of [...incoming, ...listed]) map.set(c.id, c);
    return [...map.values()];
  } catch (err) {
    if (err instanceof BlinkoneApiError && (err.status === 401 || err.status === 403)) throw err;
    return [];
  }
}

export function useCallsList() {
  const gwEnabled = isGatewayQueryEnabled();
  return useQuery({
    queryKey: ['calls', 'all', isDemoDataEnabled()],
    queryFn: fetchAllCalls,
    enabled: gwEnabled,
    retry: (failureCount, error) => {
      if (error instanceof BlinkoneApiError && (error.status === 401 || error.status === 403)) {
        return false;
      }
      return failureCount < 1;
    },
    refetchInterval: query => {
      if (!gwEnabled) return false;
      const err = query.state.error;
      if (err instanceof BlinkoneApiError && (err.status === 401 || err.status === 403)) {
        return false;
      }
      return 5_000;
    },
  });
}

export function useAnswerCall() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => answerCall(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['calls'] });
      qc.invalidateQueries({ queryKey: ['activeSessions'] });
    },
  });
}

export function useDeclineCall() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      if (shouldSkipGatewayFetch()) return;
      await bnFetch<void>('calls', `/v1/calls/${id}/decline`, { method: 'POST', body: '{}' });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['calls'] });
      qc.invalidateQueries({ queryKey: ['activeSessions'] });
    },
    onError: () => {
      console.warn('[calls] decline failed');
    },
  });
}

export async function declineCall(id: string): Promise<void> {
  if (shouldSkipGatewayFetch()) return;
  await bnFetch<void>('calls', `/v1/calls/${id}/decline`, { method: 'POST', body: '{}' });
}
