'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  assignSubscription,
  getSubscription,
  listInvoices,
  listPaymentMethods,
  listPlans,
} from '@/lib/api/billing';
import { bnFetch } from '@/lib/api/client';
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
import { useTenantAccountId } from '@/lib/hooks/useTenantAccountId';

function billingTenantId(): string {
  const user = useAuthStore.getState().user;
  return String(user?.chatwootAccountId ?? user?.tenantId ?? '');
}

export function useBillingDemoMode() {
  return isDemoDataEnabled();
}

export function useBillingSubscription() {
  const tenantId = billingTenantId();
  const gwEnabled = isGatewayQueryEnabled() && !!tenantId;
  return useQuery({
    queryKey: ['billing-subscription', tenantId, isDemoDataEnabled()],
    queryFn: async (): Promise<BillingPlanView | null> => {
      if (isDemoDataEnabled()) return DEMO_SUBSCRIPTION;
      const raw = await getSubscription(tenantId, { bootstrap: true });
      if (!raw) return null;
      return normalizeSubscription(raw);
    },
    enabled: gwEnabled,
  });
}

export function useBillingUsage() {
  const tenantId = billingTenantId();
  const gwEnabled = isGatewayQueryEnabled() && !!tenantId;
  return useQuery({
    queryKey: ['billing-usage', tenantId, isDemoDataEnabled()],
    queryFn: async (): Promise<UsageGaugeData[]> => {
      if (isDemoDataEnabled()) return DEMO_GAUGES;
      const res = await bnFetch<{ data: Record<string, unknown> }>(
        'billing',
        `/v1/tenants/${tenantId}/usage`,
      );
      return gaugesFromUsageBundle(res.data as Parameters<typeof gaugesFromUsageBundle>[0]);
    },
    enabled: gwEnabled,
  });
}

export function useBillingInvoices() {
  const tenantId = billingTenantId();
  const gwEnabled = isGatewayQueryEnabled() && !!tenantId;
  return useQuery({
    queryKey: ['billing-invoices', tenantId, isDemoDataEnabled()],
    queryFn: async (): Promise<InvoiceView[]> => {
      if (isDemoDataEnabled()) return DEMO_INVOICES;
      const rows = await listInvoices(tenantId);
      return rows.map(row => normalizeInvoice(row));
    },
    enabled: gwEnabled,
  });
}

export function useBillingHistory() {
  const tenantId = billingTenantId();
  const gwEnabled = isGatewayQueryEnabled() && !!tenantId;
  return useQuery({
    queryKey: ['billing-usage-history', tenantId, isDemoDataEnabled()],
    queryFn: async (): Promise<UsageHistoryPoint[]> => {
      if (isDemoDataEnabled()) return DEMO_USAGE_HISTORY;
      const res = await bnFetch<{ data: { history?: UsageHistoryPoint[] } }>(
        'billing',
        `/v1/tenants/${tenantId}/usage?period=historical&months=6`,
      );
      return res.data?.history ?? [];
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

export function useBillingPaymentMethods() {
  const tenantId = billingTenantId();
  const gwEnabled = isGatewayQueryEnabled() && !!tenantId;
  return useQuery({
    queryKey: ['billing-payment-methods', tenantId],
    queryFn: async () => {
      if (isDemoDataEnabled()) {
        return [{ id: 'demo', type: 'card', last4: '4242', isDefault: true }];
      }
      return listPaymentMethods(tenantId);
    },
    enabled: gwEnabled,
  });
}

export function useAssignBillingPlan() {
  const tenantId = billingTenantId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (planId: string) => assignSubscription(tenantId, planId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['billing-subscription', tenantId] });
      qc.invalidateQueries({ queryKey: ['billing-usage', tenantId] });
      qc.invalidateQueries({ queryKey: ['tenant-features', tenantId] });
      toast.success('Plan updated');
    },
    onError: () => toast.error('Could not change plan'),
  });
}

export function useBillingAddons() {
  const tenantId = useTenantAccountId();
  return useQuery({
    queryKey: ['billing-addons', tenantId],
    queryFn: async () => DEMO_ADDONS,
  });
}
