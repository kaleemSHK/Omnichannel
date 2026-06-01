'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useAgents } from '@/lib/hooks/useAgentState';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils/cn';
import { superviseCall, type SuperviseMode } from '@/lib/api/routing';
import { useAuthStore } from '@/lib/store/auth';
import type { AgentState, RoutingAgent } from '@/types';
import type { ExtendedAgent } from '@/lib/demo/wallboardFixture';
import { Headphones, MessageSquare, Activity, LayoutGrid, Table2 } from 'lucide-react';

// ─── State metadata ────────────────────────────────────────────────────────────

const STATE_META: Record<AgentState, { label: string; dot: string; badge: string }> = {
  available: { label: 'Available', dot: 'bg-green-500',  badge: 'bg-green-100 text-green-700' },
  busy:      { label: 'On call',   dot: 'bg-blue-500 animate-pulse', badge: 'bg-blue-100 text-blue-700' },
  break:     { label: 'Break',     dot: 'bg-pink-400',   badge: 'bg-pink-100 text-pink-700' },
  offline:   { label: 'Offline',   dot: 'bg-gray-300',   badge: 'bg-gray-100 text-gray-500' },
  acw:       { label: 'Wrap-up',   dot: 'bg-purple-500', badge: 'bg-purple-100 text-purple-700' },
};

const STATE_ORDER: AgentState[] = ['busy', 'available', 'acw', 'break', 'offline'];

// ─── Duration counter ──────────────────────────────────────────────────────────

function Duration({ since, className }: { since: string; className?: string }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const start = new Date(since).getTime();
    const tick = () => setElapsed(Math.floor((Date.now() - start) / 1000));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [since]);

  const m = Math.floor(elapsed / 60);
  const s = elapsed % 60;
  const text = m > 0 ? `${m}m ${s.toString().padStart(2, '0')}s` : `${s}s`;
  return <span className={cn('tabular-nums font-mono text-[11px]', className)}>{text}</span>;
}

// ─── Supervise actions ─────────────────────────────────────────────────────────

