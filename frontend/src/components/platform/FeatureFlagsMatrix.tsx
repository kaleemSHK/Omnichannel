'use client';

/**
 * FeatureFlagsMatrix — P1 Platform Admin
 * Cross-tenant matrix view: rows = tenants, cols = feature flags.
 * Each cell is an inline toggle that calls PATCH /v1/tenants/:id.
 */

import { PLATFORM_FEATURE_FLAGS } from '@/lib/utils/platform';
import { useUpdateTenantFeature } from '@/lib/hooks/usePlatform';
import { usePlatformTenants } from '@/lib/hooks/usePlatform';
import { cn } from '@/lib/utils/cn';
import { Loader2 } from 'lucide-react';

function FlagCell({
  tenantId,
  flagKey,
  value,
  disabled,
}: {
  tenantId: string;
  flagKey: string;
  value: boolean;
  disabled: boolean;
}) {
  const update = useUpdateTenantFeature();
  return (
    <button
      type="button"
      role="switch"
      aria-checked={value}
      disabled={disabled || update.isPending}
      onClick={() =>
        update.mutate({
          tenantId,
          flagKey: flagKey as Parameters<typeof update.mutate>[0]['flagKey'],
          value: !value,
        })
      }
      className={cn(
        'w-8 h-4 rounded-full transition-colors mx-auto block',
        value ? 'bg-[#0B5FFF]' : 'bg-gray-200',
        (disabled || update.isPending) && 'opacity-40 cursor-not-allowed',
      )}
    >
      <span
        className={cn(
          'block w-3 h-3 rounded-full bg-white shadow transition-transform mt-0.5',
          value ? 'translate-x-4 ml-0.5' : 'translate-x-0.5',
        )}
      />
    </button>
  );
}

export function FeatureFlagsMatrix() {
  const { data: tenants = [], isLoading } = usePlatformTenants();

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="animate-spin text-gray-400" size={24} />
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100 bg-gray-50">
            <th className="text-start px-4 py-3 font-medium text-gray-600 min-w-[180px]">
              Tenant
            </th>
            {PLATFORM_FEATURE_FLAGS.map(f => (
              <th
                key={f.key}
                className="px-3 py-3 font-medium text-gray-600 text-center whitespace-nowrap text-[11px]"
              >
                {f.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {tenants.map((t, idx) => {
            const suspended = t.status === 'suspended';
            return (
              <tr
                key={t.id}
                className={cn(
                  'border-b border-gray-100 last:border-0',
                  idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50',
                  suspended && 'opacity-50',
                )}
              >
                <td className="px-4 py-3">
                  <div className="font-medium text-gray-800 truncate max-w-[180px]">{t.name}</div>
                  <div className="text-[10px] text-gray-400">{t.plan}</div>
                </td>
                {PLATFORM_FEATURE_FLAGS.map(f => (
                  <td key={f.key} className="px-3 py-3 text-center">
                    <FlagCell
                      tenantId={t.id}
                      flagKey={f.key}
                      value={t.features[f.key] ?? false}
                      disabled={suspended}
                    />
                  </td>
                ))}
              </tr>
            );
          })}
          {tenants.length === 0 && (
            <tr>
              <td
                colSpan={PLATFORM_FEATURE_FLAGS.length + 1}
                className="py-12 text-center text-sm text-gray-400"
              >
                No tenants found.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
