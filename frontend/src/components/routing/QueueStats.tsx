'use client';

import { useQueues } from '@/lib/hooks/useAgentState';
import { Skeleton } from '@/components/ui/skeleton';

export function QueueStats() {
  const { data: queues = [], isLoading } = useQueues();

  if (isLoading) {
    return (
      <div className="grid md:grid-cols-2 gap-3">
        <Skeleton className="h-28 rounded-lg" />
        <Skeleton className="h-28 rounded-lg" />
      </div>
    );
  }

  return (
    <div className="grid md:grid-cols-2 gap-3">
      {queues.map(q => (
        <div key={q.id} className="bn-card p-3">
          <p className="font-medium text-sm">{q.name}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Avg wait {q.stats?.avgWaitSec ?? 0}s
          </p>
          <div className="grid grid-cols-4 gap-2 mt-2 text-center text-xs">
            <div>
              <p className="text-lg font-medium text-amber-600">{q.stats?.waiting ?? 0}</p>
              <p className="text-muted-foreground">Waiting</p>
            </div>
            <div>
              <p className="text-lg font-medium">{q.stats?.busy ?? 0}</p>
              <p className="text-muted-foreground">Active</p>
            </div>
            <div>
              <p className="text-lg font-medium text-green-700">{q.stats?.available ?? 0}</p>
              <p className="text-muted-foreground">Agents</p>
            </div>
            <div>
              <p className="text-lg font-medium">{q.stats?.busy ?? 0}</p>
              <p className="text-muted-foreground">In call</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
