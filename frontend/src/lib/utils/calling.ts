import { isDemoDataEnabled } from '@/lib/demo/config';
import { demoCallerName } from '@/lib/demo/callsFixture';
import type { CallSession } from '@/types';

export function resolveCallerName(
  session: Partial<CallSession>,
  cache: Map<string, string>,
): string {
  if (isDemoDataEnabled()) {
    return demoCallerName(session as CallSession);
  }
  const phone = session.customerPhone ?? '';
  return cache.get(phone) ?? session.agentLabel ?? phone ?? 'Unknown';
}
