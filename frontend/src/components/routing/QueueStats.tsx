'use client';

import { useEffect, useState } from 'react';
import { useQueues } from '@/lib/hooks/useAgentState';
import type { QueueStatEntry } from '@/lib/hooks/useRealtimeWallboard';
import type { ExtendedQueue } from '@/lib/demo/wallboardFixture';
import { Skeleton } from '@/components/ui/skeleton';
import { Clock, Phone, Users, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

// ─── Wait-time formatter ───────────────────────────────────────────────────────

function fmtWait(secs: number): string {
  if (secs <= 0) return '—';
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return m ? `${m}m ${s}s` : `${s}s`;
}

// ─── Live wait counter ─────────────────────────────────────────────────────────

function LiveWait({ seconds }: { seconds: number }) {
  const [s, setS] = useState(seconds);
  useEffect(() => {
    if (seconds <= 0) { setS(0); return; }
    setS(seconds);
    const id = setInterval(() => setS(p => p + 1), 1000);
    return () => clearInterval(id);
  }, [seconds]);
  return <span>{fmtWait(s)}</span>;
}

// ─── Sparkline ─────────────────────────────────────────────────────────────────

function Sparkline({ values, color }: { values: number[]; color: string }) {
  if (!values.length) return null;
  const max = Math.max(...values, 1);
  const w = 60;
  const h = 24;
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * w;
    const y = h - (v / max) * h;
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg width={w} height={h} className="shrink-0 opacity-70">
      <polyline points={pts} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" />
    </svg>
  );
}

// ─── SLA bar ───────────────────────────────────────────────────────────────────

function SLABar({ pct }: { pct: number }) {
  const color = pct >= 90 ? 'bg-green-500' : pct >= 80 ? 'bg-amber-400' : 'bg-red-500';
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className={cn('h-full rounded-full transition-all', color)} style={{ width: `${Math.min(100, pct)}%` }} />
      </div>
      <span className={cn(
        'text-[11px] font-semibold w-9 text-right',
        pct >= 90 ? 'text-green-600' : pct >= 80 ? 'text-amber-600' : 'text-red-600',
      )}>
        {pct.toFixed(0)}%
      </span>
    </div>
  );
}

// ─── Queue card ────────────────────────────────────────────────────────────────

interface QueueCardProps {
  queue: QueueStatEntry;
  darkMode?: boolean;
}

