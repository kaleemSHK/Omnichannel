'use client';

import { formatOmr } from '@/lib/utils/billing';
import type { BillingPlanView } from '@/lib/utils/billing';
import { cn } from '@/lib/utils/cn';

interface Props {
  plan: BillingPlanView;
  onManagePlan: () => void;
}

export function PlanBanner({ plan, onManagePlan }: Props) {
  const renewal = plan.renewalDate.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-5 flex flex-col sm:flex-row sm:items-center gap-4">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={cn('px-2.5 py-0.5 rounded-full text-xs font-semibold', plan.badgeClass)}>
            {plan.name}
          </span>
          {plan.status === 'trial' && (
            <span className="text-xs text-amber-600 font-medium">Trial</span>
          )}
        </div>
        <p className="mt-2 text-sm text-gray-600">
          Renews {renewal}
          {plan.daysUntilRenewal > 0 && (
            <span className="text-gray-500"> · {plan.daysUntilRenewal} days left</span>
          )}
        </p>
        <button
          type="button"
          onClick={onManagePlan}
          className="mt-3 text-sm text-[#0B5FFF] font-medium hover:underline"
        >
          Manage plan
        </button>
      </div>
      <div className="text-end shrink-0">
        <p className="text-2xl font-semibold text-[#0B5FFF]">{formatOmr(plan.monthlyPrice)}</p>
        <p className="text-xs text-gray-500">per month</p>
      </div>
    </div>
  );
}
