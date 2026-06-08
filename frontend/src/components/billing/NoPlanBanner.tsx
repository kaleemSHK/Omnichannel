'use client';

import { Receipt } from 'lucide-react';

interface Props {
  onChoosePlan: () => void;
}

export function NoPlanBanner({ onChoosePlan }: Props) {
  return (
    <div className="bg-white rounded-lg border border-dashed border-gray-300 p-8 text-center">
      <Receipt className="w-10 h-10 mx-auto text-gray-300 mb-3" />
      <h2 className="text-sm font-semibold text-gray-900">No active subscription</h2>
      <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
        Choose a plan to start tracking usage, invoices, and OMR billing for this workspace.
      </p>
      <button
        type="button"
        onClick={onChoosePlan}
        className="mt-4 px-4 py-2 text-sm font-medium bg-[#0B5FFF] text-white rounded-md hover:bg-blue-700"
      >
        View plans
      </button>
    </div>
  );
}
