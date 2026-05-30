'use client';

import Link from 'next/link';
import type { ElementType } from 'react';
import {
  Mic,
  MicOff,
  Pause,
  PhoneForwarded,
  PhoneOff,
  Play,
  Radio,
  Sparkles,
} from 'lucide-react';
import { CallTimer } from '@/components/calling/CallTimer';
import { VoiceWaveform } from '@/components/calling/workspace/VoiceWaveform';
import { ConnectionQuality } from '@/components/calling/workspace/ConnectionQuality';
import { AiAssistStrip } from '@/components/calling/workspace/AiAssistStrip';
import { resolveCallerName } from '@/lib/utils/calling';
import { cn } from '@/lib/utils/cn';
import type { ActiveCall } from '@/lib/store/calls';

function ActionBtn({
  label,
  icon: Icon,
  onClick,
  active,
  destructive,
  accent,
}: {
  label: string;
  icon: ElementType;
  onClick?: () => void;
  active?: boolean;
  destructive?: boolean;
  accent?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'flex flex-col items-center gap-1.5 min-w-[4.5rem] py-3 px-2 rounded-xl border transition-all',
        'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10 hover:border-white/20',
        active && 'bg-sky-500/20 border-sky-400/40 text-sky-200',
        destructive && 'hover:bg-rose-500/20 hover:border-rose-400/40 text-rose-200',
        accent && 'bg-sky-600/30 border-sky-500/50 text-white',
      )}
    >
      <Icon size={20} aria-hidden />
      <span className="text-[10px] font-medium">{label}</span>
    </button>
  );
}

export function ActiveCallStage({
  call,
  contactCache,
  muted,
  held,
  sipRegistered,
  sipError,
  onMute,
  onHold,
  onTransfer,
  onHangup,
  onRecord,
}: {
  call: ActiveCall;
  contactCache: Map<string, string>;
  muted: boolean;
  held: boolean;
  sipRegistered: boolean;
  sipError: string | null;
  onMute: () => void;
  onHold: () => void;
  onTransfer: () => void;
  onHangup: () => void;
  onRecord: () => void;
}) {
  const name = resolveCallerName(call, contactCache);
  const connected = call.status === 'connected';
  const initials = name.slice(0, 2).toUpperCase();

  return (
    <div className="space-y-5 animate-cw-float-in">
      <div
        className={cn(
          'relative rounded-2xl p-6 cw-glass cw-glow-ring overflow-hidden',
          connected && 'cw-glow-ring-active',
        )}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-sky-600/10 via-transparent to-violet-600/10 pointer-events-none" />

        <div className="relative flex flex-col items-center text-center gap-4">
          <div className="relative">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-sky-500 to-indigo-600 flex items-center justify-center text-2xl font-bold text-white shadow-lg">
              {initials}
            </div>
            {connected && (
              <span className="absolute -bottom-0.5 -end-0.5 w-4 h-4 rounded-full bg-emerald-400 border-2 border-slate-900" />
            )}
          </div>

          <div>
            <h2 className="text-xl font-semibold text-white">{name}</h2>
            <p className="text-sm text-slate-400 mt-0.5">{call.customerPhone}</p>
          </div>

          <VoiceWaveform active={connected && !held && !muted} />

          <div className="flex items-center gap-4 flex-wrap justify-center">
            {connected ? (
              <CallTimer
                startTime={call.connectedAt ?? call.startedAt}
                className="text-3xl font-light tabular-nums text-white tracking-tight"
              />
            ) : (
              <span className="text-sm text-amber-300 animate-pulse">Ringing…</span>
            )}
            <ConnectionQuality registered={sipRegistered} error={sipError} />
          </div>

          <div className="flex flex-wrap gap-2 justify-center">
            {held && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-200 border border-amber-500/30">
                On hold
              </span>
            )}
            {muted && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-500/30 text-slate-300 border border-white/10">
                Muted
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap justify-center gap-2">
        <ActionBtn
          label={muted ? 'Unmute' : 'Mute'}
          icon={muted ? MicOff : Mic}
          active={muted}
          onClick={onMute}
        />
        <ActionBtn
          label={held ? 'Resume' : 'Hold'}
          icon={held ? Play : Pause}
          active={held}
          onClick={onHold}
        />
        <ActionBtn label="Transfer" icon={PhoneForwarded} onClick={onTransfer} />
        <ActionBtn label="Record" icon={Radio} onClick={onRecord} />
        <ActionBtn
          label="AI assist"
          icon={Sparkles}
          accent
          onClick={() => undefined}
        />
        <ActionBtn label="End" icon={PhoneOff} destructive onClick={onHangup} />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Link
          href="/tickets"
          className="text-center text-xs py-2.5 rounded-xl border border-white/10 text-slate-300 hover:bg-white/5 transition-colors"
        >
          Open ticket
        </Link>
        <Link
          href="/contacts"
          className="text-center text-xs py-2.5 rounded-xl border border-white/10 text-slate-300 hover:bg-white/5 transition-colors"
        >
          Open CRM
        </Link>
      </div>

      <AiAssistStrip />
    </div>
  );
}
