'use client';

import { useAuthStore } from '@/lib/store/auth';
import { useTenantAccountId } from '@/lib/hooks/useTenantAccountId';

/** String tenant id for gateway sidecars (billing, SLA, platform settings, etc.). */
export function useTenantId(): string {
  const accountId = useAuthStore(s => s.user?.chatwootAccountId);
  const tenantId = useAuthStore(s => s.user?.tenantId);
  return String(accountId ?? tenantId ?? '');
}

export function useTenantScope() {
  const accountId = useTenantAccountId();
  const tenantId = useTenantId();
  return { accountId, tenantId };
}

/** Non-hook helper for mutation callbacks / queryFn. */
export function tenantScopeFromStore(): { accountId: number; tenantId: string } {
  const user = useAuthStore.getState().user;
  const accountId = user?.chatwootAccountId ?? 0;
  return { accountId, tenantId: String(accountId || user?.tenantId || '') };
}
