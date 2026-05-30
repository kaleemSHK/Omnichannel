'use client';

import { Phone, PhoneOff } from 'lucide-react';
import { resolveCallerName } from '@/lib/utils/calling';
import { VoiceWaveform } from '@/components/calling/workspace/VoiceWaveform';
import type { ActiveCall } from '@/lib/store/calls';

export function IncomingCallHero({
  call,
  contactCache,
  onAnswer,
  onDecline,
}: {
  call: ActiveCall;
  contactCache: Map<string, string>;
  onAnswer: () => void;
  onDecline: () => void;
}) {
  const name = resolveCallerName(call, contactCache);

  return (
    <div className="relative rounded-2xl overflow-hidden animate-cw-float-in">
      <div className="absolute inset-0 bg-gradient-to-br from-emerald-600/30 via-slate-900 to-sky-900/40" />
      <div className="absolute inset-0 animate-pulse bg-emerald-500/5" />

      <div className="relative cw-glass border-emerald-500/30 p-8 text-center space-y-6">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300">
          Incoming call
        </p>

        <div className="mx-auto w-24 h-24 rounded-full bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center text-3xl font-bold text-white shadow-xl ring-4 ring-emerald-400/30">
          {name.slice(0, 2).toUpperCase()}
        </div>

        <div>
          <h2 className="text-2xl font-semibold text-white">{name}</h2>
          <p className="text-slate-400 mt-1">{call.customerPhone}</p>
          <p className="text-[10px] text-slate-500 mt-3">
            AI preview: returning customer · 2 open tickets
          </p>
        </div>

        <VoiceWaveform active />

        <div className="flex justify-center gap-6 pt-2">
          <button
            type="button"
            onClick={onDecline}
            className="flex flex-col items-center gap-2 group"
            aria-label="Decline"
          >
            <span className="w-16 h-16 rounded-full bg-rose-500/20 border-2 border-rose-400/50 flex items-center justify-center text-rose-300 group-hover:bg-rose-500/40 transition-all group-active:scale-95">
              <PhoneOff size={28} />
            </span>
            <span className="text-xs text-slate-400">Decline</span>
          </button>
          <button
            type="button"
            onClick={onAnswer}
            className="flex flex-col items-center gap-2 group"
            aria-label="Answer"
          >
            <span className="w-16 h-16 rounded-full bg-emerald-500 flex items-center justify-center text-white shadow-lg shadow-emerald-500/40 group-hover:scale-105 transition-transform group-active:scale-95">
              <Phone size={28} />
            </span>
            <span className="text-xs text-emerald-300 font-medium">Swipe up · Answer</span>
          </button>
        </div>

        <p className="text-[10px] text-slate-500">
          <kbd className="px-1.5 py-0.5 rounded bg-white/10 font-mono">Space</kbd> answer ·{' '}
          <kbd className="px-1.5 py-0.5 rounded bg-white/10 font-mono">Esc</kbd> decline
        </p>
      </div>
    </div>
  );
}
