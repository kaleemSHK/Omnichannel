'use client';

import { Signal } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

export function ConnectionQuality({
  registered,
  error,
}: {
  registered: boolean;
  error: string | null;
}) {
  const level = registered ? 4 : error ? 1 : 2;
  const label = registered ? 'Excellent' : error ? 'Offline' : 'Connecting';

  return (
    <div className="flex items-center gap-2 text-xs text-slate-400">
      <Signal size={14} className={registered ? 'text-emerald-400' : 'text-amber-400'} />
      <span className="font-medium text-slate-300">{label}</span>
      <div className="flex gap-0.5 items-end h-3">
        {[1, 2, 3, 4].map(n => (
          <span
            key={n}
            className={cn(
              'w-1 rounded-sm bg-slate-600',
              n <= level && (registered ? 'bg-emerald-400' : 'bg-amber-400'),
            )}
            style={{ height: `${n * 3}px` }}
          />
        ))}
      </div>
    </div>
  );
}
