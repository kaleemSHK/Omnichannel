'use client';

import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

interface Props {
  label: string;
  value: string;
  delta?: number;          // % change vs previous period (positive = good or bad depends on lowerIsBetter)
  deltaLabel?: string;
  lowerIsBetter?: boolean; // for missed calls, wait time, AHT — lower delta is green
  icon: React.ElementType;
  iconColor?: string;
  accent?: string;
  suffix?: string;
}

export function KPICard({
  label,
  value,
  delta,
  deltaLabel,
  lowerIsBetter = false,
  icon: Icon,
  iconColor = 'text-brand-primary',
  accent = 'bg-blue-50',
  suffix,
}: Props) {
  const hasDelta = delta !== undefined && !isNaN(delta);
  const isGood = hasDelta
    ? lowerIsBetter
      ? delta <= 0
      : delta >= 0
    : true;
  const isNeutral = hasDelta && Math.abs(delta) < 0.5;

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 flex flex-col gap-3 min-w-0">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide truncate">
          {label}
        </span>
        <span className={cn('flex items-center justify-center w-7 h-7 rounded-lg shrink-0', accent)}>
          <Icon className={cn('w-3.5 h-3.5', iconColor)} />
        </span>
      </div>

      <div className="flex items-end gap-2">
        <span className="text-2xl font-bold text-gray-900 tabular-nums leading-none">{value}</span>
        {suffix && <span className="text-sm text-muted-foreground mb-0.5">{suffix}</span>}
      </div>

      {hasDelta && (
        <div className="flex items-center gap-1">
          {isNeutral ? (
            <Minus className="w-3 h-3 text-gray-400" />
          ) : isGood ? (
            <TrendingUp className="w-3 h-3 text-green-500" />
          ) : (
            <TrendingDown className="w-3 h-3 text-red-500" />
          )}
          <span
            className={cn(
              'text-[11px] font-semibold',
              isNeutral ? 'text-gray-400' : isGood ? 'text-green-600' : 'text-red-500',
            )}
          >
            {delta > 0 ? '+' : ''}{delta.toFixed(1)}%
          </span>
          <span className="text-[10px] text-muted-foreground">{deltaLabel ?? 'vs prev period'}</span>
        </div>
      )}
    </div>
  );
}
