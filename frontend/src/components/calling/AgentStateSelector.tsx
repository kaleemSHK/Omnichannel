'use client';

import { useEffect, useState } from 'react';
import { useAuthStore } from '@/lib/store/auth';
import { useCallsStore } from '@/lib/store/calls';
import { useAgents, useSetAgentState } from '@/lib/hooks/useAgentState';
import { useRoutingPresence } from '@/lib/hooks/useRoutingPresence';
import { cn } from '@/lib/utils/cn';
import type { AgentState } from '@/types';

const STATE_COLORS: Record<AgentState, string> = {
  available: 'bg-green-500',
  busy: 'bg-amber-500',
  break: 'bg-pink-500',
  offline: 'bg-gray-400',
  acw: 'bg-purple-500',
};

export function AgentStateSelector() {
  const { user } = useAuthStore();
  const localState = useCallsStore(s => s.agentState);
  const setLocalState = useCallsStore(s => s.setAgentState);
  const { data: agents = [] } = useAgents();
  const { agent: meFromRouting } = useRoutingPresence();
  const mutation = useSetAgentState();
  const [state, setState] = useState<AgentState>(localState);

  const me =
    meFromRouting ??
    agents.find(a => a.agentId === String(user?.id)) ??
    agents[0];

  useEffect(() => {
    if (me?.state) setState(me.state);
  }, [me?.state]);

  function handleChange(newState: AgentState) {
    setState(newState);
    setLocalState(newState);
    const agentId = me?.agentId ?? String(user?.id ?? '');
    if (agentId) mutation.mutate({ agentId, state: newState });
  }

  return (
    <div className="flex items-center gap-2">
      <div className={cn('w-2 h-2 rounded-full', STATE_COLORS[state])} />
      <select
        value={state}
        onChange={e => handleChange(e.target.value as AgentState)}
        className="w-36 h-8 text-xs border border-gray-200 rounded-md px-2 bg-white capitalize"
      >
        {Object.keys(STATE_COLORS).map(value => (
          <option key={value} value={value}>
            {value.charAt(0).toUpperCase() + value.slice(1)}
          </option>
        ))}
      </select>
    </div>
  );
}
