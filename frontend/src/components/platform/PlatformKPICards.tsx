'use client';

import type { PlatformKpis } from '@/lib/utils/platform';
import { cn } from '@/lib/utils/cn';

const CARDS: {
  key: keyof PlatformKpis;
  label: string;
  className: string;
}[] = [
  { key: 'total', label: 'Total tenants', className: 'text-gray-900' },
  { key: 'active', label: 'Active', className: 'text-green-600' },
  { key: 'trial', label: 'Trial', className: 'text-amber-600' },
  { key: 'agents', label: 'Total agents', className: 'text-[#0B5FFF]' },
];

export function PlatformKPICards({ kpis }: { kpis: PlatformKpis }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {CARDS.map(c => (
        <div key={c.key} className="bn-card p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide">{c.label}</p>
          <p className={cn('text-2xl font-semibold mt-1', c.className)}>{kpis[c.key]}</p>
        </div>
      ))}
    </div>
  );
}
