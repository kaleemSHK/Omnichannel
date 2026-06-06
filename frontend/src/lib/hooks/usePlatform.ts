'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  createTenant,
  impersonateTenant,
  listTenants,
  updateTenant,
  updateTenantFeatures,
  listAdmins,
  createAdmin,
  deleteAdmin,
  getStorageStats,
  getHealthAll,
  getAuditLog,
  listAlerts,
  createAlert,
  updateAlert,
  deleteAlert,
} from '@/lib/api/platform';
import { isDemoDataEnabled, isGatewayQueryEnabled } from '@/lib/demo/config';
import {
  DEMO_PLATFORM_TENANTS,
  DEMO_ADMINS,
  DEMO_STORAGE_STATS,
  DEMO_HEALTH,
  DEMO_AUDIT_LOG,
  DEMO_ALERTS,
} from '@/lib/demo/platformFixture';
import type {
  PlatformAdmin,
  StorageTenantStat,
  HealthAllResult,
  AuditEvent,
  AlertRule,
} from '@/lib/api/platform';
import {
  aggregateKpis,
  featuresToApiPatch,
  normalizeTenant,
  type PlatformFeatureKey,
  type PlatformKpis,
  type PlatformTenantView,
} from '@/lib/utils/platform';
import { useAuthStore } from '@/lib/store/auth';

const QUERY_KEY = ['platform-tenants'];

async function loadTenants(): Promise<PlatformTenantView[]> {
  if (isDemoDataEnabled()) return DEMO_PLATFORM_TENANTS;
  const rows = await listTenants();
  return rows.map(t => normalizeTenant(t));
}

export function usePlatformTenants() {
  const gwEnabled = isGatewayQueryEnabled();
  const isPlatformAdmin = useAuthStore(s => s.user?.role === 'platform_admin');
  return useQuery({
    queryKey: [...QUERY_KEY, isDemoDataEnabled()],
    queryFn: loadTenants,
    enabled: gwEnabled && (isDemoDataEnabled() || isPlatformAdmin),
  });
}

export function usePlatformKpis(tenants: PlatformTenantView[] | undefined): PlatformKpis {
  return aggregateKpis(tenants ?? []);
}

export function useUpdateTenantFeature() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      tenantId,
      flagKey,
      value,
    }: {
      tenantId: string;
      flagKey: PlatformFeatureKey;
      value: boolean;
    }) => {
      if (!isDemoDataEnabled()) {
        await updateTenantFeatures(tenantId, featuresToApiPatch(flagKey, value));
      }
      const key = [...QUERY_KEY, isDemoDataEnabled()];
      const current = qc.getQueryData<PlatformTenantView[]>(key) ?? [];
      return current.map(t =>
        t.id === tenantId
          ? { ...t, features: { ...t.features, [flagKey]: value } }
          : t,
      );
    },
    onMutate: async ({ tenantId, flagKey, value }) => {
      const key = [...QUERY_KEY, isDemoDataEnabled()];
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<PlatformTenantView[]>(key);
      qc.setQueryData<PlatformTenantView[]>(key, old =>
        (old ?? []).map(t =>
          t.id === tenantId ? { ...t, features: { ...t.features, [flagKey]: value } } : t,
        ),
      );
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      const key = [...QUERY_KEY, isDemoDataEnabled()];
      if (ctx?.prev) qc.setQueryData(key, ctx.prev);
      toast.error('Could not update feature flag');
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });
}

export function useUpdateTenant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      tenantId,
      patch,
    }: {
      tenantId: string;
      patch: { name?: string; status?: PlatformTenantView['status'] };
    }) => {
      if (!isDemoDataEnabled()) {
        await updateTenant(tenantId, patch);
      }
      return patch;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEY });
      toast.success('Tenant updated');
    },
    onError: () => toast.error('Could not update tenant'),
  });
}

export function useCreatePlatformTenant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      name: string;
      slug: string;
      plan: PlatformTenantView['plan'];
      adminEmail: string;
      features: Record<PlatformFeatureKey, boolean>;
    }) => {
      const apiFeatures: Partial<import('@/types').TenantFeatures> = {};
      for (const [k, v] of Object.entries(payload.features)) {
        Object.assign(apiFeatures, featuresToApiPatch(k as PlatformFeatureKey, v));
      }
      if (!isDemoDataEnabled()) {
        const created = await createTenant({
          name: payload.name,
          slug: payload.slug,
          plan: payload.plan,
          adminEmail: payload.adminEmail,
          features: apiFeatures,
        });
        if (created.chatwootStub) {
          toast.warning('Tenant created in stub mode — set CHATWOOT_PLATFORM_TOKEN on the server');
        } else if (created.ownerTempPassword) {
          toast.success(
            `Tenant created. Owner login: ${payload.adminEmail} / ${created.ownerTempPassword}`,
            { duration: 20000 },
          );
        }
      }
      const row: PlatformTenantView = {
        id: `new-${Date.now()}`,
        slug: payload.slug,
        name: payload.name,
        domain: `${payload.slug}.blinkone.local`,
        plan: payload.plan,
        status: payload.plan === 'trial' ? 'trial' : 'active',
        agentCount: 0,
        createdAt: new Date().toISOString(),
        location: 'Muscat, OM',
        features: payload.features,
      };
      const key = [...QUERY_KEY, isDemoDataEnabled()];
      const current = qc.getQueryData<PlatformTenantView[]>(key) ?? [];
      return [...current, row];
    },
    onSuccess: () => {
      const key = [...QUERY_KEY, isDemoDataEnabled()];
      qc.invalidateQueries({ queryKey: key });
      if (isDemoDataEnabled()) toast.success('Tenant created');
    },
    onError: () => toast.error('Could not create tenant'),
  });
}

