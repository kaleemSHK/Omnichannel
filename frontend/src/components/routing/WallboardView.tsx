'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRealtimeWallboard, type QueueStatEntry } from '@/lib/hooks/useRealtimeWallboard';
import type { RoutingAgent } from '@/types';
import { useCsatReport, useSlaBreachReport } from '@/lib/hooks/useReports';
import { isDemoDataEnabled } from '@/lib/demo/config';
import { getDemoWallboard, DEMO_WALLBOARD_AGENTS, DEMO_WALLBOARD_QUEUES } from '@/lib/demo/wallboardFixture';
import { QueueStats } from '@/components/routing/QueueStats';
import { WallboardTable } from '@/components/routing/WallboardTable';
import { cn } from '@/lib/utils/cn';
import {
  Phone,
  Users,
  PhoneMissed,
  Clock,
  CheckCircle2,
  TrendingUp,
  ShieldAlert,
  Maximize2,
  Minimize2,
  RefreshCw,
  Moon,
  Sun,
  Circle,
} from 'lucide-react';

// ─── Helpers ───────────────────────────────────────────────────────────────────

function fmtTime(date: string) {
  return new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function fmtSec(s: number) {
  const m = Math.floor(s / 60);
  return m ? `${m}m ${s % 60}s` : `${s}s`;
}

// ─── KPI card ──────────────────────────────────────────────────────────────────

interface KPI {
  label: string;
  value: string | number;
  icon: React.ElementType;
  tone: string;
  subtext?: string;
  pulse?: boolean;
}

function KPICard({ kpi, dark }: { kpi: KPI; dark: boolean }) {
  const Icon = kpi.icon;
  return (
    <div className={cn(
      'rounded-xl border px-4 py-3 flex flex-col gap-1.5 min-w-0',
      dark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200',
    )}>
      <div className="flex items-center justify-between gap-2">
        <p className={cn('text-[10px] font-semibold uppercase tracking-wide truncate', dark ? 'text-gray-400' : 'text-muted-foreground')}>
          {kpi.label}
        </p>
        <Icon className={cn('w-3.5 h-3.5 shrink-0', kpi.tone)} />
      </div>
      <div className="flex items-end gap-1.5">
        <p className={cn('text-2xl font-bold tabular-nums leading-none', kpi.tone, kpi.pulse && 'animate-pulse')}>
          {kpi.value}
        </p>
      </div>
      {kpi.subtext && (
        <p className={cn('text-[10px]', dark ? 'text-gray-500' : 'text-muted-foreground')}>
          {kpi.subtext}
        </p>
      )}
    </div>
  );
}

// ─── Main wallboard ────────────────────────────────────────────────────────────

export function WallboardView() {
  const { data: liveData, connected, bootstrapped } = useRealtimeWallboard();
  const [queueFilter, setQueueFilter] = useState<string>('all');
  const [darkMode, setDarkMode] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [tick, setTick] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const allowDemo = isDemoDataEnabled();
  const isEmptyLive = bootstrapped && !liveData.agents.length && !liveData.queues.length;
  const useDemoWallboard = allowDemo && (!connected || isEmptyLive);
  const demo = useMemo(() => getDemoWallboard(), []);
  const data = useDemoWallboard ? demo : liveData;
  const agents = useDemoWallboard ? DEMO_WALLBOARD_AGENTS : data.agents;
  const queues = useDemoWallboard ? DEMO_WALLBOARD_QUEUES : data.queues;

  // Clock tick for "last updated"
  useEffect(() => {
    const id = setInterval(() => setTick(p => p + 1), 1000);
    return () => clearInterval(id);
  }, []);

  // Fullscreen
  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen();
      setFullscreen(true);
    } else {
      document.exitFullscreen();
      setFullscreen(false);
    }
  }, []);

  useEffect(() => {
    const handler = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  // Analytics
  const { data: csatData } = useCsatReport('today');
  const { data: slaData } = useSlaBreachReport('today');

  const todayCsat = useMemo(() => {
    if (!csatData.length) return null;
    return csatData[csatData.length - 1]?.score ?? null;
  }, [csatData]);

  const todaySlaBreachRate = useMemo(() => {
    if (!slaData.length) return null;
    return slaData[slaData.length - 1]?.breachRate ?? null;
  }, [slaData]);

  // Derived metrics
  const waiting      = queues.reduce((n: number, q: QueueStatEntry) => n + (q.waiting ?? 0), 0);
  const activeCalls  = agents.filter((a: RoutingAgent) => a.currentCallId).length;
  const online       = agents.filter((a: RoutingAgent) => a.state !== 'offline').length;
  const onBreak      = agents.filter((a: RoutingAgent) => a.state === 'break').length;
  const missRate     = data.totalToday > 0 ? Math.round((data.missedToday / data.totalToday) * 100) : 0;
  const avgWait      = queues.length
    ? Math.round(queues.reduce((s: number, q: QueueStatEntry) => s + (q.longestWait ?? 0), 0) / queues.length)
    : 0;

  const kpis: KPI[] = [
    {
      label: 'Active calls',
      value: activeCalls,
      icon: Phone,
      tone: activeCalls > 0 ? 'text-blue-500' : 'text-gray-400',
      pulse: activeCalls > 0,
    },
    {
      label: 'Waiting',
      value: waiting,
      icon: Users,
      tone: waiting > 10 ? 'text-red-500' : waiting > 5 ? 'text-amber-500' : 'text-gray-700',
      subtext: waiting > 5 ? 'High queue depth' : undefined,
    },
    {
      label: 'Agents online',
      value: `${online}/${agents.length}`,
      icon: CheckCircle2,
      tone: 'text-green-600',
      subtext: onBreak ? `${onBreak} on break` : undefined,
    },
    {
      label: 'Handled today',
      value: data.handledToday,
      icon: TrendingUp,
      tone: 'text-gray-700',
    },
    {
      label: 'Missed today',
      value: `${data.missedToday} (${missRate}%)`,
      icon: PhoneMissed,
      tone: missRate > 10 ? 'text-red-500' : missRate > 5 ? 'text-amber-500' : 'text-gray-700',
    },
    {
      label: 'Avg wait',
      value: fmtSec(avgWait),
      icon: Clock,
      tone: avgWait > 120 ? 'text-red-500' : avgWait > 60 ? 'text-amber-500' : 'text-gray-700',
    },
    {
      label: 'CSAT today',
      value: todayCsat != null ? `${todayCsat}%` : '—',
      icon: TrendingUp,
      tone: todayCsat == null ? 'text-gray-400' : todayCsat >= 85 ? 'text-green-600' : todayCsat >= 70 ? 'text-amber-500' : 'text-red-500',
    },
    {
      label: 'SLA breach',
      value: todaySlaBreachRate != null ? `${todaySlaBreachRate.toFixed(1)}%` : '—',
      icon: ShieldAlert,
      tone: todaySlaBreachRate == null ? 'text-gray-400' : todaySlaBreachRate > 8 ? 'text-red-500' : todaySlaBreachRate > 4 ? 'text-amber-500' : 'text-green-600',
    },
  ];

  return (
    <div
      ref={containerRef}
      className={cn(
        'flex flex-col min-h-full transition-colors',
        darkMode ? 'bg-gray-900' : 'bg-gray-50',
        fullscreen && 'fixed inset-0 z-50 overflow-y-auto',
      )}
    >
      {/* ── Toolbar ── */}
      <div className={cn(
        'shrink-0 flex flex-wrap items-center gap-3 px-4 py-2.5 border-b',
        darkMode ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-200',
      )}>
        <div className="flex items-center gap-2">
          <span className={cn(
            'relative flex h-2.5 w-2.5',
          )}>
            <span className={cn(
              'absolute inline-flex h-full w-full rounded-full opacity-70',
              connected ? 'animate-ping bg-green-500' : 'bg-amber-400',
            )} />
            <span className={cn(
              'relative inline-flex h-2.5 w-2.5 rounded-full',
              connected ? 'bg-green-500' : 'bg-amber-400',
            )} />
          </span>
          <span className={cn('text-sm font-bold', darkMode ? 'text-white' : 'text-gray-900')}>
            Live Wallboard
          </span>
          <span className={cn('text-[11px]', darkMode ? 'text-gray-400' : 'text-muted-foreground')}>
            {connected ? 'Connected' : 'Reconnecting…'}
            {useDemoWallboard && <span className="ml-1 text-amber-500">(demo data)</span>}
          </span>
        </div>

        <div className={cn('text-[11px] hidden md:flex items-center gap-1', darkMode ? 'text-gray-400' : 'text-muted-foreground')}>
          <RefreshCw className="w-3 h-3" />
          Updated {fmtTime(data.updatedAt)}
        </div>

        <div className="ms-auto flex items-center gap-2">
          {/* Queue filter */}
          <select
            value={queueFilter}
            onChange={e => setQueueFilter(e.target.value)}
            className={cn(
              'text-xs border rounded-md px-2 py-1 focus:outline-none focus:ring-1 focus:ring-brand-primary',
              darkMode ? 'bg-gray-800 border-gray-600 text-white' : 'bg-white border-gray-200 text-gray-700',
            )}
          >
            <option value="all">All queues</option>
            {queues.map(q => (
              <option key={q.id} value={q.id}>{q.name}</option>
            ))}
          </select>

          {/* Dark mode */}
          <button
            type="button"
            onClick={() => setDarkMode(p => !p)}
            title={darkMode ? 'Light mode' : 'Dark mode (TV)'}
            className={cn(
              'p-1.5 rounded-lg border transition-colors',
              darkMode ? 'border-gray-600 text-gray-300 hover:bg-gray-700' : 'border-gray-200 text-gray-500 hover:bg-gray-50',
            )}
          >
            {darkMode ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
          </button>

          {/* Fullscreen */}
          <button
            type="button"
            onClick={toggleFullscreen}
            title={fullscreen ? 'Exit fullscreen' : 'Fullscreen (TV mode)'}
            className={cn(
              'p-1.5 rounded-lg border transition-colors',
              darkMode ? 'border-gray-600 text-gray-300 hover:bg-gray-700' : 'border-gray-200 text-gray-500 hover:bg-gray-50',
            )}
          >
            {fullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* ── Content ── */}
      <div className="flex-1 p-4 space-y-4 overflow-y-auto">
        {/* KPI strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-8 gap-3">
          {kpis.map(k => <KPICard key={k.label} kpi={k} dark={darkMode} />)}
        </div>

        {/* Queue section */}
        <div>
          <p className={cn('text-xs font-semibold uppercase tracking-wide mb-2', darkMode ? 'text-gray-400' : 'text-muted-foreground')}>
            Queues
          </p>
          <QueueStats
            queues={queues}
            filter={queueFilter}
            live={connected}
            darkMode={darkMode}
          />
        </div>

        {/* Agent section */}
        <WallboardTable
          agents={agents}
          filter={queueFilter}
          queueKey={queues.find(q => q.id === queueFilter)?.queueKey}
          live={connected}
          darkMode={darkMode}
        />
      </div>
    </div>
  );
}
