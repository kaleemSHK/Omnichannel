/**
 * BlinkOne Platform admin — tenant registry via tenant sidecar (Postgres + Chatwoot provision).
 * Branding still uses platform service.
 */

import { bnFetch } from './client';
import type { Tenant, TenantFeatures } from '@/types';

const TENANT_SVC = 'tenant';
const PLATFORM_SVC = 'platform';

function unwrapData<T>(res: T | { data: T }): T {
  if (res && typeof res === 'object' && 'data' in res) {
    return (res as { data: T }).data;
  }
  return res as T;
}

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? value : [];
}

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
}): Promise<{
  tenant: Tenant;
  ownerTempPassword?: string | null;
  chatwootStub?: boolean;
}> {
  const billingPlanId =
    data.plan === 'trial' || data.plan === 'starter' ? 'starter' : data.plan;
  const res = await bnFetch<{
    data: {
      tenant: Tenant;
      ownerTempPassword?: string | null;
      chatwootStub?: boolean;
    };
  }>(TENANT_SVC, '/v1/tenants', {
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
  const payload = unwrapData(res);
  return {
    tenant: payload.tenant ?? (payload as unknown as Tenant),
    ownerTempPassword: payload.ownerTempPassword,
    chatwootStub: payload.chatwootStub,
  };
}

export async function updateTenantFeatures(
  id: string,
  features: Partial<TenantFeatures>,
): Promise<Tenant> {
  return updateTenant(id, { features });
}

export async function updateTenant(
  id: string,
  patch: { name?: string; status?: Tenant['status']; features?: Partial<TenantFeatures> },
): Promise<Tenant> {
  const res = await bnFetch<{ data: Tenant }>(TENANT_SVC, `/v1/tenants/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
  return res.data;
}

/** Platform admin — re-issue gateway JWT for target tenant. */
export async function impersonateTenant(tenantId: string): Promise<{
  tenantId: string;
  chatwootAccountId?: number;
  token: string;
  permissions?: string[];
  pages?: string[];
}> {
  const res = await bnFetch<{ data: Record<string, unknown> }>(
    'auth',
    '/impersonate-tenant',
    {
      method: 'POST',
      body: JSON.stringify({ tenant_id: tenantId }),
    },
  );
  const body = (res as { data?: Record<string, unknown> }).data ?? (res as Record<string, unknown>);
  return {
    tenantId: String(body.tenantId ?? tenantId),
    chatwootAccountId: Number(body.chatwootAccountId ?? 0) || undefined,
    token: String(body.token ?? ''),
    permissions: body.permissions as string[] | undefined,
    pages: body.pages as string[] | undefined,
  };
}

export async function getBranding(accountId: number): Promise<{
  productName: string;
  primaryColor: string;
  logoUrl?: string;
  faviconUrl?: string;
}> {
  const res = await bnFetch<{ data: unknown }>(PLATFORM_SVC, `/v1/branding/${accountId}`);
  return unwrapData(res) as { productName: string; primaryColor: string; logoUrl?: string; faviconUrl?: string };
}

// ─── P1: Platform admin types ─────────────────────────────────────────────────

export interface PlatformAdmin {
  id: string;
  email: string;
  name: string;
  role: 'platform_admin' | 'platform_viewer';
  status: 'active' | 'invited';
  createdAt: string | null;
  source?: 'configured' | 'invited';
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
  const res = await bnFetch<{ data: PlatformAdmin[] } | PlatformAdmin[]>(PLATFORM_SVC, '/v1/admins');
  return asArray(unwrapData(res));
}

export async function createAdmin(data: {
  email: string;
  name?: string;
  role?: string;
}): Promise<PlatformAdmin> {
  const res = await bnFetch<{ data: PlatformAdmin } | PlatformAdmin>(PLATFORM_SVC, '/v1/admins', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  return unwrapData(res);
}

export async function deleteAdmin(id: string): Promise<void> {
  await bnFetch<unknown>(PLATFORM_SVC, `/v1/admins/${id}`, { method: 'DELETE' });
}

// ─── P1: Storage stats ────────────────────────────────────────────────────────

export async function getStorageStats(): Promise<StorageTenantStat[]> {
  const res = await bnFetch<{ data: StorageTenantStat[] } | StorageTenantStat[]>(
    PLATFORM_SVC,
    '/v1/storage/stats',
  );
  return asArray(unwrapData(res));
}

// ─── P1: Health ───────────────────────────────────────────────────────────────

export async function getHealthAll(): Promise<HealthAllResult> {
  const res = await bnFetch<{ data: HealthAllResult } | HealthAllResult>(
    PLATFORM_SVC,
    '/v1/health/all',
  );
  const body = unwrapData(res);
  return {
    overall: body?.overall ?? 'degraded',
    services: asArray(body?.services),
    checkedAt: body?.checkedAt ?? new Date().toISOString(),
  };
}

// ─── P1: Audit log ────────────────────────────────────────────────────────────

export async function getAuditLog(limit = 100): Promise<AuditEvent[]> {
  const res = await bnFetch<{ data: AuditEvent[] } | AuditEvent[]>(
    PLATFORM_SVC,
    `/v1/audit?limit=${limit}`,
  );
  return asArray(unwrapData(res));
}

// ─── P1: Alert rules ─────────────────────────────────────────────────────────

export async function listAlerts(): Promise<AlertRule[]> {
  const res = await bnFetch<{ data: AlertRule[] } | AlertRule[]>(PLATFORM_SVC, '/v1/alerts');
  return asArray(unwrapData(res));
}

export async function createAlert(data: {
  name: string;
  condition: string;
  threshold?: number;
  channels?: string[];
}): Promise<AlertRule> {
  const res = await bnFetch<{ data: AlertRule } | AlertRule>(PLATFORM_SVC, '/v1/alerts', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  return unwrapData(res);
}

export async function updateAlert(id: string, data: Partial<AlertRule>): Promise<AlertRule> {
  const res = await bnFetch<{ data: AlertRule } | AlertRule>(PLATFORM_SVC, `/v1/alerts/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
  return unwrapData(res);
}

export async function deleteAlert(id: string): Promise<void> {
  await bnFetch<unknown>(PLATFORM_SVC, `/v1/alerts/${id}`, { method: 'DELETE' });
}
