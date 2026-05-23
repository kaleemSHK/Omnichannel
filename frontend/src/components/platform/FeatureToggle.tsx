'use client';

import { useUpdateTenantFeature } from '@/lib/hooks/usePlatform';
import type { PlatformFeatureKey } from '@/lib/utils/platform';
import { cn } from '@/lib/utils/cn';

interface Props {
  tenantId: string;
  flagKey: PlatformFeatureKey;
  label: string;
  value: boolean;
  disabled?: boolean;
}

export function FeatureToggle({ tenantId, flagKey, label, value, disabled }: Props) {
  const update = useUpdateTenantFeature();

  return (
    <label
      className={cn(
        'flex items-center justify-between gap-3 py-1.5',
        disabled && 'opacity-50 pointer-events-none',
      )}
    >
      <span className="text-sm text-gray-700">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={value}
        disabled={disabled || update.isPending}
        onClick={() => update.mutate({ tenantId, flagKey, value: !value })}
        className={cn(
          'relative w-9 h-5 rounded-full transition-colors shrink-0',
          value ? 'bg-[#0B5FFF]' : 'bg-gray-300',
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform',
            value ? 'translate-x-4' : 'translate-x-0.5',
          )}
        />
      </button>
    </label>
  );
}
