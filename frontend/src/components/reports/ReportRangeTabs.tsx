'use client';

import { cn } from '@/lib/utils/cn';
import type { ReportRange } from '@/lib/hooks/useReports';

const RANGES: { value: ReportRange; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
];

export function ReportRangeTabs({
  range,
  onChange,
}: {
  range: ReportRange;
  onChange: (r: ReportRange) => void;
}) {
  return (
    <div
      className="flex gap-1 border rounded-lg p-0.5"
      role="radiogroup"
      aria-label="Report date range"
    >
      {RANGES.map(({ value, label }) => (
        <button
          key={value}
          type="button"
          role="radio"
          aria-checked={range === value}
          onClick={() => onChange(value)}
          className={cn(
            'px-3 py-1 text-xs rounded-md transition-colors',
            range === value ? 'bg-brand-primary text-white' : 'text-muted-foreground hover:bg-muted',
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
