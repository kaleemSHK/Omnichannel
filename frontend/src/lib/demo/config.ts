import { useAuthStore } from '@/lib/store/auth';

/**
 * When true, sidecar hooks return fixture data without calling the API.
 * Set NEXT_PUBLIC_USE_DEMO_DATA=true in .env.local for local UI work.
 */
export function isDemoDataEnabled(): boolean {
  return process.env.NEXT_PUBLIC_USE_DEMO_DATA === 'true';
}

/** Skip BlinkOne gateway calls (avoids 401 spam when JWT is missing or sidecars are down). */
export function shouldSkipGatewayFetch(): boolean {
  if (isDemoDataEnabled()) return true;
  return !useAuthStore.getState().tokens?.gatewayJwt;
}
