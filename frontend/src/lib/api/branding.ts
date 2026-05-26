/**
 * Tenant branding API — thin wrapper over the tenant sidecar.
 *
 * Server response shape:
 *   { status: "ok", data: { brand: BrandConfig, subdomain: string | null } }
 *
 * This module always extracts `.data.brand` so callers get the flat BrandConfig.
 */

import { bnFetch } from '@/lib/api/client';

export interface BrandConfig {
  productName?: string;
  companyName?: string;
  primaryColor?: string;
  secondaryColor?: string;
  accentColor?: string;
  tagline?: string;
  emailFromName?: string;
  emailFromAddress?: string;
  supportUrl?: string;
  marketingUrl?: string;
  termsUrl?: string;
  privacyUrl?: string;
  logoUrl?: { full?: string; mark?: string };
  faviconUrl?: string;
  fontFamily?: string;
}

interface BrandingResponse {
  brand: BrandConfig;
  subdomain: string | null;
}

/** Fetch branding for a tenant. Returns null on any error (API down, no Postgres, etc.) */
export async function getTenantBranding(tenantId: string): Promise<BrandConfig | null> {
  try {
    const res = await bnFetch<{ data: BrandingResponse }>(
      'tenant',
      `/v1/tenants/${tenantId}/branding`,
    );
    return res.data?.brand ?? null;
  } catch {
    return null;
  }
}

/** Save branding for a tenant. Returns the updated BrandConfig. */
export async function patchTenantBranding(
  tenantId: string,
  brand: Partial<BrandConfig>,
): Promise<BrandConfig> {
  const res = await bnFetch<{ data: BrandingResponse }>(
    'tenant',
    `/v1/tenants/${tenantId}/branding`,
    {
      method: 'PATCH',
      body: JSON.stringify({ brand }),
    },
  );
  return res.data?.brand ?? {};
}
