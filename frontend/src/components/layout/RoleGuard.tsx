'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuthStore } from '@/lib/store/auth';
import { canAccessRoute, defaultRouteForRole } from '@/lib/rbac';

export function RoleGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, tokens } = useAuthStore();

  useEffect(() => {
    if (!tokens || !user) {
      router.replace('/login');
      return;
    }
    if (!canAccessRoute(user.role, pathname)) {
      router.replace(defaultRouteForRole(user.role));
    }
  }, [tokens, user, pathname, router]);

  if (!tokens || !user) return null;

  return <>{children}</>;
}
