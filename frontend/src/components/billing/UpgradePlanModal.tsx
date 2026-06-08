'use client';

import { Loader2 } from 'lucide-react';
import { Dialog } from '@/components/ui/Dialog';
import { formatOmr } from '@/lib/utils/billing';
import { useAssignBillingPlan, useBillingPlans } from '@/lib/hooks/useBilling';

interface Props {
  open: boolean;
  onClose: () => void;
}

export function UpgradePlanModal({ open, onClose }: Props) {
  const { data: plans = [], isLoading } = useBillingPlans();
  const assign = useAssignBillingPlan();

  return (
    <Dialog open={open} onClose={onClose} title="Manage plan" className="max-w-md">
      {isLoading ? (
        <div className="flex justify-center py-8 text-gray-400">
          <Loader2 className="animate-spin" size={24} />
        </div>
      ) : plans.length === 0 ? (
        <p className="text-sm text-muted-foreground py-6 text-center">No plans available.</p>
      ) : (
        <ul className="space-y-3">
          {plans.map(plan => (
            <li
              key={plan.id}
              className="border border-gray-200 rounded-lg p-4 hover:border-[#0B5FFF]/40 transition-colors"
            >
              <div className="flex justify-between items-start gap-2">
                <div>
                  <p className="font-medium text-gray-900">{plan.name}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    Up to {plan.seats} agents
                    {plan.featureSummary ? ` · ${plan.featureSummary}` : ''}
                  </p>
                </div>
                <p className="text-sm font-semibold text-[#0B5FFF]">
                  {formatOmr(plan.monthlyPrice)}/mo
                </p>
              </div>
              <button
                type="button"
                disabled={assign.isPending}
                className="mt-3 w-full py-1.5 text-sm border border-[#0B5FFF] text-[#0B5FFF] rounded-md hover:bg-blue-50 disabled:opacity-50"
                onClick={() => {
                  assign.mutate(plan.id, { onSuccess: onClose });
                }}
              >
                {assign.isPending ? 'Applying…' : `Select ${plan.name}`}
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs text-gray-400 mt-4">
        Plans include 5% VAT on invoices (OMR). Enterprise contracts — contact LABBIK support.
      </p>
    </Dialog>
  );
}
