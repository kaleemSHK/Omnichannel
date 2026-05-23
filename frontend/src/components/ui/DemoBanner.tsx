'use client';

import { Info } from 'lucide-react';

export function DemoBanner({ label = 'Demo data' }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-amber-50 border border-amber-200 text-amber-900 text-xs">
      <Info size={14} className="shrink-0" />
      <span>
        {label} — set <code className="font-mono bg-amber-100/80 px-1 rounded">NEXT_PUBLIC_USE_DEMO_DATA=false</code>{' '}
        in <code className="font-mono bg-amber-100/80 px-1 rounded">.env.local</code> to use live APIs.
      </span>
    </div>
  );
}
