'use client';

import { useEffect, useLayoutEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { useAuthStore } from '@/lib/store/auth';
import { canAccessRoute } from '@/lib/rbac';

export function RoleGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const user = useAuthStore(s => s.user);
  const tokens = useAuthStore(s => s.tokens);
  const hydrated = useAuthStore(s => s.hydrated);
  const hydrateFromSession = useAuthStore(s => s.hydrateFromSession);

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
      router.replace('/conversations');
    }
  }, [hydrated, tokens, user, pathname, router]);

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
