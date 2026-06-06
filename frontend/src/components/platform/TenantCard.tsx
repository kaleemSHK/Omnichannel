'use client';

import { useState } from 'react';
import { FeatureToggle } from '@/components/platform/FeatureToggle';
import { TenantEditSheet } from '@/components/platform/TenantEditSheet';
import {
  PLATFORM_FEATURE_FLAGS,
  avatarColor,
  planLabel,
  statusPill,
  tenantInitials,
  type PlatformTenantView,
} from '@/lib/utils/platform';
import { useImpersonateTenant } from '@/lib/hooks/usePlatform';
import { cn } from '@/lib/utils/cn';

interface Props {
  tenant: PlatformTenantView;
}

export function TenantCard({ tenant }: Props) {
  const impersonate = useImpersonateTenant();
  const [editOpen, setEditOpen] = useState(false);
  const pill = statusPill(tenant.status);
  const suspended = tenant.status === 'suspended';

  return (
    <article
      className={cn(
        'bn-card p-4 space-y-4',
        suspended && 'bg-red-50/30 border-red-200',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div
            className={cn(
              'w-10 h-10 rounded-lg flex items-center justify-center text-sm font-semibold shrink-0',
              avatarColor(tenant.id),
            )}
          >
            {tenantInitials(tenant.name)}
          </div>
          <div className="min-w-0">
            <h3 className="font-semibold text-gray-900 truncate">{tenant.name}</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              ID {tenant.id} · {tenant.agentCount} agents · {tenant.location ?? '—'}
            </p>
          </div>
        </div>
        <div className="text-end shrink-0 space-y-1">
          <span
            className={cn(
              'inline-flex px-2 py-0.5 rounded-full text-xs font-medium border',
              pill.className,
            )}
          >
            {pill.label}
          </span>
          <p className="text-xs text-gray-500">{planLabel(tenant.plan)}</p>
          <div className="flex items-center justify-end gap-2 text-xs">
            <button type="button" className="text-[#0B5FFF] hover:underline" onClick={() => setEditOpen(true)}>
              Edit
            </button>
            <button
              type="button"
              className="text-gray-600 hover:underline"
              disabled={impersonate.isPending || suspended}
              onClick={() => impersonate.mutate(tenant)}
            >
              Impersonate
            </button>
          </div>
        </div>
      </div>

      <div className="border-t border-gray-100 pt-3">
        <p className="text-xs text-gray-400 mb-2">Feature flags</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
          {PLATFORM_FEATURE_FLAGS.map(flag => (
            <FeatureToggle
              key={flag.key}
              tenantId={tenant.id}
              flagKey={flag.key}
              label={flag.label}
              value={tenant.features[flag.key] ?? false}
              disabled={suspended}
            />
          ))}
        </div>
      </div>
      <TenantEditSheet tenant={tenant} open={editOpen} onClose={() => setEditOpen(false)} />
    </article>
  );
}
