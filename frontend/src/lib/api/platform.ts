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

// ─── P1: Platform admin types ─────────────────────────────────────────────────

export interface PlatformAdmin {
  id: string;
  email: string;
  name: string;
  role: 'platform_admin' | 'platform_viewer';
  status: 'active' | 'invited';
  createdAt: string;
}

export interface StorageTenantStat {
  tenantId: string;
  tenantName: string;
  plan: string;
  recordings_gb: number;
  assets_gb: number;
  ai_gb: number;
  total_gb: number;
  quota_gb: number;
}

export interface ServiceHealthEntry {
  name: string;
  status: 'up' | 'down' | 'degraded' | 'unknown';
  latency_ms: number;
  error?: string;
}

export interface HealthAllResult {
  overall: 'healthy' | 'degraded';
  services: ServiceHealthEntry[];
  checkedAt: string;
}

export interface AuditEvent {
  id: string;
  ts: string;
  action: string;
  resourceType: string;
  tenantId: string | null;
  actorEmail: string | null;
}

export interface AlertRule {
  id: string;
  name: string;
  condition: string;
  threshold: number | null;
  channels: string[];
  enabled: boolean;
  createdAt: string;
}

// ─── P1: Admin CRUD ───────────────────────────────────────────────────────────

export async function listAdmins(): Promise<PlatformAdmin[]> {
  return bnFetch<PlatformAdmin[]>(PLATFORM_SVC, '/v1/admins');
}

export async function createAdmin(data: {
  email: string;
  name?: string;
  role?: string;
}): Promise<PlatformAdmin> {
  return bnFetch<PlatformAdmin>(PLATFORM_SVC, '/v1/admins', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function deleteAdmin(id: string): Promise<void> {
  await bnFetch<unknown>(PLATFORM_SVC, `/v1/admins/${id}`, { method: 'DELETE' });
}

// ─── P1: Storage stats ────────────────────────────────────────────────────────

export async function getStorageStats(): Promise<StorageTenantStat[]> {
  return bnFetch<StorageTenantStat[]>(PLATFORM_SVC, '/v1/storage/stats');
}

// ─── P1: Health ───────────────────────────────────────────────────────────────

export async function getHealthAll(): Promise<HealthAllResult> {
  return bnFetch<HealthAllResult>(PLATFORM_SVC, '/v1/health/all');
}

// ─── P1: Audit log ────────────────────────────────────────────────────────────

export async function getAuditLog(limit = 100): Promise<AuditEvent[]> {
  return bnFetch<AuditEvent[]>(PLATFORM_SVC, `/v1/audit?limit=${limit}`);
}

// ─── P1: Alert rules ─────────────────────────────────────────────────────────

export async function listAlerts(): Promise<AlertRule[]> {
  return bnFetch<AlertRule[]>(PLATFORM_SVC, '/v1/alerts');
}

export async function createAlert(data: {
  name: string;
  condition: string;
  threshold?: number;
  channels?: string[];
}): Promise<AlertRule> {
  return bnFetch<AlertRule>(PLATFORM_SVC, '/v1/alerts', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateAlert(id: string, data: Partial<AlertRule>): Promise<AlertRule> {
  return bnFetch<AlertRule>(PLATFORM_SVC, `/v1/alerts/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function deleteAlert(id: string): Promise<void> {
  await bnFetch<unknown>(PLATFORM_SVC, `/v1/alerts/${id}`, { method: 'DELETE' });
}
