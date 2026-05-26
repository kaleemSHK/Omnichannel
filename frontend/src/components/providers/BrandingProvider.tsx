'use client';

/**
 * BrandingProvider — fetches tenant branding after login and injects CSS variables.
 *
 * Mounted inside <Providers> (root layout) so it covers all routes.
 * Query is disabled until the user has a valid gateway JWT — avoids a wasted
 * request on the public login page.
 *
 * When BrandingSection saves new branding it writes to the same React Query key
 * ['tenant-branding', tenantId], which triggers this effect and re-injects.
 */

import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/lib/store/auth';
import { getTenantBranding } from '@/lib/api/branding';
import { injectBrandingVars } from '@/lib/branding/inject';

export function BrandingProvider({ children }: { children: React.ReactNode }) {
  const user  = useAuthStore(s => s.user);
  const tokens = useAuthStore(s => s.tokens);

  const tenantId = user
    ? String(user.chatwootAccountId ?? user.tenantId ?? '1')
    : null;

  // Only fetch when the user is authenticated (has a gateway JWT)
  const enabled = !!(tenantId && tokens?.gatewayJwt);

  const { data: branding } = useQuery({
    queryKey: ['tenant-branding', tenantId],
    queryFn: () => getTenantBranding(tenantId!),
    enabled,
    staleTime: 10 * 60 * 1_000, // 10 minutes — branding rarely changes mid-session
    retry: false,                // don't spam the service on first login
    gcTime: 30 * 60 * 1_000,    // keep in cache for 30 min
  });

  useEffect(() => {
    injectBrandingVars(branding ?? null);
  }, [branding]);

  return <>{children}</>;
}
