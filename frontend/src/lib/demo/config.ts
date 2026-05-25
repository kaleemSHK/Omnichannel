import { useAuthStore } from '@/lib/store/auth';

let gatewayAuthFailed = false;

/** Call after login so gateway queries can run again. */
export function resetGatewayAuthFailed() {
  gatewayAuthFailed = false;
}

/** Stop gateway polling after the first 401/403 (invalid or expired JWT). */
export function markGatewayAuthFailed() {
  gatewayAuthFailed = true;
}

export function isGatewayAuthFailed(): boolean {
  return gatewayAuthFailed;
}

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
  if (gatewayAuthFailed) return true;
  return !useAuthStore.getState().tokens?.gatewayJwt;
}

/** React Query `enabled` for gateway-backed queries. */
export function isGatewayQueryEnabled(): boolean {
  return isDemoDataEnabled() || !shouldSkipGatewayFetch();
}
