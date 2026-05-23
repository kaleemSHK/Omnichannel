'use client';

import { formatOmr } from '@/lib/utils/billing';
import { cn } from '@/lib/utils/cn';

export interface AddOnItem {
  id: string;
  name: string;
  description: string;
  price: number;
  enabled: boolean;
}

interface Props {
  addon: AddOnItem;
  onToggle?: (enabled: boolean) => void;
}

export function AddOnCard({ addon, onToggle }: Props) {
  return (
    <div
      className={cn(
        'bn-card p-4 flex flex-col gap-3',
        addon.enabled && 'ring-1 ring-[#0B5FFF]/30',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="font-medium text-gray-900">{addon.name}</h3>
          <p className="text-sm text-gray-500 mt-1">{addon.description}</p>
        </div>
        <p className="text-sm font-semibold text-[#0B5FFF] shrink-0">{formatOmr(addon.price)}/mo</p>
      </div>
      <button
        type="button"
        onClick={() => onToggle?.(!addon.enabled)}
        className={cn(
          'text-sm py-1.5 rounded-md border transition-colors',
          addon.enabled
            ? 'border-gray-200 text-gray-600 hover:bg-gray-50'
            : 'border-[#0B5FFF] bg-[#0B5FFF] text-white hover:bg-blue-700',
        )}
      >
        {addon.enabled ? 'Remove add-on' : 'Add to plan'}
      </button>
    </div>
  );
}
