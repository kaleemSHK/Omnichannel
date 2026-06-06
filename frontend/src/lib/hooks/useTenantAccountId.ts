import { useAuthStore } from '@/lib/store/auth';

/** Chatwoot account id for the logged-in tenant (settings API scope). */
export function useTenantAccountId(): number {
  return useAuthStore(s => s.user?.chatwootAccountId ?? 0);
}
