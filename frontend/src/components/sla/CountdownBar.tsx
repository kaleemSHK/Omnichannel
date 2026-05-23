'use client';

import { cn } from '@/lib/utils/cn';

interface Props {
  elapsedSeconds: number;
  totalSeconds: number;
}

export function CountdownBar({ elapsedSeconds, totalSeconds }: Props) {
  const pct = totalSeconds > 0 ? Math.min(100, (elapsedSeconds / totalSeconds) * 100) : 0;
  const color =
    pct > 85 ? 'bg-red-500' : pct > 50 ? 'bg-amber-500' : 'bg-green-500';

  return (
    <div className="h-1.5 w-full max-w-[100px] rounded-full bg-gray-200 overflow-hidden">
      <div className={cn('h-full rounded-full transition-all duration-500', color)} style={{ width: `${pct}%` }} />
    </div>
  );
}
