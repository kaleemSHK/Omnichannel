/**
 * BlinkOne Billing sidecar — /api/billing
 */

import { bnFetch } from './client';
import type { BillingSubscription, UsageMetric, Invoice } from '@/types';

const SVC = 'billing';

export async function getSubscription(tenantId: string): Promise<BillingSubscription> {
  const res = await bnFetch<{ data: BillingSubscription }>(SVC, `/v1/tenants/${tenantId}/subscription`);
  return res.data;
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