export function useImpersonateTenant() {
  const setAuth = useAuthStore(s => s.setAuth);
  const user = useAuthStore(s => s.user);
  const tokens = useAuthStore(s => s.tokens);
  const updateTokens = useAuthStore(s => s.updateTokens);

  return useMutation({
    mutationFn: async (tenant: PlatformTenantView) => {
      if (!user || !tokens) throw new Error('Not signed in');
      if (!isDemoDataEnabled()) {
        const result = await impersonateTenant(tenant.id);
        if (!result.token) throw new Error('No impersonation token');
        const newTokens = { ...tokens, gatewayJwt: result.token };
        await updateTokens(newTokens);
        const { hydratePermissionsFromJwt } = await import('@/lib/store/permissions');
        hydratePermissionsFromJwt(result.token);
        setAuth(
          {
            ...user,
            tenantId: result.tenantId,
            chatwootAccountId:
              result.chatwootAccountId ?? (Number(tenant.id) || user.chatwootAccountId),
          },
          newTokens,
        );
        return tenant;
      }
      setAuth(
        {
          ...user,
          tenantId: tenant.id,
          chatwootAccountId: Number(tenant.id) || user.chatwootAccountId,
        },
        tokens,
      );
      return tenant;
    },
    onSuccess: t => {
      toast.success(`Impersonating ${t.name}`);
      if (typeof window !== 'undefined') {
        window.location.href = '/conversations';
      }
    },
    onError: () => toast.error('Impersonation failed'),
  });
}

// ─── P1: Admins ───────────────────────────────────────────────────────────────

export function useAdmins() {
  const gwEnabled = isGatewayQueryEnabled();
  return useQuery<PlatformAdmin[]>({
    queryKey: ['platform-admins'],
    queryFn: async () => {
      if (isDemoDataEnabled() || !gwEnabled) return DEMO_ADMINS;
      try { return await listAdmins(); } catch { return DEMO_ADMINS; }
    },
    staleTime: 60_000,
  });
}

export function useCreateAdmin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: { email: string; name?: string; role?: string }) => {
      if (isDemoDataEnabled()) {
        return { id: `adm-${Date.now()}`, email: data.email, name: data.name || data.email.split('@')[0]!, role: (data.role ?? 'platform_admin') as PlatformAdmin['role'], status: 'invited' as const, createdAt: new Date().toISOString() };
      }
      return createAdmin(data);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['platform-admins'] }); toast.success('Invitation sent'); },
    onError: () => toast.error('Could not invite admin'),
  });
}

export function useDeleteAdmin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      if (!isDemoDataEnabled()) await deleteAdmin(id);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['platform-admins'] }); toast.success('Admin removed'); },
    onError: () => toast.error('Could not remove admin'),
  });
}

// ─── P1: Storage ──────────────────────────────────────────────────────────────

export function useStorageStats() {
  const gwEnabled = isGatewayQueryEnabled();
  return useQuery<StorageTenantStat[]>({
    queryKey: ['platform-storage'],
    queryFn: async () => {
      if (isDemoDataEnabled() || !gwEnabled) return DEMO_STORAGE_STATS;
      try { return await getStorageStats(); } catch { return DEMO_STORAGE_STATS; }
    },
    staleTime: 5 * 60_000,
  });
}

// ─── P1: Health ───────────────────────────────────────────────────────────────

export function useHealthAll() {
  const gwEnabled = isGatewayQueryEnabled();
  return useQuery<HealthAllResult>({
    queryKey: ['platform-health'],
    queryFn: async () => {
      if (isDemoDataEnabled() || !gwEnabled) return DEMO_HEALTH;
      try { return await getHealthAll(); } catch { return DEMO_HEALTH; }
    },
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}

// ─── P1: Audit log ────────────────────────────────────────────────────────────

export function useAuditLog(limit = 100) {
  const gwEnabled = isGatewayQueryEnabled();
  return useQuery<AuditEvent[]>({
    queryKey: ['platform-audit', limit],
    queryFn: async () => {
      if (isDemoDataEnabled() || !gwEnabled) return DEMO_AUDIT_LOG;
      try { return await getAuditLog(limit); } catch { return DEMO_AUDIT_LOG; }
    },
    staleTime: 30_000,
  });
}

// ─── P1: Alert rules ─────────────────────────────────────────────────────────

export function useAlerts() {
  const gwEnabled = isGatewayQueryEnabled();
  return useQuery<AlertRule[]>({
    queryKey: ['platform-alerts'],
    queryFn: async () => {
      if (isDemoDataEnabled() || !gwEnabled) return DEMO_ALERTS;
      try { return await listAlerts(); } catch { return DEMO_ALERTS; }
    },
    staleTime: 60_000,
  });
}

export function useCreateAlert() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: { name: string; condition: string; threshold?: number; channels?: string[] }) => {
      if (isDemoDataEnabled()) {
        return { id: `alr-${Date.now()}`, ...data, threshold: data.threshold ?? null, channels: data.channels ?? ['email'], enabled: true, createdAt: new Date().toISOString() } as AlertRule;
      }
      return createAlert(data);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['platform-alerts'] }); toast.success('Alert rule created'); },
    onError: () => toast.error('Could not create alert rule'),
  });
}

export function useUpdateAlert() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<AlertRule> }) => {
      if (isDemoDataEnabled()) return { id, ...data } as AlertRule;
      return updateAlert(id, data);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['platform-alerts'] }),
    onError: () => toast.error('Could not update alert rule'),
  });
}

export function useDeleteAlert() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      if (!isDemoDataEnabled()) await deleteAlert(id);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['platform-alerts'] }); toast.success('Alert rule deleted'); },
    onError: () => toast.error('Could not delete alert rule'),
  });
}
