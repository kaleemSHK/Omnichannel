import { isDemoDataEnabled, shouldSkipGatewayFetch } from '@/lib/demo/config';

/**
 * Production calling / routing must never silently substitute fixture data.
 * Demo fixtures are opt-in only: NEXT_PUBLIC_USE_DEMO_DATA=true (local UI).
 */
export function isLiveCallingDataRequired(): boolean {
  return !isDemoDataEnabled();
}

/** Gateway-backed telephony queries (agents, queues, calls, wallboard REST). */
export function isLiveGatewayEnabled(): boolean {
  if (isDemoDataEnabled()) return false;
  return !shouldSkipGatewayFetch();
}
