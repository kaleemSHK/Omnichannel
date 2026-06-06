import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getAgent, setAgentState as apiSetAgentState } from '@/api/routing';
import { useAuthStore } from '@/store/auth';
import { useCallsStore } from '@/store/calls';
import type { AgentState } from '@/types';

/** Load agent presence from routing (Redis) — no local mock state. */
export function useRoutingPresence() {
  const user = useAuthStore((s) => s.user);
  const setLocalState = useCallsStore((s) => s.setAgentState);
  const agentId = user?.id != null ? String(user.id) : '';

  const { data: agent, refetch } = useQuery({
    queryKey: ['routing-agent', agentId],
    queryFn: () => getAgent(agentId),
    enabled: Boolean(agentId),
    refetchInterval: 10_000,
  });

  useEffect(() => {
    const raw = agent as { status?: string; state?: AgentState } | undefined;
    const s = raw?.status ?? raw?.state;
    if (!s) return;
    const mapped: AgentState =
      s === 'away' || s === 'break'
        ? 'break'
        : s === 'available' || s === 'busy'
          ? s
          : 'offline';
    setLocalState(mapped);
  }, [agent, setLocalState]);

  async function publishState(state: AgentState) {
    setLocalState(state);
    if (agentId) await apiSetAgentState(agentId, state);
  }

  return { agent, agentId, publishState, refetch };
}
