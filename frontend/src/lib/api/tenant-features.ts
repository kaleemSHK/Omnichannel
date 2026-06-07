import { bnFetch } from '@/lib/api/client';

export async function getTenantFeatures(tenantId: string): Promise<Record<string, unknown>> {
  const res = await bnFetch<{
    data?: { features?: Record<string, unknown> };
  }>('tenant', `/v1/tenants/${encodeURIComponent(tenantId)}/features`);
  return res.data?.features ?? {};
}
