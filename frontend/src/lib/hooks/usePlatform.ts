'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  createTenant,
  impersonateTenant,
  listTenants,
  updateTenantFeatures,
} from '@/lib/api/platform';
import { isDemoDataEnabled, isGatewayQueryEnabled } from '@/lib/demo/config';
import { DEMO_PLATFORM_TENANTS } from '@/lib/demo/platformFixture';
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
  try {
    const rows = await listTenants();
    return rows.map(t => normalizeTenant(t));
  } catch {
    return [];
  }
}

export function usePlatformTenants() {
  const gwEnabled = isGatewayQueryEnabled();
  return useQuery({
    queryKey: [...QUERY_KEY, isDemoDataEnabled()],
    queryFn: loadTenants,
    enabled: gwEnabled,
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
    onSuccess: data => {
      qc.setQueryData([...QUERY_KEY, isDemoDataEnabled()], data);
    },
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
        await createTenant({
          name: payload.name,
          slug: payload.slug,
          plan: payload.plan,
          adminEmail: payload.adminEmail,
          features: apiFeatures,
        });
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
      toast.success('Tenant created');
    },
    onError: () => toast.error('Could not create tenant'),
  });
}

export function useImpersonateTenant() {
  const setAuth = useAuthStore(s => s.setAuth);
  const user = useAuthStore(s => s.user);
  const tokens = useAuthStore(s => s.tokens);

  return useMutation({
    mutationFn: async (tenant: PlatformTenantView) => {
      if (!isDemoDataEnabled()) {
        try {
          await impersonateTenant(tenant.id);
        } catch {
          /* demo fallback below */
        }
      }
      if (user && tokens) {
        setAuth(
          {
            ...user,
            tenantId: tenant.id,
            chatwootAccountId: Number(tenant.id) || user.chatwootAccountId,
            role: user.role,
          },
          tokens,
        );
      }
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
