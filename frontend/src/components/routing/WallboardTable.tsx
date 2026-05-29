'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { useAgents } from '@/lib/hooks/useAgentState';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils/cn';
import { superviseCall, type SuperviseMode } from '@/lib/api/routing';
import { useAuthStore } from '@/lib/store/auth';
import type { AgentState, RoutingAgent } from '@/types';

const STATE_STYLES: Record<AgentState, string> = {
  available: 'bg-green-100 text-green-700',
  busy: 'bg-amber-100 text-amber-700',
  break: 'bg-pink-100 text-pink-700',
  offline: 'bg-gray-100 text-gray-600',
  acw: 'bg-purple-100 text-purple-700',
};

interface Props {
  agents?: RoutingAgent[];
  filter?: string;
  queueKey?: string;
  live?: boolean;
}

function SuperviseActions({ agent }: { agent: RoutingAgent }) {
  const [loading, setLoading] = useState<SuperviseMode | null>(null);
  const userId = useAuthStore(s => s.user?.id?.toString() ?? 'supervisor');

  if (!agent.currentCallId) return <span className="text-muted-foreground">—</span>;

  const modes: { label: string; mode: SuperviseMode; style: string }[] = [
    { label: 'Listen', mode: 'listen', style: 'border-blue-200 text-blue-700 hover:bg-blue-50' },
    { label: 'Whisper', mode: 'whisper', style: 'border-amber-200 text-amber-700 hover:bg-amber-50' },
    { label: 'Barge', mode: 'barge', style: 'border-red-200 text-red-700 hover:bg-red-50' },
  ];

  async function handle(mode: SuperviseMode) {
    if (loading || !agent.currentCallId) return;
    setLoading(mode);
    try {
      await superviseCall(agent.currentCallId, mode, userId);
      toast.success(`${mode} mode activated for ${agent.name}`);
    } catch {
      toast.error(`Failed to activate ${mode} mode`);
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="flex gap-1">
      {modes.map(({ label, mode, style }) => (
        <button
          key={mode}
          type="button"
          onClick={() => handle(mode)}
          disabled={!!loading}
          className={cn(
            'px-2 py-0.5 text-[10px] border rounded transition-colors',
            style,
            loading === mode && 'opacity-50 cursor-not-allowed',
          )}
        >
          {loading === mode ? '…' : label}
        </button>
      ))}
    </div>
  );
}

export function WallboardTable({ agents: propAgents, filter = 'all', queueKey, live }: Props) {
  const { data: hookAgents = [], isLoading } = useAgents();
  const useHook = propAgents == null;
  const agents = propAgents ?? hookAgents;
  const visible =
    filter === 'all'
      ? agents
      : agents.filter(
          a => !queueKey || (a.queueKeys ?? []).includes(queueKey) || a.skills.includes(queueKey),
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
                    STATE_STYLES[a.state] ?? 'bg-gray-100 text-gray-600',
                  )}
                >
                  {a.state}
                </span>
              </td>
              <td className="px-3 py-2 text-muted-foreground font-mono text-xs">
                {a.currentCallId ? a.currentCallId.slice(-8) : '—'}
              </td>
              <td className="px-3 py-2 text-muted-foreground tabular-nums">—</td>
              <td className="px-3 py-2 text-muted-foreground">—</td>
              <td className="px-3 py-2">
                {a.state === 'busy' ? <SuperviseActions agent={a} /> : <span className="text-muted-foreground">—</span>}
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
