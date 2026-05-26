'use client';

import { useState } from 'react';
import { Trash2, Pencil, Loader2 } from 'lucide-react';
import { tierBadgeClass } from '@/lib/utils/sla';
import { useDeletePolicy } from '@/lib/hooks/useSla';
import { PolicyFormModal } from '@/components/sla/PolicyFormModal';
import { cn } from '@/lib/utils/cn';
import type { SLAPolicy } from '@/types';

export function PolicyCard({ policy }: { policy: SLAPolicy }) {
  const [editOpen, setEditOpen] = useState(false);
  const deleteMut = useDeletePolicy();

  return (
    <>
      <div className="bn-card p-4 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium capitalize', tierBadgeClass(policy.tier))}>
            {policy.tier}
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setEditOpen(true)}
              className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
              aria-label="Edit policy"
            >
              <Pencil size={13} />
            </button>
            <button
              type="button"
              onClick={() => deleteMut.mutate(policy.id)}
              disabled={deleteMut.isPending}
              className="p-1 rounded hover:bg-red-50 text-muted-foreground hover:text-red-600 disabled:opacity-50"
              aria-label="Delete policy"
            >
              {deleteMut.isPending ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
            </button>
          </div>
        </div>

        <h3 className="font-medium text-gray-900">{policy.name}</h3>

        <dl className="space-y-2 text-sm">
          <Row label="First response" value={`${policy.firstResponseMinutes} min`} />
          <Row label="Resolution"     value={`${policy.resolutionHours} h`} />
          <Row label="Escalates after" value={`${policy.escalationHours} h`} />
          <Row label="Business hours only" value={policy.calendarId ? 'Yes' : 'No'} />
        </dl>
      </div>

      <PolicyFormModal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        existing={policy}
      />
    </>
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
