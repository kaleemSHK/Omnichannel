'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { CheckCircle, Mic, MicOff, PauseCircle, Phone, PhoneOff, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { CallTimer } from '@/components/calling/CallTimer';
import { useDeclineCall } from '@/lib/hooks/useCalls';
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
import {
  answerCall,
  pauseCallRecording,
  resumeCallRecording,
  reportMosSample,
  type MosResult,
} from '@/lib/api/calls';
import { unlockSipAudio } from '@/lib/telephony/sip-audio';

function CallControls({ callId }: { callId?: string }) {
  const setActiveCall = useCallsStore(s => s.setActiveCall);
  const muted = useCallsStore(s => s.muted);
  const held = useCallsStore(s => s.held);
  const sipControls = useCallsStore(s => s.sipControls);

  // PCI secure payment mode — pauses recording during card data collection
  const [pciPaused, setPciPaused] = useState(false);
  const [pciPending, setPciPending] = useState(false);

  const togglePciPause = useCallback(async () => {
    if (!callId || pciPending) return;
    setPciPending(true);
    try {
      if (pciPaused) {
        await resumeCallRecording(callId);
        setPciPaused(false);
        toast.success('Recording resumed');
      } else {
        await pauseCallRecording(callId);
        setPciPaused(true);
        toast.info('Recording paused — secure payment mode active', { duration: 4000 });
      }
    } catch {
      toast.error('Failed to update recording state');
    } finally {
      setPciPending(false);
    }
  }, [callId, pciPaused, pciPending]);

  return (
    <div className="space-y-2">
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

      {/* PCI secure payment mode toggle — only shown during active calls */}
      {callId && (
        <div className="flex justify-center">
          <button
            type="button"
            aria-label={pciPaused ? 'Resume recording (exit secure payment mode)' : 'Pause recording for secure payment'}
            aria-pressed={pciPaused}
            onClick={togglePciPause}
            disabled={pciPending}
            title={pciPaused ? 'Recording paused — PCI mode active. Click to resume.' : 'Pause recording for card payment (PCI DSS)'}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all',
              pciPaused
                ? 'bg-amber-500 text-white animate-pulse'
                : 'bg-muted text-muted-foreground hover:bg-amber-50 hover:text-amber-700',
              pciPending && 'opacity-50 cursor-not-allowed',
            )}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            {pciPaused ? 'Secure Mode ON — tap to resume' : 'Secure Payment Mode'}
          </button>
        </div>
      )}
    </div>
  );
}

/** Small MOS quality badge — color-coded per ITU-T P.800 grade */
function MosBadge({ mos }: { mos: MosResult }) {
  return (
    <div
      className="flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
      style={{ backgroundColor: mos.color + '22', color: mos.color }}
      title={`Voice quality: ${mos.label} (MOS ${mos.mos})`}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: mos.color }} />
      {mos.label} {mos.mos.toFixed(1)}
    </div>
  );
}

const ACW_DURATION_S = 60;

function AcwPanel() {
  const acwCall = useCallsStore(s => s.acwCall);
  const setAcwCall = useCallsStore(s => s.setAcwCall);
  const [remaining, setRemaining] = useState(ACW_DURATION_S);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!acwCall) return;
    setRemaining(ACW_DURATION_S);
    timerRef.current = setInterval(() => {
      setRemaining(r => {
        if (r <= 1) {
          clearInterval(timerRef.current!);
          setAcwCall(null);
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [acwCall, setAcwCall]);

  if (!acwCall) return null;

  return (
    <div className="fixed bottom-4 end-4 z-50 w-72 rounded-xl bg-purple-50 border border-purple-200 shadow-xl p-4 space-y-3">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center">
          <CheckCircle className="w-4 h-4" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-medium text-purple-900">After-Call Work</p>
          <p className="text-xs text-purple-600">Complete wrap-up notes</p>
        </div>
        <span className="font-mono text-lg font-bold text-purple-700">{remaining}s</span>
      </div>
      <div className="h-1.5 rounded-full bg-purple-100 overflow-hidden">
        <div
          className="h-full bg-purple-500 transition-all duration-1000"
          style={{ width: `${(remaining / ACW_DURATION_S) * 100}%` }}
        />
      </div>
      <button
        type="button"
        onClick={() => { clearInterval(timerRef.current!); setAcwCall(null); }}
        className="w-full py-1.5 rounded-lg text-xs font-medium bg-purple-600 text-white hover:bg-purple-700 transition-colors"
      >
        Done — Ready for next call
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
  const acwCall = useCallsStore(s => s.acwCall);
  const setActiveCall = useCallsStore(s => s.setActiveCall);
  const sipControls = useCallsStore(s => s.sipControls);
  const contactCache = useCallsStore(s => s.contactCache);
  const decline = useDeclineCall();

  const callHandlersRef = useRef({ decline, setActiveCall, sipControls });
  callHandlersRef.current = { decline, setActiveCall, sipControls };

  // MOS voice quality polling — every 5s during connected call
  const [mosResult, setMosResult] = useState<MosResult | null>(null);

  useEffect(() => {
    if (!activeCall?.id || activeCall.status !== 'connected') {
      setMosResult(null);
      return;
    }
    const sampleMos = async () => {
      try {
        // Collect WebRTC stats from JsSIP session if available
        const stats = sipControls?.getRtpStats?.() ?? {};
        const result = await reportMosSample(activeCall.id, stats);
        setMosResult(result);
      } catch {
        // Non-fatal — MOS display degrades gracefully
      }
    };
    sampleMos();
    const interval = setInterval(sampleMos, 5000);
    return () => clearInterval(interval);
  }, [activeCall?.id, activeCall?.status, sipControls]);

  useEffect(() => {
    if (!user?.chatwootAccountId || !isActionCableReady()) return;

    return subscribeToCallEvents(user.chatwootAccountId, raw => {
      const { decline, setActiveCall, sipControls } = callHandlersRef.current;
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
        const displayName = resolveCallerName(session, useCallsStore.getState().contactCache);
        if (session.customerPhone && displayName) {
          useCallsStore.getState().cacheContact(session.customerPhone, displayName);
        }
        presentIncomingCall(session, {
          onAnswer: () => {
            void unlockSipAudio();
            sipControls?.answerCall();
            clearIncomingCallUi(session.id);
            void answerCall(session.id, session.roomId)
              .then(s => setActiveCall(s))
              .catch(() =>
                setActiveCall({ ...session, status: 'connected', connectedAt: new Date().toISOString() }),
              );
          },
          onDecline: () => {
            decline.mutate(session.id);
            clearIncomingCallUi(session.id);
          },
        });
        return;
      }

      if (eventType === 'call.ended' || eventType === 'call.missed') {
        clearIncomingCallUi(session.id);
        sipControls?.hangup();
        return;
      }

      if (eventType === 'call.connected') {
        clearIncomingCallUi(session.id);
        setActiveCall(session);
      }
    });
    // Subscribe once per account; handlers are read from a ref to avoid churn.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.chatwootAccountId]);

  if (!activeCall) {
    if (acwCall) return <AcwPanel />;
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

      {/* MOS voice quality indicator */}
      {mosResult && (
        <div className="flex justify-end">
          <MosBadge mos={mosResult} />
        </div>
      )}

      <CallControls callId={activeCall.id} />
    </div>
  );
}
