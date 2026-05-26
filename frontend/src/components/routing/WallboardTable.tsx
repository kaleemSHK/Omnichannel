'use client';

import { useAgents } from '@/lib/hooks/useAgentState';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils/cn';
import type { AgentState, RoutingAgent } from '@/types';

const STATE_STYLES: Record<AgentState, string> = {
  available: 'bg-green-100 text-green-700',
  busy: 'bg-amber-100 text-amber-700',
  break: 'bg-pink-100 text-pink-700',
  offline: 'bg-gray-100 text-gray-600',
};

interface Props {
  agents?: RoutingAgent[];
  filter?: string;
  queueKey?: string;
  live?: boolean;
}

export function WallboardTable({
  agents: propAgents,
  filter = 'all',
  queueKey,
  live,
}: Props) {
  const { data: hookAgents = [], isLoading } = useAgents();
  const useHook = propAgents == null;
  const agents = propAgents ?? hookAgents;
  const visible =
    filter === 'all'
      ? agents
      : agents.filter(
          a =>
            !queueKey ||
            (a.queueKeys ?? []).includes(queueKey) ||
            a.skills.includes(queueKey),
        );

  if (useHook && isLoading && !live) {
    return (
      <div className="bn-card overflow-hidden">
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  return (
    <div className="bn-card overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-left text-xs text-muted-foreground">
          <tr>
            <th className="px-3 py-2">Agent</th>
            <th className="px-3 py-2">State</th>
            <th className="px-3 py-2">Current call</th>
            <th className="px-3 py-2">Duration</th>
            <th className="px-3 py-2">Handled today</th>
            <th className="px-3 py-2">Actions</th>
          </tr>
        </thead>
        <tbody>
          {visible.map(a => (
            <tr key={a.id} className="border-t border-gray-100">
              <td className="px-3 py-2 font-medium">{a.name}</td>
              <td className="px-3 py-2">
                <span
                  className={cn(
                    'px-2 py-0.5 rounded-full text-xs capitalize',
                    STATE_STYLES[a.state],
                  )}
                >
                  {a.state}
                </span>
              </td>
              <td className="px-3 py-2 text-muted-foreground">{a.currentCallId ?? '—'}</td>
              <td className="px-3 py-2 text-muted-foreground tabular-nums">—</td>
              <td className="px-3 py-2 text-muted-foreground">—</td>
              <td className="px-3 py-2">
                {a.state === 'busy' && (
                  <div className="flex gap-1">
                    {['Listen', 'Whisper', 'Barge'].map(label => (
                      <button
                        key={label}
                        type="button"
                        className="px-2 py-0.5 text-[10px] border border-gray-200 rounded hover:bg-muted"
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                )}
              </td>
            </tr>
          ))}
          {!visible.length && (
            <tr>
              <td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">
                No agents to display
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