function SuperviseActions({ agent, compact }: { agent: RoutingAgent; compact?: boolean }) {
  const [loading, setLoading] = useState<SuperviseMode | null>(null);
  const userId = useAuthStore(s => s.user?.id?.toString() ?? 'supervisor');

  if (!agent.currentCallId) return <span className="text-muted-foreground text-xs">—</span>;

  const modes: { label: string; short: string; mode: SuperviseMode; cls: string }[] = [
    { label: 'Listen',  short: 'L', mode: 'listen',  cls: 'border-blue-200 text-blue-700 hover:bg-blue-50' },
    { label: 'Whisper', short: 'W', mode: 'whisper', cls: 'border-amber-200 text-amber-700 hover:bg-amber-50' },
    { label: 'Barge',   short: 'B', mode: 'barge',   cls: 'border-red-200 text-red-700 hover:bg-red-50' },
  ];

  async function handle(mode: SuperviseMode) {
    if (loading) return;
    setLoading(mode);
    try {
      await superviseCall(agent.currentCallId!, mode, userId);
      toast.success(`${mode.charAt(0).toUpperCase() + mode.slice(1)} — ${agent.name}`);
    } catch {
      toast.error(`Failed to activate ${mode}`);
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="flex gap-1">
      {modes.map(({ label, short, mode, cls }) => (
        <button
          key={mode}
          type="button"
          onClick={() => handle(mode)}
          disabled={!!loading}
          title={label}
          className={cn(
            'border rounded transition-colors disabled:opacity-40',
            compact ? 'px-1.5 py-0.5 text-[9px] font-bold' : 'px-2 py-0.5 text-[10px]',
            cls,
          )}
        >
          {loading === mode ? '…' : compact ? short : label}
        </button>
      ))}
    </div>
  );
}

// ─── Avatar ────────────────────────────────────────────────────────────────────

const AVATAR_COLORS: Record<AgentState, string> = {
  available: 'bg-green-100 text-green-700',
  busy:      'bg-blue-100 text-blue-700',
  break:     'bg-pink-100 text-pink-700',
  offline:   'bg-gray-100 text-gray-400',
  acw:       'bg-purple-100 text-purple-700',
};

function Avatar({ name, state, size = 'md' }: { name: string; state: AgentState; size?: 'sm' | 'md' }) {
  const initials = name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
  return (
    <div className={cn(
      'rounded-full flex items-center justify-center font-semibold shrink-0',
      size === 'sm' ? 'w-7 h-7 text-[10px]' : 'w-10 h-10 text-xs',
      AVATAR_COLORS[state],
    )}>
      {initials}
    </div>
  );
}

// ─── Agent card (grid mode) ────────────────────────────────────────────────────

function AgentCard({ agent, darkMode }: { agent: RoutingAgent; darkMode?: boolean }) {
  const ext = agent as Partial<ExtendedAgent>;
  const meta = STATE_META[agent.state] ?? STATE_META.offline;

  return (
    <div className={cn(
      'rounded-xl border p-3.5 flex flex-col gap-2.5 transition-shadow',
      darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200',
      agent.state === 'busy' && 'ring-1 ring-blue-200',
      agent.state === 'offline' && 'opacity-60',
    )}>
      {/* Header */}
      <div className="flex items-center gap-2.5">
        <div className="relative">
          <Avatar name={agent.name} state={agent.state} />
          <span className={cn('absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2', darkMode ? 'border-gray-800' : 'border-white', meta.dot)} />
        </div>
        <div className="flex-1 min-w-0">
          <p className={cn('text-sm font-semibold truncate', darkMode ? 'text-white' : 'text-gray-900')}>
            {agent.name}
          </p>
          {ext.extension && (
            <p className={cn('text-[10px] font-mono', darkMode ? 'text-gray-400' : 'text-muted-foreground')}>
              Ext. {ext.extension}
            </p>
          )}
        </div>
        <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0', meta.badge)}>
          {meta.label}
        </span>
      </div>

      {/* State duration */}
      <div className={cn('flex items-center gap-1 text-[11px]', darkMode ? 'text-gray-400' : 'text-muted-foreground')}>
        <Activity className="w-3 h-3 shrink-0" />
        <span>In state:</span>
        <Duration since={agent.lastStateChange} className={darkMode ? 'text-gray-300' : 'text-gray-700'} />
      </div>

      {/* Active call info */}
      {agent.state === 'busy' && agent.currentCallId && (
        <div className={cn('rounded-lg px-2.5 py-2 flex items-center gap-2', darkMode ? 'bg-gray-700' : 'bg-blue-50')}>
          <Headphones className="w-3.5 h-3.5 text-blue-600 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className={cn('text-[11px] font-mono truncate', darkMode ? 'text-gray-300' : 'text-gray-700')}>
              {agent.currentCallId.slice(-10)}
            </p>
            <Duration since={agent.lastStateChange} className="text-blue-600" />
          </div>
        </div>
      )}

      {/* Skills */}
      {agent.skills.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {agent.skills.slice(0, 3).map(s => (
            <span key={s} className={cn(
              'text-[9px] px-1.5 py-0.5 rounded font-mono',
              darkMode ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-600',
            )}>
              {s}
            </span>
          ))}
          {agent.skills.length > 3 && (
            <span className={cn('text-[9px] px-1.5 py-0.5 rounded', darkMode ? 'bg-gray-700 text-gray-400' : 'bg-gray-100 text-gray-400')}>
              +{agent.skills.length - 3}
            </span>
          )}
        </div>
      )}

      {/* Stats */}
      {(ext.handledToday !== undefined) && (
        <div className={cn('flex gap-3 text-[10px] pt-2 border-t', darkMode ? 'border-gray-700 text-gray-400' : 'border-gray-100 text-muted-foreground')}>
          <span>{ext.handledToday} handled</span>
          {ext.missedToday ? <span className="text-red-500">{ext.missedToday} missed</span> : null}
          {ext.avgHandleTimeSec && (
            <span className="ms-auto">AHT {Math.round(ext.avgHandleTimeSec / 60)}m</span>
          )}
        </div>
      )}

      {/* Supervise */}
      {agent.state === 'busy' && (
        <SuperviseActions agent={agent} compact />
      )}
    </div>
  );
}

// ─── Table row ─────────────────────────────────────────────────────────────────

