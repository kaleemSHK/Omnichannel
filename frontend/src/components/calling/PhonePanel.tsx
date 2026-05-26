'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Mic, MicOff, PauseCircle, Phone, PhoneOff } from 'lucide-react';
import { CallTimer } from '@/components/calling/CallTimer';
import { useAnswerCall, useDeclineCall } from '@/lib/hooks/useCalls';
import { useCallsStore } from '@/lib/store/calls';
import { useAuthStore } from '@/lib/store/auth';
import { isActionCableReady } from '@/lib/env/telephony';
import { subscribeToCallEvents } from '@/lib/api/websocket';
import {
  clearIncomingCallUi,
  normalizeCallEvent,
  presentIncomingCall,
} from '@/lib/calling/incoming-call-ui';
import { resolveCallerName } from '@/lib/utils/calling';
import { cn } from '@/lib/utils/cn';

function CallControls() {
  const setActiveCall = useCallsStore(s => s.setActiveCall);
  const muted = useCallsStore(s => s.muted);
  const held = useCallsStore(s => s.held);
  const sipControls = useCallsStore(s => s.sipControls);

  return (
    <div className="flex gap-2 justify-center">
      <button
        type="button"
        aria-label={muted ? 'Unmute microphone' : 'Mute microphone'}
        aria-pressed={muted}
        onClick={() => sipControls?.toggleMute()}
        className={cn(
          'w-10 h-10 rounded-full flex items-center justify-center',
          muted ? 'bg-brand-primary text-white' : 'bg-muted',
        )}
      >
        {muted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
      </button>
      <button
        type="button"
        aria-label={held ? 'Resume call' : 'Hold call'}
        aria-pressed={held}
        onClick={() => sipControls?.toggleHold()}
        className={cn(
          'w-10 h-10 rounded-full flex items-center justify-center',
          held ? 'bg-amber-100 text-amber-800' : 'bg-muted',
        )}
      >
        <PauseCircle className="w-4 h-4" />
      </button>
      <button
        type="button"
        aria-label="End call"
        onClick={() => {
          sipControls?.hangup();
          setActiveCall(null);
        }}
        className="w-10 h-10 rounded-full bg-red-500 text-white flex items-center justify-center"
      >
        <PhoneOff className="w-4 h-4" />
      </button>
    </div>
  );
}

export function PhonePanel() {
  const pathname = usePathname();
  const router = useRouter();
  const onCallingPage = pathname.startsWith('/calling');
  const { user } = useAuthStore();
  const activeCall = useCallsStore(s => s.activeCall);
  const setActiveCall = useCallsStore(s => s.setActiveCall);
  const sipControls = useCallsStore(s => s.sipControls);
  const contactCache = useCallsStore(s => s.contactCache);
  const answer = useAnswerCall();
  const decline = useDeclineCall();

  useEffect(() => {
    if (!user?.chatwootAccountId || !isActionCableReady()) return;

    return subscribeToCallEvents(user.chatwootAccountId, raw => {
      const { eventType, session } = normalizeCallEvent(
        raw as {
          eventType?: string;
          type?: string;
          callId?: string;
          callSession?: import('@/types').CallSession;
        },
      );

      if (!session?.id) return;

      if (eventType === 'call.ringing') {
        presentIncomingCall(session, {
          onAnswer: () => {
            sipControls?.answerCall();
            clearIncomingCallUi(session.id);
            answer.mutate(session.id, {
              onSuccess: s => setActiveCall(s),
              onError: () => setActiveCall(session),
            });
          },
          onDecline: () => {
            decline.mutate(session.id);
            clearIncomingCallUi(session.id);
          },
        });
        return;
      }

      if (
        eventType === 'call.ended' ||
        eventType === 'call.missed' ||
        eventType === 'call.connected'
      ) {
        clearIncomingCallUi(session.id);
        if (eventType === 'call.connected') {
          setActiveCall(session);
        }
      }
    });
  }, [user?.chatwootAccountId, answer, decline, setActiveCall, sipControls]);

  if (!activeCall) {
    if (onCallingPage) return null;
    return (
      <div className="fixed bottom-4 end-4 z-50">
        <button
          type="button"
          className="w-12 h-12 rounded-full bg-brand-primary text-white flex items-center justify-center shadow-lg hover:bg-brand-primary/90"
          aria-label="Open phone panel"
          onClick={() => router.push('/calling')}
        >
          <Phone className="w-5 h-5" />
        </button>
      </div>
    );
  }

  const contactName = resolveCallerName(activeCall, contactCache);

  return (
    <div className="fixed bottom-4 end-4 z-50 w-72 rounded-xl bg-white border shadow-xl p-4 space-y-3">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-green-100 text-green-700 flex items-center justify-center font-medium text-sm">
          {contactName.slice(0, 2).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-medium text-sm truncate">{contactName}</p>
          <p className="text-xs text-muted-foreground">{activeCall.customerPhone}</p>
        </div>
        <CallTimer
          startTime={activeCall.connectedAt ?? activeCall.startedAt}
          className="ms-auto font-mono text-brand-primary font-semibold shrink-0"
        />
      </div>
      <CallControls />
    </div>
  );
}
