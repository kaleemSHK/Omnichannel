'use client';

import { useState } from 'react';
import { useRealtimeWallboard } from '@/lib/hooks/useRealtimeWallboard';
import { QueueStats } from '@/components/routing/QueueStats';
import { WallboardTable } from '@/components/routing/WallboardTable';
import { cn } from '@/lib/utils/cn';

export function WallboardView() {
  const { data, connected } = useRealtimeWallboard();
  const [queueFilter, setQueueFilter] = useState<string>('all');

  const agents = data.agents;
  const queues = data.queues;
  const waiting = queues.reduce((n, q) => n + (q.waiting ?? 0), 0);
  const online = agents.filter(a => a.state !== 'offline').length;
  const activeCalls = agents.filter(a => a.currentCallId).length;
  const missRate =
    data.totalToday > 0 ? Math.round((data.missedToday / data.totalToday) * 100) : 0;

  return (
    <div className="p-4 space-y-4 bg-surface-tertiary min-h-full">
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

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: 'Active calls', value: activeCalls, tone: 'text-blue-600' },
          {
            label: 'Waiting',
            value: waiting,
            tone: waiting > 5 ? 'text-amber-600' : 'text-gray-900',
          },
          { label: 'Agents online', value: `${online}/${agents.length}`, tone: 'text-green-700' },
          { label: 'Handled today', value: data.handledToday, tone: 'text-gray-900' },
          {
            label: 'Missed today',
            value: data.missedToday,
            tone: missRate > 10 ? 'text-red-600' : 'text-gray-900',
          },
        ].map(k => (
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
