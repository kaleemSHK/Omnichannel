'use client';

import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getAgent } from '@/lib/api/routing';
import { useAuthStore } from '@/lib/store/auth';
import { useCallsStore } from '@/lib/store/calls';
import { isLiveGatewayEnabled } from '@/lib/live-data/policy';
import type { AgentState } from '@/types';

/**
 * Sync local agent UI state from routing service (Redis-backed presence).
 * SIP register also PATCHes routing; this keeps the selector accurate on load.
 */
export function useRoutingPresence() {
  const user = useAuthStore(s => s.user);
  const setAgentState = useCallsStore(s => s.setAgentState);
  const agentId = user?.id != null ? String(user.id) : '';

  const { data: agent } = useQuery({
    queryKey: ['routing-agent', agentId],
    queryFn: () => getAgent(agentId),
    enabled: Boolean(agentId) && isLiveGatewayEnabled(),
    refetchInterval: 10_000,
  });

  useEffect(() => {
    if (agent?.state) {
      setAgentState(agent.state as AgentState);
    }
  }, [agent?.state, setAgentState]);

  return { agent, agentId };
}
