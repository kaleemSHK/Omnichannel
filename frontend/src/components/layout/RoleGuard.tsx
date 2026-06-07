'use client';

import { useEffect, useLayoutEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { useAuthStore } from '@/lib/store/auth';
import { canAccessRoute, defaultRouteForRole } from '@/lib/rbac';
import { canAccessTenantFeatureRoute, firstAllowedRoute } from '@/lib/features/access';
import { useTenantFeatures } from '@/lib/hooks/useTenantFeatures';

export function RoleGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const user = useAuthStore(s => s.user);
  const tokens = useAuthStore(s => s.tokens);
  const hydrated = useAuthStore(s => s.hydrated);
  const hydrateFromSession = useAuthStore(s => s.hydrateFromSession);
  const { features, loaded: featuresLoaded } = useTenantFeatures();

  useLayoutEffect(() => {
    hydrateFromSession();
  }, [hydrateFromSession]);

  useEffect(() => {
    if (!hydrated) return;
    if (!tokens || !user) {
      router.replace('/login');
      return;
    }
    if (!canAccessRoute(user.role, pathname)) {
      router.replace(defaultRouteForRole(user.role));
      return;
    }
    if (
      featuresLoaded &&
      user.role !== 'platform_admin' &&
      !canAccessTenantFeatureRoute(pathname, features)
    ) {
      router.replace(firstAllowedRoute(features));
    }
  }, [hydrated, tokens, user, pathname, router, features, featuresLoaded]);

  if (!hydrated) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" aria-label="Loading" />
      </div>
    );
  }

  if (!tokens || !user) return null;

  return <>{children}</>;
}
