'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { listAgents, listQueues, setAgentState } from '@/lib/api/routing';
import { isDemoDataEnabled, shouldSkipGatewayFetch } from '@/lib/demo/config';
import { DEMO_AGENTS, DEMO_QUEUES } from '@/lib/demo/callingFixture';
import type { AgentState } from '@/types';

export function useAgents() {
  const live = !shouldSkipGatewayFetch() || isDemoDataEnabled();
  return useQuery({
    queryKey: ['agents', isDemoDataEnabled(), live],
    queryFn: async () => {
      if (shouldSkipGatewayFetch()) return DEMO_AGENTS;
      try {
        const rows = await listAgents();
        return rows.length ? rows : DEMO_AGENTS;
      } catch {
        return DEMO_AGENTS;
      }
    },
    refetchInterval: live ? 5_000 : false,
  });
}

export function useQueues() {
  const live = !shouldSkipGatewayFetch() || isDemoDataEnabled();
  return useQuery({
    queryKey: ['queues', isDemoDataEnabled(), live],
    queryFn: async () => {
      if (shouldSkipGatewayFetch()) return DEMO_QUEUES;
      try {
        const rows = await listQueues();
        return rows.length ? rows : DEMO_QUEUES;
      } catch {
        return DEMO_QUEUES;
      }
    },
    refetchInterval: live ? 10_000 : false,
  });
}

export function useSetAgentState() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ agentId, state }: { agentId: string; state: AgentState }) =>
      setAgentState(agentId, state),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['agents'] }),
  });
}
