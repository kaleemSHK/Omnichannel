'use client';

import { Phone, PhoneIncoming, PhoneMissed, PhoneOff } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { demoCallerName } from '@/lib/demo/callsFixture';
import type { CallSession } from '@/types';

function initials(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function avatarClass(transport: string) {
  if (transport === 'whatsapp') return 'bg-[#e1f5ee] text-[#0f6e56]';
  if (transport === 'pstn') return 'bg-[#faeeda] text-[#854f0b]';
  if (transport === 'webrtc') return 'bg-[#e6f1fb] text-[#185fa5]';
  return 'bg-gray-100 text-gray-600';
}

interface Props {
  call: CallSession;
  active?: boolean;
  displayName?: string;
  onSelect?: () => void;
  onAnswer?: () => void;
  onDecline?: () => void;
}

export function CallListRow({ call, active, displayName, onSelect, onAnswer, onDecline }: Props) {
  const name = displayName ?? demoCallerName(call);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={e => e.key === 'Enter' && onSelect?.()}
      className={cn(
        'flex gap-2.5 px-3.5 py-2 cursor-pointer border-s-[3px] border-s-transparent',
        call.status === 'ringing' && 'border-s-[#e24b4a] animate-pulse',
        active && 'bg-[#0B5FFF]/10 border-s-[#0B5FFF]',
        !active && call.status !== 'ringing' && 'hover:bg-gray-50',
      )}
    >
      <div
        className={cn(
          'size-8 shrink-0 rounded-full flex items-center justify-center text-xs font-medium',
          avatarClass(call.transport),
        )}
      >
        {initials(name)}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-medium text-gray-900 truncate">{name}</p>
        <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
          {call.status === 'ringing' && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-[#fcebeb] text-[#a32d2d]">
              <PhoneIncoming size={10} /> ringing
            </span>
          )}
          {call.status === 'connected' && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-[#eaf3de] text-[#3b6d11]">
              live
            </span>
          )}
          {call.status === 'missed' && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-[#faeeda] text-[#854f0b]">
              <PhoneMissed size={10} /> missed
            </span>
          )}
          {call.status === 'ended' && (
            <span className="px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-[#f1efe8] text-[#5f5e5a]">
              ended
            </span>
          )}
        </div>
        {call.status === 'ringing' && (
          <div className="flex gap-1 mt-1.5" onClick={e => e.stopPropagation()}>
            <button
              type="button"
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium bg-[#eaf3de] text-[#3b6d11] border border-[#c0dd97]"
              onClick={onAnswer}
            >
              <Phone size={10} /> Answer
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium bg-[#fcebeb] text-[#a32d2d] border border-[#f7c1c1]"
              onClick={onDecline}
            >
              <PhoneOff size={10} /> Decline
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
