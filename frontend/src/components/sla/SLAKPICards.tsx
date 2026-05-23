'use client';

import { cn } from '@/lib/utils/cn';

interface Stats {
  breachedCount: number;
  atRiskCount: number;
  activeCount: number;
  metToday: number;
  compliancePct: number;
}

export function SLAKPICards({ stats }: { stats: Stats }) {
  const cards = [
    { label: 'Breached', value: stats.breachedCount, sub: 'Needs immediate action', tone: 'text-red-600' },
    { label: 'At risk', value: stats.atRiskCount, sub: 'Within warning threshold', tone: 'text-amber-600' },
    { label: 'Active', value: stats.activeCount, sub: 'Tracking now', tone: 'text-blue-600' },
    {
      label: 'Met today',
      value: stats.metToday,
      sub: `${stats.compliancePct}% compliance`,
      tone: 'text-green-700',
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {cards.map(c => (
        <div key={c.label} className="kpi-card">
          <p className="kpi-label">{c.label}</p>
          <p className={cn('kpi-value', c.tone)}>{c.value}</p>
          <p className="text-xs text-gray-500 mt-0.5">{c.sub}</p>
        </div>
      ))}
    </div>
  );
}
