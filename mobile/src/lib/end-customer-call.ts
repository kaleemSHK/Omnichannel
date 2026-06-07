import { cancelCustomerCall } from '@/api/customer';
import { navigationRef } from '@/navigation/navigationRef';
import { useCallsStore } from '@/store/calls';

export const TERMINAL_CALL_STATUSES = new Set(['abandoned', 'completed', 'cancelled']);

export function isTerminalCallStatus(status?: string | null): boolean {
  return TERMINAL_CALL_STATUSES.has(String(status ?? '').toLowerCase());
}

const endingCalls = new Set<string>();

/** Tear down SIP + ACD state and return customer to home. */
export async function endCustomerCallSession(opts: {
  callId?: string;
  hangup: () => void;
}) {
  const store = useCallsStore.getState();
  const callId = opts.callId ?? store.customerQueueCallId ?? store.activeCall?.roomId ?? null;
  const key = callId ? String(callId) : 'unknown';
  if (endingCalls.has(key)) return;
  endingCalls.add(key);

  try {
    opts.hangup();
    store.setActiveCall(null);
    store.setCustomerQueueCallId(null);

    if (callId) {
      try {
        await cancelCustomerCall(String(callId));
      } catch {
        /* best-effort */
      }
    }

    if (navigationRef.isReady()) {
      navigationRef.navigate('Customer', { screen: 'CustomerTabs', params: { screen: 'Home' } });
    }
  } finally {
    setTimeout(() => endingCalls.delete(key), 1500);
  }
}
