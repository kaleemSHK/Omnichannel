import { useEffect, useRef, useState } from 'react';
import { useCallsStore } from '@/store/calls';
import { navigate } from '@/navigation/navigationRef';
import { cancelCustomerCall } from '@/api/customer';
import { resolveAssignDialTarget } from '@/lib/utils/sip-target';

type AssignStatus = {
  status?: string;
  dialTarget?: string;
  agentId?: string;
};

const RETRY_MS = 1500;
const MAX_TRIES = 40;

export function useDialOnAssign(
  callId: string | undefined,
  status: AssignStatus | null,
  makeCall: (destination: string) => Promise<boolean>,
) {
  const sipRegistered = useCallsStore((s) => s.sipRegistered);
  const activeCall = useCallsStore((s) => s.activeCall);
  const [dialError, setDialError] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const makeCallRef = useRef(makeCall);
  makeCallRef.current = makeCall;
  const dialedForCallIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!callId) return;
    useCallsStore.getState().setCustomerQueueCallId(callId);
    return () => {
      useCallsStore.getState().setCustomerQueueCallId(null);
      dialedForCallIdRef.current = null;
    };
  }, [callId]);

  useEffect(() => {
    if (activeCall?.status === 'ringing' || activeCall?.status === 'connected') {
      navigate('CallActive');
    }
  }, [activeCall?.id, activeCall?.status]);

  useEffect(() => {
    if (status?.status !== 'assigned') {
      dialedForCallIdRef.current = null;
      setDialError(null);
      setConnecting(false);
      return;
    }

    if (callId && dialedForCallIdRef.current === callId) {
      return;
    }

    const dest = resolveAssignDialTarget(status);
    let tries = 0;
    let cancelled = false;
    setDialError(null);
    setConnecting(true);

    const attempt = async () => {
      if (cancelled) return;
      if (!useCallsStore.getState().sipRegistered) {
        if (tries >= MAX_TRIES) {
          setConnecting(false);
          setDialError('Phone not connected. Check network and try again.');
          if (callId) void cancelCustomerCall(callId).catch(() => {});
          return;
        }
        tries += 1;
        timer = setTimeout(() => void attempt(), RETRY_MS);
        return;
      }
      tries += 1;
      const ok = await makeCallRef.current(dest);
      if (ok) {
        if (callId) dialedForCallIdRef.current = callId;
        setConnecting(false);
        return;
      }
      if (tries >= MAX_TRIES) {
        setConnecting(false);
        setDialError('Could not connect. Check microphone permission and try again.');
        if (callId) void cancelCustomerCall(callId).catch(() => {});
        return;
      }
      timer = setTimeout(() => void attempt(), RETRY_MS);
    };

    let timer = setTimeout(() => void attempt(), 0);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [status?.status, status?.dialTarget, status?.agentId, callId]);

  return { dialError, connecting };
}
