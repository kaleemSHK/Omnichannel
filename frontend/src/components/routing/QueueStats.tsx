'use client';

import { useQueues } from '@/lib/hooks/useAgentState';
import type { QueueStatEntry } from '@/lib/hooks/useRealtimeWallboard';
import { Skeleton } from '@/components/ui/skeleton';

interface Props {
  queues?: QueueStatEntry[];
  filter?: string;
  live?: boolean;
}

export function QueueStats({ queues: propQueues, filter = 'all', live }: Props) {
  const { data: hookQueues = [], isLoading } = useQueues();
  const useHook = propQueues == null;
  const queues = propQueues ?? hookQueues.map(q => ({
    id: q.id,
    name: q.name,
    waiting: q.stats?.waiting ?? 0,
    active: q.stats?.busy ?? 0,
    longestWait: q.stats?.avgWaitSec ?? 0,
  }));
  const visible = filter === 'all' ? queues : queues.filter(q => q.id === filter);

  if (useHook && isLoading && !live) {
    return (
      <div className="grid md:grid-cols-2 gap-3">
        <Skeleton className="h-28 rounded-lg" />
        <Skeleton className="h-28 rounded-lg" />
      </div>
    );
  }

  if (!visible.length) {
    return (
      <p className="text-sm text-muted-foreground">No queue data yet.</p>
    );
  }

  return (
    <div className="grid md:grid-cols-2 gap-3">
      {visible.map(q => (
        <div key={q.id} className="bn-card p-3">
          <p className="font-medium text-sm">{q.name}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Longest wait {q.longestWait}s
          </p>
          <div className="grid grid-cols-3 gap-2 mt-2 text-center text-xs">
            <div>
              <p className="text-lg font-medium text-amber-600">{q.waiting}</p>
              <p className="text-muted-foreground">Waiting</p>
            </div>
            <div>
              <p className="text-lg font-medium">{q.active}</p>
              <p className="text-muted-foreground">Active</p>
            </div>
            <div>
              <p className="text-lg font-medium text-green-700">
                {q.waiting + q.active > 0 ? '●' : '—'}
              </p>
              <p className="text-muted-foreground">Load</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
