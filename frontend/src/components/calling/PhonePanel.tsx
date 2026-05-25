'use client';

import { useEffect, useRef } from 'react';
import { Mic, MicOff, PauseCircle, Phone, PhoneOff } from 'lucide-react';
import { searchContacts } from '@/lib/api/contacts';
import { CallTimer } from '@/components/calling/CallTimer';
import { showIncomingCallToast } from '@/components/calling/IncomingCallToast';
import { useCallsList, useAnswerCall, useDeclineCall } from '@/lib/hooks/useCalls';
import { useCallsStore } from '@/lib/store/calls';
import { useAuthStore } from '@/lib/store/auth';
import { isActionCableReady } from '@/lib/env/telephony';
import { subscribeToCallEvents } from '@/lib/api/websocket';
import { resolveCallerName } from '@/lib/utils/calling';
import { cn } from '@/lib/utils/cn';
import type { CallSession } from '@/types';

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
  const { user } = useAuthStore();
  const activeCall = useCallsStore(s => s.activeCall);
  const setActiveCall = useCallsStore(s => s.setActiveCall);
  const addIncoming = useCallsStore(s => s.addIncomingCall);
  const removeIncoming = useCallsStore(s => s.removeIncomingCall);
  const contactCache = useCallsStore(s => s.contactCache);
  const cacheContact = useCallsStore(s => s.cacheContact);
  const sipControls = useCallsStore(s => s.sipControls);
  const { data: calls = [] } = useCallsList();
  const answer = useAnswerCall();
  const decline = useDeclineCall();
  const toasted = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!user?.chatwootAccountId || !isActionCableReady()) return;
    return subscribeToCallEvents(user.chatwootAccountId, evt => {
      if (evt.eventType === 'call.ringing' && evt.callSession) {
        const session = evt.callSession as CallSession;
        addIncoming(session);
        if (toasted.current.has(session.id)) return;
        toasted.current.add(session.id);

        const cached = contactCache.get(session.customerPhone);
        if (cached) {
          showIncomingCallToast(
            { ...session, agentLabel: cached },
            {
              onAnswer: () => {
                answer.mutate(session.id, {
                  onSuccess: s => {
                    setActiveCall(s);
                    sipControls?.answerCall();
                    removeIncoming(session.id);
                  },
                });
              },
              onDecline: () => {
                decline.mutate(session.id);
                removeIncoming(session.id);
              },
            },
          );
          return;
        }

        void searchContacts(session.customerPhone).then(res => {
          const rows =
            (res as { payload?: { name?: string }[] }).payload ??
            (res as { data?: { name?: string }[] }).data ??
            [];
          const contactName = rows[0]?.name ?? session.customerPhone;
          cacheContact(session.customerPhone, contactName);
          showIncomingCallToast(
            { ...session, agentLabel: contactName },
            {
              onAnswer: () => {
                answer.mutate(session.id, {
                  onSuccess: s => {
                    setActiveCall(s);
                    sipControls?.answerCall();
                    removeIncoming(session.id);
                  },
                });
              },
              onDecline: () => {
                decline.mutate(session.id);
                removeIncoming(session.id);
              },
            },
          );
        });
      }
    });
  }, [
    user?.chatwootAccountId,
    addIncoming,
    removeIncoming,
    answer,
    decline,
    setActiveCall,
    sipControls,
    cacheContact,
    contactCache,
  ]);

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
              sipControls?.answerCall();
              removeIncoming(c.id);
            },
          });
        },
        onDecline: () => {
          decline.mutate(c.id);
          removeIncoming(c.id);
        },
      });
    }
  }, [calls, addIncoming, removeIncoming, answer, decline, setActiveCall, sipControls]);

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
          aria-label="Open phone panel"
          onClick={() => {
            window.location.href = '/calling';
          }}
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
