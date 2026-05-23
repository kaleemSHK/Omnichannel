'use client';

import { useEffect, useState } from 'react';
import { Mic, MicOff, PauseCircle, PhoneOff } from 'lucide-react';
import { endCall } from '@/lib/api/calls';
import { demoCallerName } from '@/lib/demo/callsFixture';
import { useJsSip } from '@/lib/hooks/useJsSip';
import { useCallsStore } from '@/lib/store/calls';
import { cn } from '@/lib/utils/cn';

function CallTimer({ startTime, className }: { startTime: string; className?: string }) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const start = new Date(startTime).getTime();
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - start) / 1000)), 1000);
    return () => clearInterval(id);
  }, [startTime]);
  const mm = String(Math.floor(elapsed / 60)).padStart(2, '0');
  const ss = String(elapsed % 60).padStart(2, '0');
  return (
    <span className={className}>
      {mm}:{ss}
    </span>
  );
}

/** Top bar when a call is active — reads from calls store. */
export function ActiveCallBar() {
  const activeCall = useCallsStore(s => s.activeCall);
  const setActiveCall = useCallsStore(s => s.setActiveCall);
  const { hangup, mute, unmute, hold } = useJsSip();
  const [muted, setMuted] = useState(false);

  if (!activeCall || activeCall.status !== 'connected') return null;

  const name = demoCallerName(activeCall);
  const number = activeCall.customerPhone;

  const handleHangup = () => {
    hangup();
    void endCall(activeCall.id).catch(() => undefined);
    setActiveCall(null);
  };

  return (
    <div className="h-10 bg-green-600 text-white flex items-center gap-4 px-4 text-sm shrink-0">
      <div className="w-2 h-2 rounded-full bg-white animate-pulse shrink-0" />
      <span className="font-medium truncate">{name}</span>
      <span className="text-green-100 text-xs hidden sm:inline">{number}</span>
      <CallTimer
        startTime={activeCall.connectedAt ?? activeCall.startedAt}
        className="font-mono tabular-nums"
      />
      <div className="ms-auto flex gap-1.5 shrink-0">
        <button
          type="button"
          title="Mute"
          onClick={() => {
            if (muted) unmute();
            else mute();
            setMuted(m => !m);
          }}
          className={cn(
            'w-7 h-7 rounded-full flex items-center justify-center',
            muted ? 'bg-white/30' : 'bg-white/10 hover:bg-white/20',
          )}
        >
          {muted ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
        </button>
        <button
          type="button"
          title="Hold"
          onClick={() => hold()}
          className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center"
        >
          <PauseCircle className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          title="End call"
          onClick={handleHangup}
          className="w-7 h-7 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center"
        >
          <PhoneOff className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
