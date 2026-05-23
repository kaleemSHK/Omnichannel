'use client';

import { formatOmr, gaugeColor, gaugePercent } from '@/lib/utils/billing';
import type { UsageGaugeData } from '@/lib/utils/billing';

interface Props {
  label: string;
  used: number;
  total: number;
  unit: string;
  overage?: number;
  overageCost?: number;
}

export function UsageGauge({ label, used, total, unit, overage, overageCost }: Props) {
  const pct = gaugePercent(used, total);
  const barColor = gaugeColor(used, total);

  return (
    <div className="bn-card p-4">
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="text-sm text-gray-600">{label}</span>
        <span className="text-sm font-medium text-gray-900">
          {used.toLocaleString()} / {total.toLocaleString()} {unit}
        </span>
      </div>
      <div className="h-2 w-full rounded-full bg-gray-100 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${barColor}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {overage != null && overage > 0 && (
        <p className="mt-2 text-sm text-red-600">
          +{overage.toLocaleString()} {unit} overage
          {overageCost != null ? ` · ${formatOmr(overageCost)}` : ''}
        </p>
      )}
    </div>
  );
}

export function UsageGaugeFromData({ data }: { data: UsageGaugeData }) {
  return (
    <UsageGauge
      label={data.label}
      used={data.used}
      total={data.total}
      unit={data.unit}
      overage={data.overage}
      overageCost={data.overageCost}
    />
  );
}
