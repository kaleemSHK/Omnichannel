import { useEffect, useRef, useState, useCallback } from 'react';
import { getCustomerCallStatus, type CustomerCallRouteStatus } from '@/api/customer';
import { getCallRouteStatus } from '@/api/routing';
import { isTerminalCallStatus } from '@/lib/end-customer-call';

const POLL_MS = 2000;

type Options = {
  callId: string;
  mode: 'customer' | 'agent';
  enabled?: boolean;
  onAssigned?: (status: CustomerCallRouteStatus) => void;
  onEnded?: (status: CustomerCallRouteStatus) => void;
};

export function useCallQueue({ callId, mode, enabled = true, onAssigned, onEnded }: Options) {
  const [status, setStatus] = useState<CustomerCallRouteStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ended, setEnded] = useState(false);
  const onAssignedRef = useRef(onAssigned);
  const onEndedRef = useRef(onEnded);
  onAssignedRef.current = onAssigned;
  onEndedRef.current = onEnded;
  const assignedNotifiedRef = useRef(false);
  const endedNotifiedRef = useRef(false);

  const poll = useCallback(async () => {
    if (!callId || ended) return;
    try {
      const next =
        mode === 'customer'
          ? await getCustomerCallStatus(callId)
          : (await getCallRouteStatus(callId)) as CustomerCallRouteStatus;
      setStatus(next);
      setError(null);

      if (isTerminalCallStatus(next.status)) {
        if (!endedNotifiedRef.current) {
          endedNotifiedRef.current = true;
          setEnded(true);
          onEndedRef.current?.(next);
        }
        return;
      }

      if (next.status === 'assigned' && !assignedNotifiedRef.current) {
        assignedNotifiedRef.current = true;
        onAssignedRef.current?.(next);
      } else if (next.status !== 'assigned') {
        assignedNotifiedRef.current = false;
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Queue update failed';
      if (msg.includes('502') || msg.includes('503')) {
        setError('Updating queue… (retrying)');
      } else {
        setError(msg);
      }
    }
  }, [callId, mode, ended]);

  useEffect(() => {
    if (!enabled || !callId || ended) return;
    void poll();
    const id = setInterval(() => void poll(), POLL_MS);
    return () => clearInterval(id);
  }, [enabled, callId, poll, ended]);

  return { status, error, ended, refresh: poll };
}
