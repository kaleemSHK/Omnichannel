'use client';

import { useEffect, useRef, useState } from 'react';
import { Mic, MicOff, PauseCircle, Phone, PhoneOff } from 'lucide-react';
import { searchContacts } from '@/lib/api/contacts';
import { useJsSip } from '@/lib/hooks/useJsSip';
import { useCallsList, useAnswerCall, declineCall } from '@/lib/hooks/useCalls';
import { useCallsStore } from '@/lib/store/calls';
import { useAuthStore } from '@/lib/store/auth';
import { subscribeToCallEvents } from '@/lib/api/websocket';
import { showIncomingCallToast } from '@/components/calling/IncomingCallToast';
import { demoCallerName } from '@/lib/demo/callsFixture';
import { cn } from '@/lib/utils/cn';
import type { CallSession } from '@/types';

function CallTimer({ startTime, className }: { startTime: string; className?: string }) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const start = new Date(startTime).getTime();
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - start) / 1000)), 1000);
    return () => clearInterval(id);
  }, [startTime]);
  const mm = String(Math.floor(elapsed / 60)).padStart(2, '0');
  const ss = String(elapsed % 60).padStart(2, '0');
  return <span className={className}>{mm}:{ss}</span>;
}

function CallControls() {
  const { mute, unmute, hold, hangup } = useJsSip();
  const setActiveCall = useCallsStore(s => s.setActiveCall);
  const [muted, setMuted] = useState(false);

  return (
    <div className="flex gap-2 justify-center">
      <button
        type="button"
        onClick={() => {
          if (muted) unmute();
          else mute();
          setMuted(m => !m);
        }}
        className={cn(
          'w-10 h-10 rounded-full flex items-center justify-center',
          muted ? 'bg-brand-primary text-white' : 'bg-muted',
        )}
      >
        {muted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
      </button>
      <button
        type="button"
        onClick={() => hold()}
        className="w-10 h-10 rounded-full bg-muted flex items-center justify-center"
      >
        <PauseCircle className="w-4 h-4" />
      </button>
      <button
        type="button"
        onClick={() => {
          hangup();
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
  useJsSip();
  const { user } = useAuthStore();
  const activeCall = useCallsStore(s => s.activeCall);
  const setActiveCall = useCallsStore(s => s.setActiveCall);
  const addIncoming = useCallsStore(s => s.addIncomingCall);
  const removeIncoming = useCallsStore(s => s.removeIncomingCall);
  const { data: calls = [] } = useCallsList();
  const answer = useAnswerCall();
  const { answerCall: sipAnswer } = useJsSip();
  const toasted = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!user?.chatwootAccountId) return;
    return subscribeToCallEvents(user.chatwootAccountId, evt => {
      if (evt.eventType === 'call.ringing' && evt.callSession) {
        const session = evt.callSession as CallSession;
        addIncoming(session);
        if (toasted.current.has(session.id)) return;
        toasted.current.add(session.id);
        void searchContacts(session.customerPhone).then(res => {
          const rows =
            (res as { payload?: { name?: string }[] }).payload ??
            (res as { data?: { name?: string }[] }).data ??
            [];
          const contactName = rows[0]?.name ?? session.customerPhone;
          showIncomingCallToast(
            { ...session, agentLabel: contactName },
            {
              onAnswer: () => {
                answer.mutate(session.id, {
                  onSuccess: s => {
                    setActiveCall(s);
                    sipAnswer();
                    removeIncoming(session.id);
                  },
                });
              },
              onDecline: () => {
                void declineCall(session.id);
                removeIncoming(session.id);
              },
            },
          );
        });
      }
    });
  }, [user?.chatwootAccountId, addIncoming, removeIncoming, answer, setActiveCall, sipAnswer]);

  useEffect(() => {
    for (const c of calls.filter(x => x.status === 'ringing')) {
      if (toasted.current.has(c.id)) continue;
      toasted.current.add(c.id);
      addIncoming(c);
      showIncomingCallToast(c, {
        onAnswer: () => {
          answer.mutate(c.id, {
            onSuccess: session => {
              setActiveCall(session);
              sipAnswer();
              removeIncoming(c.id);
            },
          });
        },
        onDecline: () => {
          void declineCall(c.id);
          removeIncoming(c.id);
        },
      });
    }
  }, [calls, addIncoming, removeIncoming, answer, setActiveCall, sipAnswer]);

  useEffect(() => {
    const live = calls.find(c => c.status === 'connected');
    if (live && !activeCall) setActiveCall(live);
  }, [calls, activeCall, setActiveCall]);

  if (!activeCall) {
    return (
      <div className="fixed bottom-4 end-4 z-50">
        <button
          type="button"
          className="w-12 h-12 rounded-full bg-brand-primary text-white flex items-center justify-center shadow-lg hover:bg-brand-primary/90"
          aria-label="Phone"
        >
          <Phone className="w-5 h-5" />
        </button>
      </div>
    );
  }

  const contactName = demoCallerName(activeCall);
  const remoteNumber = activeCall.customerPhone;

  return (
    <div className="fixed bottom-4 end-4 z-50 w-72 rounded-xl bg-white border shadow-xl p-4 space-y-3">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-green-100 text-green-700 flex items-center justify-center font-medium text-sm">
          {contactName.slice(0, 2).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-medium text-sm truncate">{contactName}</p>
          <p className="text-xs text-muted-foreground">{remoteNumber}</p>
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
