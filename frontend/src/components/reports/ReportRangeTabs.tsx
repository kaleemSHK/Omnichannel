'use client';

import { cn } from '@/lib/utils/cn';
import type { ReportRange } from '@/lib/hooks/useReports';

export function ReportRangeTabs({
  range,
  onChange,
}: {
  range: ReportRange;
  onChange: (r: ReportRange) => void;
}) {
  return (
    <div className="flex gap-1 border rounded-lg p-0.5">
      {(['today', '7d', '30d'] as const).map(r => (
        <button
          key={r}
          type="button"
          onClick={() => onChange(r)}
          className={cn(
            'px-3 py-1 text-xs rounded-md transition-colors',
            range === r ? 'bg-brand-primary text-white' : 'text-muted-foreground hover:bg-muted',
          )}
        >
          {r === 'today' ? 'Today' : r === '7d' ? 'Last 7 days' : 'Last 30 days'}
        </button>
      ))}
    </div>
  );
}
