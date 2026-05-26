/**
 * BlinkOne Platform admin — tenant registry via tenant sidecar (Postgres + Chatwoot provision).
 * Branding still uses platform service.
 */

import { bnFetch } from './client';
import type { Tenant, TenantFeatures } from '@/types';

const TENANT_SVC = 'tenant';
const PLATFORM_SVC = 'platform';

export async function listTenants(): Promise<Tenant[]> {
  const res = await bnFetch<{ data: Tenant[] }>(TENANT_SVC, '/v1/tenants');
  return res.data;
}

export async function getTenant(id: string): Promise<Tenant> {
  const res = await bnFetch<{ data: Tenant }>(TENANT_SVC, `/v1/tenants/${id}`);
  return res.data;
}

export async function createTenant(data: {
  name: string;
  slug: string;
  plan: Tenant['plan'];
  features: Partial<TenantFeatures>;
  adminEmail: string;
}): Promise<Tenant> {
  const billingPlanId =
    data.plan === 'trial' || data.plan === 'starter' ? 'starter' : data.plan;
  const res = await bnFetch<{ data: { tenant: Tenant } }>(TENANT_SVC, '/v1/tenants', {
    method: 'POST',
    body: JSON.stringify({
      name: data.name,
      slug: data.slug,
      plan: data.plan === 'trial' ? 'trial' : 'active',
      ownerEmail: data.adminEmail,
      billingPlanId,
      features: data.features,
    }),
  });
  return res.data.tenant ?? (res.data as unknown as Tenant);
}

export async function updateTenantFeatures(
  id: string,
  features: Partial<TenantFeatures>,
): Promise<Tenant> {
  const res = await bnFetch<{ data: Tenant }>(TENANT_SVC, `/v1/tenants/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ features }),
  });
  return res.data;
}

/** Platform admin — start tenant impersonation session (tenant sidecar). */
export async function impersonateTenant(tenantId: string): Promise<{
  tenantId: string;
  chatwootAccountId?: number;
  impersonationToken?: string;
  token?: string;
}> {
  const res = await bnFetch<{ data: Record<string, unknown> }>(TENANT_SVC, `/v1/tenants/${tenantId}/impersonate`, {
    method: 'POST',
    body: '{}',
  });
  return res.data as {
    tenantId: string;
    chatwootAccountId?: number;
    impersonationToken?: string;
    token?: string;
  };
}

export async function getBranding(accountId: number): Promise<{
  productName: string;
  primaryColor: string;
  logoUrl?: string;
  faviconUrl?: string;
}> {
  const res = await bnFetch<{ data: unknown }>(PLATFORM_SVC, `/v1/branding/${accountId}`);
  return res.data as { productName: string; primaryColor: string; logoUrl?: string; faviconUrl?: string };
}
