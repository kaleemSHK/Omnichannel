/**
 * BlinkOne Billing sidecar — /api/billing
 */

import { bnFetch } from './client';
import type { BillingSubscription, UsageMetric, Invoice } from '@/types';

const SVC = 'billing';

export async function getSubscription(
  tenantId: string,
  opts?: { bootstrap?: boolean },
): Promise<BillingSubscription | null> {
  const q = opts?.bootstrap ? '?bootstrap=1' : '';
  const res = await bnFetch<{ data: BillingSubscription | { subscription: null } }>(
    SVC,
    `/v1/tenants/${tenantId}/subscription${q}`,
  );
  const data = res.data as Record<string, unknown>;
  if (data && 'subscription' in data && data.subscription === null) return null;
  return res.data as BillingSubscription;
}

export async function assignSubscription(
  tenantId: string,
  planId: string,
  trialDays = 14,
): Promise<BillingSubscription> {
  const res = await bnFetch<{ data: BillingSubscription }>(SVC, `/v1/tenants/${tenantId}/subscription`, {
    method: 'POST',
    body: JSON.stringify({ planId, trialDays }),
  });
  return res.data;
}

export interface PaymentMethodView {
  id: string;
  type: string;
  last4?: string;
  expMonth?: number;
  expYear?: number;
  isDefault?: boolean;
}

export async function listPaymentMethods(tenantId: string): Promise<PaymentMethodView[]> {
  const res = await bnFetch<{ data: PaymentMethodView[] }>(
    SVC,
    `/v1/tenants/${tenantId}/payment-methods`,
  );
  return res.data ?? [];
}

export async function getUsage(tenantId: string): Promise<UsageMetric[]> {
  const res = await bnFetch<{ data: UsageMetric[] }>(SVC, `/v1/tenants/${tenantId}/usage`);
  return res.data;
}

export async function listInvoices(tenantId: string): Promise<Invoice[]> {
  const res = await bnFetch<{ data: Invoice[] }>(SVC, `/v1/tenants/${tenantId}/invoices`);
  return res.data;
}

export async function listPlans(): Promise<{
  id: string;
  name: string;
  monthlyPrice: number;
  seats: number;
  features: string[];
}[]> {
  const res = await bnFetch<{ data: unknown[] }>(SVC, '/v1/plans');
  return res.data as ReturnType<typeof listPlans> extends Promise<infer T> ? T : never;
}

export async function cancelSubscription(tenantId: string): Promise<void> {
  await bnFetch<void>(SVC, `/v1/tenants/${tenantId}/subscription/cancel`, {
    method: 'POST',
  });
}