function AgentRow({ agent, darkMode }: { agent: RoutingAgent; darkMode?: boolean }) {
  const ext = agent as Partial<ExtendedAgent>;
  const meta = STATE_META[agent.state] ?? STATE_META.offline;

  return (
    <tr className={cn(
      'border-b transition-colors',
      darkMode ? 'border-gray-700 hover:bg-gray-750' : 'border-gray-100 hover:bg-gray-50',
      agent.state === 'offline' && 'opacity-50',
    )}>
      <td className="px-3 py-2.5">
        <div className="flex items-center gap-2.5">
          <Avatar name={agent.name} state={agent.state} size="sm" />
          <div>
            <p className={cn('text-sm font-medium', darkMode ? 'text-white' : 'text-gray-900')}>{agent.name}</p>
            {ext.extension && (
              <p className={cn('text-[10px] font-mono', darkMode ? 'text-gray-400' : 'text-muted-foreground')}>Ext. {ext.extension}</p>
            )}
          </div>
        </div>
      </td>
      <td className="px-3 py-2.5">
        <div className="flex items-center gap-1.5">
          <span className={cn('w-2 h-2 rounded-full shrink-0', meta.dot)} />
          <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', meta.badge)}>{meta.label}</span>
        </div>
      </td>
      <td className="px-3 py-2.5">
        <Duration since={agent.lastStateChange} className={darkMode ? 'text-gray-300' : 'text-gray-600'} />
      </td>
      <td className="px-3 py-2.5">
        {agent.state === 'busy' && agent.currentCallId ? (
          <Duration since={agent.lastStateChange} className="text-blue-600" />
        ) : (
          <span className={cn('text-xs', darkMode ? 'text-gray-500' : 'text-muted-foreground')}>—</span>
        )}
      </td>
      <td className="px-3 py-2.5">
        <div className="flex flex-wrap gap-1">
          {agent.skills.slice(0, 3).map(s => (
            <span key={s} className={cn('text-[9px] px-1.5 py-0.5 rounded font-mono', darkMode ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-600')}>
              {s}
            </span>
          ))}
        </div>
      </td>
      <td className="px-3 py-2.5 tabular-nums text-sm">
        {ext.handledToday ?? '—'}
      </td>
      <td className="px-3 py-2.5">
        <SuperviseActions agent={agent} />
      </td>
    </tr>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

interface Props {
  agents?: RoutingAgent[];
  filter?: string;
  queueKey?: string;
  live?: boolean;
  darkMode?: boolean;
}

export function WallboardTable({ agents: propAgents, filter = 'all', queueKey, live, darkMode }: Props) {
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const { data: hookAgents = [], isLoading } = useAgents();

  const agents = propAgents ?? hookAgents;
  const filtered = filter === 'all'
    ? agents
    : agents.filter(a => !queueKey || (a.queueKeys ?? []).includes(queueKey) || a.skills.includes(queueKey));

  const sorted = [...filtered].sort((a, b) => {
    const ai = STATE_ORDER.indexOf(a.state);
    const bi = STATE_ORDER.indexOf(b.state);
    return ai - bi;
  });

  if (!propAgents && isLoading && !live) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
        {[1, 2, 3, 4, 5, 6].map(i => <Skeleton key={i} className="h-44 rounded-xl" />)}
      </div>
    );
  }

  const headerCls = cn('text-left px-3 py-2 text-[10px] font-semibold uppercase tracking-wide', darkMode ? 'text-gray-400' : 'text-muted-foreground');

  return (
    <div className="space-y-3">
      {/* Sub-toolbar */}
      <div className="flex items-center gap-2">
        <p className={cn('text-xs font-semibold', darkMode ? 'text-gray-300' : 'text-gray-700')}>
          Agents <span className={cn('font-normal', darkMode ? 'text-gray-400' : 'text-muted-foreground')}>({sorted.length})</span>
        </p>
        <div className="ms-auto flex gap-1 p-0.5 rounded-lg bg-gray-100">
          <button
            type="button"
            onClick={() => setViewMode('grid')}
            className={cn('p-1 rounded-md transition-colors', viewMode === 'grid' ? 'bg-white shadow-sm text-gray-700' : 'text-gray-400 hover:text-gray-600')}
            title="Grid view"
          >
            <LayoutGrid className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setViewMode('table')}
            className={cn('p-1 rounded-md transition-colors', viewMode === 'table' ? 'bg-white shadow-sm text-gray-700' : 'text-gray-400 hover:text-gray-600')}
            title="Table view"
          >
            <Table2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {sorted.length === 0 ? (
        <div className={cn('rounded-xl border p-8 text-center text-sm', darkMode ? 'border-gray-700 bg-gray-800 text-gray-400' : 'border-gray-200 text-muted-foreground')}>
          No agents to display
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
          {sorted.map(a => <AgentCard key={a.id} agent={a} darkMode={darkMode} />)}
        </div>
      ) : (
        <div className={cn('rounded-xl border overflow-hidden', darkMode ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-white')}>
          <table className="w-full text-sm">
            <thead className={cn('border-b', darkMode ? 'bg-gray-750 border-gray-700' : 'bg-gray-50 border-gray-200')}>
              <tr>
                <th className={headerCls}>Agent</th>
                <th className={headerCls}>State</th>
                <th className={headerCls}>In state</th>
                <th className={headerCls}>Call duration</th>
                <th className={headerCls}>Skills</th>
                <th className={headerCls}>Handled</th>
                <th className={headerCls}>Supervise</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map(a => <AgentRow key={a.id} agent={a} darkMode={darkMode} />)}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
