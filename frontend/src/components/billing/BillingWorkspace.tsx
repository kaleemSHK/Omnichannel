'use client';

import { useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { CreditCard, Loader2, Lock, Package, PieChart, Receipt } from 'lucide-react';
import { useAuthStore } from '@/lib/store/auth';
import { can } from '@/lib/rbac';
import { PlanBanner } from '@/components/billing/PlanBanner';
import { NoPlanBanner } from '@/components/billing/NoPlanBanner';
import { UsageGaugeFromData } from '@/components/billing/UsageGauge';
import { InvoiceTable } from '@/components/billing/InvoiceTable';
import { AddOnCard } from '@/components/billing/AddOnCard';
import { UsageHistoryChart } from '@/components/billing/UsageHistoryChart';
import { UpgradePlanModal } from '@/components/billing/UpgradePlanModal';
import {
  useBillingAddons,
  useBillingDemoMode,
  useBillingHistory,
  useBillingInvoices,
  useBillingPaymentMethods,
  useBillingSubscription,
  useBillingUsage,
} from '@/lib/hooks/useBilling';
import { DemoBanner } from '@/components/ui/DemoBanner';
import { cn } from '@/lib/utils/cn';

type BillingTab = 'overview' | 'usage' | 'invoices' | 'payment' | 'addons';

const NAV: { id: BillingTab; label: string; icon: typeof PieChart }[] = [
  { id: 'overview', label: 'Overview', icon: PieChart },
  { id: 'usage', label: 'Usage', icon: Receipt },
  { id: 'invoices', label: 'Invoices', icon: Receipt },
  { id: 'payment', label: 'Payment methods', icon: CreditCard },
  { id: 'addons', label: 'Add-ons', icon: Package },
];

export function BillingWorkspace() {
  const role = useAuthStore(s => s.user?.role);
  const router = useRouter();
  const searchParams = useSearchParams();
  const tab = (searchParams.get('tab') as BillingTab) || 'overview';

  if (!can(role, 'manageBilling')) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <Lock className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
          <p className="text-muted-foreground text-sm">Admin access required</p>
        </div>
      </div>
    );
  }

  const { data: plan, isLoading: planLoading, isError: planError } = useBillingSubscription();
  const { data: gauges = [], isLoading: usageLoading } = useBillingUsage();
  const { data: invoices = [], isLoading: invLoading } = useBillingInvoices();
  const { data: history = [] } = useBillingHistory();
  const { data: paymentMethods = [] } = useBillingPaymentMethods();
  const { data: addons = [] } = useBillingAddons();
  const demoMode = useBillingDemoMode();

  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [addonState, setAddonState] = useState<Record<string, boolean>>({});

  const resolvedAddons = useMemo(
    () =>
      addons.map(a => ({
        ...a,
        enabled: addonState[a.id] ?? a.enabled,
      })),
    [addons, addonState],
  );

  const setTab = (id: BillingTab) => {
    const q = id === 'overview' ? '/billing' : `/billing?tab=${id}`;
    router.push(q);
  };

  const loading = planLoading || (usageLoading && tab === 'overview');

  return (
    <div className="flex h-full min-h-[calc(100vh-3rem)] bg-surface-tertiary">
      <nav className="w-[160px] shrink-0 bg-white border-e border-gray-200 py-3 px-2">
        {NAV.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={cn(
              'w-full flex items-center gap-2 px-2.5 py-2 rounded-md text-sm mb-0.5 text-start',
              tab === id ? 'bg-blue-50 text-[#0B5FFF] font-medium' : 'text-gray-600 hover:bg-gray-50',
            )}
          >
            <Icon size={16} className="shrink-0" />
            {label}
          </button>
        ))}
      </nav>

      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
        {demoMode && <DemoBanner label="Billing demo data (LABBIK Telecom sample tenant)" />}
        {planError && tab === 'overview' && (
          <div className="bn-card p-4 text-sm text-amber-800 bg-amber-50 border border-amber-200">
            Billing service unavailable. Ensure billing sidecar is running and PostgreSQL is configured.
          </div>
        )}
        {loading && tab === 'overview' ? (
          <div className="flex justify-center py-16 text-gray-400">
            <Loader2 className="animate-spin" size={28} />
          </div>
        ) : (
          <>
            {tab === 'overview' && (
              <>
                {plan ? (
                  <PlanBanner plan={plan} onManagePlan={() => setUpgradeOpen(true)} />
                ) : (
                  <NoPlanBanner onChoosePlan={() => setUpgradeOpen(true)} />
                )}
                <section>
                  <h2 className="text-sm font-semibold text-gray-900 mb-3">Usage this cycle</h2>
                  {gauges.length === 0 ? (
                    <p className="text-xs text-muted-foreground bn-card p-4">No usage recorded yet this billing period.</p>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                      {gauges.map(g => (
                        <UsageGaugeFromData key={g.key} data={g} />
                      ))}
                    </div>
                  )}
                </section>
                <section className="bn-card p-4">
                  <h2 className="text-sm font-semibold text-gray-900 mb-3">Recent invoices</h2>
                  {invLoading ? (
                    <Loader2 className="animate-spin text-gray-400 mx-auto" size={20} />
                  ) : invoices.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No invoices yet. Invoices generate at period end (OMR + 5% VAT).</p>
                  ) : (
                    <InvoiceTable invoices={invoices.slice(0, 5)} />
                  )}
                </section>
              </>
            )}

            {tab === 'usage' && (
              <>
                <section>
                  <h2 className="text-sm font-semibold text-gray-900 mb-3">Usage this cycle</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                    {gauges.map(g => (
                      <UsageGaugeFromData key={g.key} data={g} />
                    ))}
                  </div>
                </section>
                <section className="bn-card p-4">
                  <h2 className="text-sm font-semibold text-gray-900 mb-1">6-month trend</h2>
                  <p className="text-xs text-gray-500 mb-4">Agents, PSTN, and WhatsApp volume</p>
                  <UsageHistoryChart data={history} />
                </section>
              </>
            )}

            {tab === 'invoices' && (
              <section className="bn-card p-4">
                <h2 className="text-sm font-semibold text-gray-900 mb-3">Invoices</h2>
                {invLoading ? (
                  <div className="flex justify-center py-12">
                    <Loader2 className="animate-spin text-gray-400" size={24} />
                  </div>
                ) : (
                  <InvoiceTable invoices={invoices} />
                )}
              </section>
            )}

            {tab === 'payment' && (
              <section className="bn-card p-4 max-w-lg">
                <h2 className="text-sm font-semibold text-gray-900 mb-3">Payment methods</h2>
                {paymentMethods.length === 0 ? (
                  <p className="text-xs text-muted-foreground mb-3">
                    No payment method on file. Add a card to pay invoices (OMR).
                  </p>
                ) : (
                  paymentMethods.map(pm => (
                    <div
                      key={pm.id}
                      className="border border-gray-200 rounded-lg p-4 flex items-center gap-3 mb-2"
                    >
                      <CreditCard className="text-gray-400" size={24} />
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {pm.type === 'card' ? 'Card' : pm.type} ···· {pm.last4 ?? '****'}
                        </p>
                        <p className="text-xs text-gray-500">
                          {pm.expMonth && pm.expYear
                            ? `Expires ${String(pm.expMonth).padStart(2, '0')}/${pm.expYear}`
                            : 'On file'}
                          {pm.isDefault ? ' · Default' : ''}
                        </p>
                      </div>
                      <button
                        type="button"
                        className="ms-auto text-sm text-[#0B5FFF] hover:underline"
                      >
                        Update
                      </button>
                    </div>
                  ))
                )}
                <button
                  type="button"
                  className="mt-3 text-sm text-[#0B5FFF] hover:underline"
                >
                  + Add payment method
                </button>
              </section>
            )}

            {tab === 'addons' && (
              <section>
                <h2 className="text-sm font-semibold text-gray-900 mb-3">Add-ons</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                  {resolvedAddons.map(addon => (
                    <AddOnCard
                      key={addon.id}
                      addon={addon}
                      onToggle={enabled =>
                        setAddonState(s => ({ ...s, [addon.id]: enabled }))
                      }
                    />
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>

      <UpgradePlanModal open={upgradeOpen} onClose={() => setUpgradeOpen(false)} />
    </div>
  );
}
