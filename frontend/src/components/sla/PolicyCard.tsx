'use client';

import { tierBadgeClass } from '@/lib/utils/sla';
import { cn } from '@/lib/utils/cn';
import type { SLAPolicy } from '@/types';

export function PolicyCard({ policy }: { policy: SLAPolicy }) {
  return (
    <div className="bn-card p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium capitalize', tierBadgeClass(policy.tier))}>
          {policy.tier}
        </span>
        <button type="button" className="text-xs text-[#0B5FFF] hover:underline">
          Edit
        </button>
      </div>
      <h3 className="font-medium text-gray-900">{policy.name}</h3>
      <dl className="space-y-2 text-sm">
        <Row label="First response" value={`${policy.firstResponseMinutes} min`} />
        <Row label="Resolution" value={`${policy.resolutionHours} h`} />
        <Row label="Business hours only" value={policy.calendarId ? 'Yes' : 'No'} />
        <Row label="Escalates after" value={`${policy.escalationHours} h`} />
      </dl>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-2">
      <dt className="text-gray-500">{label}</dt>
      <dd className="text-gray-900 font-medium">{value}</dd>
    </div>
  );
}
