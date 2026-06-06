'use client';

import { useRef, useState, type ReactNode } from 'react';
import { ArrowDownLeft, ArrowUpRight, Play, Pause, Voicemail } from 'lucide-react';
import { toast } from 'sonner';
import { fetchRecordingAudioBlob } from '@/lib/api/recording';
import { useCallsStore } from '@/lib/store/calls';
import {
  resolveCallerName,
  resolveCdrAgentName,
  resolveCdrCallerName,
  transportLabel,
} from '@/lib/utils/calling';
import { cn } from '@/lib/utils/cn';
import type { CallSession, CDRRecord } from '@/types';
import type { RoutingAgent } from '@/types';

function formatDuration(sec: number): string {
  if (!sec || sec < 0) return '0:00';
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function formatWhen(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function outcomeLabel(outcome: string): { text: string; cls: string } {
  const o = (outcome || '').toLowerCase();
  if (o === 'completed' || o === 'answered' || o === 'ended')
    return { text: 'Completed', cls: 'bg-green-100 text-green-800' };
  if (o === 'missed' || o === 'timeout' || o === 'no_answer')
    return { text: o === 'timeout' ? 'No answer' : 'Missed', cls: 'bg-red-100 text-red-700' };
  if (o === 'declined' || o === 'rejected')
    return { text: 'Declined', cls: 'bg-orange-100 text-orange-800' };
  return { text: outcome || 'Unknown', cls: 'bg-gray-100 text-gray-600' };
}

function DetailRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-2 border-b border-gray-50 last:border-0 text-sm">
      <span className="text-gray-500 shrink-0">{label}</span>
      <span className="text-gray-900 text-end font-medium truncate">{value}</span>
    </div>
  );
}

function RecordingPlayButton({ recordingId }: { recordingId: string }) {
  const [state, setState] = useState<'idle' | 'loading' | 'playing'>('idle');
  const audioRef = useRef<HTMLAudioElement | null>(null);

  async function toggle() {
    if (state === 'playing') {
      audioRef.current?.pause();
      setState('idle');
      return;
    }
    try {
      setState('loading');
      const blob = await fetchRecordingAudioBlob(recordingId);
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.onended = () => {
        URL.revokeObjectURL(url);
        setState('idle');
      };
      await audio.play();
      audioRef.current = audio;
      setState('playing');
    } catch {
      setState('idle');
      toast.error('Recording not available');
    }
  }

  return (
    <button
      type="button"
      onClick={() => void toggle()}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 text-brand-primary text-xs font-medium hover:bg-blue-100"
    >
      {state === 'playing' ? <Pause size={14} /> : <Play size={14} />}
      {state === 'loading' ? 'Loading…' : state === 'playing' ? 'Pause' : 'Play recording'}
    </button>
  );
}

export function SessionDetailPanel({ session }: { session: CallSession }) {
  const contactCache = useCallsStore(s => s.contactCache);
  const name = resolveCallerName(session, contactCache);
  const oc = outcomeLabel(session.outcome ?? session.status);

  return (
    <div className="rounded-xl border border-gray-100 p-4 bg-white shadow-sm">
      <div className="flex items-start gap-3 mb-4">
        <div className="w-12 h-12 rounded-full bg-blue-50 text-brand-primary flex items-center justify-center text-lg font-semibold shrink-0">
          {name.slice(0, 2).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-base font-semibold truncate">{name}</p>
          <p className="text-sm text-gray-500">{session.customerPhone || '—'}</p>
          <span className={cn('inline-flex mt-1 px-2 py-0.5 rounded-full text-[10px] font-medium', oc.cls)}>
            {session.status === 'connected' ? 'Connected' : session.status === 'ringing' ? 'Ringing' : oc.text}
          </span>
        </div>
      </div>
      <DetailRow label="Channel" value={transportLabel(session.transport)} />
      <DetailRow label="Direction" value={session.direction === 'inbound' ? 'Inbound' : 'Outbound'} />
      <DetailRow label="Started" value={formatWhen(session.startedAt)} />
      {session.connectedAt && <DetailRow label="Connected" value={formatWhen(session.connectedAt)} />}
      {session.endedAt && <DetailRow label="Ended" value={formatWhen(session.endedAt)} />}
    </div>
  );
}

interface CdrProps {
  record: CDRRecord;
  agents?: RoutingAgent[];
}

export function CdrDetailPanel({ record, agents = [] }: CdrProps) {
  const contactCache = useCallsStore(s => s.contactCache);
  const name = resolveCdrCallerName(record, contactCache);
  const agent = resolveCdrAgentName(record, agents);
  const oc = outcomeLabel(record.outcome);
  const missed =
    record.outcome === 'missed' ||
    ['timeout', 'no_answer', 'declined', 'rejected', 'failed'].includes(
      (record.outcome || '').toLowerCase(),
    );
  const DirIcon = missed ? Voicemail : record.direction === 'inbound' ? ArrowDownLeft : ArrowUpRight;

  return (
    <div className="rounded-xl border border-gray-100 p-4 bg-white shadow-sm">
      <div className="flex items-start gap-3 mb-4">
        <span
          className={cn(
            'size-12 rounded-full flex items-center justify-center shrink-0',
            missed ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-brand-primary',
          )}
        >
          <DirIcon size={22} aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-base font-semibold truncate">{name}</p>
          {record.customerPhone && record.customerPhone !== name && (
            <p className="text-sm text-gray-500">{record.customerPhone}</p>
          )}
          <span className={cn('inline-flex mt-1 px-2 py-0.5 rounded-full text-[10px] font-medium', oc.cls)}>
            {oc.text}
          </span>
        </div>
      </div>
      <DetailRow label="Channel" value={transportLabel(record.transport)} />
      <DetailRow label="Direction" value={record.direction === 'inbound' ? 'Inbound' : 'Outbound'} />
      <DetailRow label="Agent" value={agent} />
      <DetailRow label="When" value={formatWhen(record.startedAt)} />
      <DetailRow label="Duration" value={formatDuration(record.duration)} />
      {record.endedAt && <DetailRow label="Ended" value={formatWhen(record.endedAt)} />}
      {record.recordingId && (
        <div className="pt-3">
          <RecordingPlayButton recordingId={record.recordingId} />
        </div>
      )}
    </div>
  );
}
