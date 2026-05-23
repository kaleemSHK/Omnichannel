'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { listAgents, listQueues, setAgentState } from '@/lib/api/routing';
import { DEMO_AGENTS, DEMO_QUEUES } from '@/lib/demo/callingFixture';
import type { AgentState } from '@/types';

export function useAgents() {
  return useQuery({
    queryKey: ['agents'],
    queryFn: async () => {
      try {
        const data = await listAgents();
        return data.length ? data : DEMO_AGENTS;
      } catch {
        return DEMO_AGENTS;
      }
    },
    refetchInterval: 5_000,
  });
}

export function useQueues() {
  return useQuery({
    queryKey: ['queues'],
    queryFn: async () => {
      try {
        const data = await listQueues();
        return data.length ? data : DEMO_QUEUES;
      } catch {
        return DEMO_QUEUES;
      }
    },
    refetchInterval: 5_000,
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
