'use client';

import { useQuery } from '@tanstack/react-query';
import { bnFetch } from '@/lib/api/client';
import { getSubscription, listInvoices, listPlans } from '@/lib/api/billing';
import { isDemoDataEnabled, isGatewayQueryEnabled } from '@/lib/demo/config';
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
  normalizePlanOption,
  normalizeSubscription,
  type BillingPlanOption,
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
  const gwEnabled = isGatewayQueryEnabled();
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
          throw new Error('Billing subscription unavailable');
        }
      }
    },
    enabled: gwEnabled,
  });
}

export function useBillingUsage() {
  const gwEnabled = isGatewayQueryEnabled();
  return useQuery({
    queryKey: ['billing-usage', isDemoDataEnabled()],
    queryFn: async (): Promise<UsageGaugeData[]> => {
      if (isDemoDataEnabled()) return DEMO_GAUGES;
      try {
        const res = await bnFetch<{ data: Record<string, unknown> }>(
          'billing',
          `/v1/tenants/${tenantId()}/usage`,
        );
        return gaugesFromUsageBundle(res.data as Parameters<typeof gaugesFromUsageBundle>[0]);
      } catch {
        return [];
      }
    },
    enabled: gwEnabled,
  });
}

export function useBillingInvoices() {
  const gwEnabled = isGatewayQueryEnabled();
  return useQuery({
    queryKey: ['billing-invoices', isDemoDataEnabled()],
    queryFn: async (): Promise<InvoiceView[]> => {
      if (isDemoDataEnabled()) return DEMO_INVOICES;
      try {
        const rows = await listInvoices(tenantId());
        return rows.map(row => normalizeInvoice(row));
      } catch {
        return [];
      }
    },
    enabled: gwEnabled,
  });
}

export function useBillingHistory() {
  const gwEnabled = isGatewayQueryEnabled();
  return useQuery({
    queryKey: ['billing-usage-history', isDemoDataEnabled()],
    queryFn: async (): Promise<UsageHistoryPoint[]> => {
      if (isDemoDataEnabled()) return DEMO_USAGE_HISTORY;
      try {
        await bnFetch('billing', `/v1/tenants/${tenantId()}/usage?period=historical&months=6`);
      } catch {
        /* historical endpoint optional */
      }
      return [];
    },
    enabled: gwEnabled,
  });
}

export function useBillingPlans() {
  const gwEnabled = isGatewayQueryEnabled();
  return useQuery({
    queryKey: ['billing-plans', isDemoDataEnabled()],
    queryFn: async (): Promise<BillingPlanOption[]> => {
      const raw = isDemoDataEnabled()
        ? DEMO_PLANS
        : await listPlans().catch(() => []);
      return raw.map(row => normalizePlanOption(row));
    },
    enabled: gwEnabled,
  });
}

export function useBillingAddons() {
  return useQuery({
    queryKey: ['billing-addons'],
    queryFn: async () => DEMO_ADDONS,
  });
}
