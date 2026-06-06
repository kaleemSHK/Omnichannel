'use client';

import { Mic, MicOff, PauseCircle, PhoneOff } from 'lucide-react';
import { CallTimer } from '@/components/calling/CallTimer';
import { useCallsStore } from '@/lib/store/calls';
import { resolveCallerName } from '@/lib/utils/calling';
import { cn } from '@/lib/utils/cn';

export function ActiveCallBar() {
  const activeCall = useCallsStore(s => s.activeCall);
  const muted = useCallsStore(s => s.muted);
  const held = useCallsStore(s => s.held);
  const contactCache = useCallsStore(s => s.contactCache);
  const sipControls = useCallsStore(s => s.sipControls);

  if (!activeCall || activeCall.status !== 'connected') return null;

  const displayName = resolveCallerName(activeCall, contactCache);

  const handleHangup = () => {
    sipControls?.hangup();
  };

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Active call"
      className={cn(
        'h-10 text-white flex items-center gap-4 px-4 text-sm shrink-0 transition-colors',
        held ? 'bg-amber-600' : 'bg-green-600',
      )}
    >
      <div className="w-2 h-2 rounded-full bg-white animate-pulse shrink-0" aria-hidden />
      <span className="font-medium truncate">{displayName}</span>
      <span className="text-white/70 text-xs hidden sm:inline">{activeCall.customerPhone}</span>
      <CallTimer
        startTime={activeCall.connectedAt ?? activeCall.startedAt}
        className="font-mono tabular-nums text-xs"
      />
      {held && (
        <span className="text-xs font-medium bg-white/20 px-2 py-0.5 rounded">On Hold</span>
      )}
      <div className="ms-auto flex gap-1.5 shrink-0">
        <button
          type="button"
          aria-label={muted ? 'Unmute microphone' : 'Mute microphone'}
          aria-pressed={muted}
          onClick={() => sipControls?.toggleMute()}
          className={cn(
            'w-7 h-7 rounded-full flex items-center justify-center',
            muted ? 'bg-white/30' : 'bg-white/10 hover:bg-white/20',
          )}
        >
          {muted ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
        </button>
        <button
          type="button"
          aria-label={held ? 'Resume call' : 'Hold call'}
          aria-pressed={held}
          onClick={() => sipControls?.toggleHold()}
          className={cn(
            'w-7 h-7 rounded-full flex items-center justify-center',
            held ? 'bg-white/30' : 'bg-white/10 hover:bg-white/20',
          )}
        >
          <PauseCircle className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          aria-label="End call"
          onClick={handleHangup}
          className="w-7 h-7 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center"
        >
          <PhoneOff className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
