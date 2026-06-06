import { useEffect, useRef, useState, useCallback } from 'react';
import { getCustomerCallStatus, type CustomerCallRouteStatus } from '@/api/customer';
import { getCallRouteStatus } from '@/api/routing';

const POLL_MS = 2000;

type Options = {
  callId: string;
  mode: 'customer' | 'agent';
  enabled?: boolean;
  onAssigned?: (status: CustomerCallRouteStatus) => void;
};

export function useCallQueue({ callId, mode, enabled = true, onAssigned }: Options) {
  const [status, setStatus] = useState<CustomerCallRouteStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const onAssignedRef = useRef(onAssigned);
  onAssignedRef.current = onAssigned;
  const assignedNotifiedRef = useRef(false);

  const poll = useCallback(async () => {
    if (!callId) return;
    try {
      const next =
        mode === 'customer'
          ? await getCustomerCallStatus(callId)
          : (await getCallRouteStatus(callId)) as CustomerCallRouteStatus;
      setStatus(next);
      setError(null);
      if (next.status === 'assigned' && !assignedNotifiedRef.current) {
        assignedNotifiedRef.current = true;
        onAssignedRef.current?.(next);
      } else if (next.status !== 'assigned') {
        assignedNotifiedRef.current = false;
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Queue update failed';
      // Keep last good status visible; show a softer hint after transient gateway errors.
      if (msg.includes('502') || msg.includes('503')) {
        setError('Updating queue… (retrying)');
      } else {
        setError(msg);
      }
    }
  }, [callId, mode]);

  useEffect(() => {
    if (!enabled || !callId) return;
    void poll();
    const id = setInterval(() => void poll(), POLL_MS);
    return () => clearInterval(id);
  }, [enabled, callId, poll]);

  return { status, error, refresh: poll };
}
