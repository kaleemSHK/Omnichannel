'use client';

import { useMemo, useState } from 'react';
import { useRealtimeWallboard } from '@/lib/hooks/useRealtimeWallboard';
import { useCsatReport, useSlaBreachReport } from '@/lib/hooks/useReports';
import { QueueStats } from '@/components/routing/QueueStats';
import { WallboardTable } from '@/components/routing/WallboardTable';
import { cn } from '@/lib/utils/cn';

export function WallboardView() {
  const { data, connected } = useRealtimeWallboard();
  const [queueFilter, setQueueFilter] = useState<string>('all');

  // Analytics KPI cards — today's CSAT + SLA breach
  const { data: csatData } = useCsatReport('today');
  const { data: slaData } = useSlaBreachReport('today');

  const agents = data.agents;
  const queues = data.queues;
  const waiting = queues.reduce((n, q) => n + (q.waiting ?? 0), 0);
  const online = agents.filter(a => a.state !== 'offline').length;
  const activeCalls = agents.filter(a => a.currentCallId).length;
  const missRate =
    data.totalToday > 0 ? Math.round((data.missedToday / data.totalToday) * 100) : 0;

  // Derived analytics values
  const todayCsat = useMemo(() => {
    if (!csatData.length) return null;
    const last = csatData[csatData.length - 1];
    return last?.score ?? null;
  }, [csatData]);

  const todaySlaBreachRate = useMemo(() => {
    if (!slaData.length) return null;
    const last = slaData[slaData.length - 1];
    return last?.breachRate ?? null;
  }, [slaData]);

  const kpiCards = [
    { label: 'Active calls',   value: activeCalls,                    tone: 'text-blue-600' },
    { label: 'Waiting',        value: waiting,                        tone: waiting > 5 ? 'text-amber-600' : 'text-gray-900' },
    { label: 'Agents online',  value: `${online}/${agents.length}`,   tone: 'text-green-700' },
    { label: 'Handled today',  value: data.handledToday,              tone: 'text-gray-900' },
    { label: 'Missed today',   value: data.missedToday,               tone: missRate > 10 ? 'text-red-600' : 'text-gray-900' },
    {
      label: 'CSAT today',
      value: todayCsat != null ? `${todayCsat}%` : '—',
      tone: todayCsat == null ? 'text-gray-400'
           : todayCsat >= 85 ? 'text-green-600'
           : todayCsat >= 70 ? 'text-amber-600'
           : 'text-red-600',
    },
    {
      label: 'SLA breach',
      value: todaySlaBreachRate != null ? `${todaySlaBreachRate.toFixed(1)}%` : '—',
      tone: todaySlaBreachRate == null ? 'text-gray-400'
           : todaySlaBreachRate > 8 ? 'text-red-600'
           : todaySlaBreachRate > 4 ? 'text-amber-600'
           : 'text-green-600',
    },
  ];

  return (
    <div className="p-4 space-y-4 bg-surface-tertiary min-h-full">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-lg font-semibold">Realtime wallboard</h1>
        <span
          className={cn(
            'size-2 rounded-full',
            connected ? 'bg-green-500 animate-pulse' : 'bg-amber-400',
          )}
        />
        <span className="text-xs text-muted-foreground">
          {connected ? 'Live' : 'Reconnecting…'}
        </span>
        <select
          value={queueFilter}
          onChange={e => setQueueFilter(e.target.value)}
          className="ms-auto text-xs border border-gray-200 rounded-md px-2 py-1 bg-white"
        >
          <option value="all">All queues</option>
          {queues.map(q => (
            <option key={q.id} value={q.id}>
              {q.name}
            </option>
          ))}
        </select>
      </div>

      {/* KPI strip — 7 cards, wraps gracefully */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        {kpiCards.map(k => (
          <div key={k.label} className="kpi-card">
            <p className="kpi-label">{k.label}</p>
            <p className={cn('kpi-value', k.tone)}>{k.value}</p>
          </div>
        ))}
      </div>

      <QueueStats queues={queues} filter={queueFilter} live={connected} />
      <WallboardTable
        agents={agents}
        filter={queueFilter}
        queueKey={queues.find(q => q.id === queueFilter)?.queueKey}
        live={connected}
      />
    </div>
  );
}
