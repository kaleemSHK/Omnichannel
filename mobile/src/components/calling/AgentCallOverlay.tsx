import { useEffect } from 'react';
import { View } from 'react-native';
import { useAuthStore } from '@/store/auth';
import { useCallsStore } from '@/store/calls';
import { subscribeToCallEvents } from '@/api/websocket';
import { randomId } from '@/lib/uuid';
import { navigationRef } from '@/navigation/navigationRef';
import { IncomingCallSheet } from './IncomingCallSheet';
import { ActiveCallBar } from './ActiveCallBar';

/** Global call UI — mounted on agent tabs so incoming calls surface on every screen. */
export function AgentCallOverlay() {
  const incomingCalls = useCallsStore((s) => s.incomingCalls);
  const activeCall = useCallsStore((s) => s.activeCall);
  const addIncomingCall = useCallsStore((s) => s.addIncomingCall);
  const setActiveCall = useCallsStore((s) => s.setActiveCall);
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    if (!user?.chatwootAccountId) return;
    return subscribeToCallEvents(user.chatwootAccountId, (evt) => {
      if (evt.eventType === 'call.ringing') {
        const session = evt.callSession as {
          id?: string;
          customerPhone?: string;
          agentLabel?: string;
        } | null;
        if (!session) return;
        addIncomingCall({
          callId: session.id ?? randomId(),
          callerName: session.agentLabel ?? session.customerPhone ?? 'Incoming call',
          callerNumber: session.customerPhone ?? 'unknown',
          startedAt: new Date().toISOString(),
        });
        navigationRef.navigate('CallActive');
        return;
      }
      if (evt.eventType === 'call.ended' || evt.eventType === 'call.missed') {
        setActiveCall(null);
      }
    });
  }, [user?.chatwootAccountId, addIncomingCall, setActiveCall]);

  if (!activeCall && incomingCalls.length === 0) return null;

  return (
    <View
      pointerEvents="box-none"
      style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 100 }}
    >
      {activeCall ? <ActiveCallBar /> : null}
      {incomingCalls.length > 0 ? <IncomingCallSheet /> : null}
    </View>
  );
}