function QueueCard({ queue, darkMode }: QueueCardProps) {
  const ext = queue as Partial<ExtendedQueue>;
  const utilPct = ext.maxDepth ? Math.round((queue.waiting / ext.maxDepth) * 100) : 0;
  const isOverloaded = queue.waiting > (ext.maxDepth ? ext.maxDepth * 0.7 : 20);
  const slaOk = (ext.slaPercent ?? 100) >= 80;

  return (
    <div className={cn(
      'rounded-xl border p-4 flex flex-col gap-3 transition-shadow hover:shadow-md',
      darkMode
        ? 'bg-gray-800 border-gray-700'
        : 'bg-white border-gray-200',
      isOverloaded && 'ring-2 ring-amber-400/50',
    )}>
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className={cn(
            'w-2 h-2 rounded-full shrink-0',
            queue.active > 0 ? 'bg-green-500 animate-pulse' : 'bg-gray-300',
          )} />
          <p className={cn('text-sm font-semibold truncate', darkMode ? 'text-white' : 'text-gray-900')}>
            {queue.name}
          </p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {isOverloaded && <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />}
          {ext.waitTrend && (
            <Sparkline values={ext.waitTrend} color={isOverloaded ? '#f59e0b' : '#0B5FFF'} />
          )}
        </div>
      </div>

      {/* Main metrics */}
      <div className="grid grid-cols-3 gap-2">
        <div className="text-center">
          <p className={cn(
            'text-2xl font-bold tabular-nums',
            queue.waiting > 5 ? 'text-amber-500' : queue.waiting > 10 ? 'text-red-500' : darkMode ? 'text-white' : 'text-gray-900',
          )}>
            {queue.waiting}
          </p>
          <p className={cn('text-[10px] font-medium uppercase tracking-wide', darkMode ? 'text-gray-400' : 'text-muted-foreground')}>
            Waiting
          </p>
        </div>
        <div className="text-center">
          <p className={cn('text-2xl font-bold tabular-nums', darkMode ? 'text-white' : 'text-gray-900')}>
            {queue.active}
          </p>
          <p className={cn('text-[10px] font-medium uppercase tracking-wide', darkMode ? 'text-gray-400' : 'text-muted-foreground')}>
            Active
          </p>
        </div>
        <div className="text-center">
          <p className={cn(
            'text-2xl font-bold tabular-nums',
            queue.longestWait > 120 ? 'text-red-500' : queue.longestWait > 60 ? 'text-amber-500' : darkMode ? 'text-white' : 'text-gray-900',
          )}>
            <LiveWait seconds={queue.longestWait} />
          </p>
          <p className={cn('text-[10px] font-medium uppercase tracking-wide', darkMode ? 'text-gray-400' : 'text-muted-foreground')}>
            Longest
          </p>
        </div>
      </div>

      {/* SLA bar */}
      {ext.slaPercent !== undefined && (
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className={cn('text-[10px] font-semibold uppercase tracking-wide', darkMode ? 'text-gray-400' : 'text-muted-foreground')}>
              SLA
            </span>
          </div>
          <SLABar pct={ext.slaPercent} />
        </div>
      )}

      {/* Utilization bar */}
      {ext.maxDepth !== undefined && (
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className={cn('text-[10px] font-semibold uppercase tracking-wide', darkMode ? 'text-gray-400' : 'text-muted-foreground')}>
              Queue depth
            </span>
            <span className={cn('text-[10px]', darkMode ? 'text-gray-400' : 'text-muted-foreground')}>
              {queue.waiting}/{ext.maxDepth}
            </span>
          </div>
          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={cn(
                'h-full rounded-full transition-all',
                utilPct > 70 ? 'bg-red-400' : utilPct > 40 ? 'bg-amber-400' : 'bg-green-400',
              )}
              style={{ width: `${Math.min(100, utilPct)}%` }}
            />
          </div>
        </div>
      )}

      {/* Footer stats */}
      <div className={cn('flex items-center gap-3 text-[10px] pt-1 border-t', darkMode ? 'border-gray-700 text-gray-400' : 'border-gray-100 text-muted-foreground')}>
        {ext.answeredToday !== undefined && (
          <span className="flex items-center gap-1">
            <Phone className="w-3 h-3" /> {ext.answeredToday} today
          </span>
        )}
        {ext.avgHandleTimeSec !== undefined && (
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" /> AHT {Math.round(ext.avgHandleTimeSec / 60)}m
          </span>
        )}
        {ext.algorithm && (
          <span className="ms-auto font-mono capitalize">{ext.algorithm.replace('_', ' ')}</span>
        )}
      </div>
    </div>
  );
}

// ─── Main export ───────────────────────────────────────────────────────────────

interface Props {
  queues?: QueueStatEntry[];
  filter?: string;
  live?: boolean;
  darkMode?: boolean;
}

export function QueueStats({ queues: propQueues, filter = 'all', live, darkMode }: Props) {
  const { data: hookQueues = [], isLoading } = useQueues();
  const useHook = propQueues == null;

  const queues: QueueStatEntry[] = propQueues ?? hookQueues.map(q => ({
    id: q.id,
    queueKey: q.queueKey,
    name: q.name,
    waiting: q.stats?.waiting ?? 0,
    active: q.stats?.busy ?? 0,
    longestWait: q.stats?.avgWaitSec ?? 0,
  }));

  const visible = filter === 'all' ? queues : queues.filter(q => q.id === filter);

  if (useHook && isLoading && !live) {
    return (
      <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-3">
        {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-52 rounded-xl" />)}
      </div>
    );
  }

  if (!visible.length) {
    return (
      <div className={cn('rounded-xl border p-8 text-center', darkMode ? 'border-gray-700 bg-gray-800 text-gray-400' : 'border-gray-200 text-muted-foreground')}>
        <Users className="w-8 h-8 mx-auto mb-2 opacity-40" />
        <p className="text-sm">No queues to display</p>
      </div>
    );
  }

  return (
    <div className={cn('grid gap-3', visible.length === 1 ? 'grid-cols-1 max-w-xs' : visible.length === 2 ? 'md:grid-cols-2' : 'md:grid-cols-2 xl:grid-cols-4')}>
      {visible.map(q => <QueueCard key={q.id} queue={q} darkMode={darkMode} />)}
    </div>
  );
}
