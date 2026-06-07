'use client';

import { useQuery } from '@tanstack/react-query';
import { getTenantFeatures } from '@/lib/api/tenant-features';
import { useFeaturesStore } from '@/lib/store/features';
import { useAuthStore } from '@/lib/store/auth';
import { normalizeTenantFeatures } from '@/lib/features/access';

/**
 * Tenant entitlements for nav + route guards.
 * Hydrated at login; refreshed from tenant API when stale.
 */
export function useTenantFeatures() {
  const user = useAuthStore(s => s.user);
  const tokens = useAuthStore(s => s.tokens);
  const stored = useFeaturesStore(s => s.features);
  const loaded = useFeaturesStore(s => s.loaded);
  const setFeatures = useFeaturesStore(s => s.setFeatures);

  const tenantId = user ? String(user.chatwootAccountId ?? user.tenantId ?? '') : '';

  const query = useQuery({
    queryKey: ['tenant-features', tenantId],
    queryFn: async () => {
      const raw = await getTenantFeatures(tenantId);
      setFeatures(raw);
      return normalizeTenantFeatures(raw);
    },
    enabled: !!(tenantId && tokens?.gatewayJwt),
    staleTime: 5 * 60_000,
    retry: 1,
  });

  return {
    features: query.data ?? stored,
    loaded: loaded || query.isSuccess,
    isLoading: query.isLoading,
    refetch: query.refetch,
  };
}

export function useTenantFeatureEnabled(key: keyof ReturnType<typeof normalizeTenantFeatures>): boolean {
  const { features } = useTenantFeatures();
  return features[key] === true;
}
