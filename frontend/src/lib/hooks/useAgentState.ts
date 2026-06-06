'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { listAgents, listQueues, setAgentState } from '@/lib/api/routing';
import { isDemoDataEnabled } from '@/lib/demo/config';
import { isLiveGatewayEnabled } from '@/lib/live-data/policy';
import { DEMO_AGENTS, DEMO_QUEUES } from '@/lib/demo/callingFixture';
import type { AgentState } from '@/types';

export function useAgents() {
  const live = isLiveGatewayEnabled();
  return useQuery({
    queryKey: ['agents', 'live', live],
    queryFn: async () => {
      if (isDemoDataEnabled()) return DEMO_AGENTS;
      if (!live) return [];
      return listAgents();
    },
    refetchInterval: live ? 5_000 : false,
    enabled: live || isDemoDataEnabled(),
  });
}

export function useQueues() {
  const live = isLiveGatewayEnabled();
  return useQuery({
    queryKey: ['queues', 'live', live],
    queryFn: async () => {
      if (isDemoDataEnabled()) return DEMO_QUEUES;
      if (!live) return [];
      return listQueues();
    },
    refetchInterval: live ? 10_000 : false,
    enabled: live || isDemoDataEnabled(),
  });
}

export function useSetAgentState() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ agentId, state }: { agentId: string; state: AgentState }) =>
      setAgentState(agentId, state),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['agents'] });
    },
  });
}
