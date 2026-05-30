'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { GripVertical, Mic, MicOff, PauseCircle, Phone, PhoneOff } from 'lucide-react';
import { endCall } from '@/lib/api/calls';
import { CallTimer } from '@/components/calling/CallTimer';
import { VoiceWaveform } from '@/components/calling/workspace/VoiceWaveform';
import { useCallsStore } from '@/lib/store/calls';
import { resolveCallerName } from '@/lib/utils/calling';
import { isDemoDataEnabled } from '@/lib/demo/config';
import { cn } from '@/lib/utils/cn';

/** Persistent mini call window when agent leaves /calling */
export function FloatingMiniCall() {
  const pathname = usePathname();
  const activeCall = useCallsStore(s => s.activeCall);
  const setActiveCall = useCallsStore(s => s.setActiveCall);
  const muted = useCallsStore(s => s.muted);
  const held = useCallsStore(s => s.held);
  const contactCache = useCallsStore(s => s.contactCache);
  const sipControls = useCallsStore(s => s.sipControls);

  if (!activeCall || activeCall.status !== 'connected') return null;
  if (pathname.startsWith('/calling')) return null;

  const name = resolveCallerName(activeCall, contactCache);

  const hangup = () => {
    sipControls?.hangup();
    if (!isDemoDataEnabled()) void endCall(activeCall.id).catch(() => undefined);
    setActiveCall(null);
  };

  return (
    <div
      className="fixed bottom-6 end-6 z-[100] w-[min(100vw-2rem,320px)] animate-cw-float-in"
      role="dialog"
      aria-label="Active call"
    >
      <div className="cw-glass cw-glow-ring cw-glow-ring-active rounded-2xl overflow-hidden shadow-2xl">
        <div className="flex items-center gap-2 px-3 py-2 border-b border-white/10 bg-white/5 cursor-grab">
          <GripVertical size={14} className="text-slate-500 shrink-0" aria-hidden />
          <span className="text-xs font-medium text-white truncate flex-1">{name}</span>
          <Link
            href="/calling"
            className="text-[10px] text-sky-400 hover:text-sky-300 font-semibold shrink-0"
          >
            Expand
          </Link>
        </div>

        <div className="p-3 space-y-3">
          <VoiceWaveform active={!muted && !held} className="h-8" />
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="truncate">{activeCall.customerPhone}</span>
            <CallTimer
              startTime={activeCall.connectedAt ?? activeCall.startedAt}
              className="tabular-nums text-white font-mono"
            />
          </div>
          <div className="flex justify-center gap-2">
            <button
              type="button"
              aria-label={muted ? 'Unmute' : 'Mute'}
              onClick={() => sipControls?.toggleMute()}
              className={cn(
                'w-9 h-9 rounded-full flex items-center justify-center border border-white/10',
                muted ? 'bg-amber-500/20 text-amber-200' : 'bg-white/5 text-slate-300 hover:bg-white/10',
              )}
            >
              {muted ? <MicOff size={16} /> : <Mic size={16} />}
            </button>
            <button
              type="button"
              aria-label={held ? 'Resume' : 'Hold'}
              onClick={() => sipControls?.toggleHold()}
              className="w-9 h-9 rounded-full flex items-center justify-center bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10"
            >
              <PauseCircle size={16} />
            </button>
            <Link
              href="/calling"
              className="w-9 h-9 rounded-full flex items-center justify-center bg-sky-600 text-white hover:bg-sky-500"
              aria-label="Open workspace"
            >
              <Phone size={16} />
            </Link>
            <button
              type="button"
              aria-label="End call"
              onClick={hangup}
              className="w-9 h-9 rounded-full flex items-center justify-center bg-rose-600 text-white hover:bg-rose-500"
            >
              <PhoneOff size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
