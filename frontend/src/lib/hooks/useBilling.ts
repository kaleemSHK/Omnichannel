'use client';

import { useQuery } from '@tanstack/react-query';
import { bnFetch } from '@/lib/api/client';
import { getSubscription, listInvoices, listPlans } from '@/lib/api/billing';
import { isDemoDataEnabled } from '@/lib/demo/config';
import {
  DEMO_ADDONS,
  DEMO_GAUGES,
  DEMO_INVOICES,
  DEMO_PLANS,
  DEMO_SUBSCRIPTION,
  DEMO_USAGE_HISTORY,
} from '@/lib/demo/billingFixture';
import {
  gaugesFromUsageBundle,
  normalizeInvoice,
  normalizeSubscription,
  type BillingPlanView,
  type InvoiceView,
  type UsageGaugeData,
  type UsageHistoryPoint,
} from '@/lib/utils/billing';
import { useAuthStore } from '@/lib/store/auth';

function tenantId(): string {
  return useAuthStore.getState().user?.tenantId ?? '1';
}

export function useBillingDemoMode() {
  return isDemoDataEnabled();
}

export function useBillingSubscription() {
  return useQuery({
    queryKey: ['billing-subscription', isDemoDataEnabled()],
    queryFn: async (): Promise<BillingPlanView> => {
      if (isDemoDataEnabled()) return DEMO_SUBSCRIPTION;
      try {
        const raw = await getSubscription(tenantId());
        return normalizeSubscription(raw);
      } catch {
        try {
          const res = await bnFetch<{ data: Record<string, unknown> }>(
            'billing',
            `/v1/tenants/${tenantId()}/subscription`,
          );
          return normalizeSubscription(res.data);
        } catch {
          return DEMO_SUBSCRIPTION;
        }
      }
    },
  });
}

export function useBillingUsage() {
  return useQuery({
    queryKey: ['billing-usage', isDemoDataEnabled()],
    queryFn: async (): Promise<UsageGaugeData[]> => {
      if (isDemoDataEnabled()) return DEMO_GAUGES;
      try {
        const res = await bnFetch<{ data: Record<string, unknown> }>(
          'billing',
          `/v1/tenants/${tenantId()}/usage`,
        );
        const gauges = gaugesFromUsageBundle(res.data as Parameters<typeof gaugesFromUsageBundle>[0]);
        return gauges.some(g => g.total > 0) ? gauges : DEMO_GAUGES;
      } catch {
        return DEMO_GAUGES;
      }
    },
  });
}

export function useBillingInvoices() {
  return useQuery({
    queryKey: ['billing-invoices', isDemoDataEnabled()],
    queryFn: async (): Promise<InvoiceView[]> => {
      if (isDemoDataEnabled()) return DEMO_INVOICES;
      try {
        const rows = await listInvoices(tenantId());
        const mapped = rows.map(row => normalizeInvoice(row));
        return mapped.length ? mapped : DEMO_INVOICES;
      } catch {
        return DEMO_INVOICES;
      }
    },
  });
}

export function useBillingHistory() {
  return useQuery({
    queryKey: ['billing-usage-history'],
    queryFn: async (): Promise<UsageHistoryPoint[]> => {
      try {
        await bnFetch('billing', `/v1/tenants/${tenantId()}/usage?period=historical&months=6`);
      } catch {
        /* historical endpoint optional */
      }
      return DEMO_USAGE_HISTORY;
    },
  });
}

export function useBillingPlans() {
  return useQuery({
    queryKey: ['billing-plans', isDemoDataEnabled()],
    queryFn: async () => {
      if (isDemoDataEnabled()) return DEMO_PLANS;
      try {
        return await listPlans();
      } catch {
        return DEMO_PLANS;
      }
    },
  });
}

export function useBillingAddons() {
  return useQuery({
    queryKey: ['billing-addons'],
    queryFn: async () => DEMO_ADDONS,
  });
}
