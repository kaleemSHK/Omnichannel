'use client';

import Link from 'next/link';
import { ArrowDownLeft, ArrowUpRight, Phone, Voicemail } from 'lucide-react';
import { useCallsStore } from '@/lib/store/calls';
import { CallConversationHistory } from '@/components/calling/CallConversationHistory';
import { CallTicketHistory } from '@/components/calling/CallTicketHistory';
import {
  resolveCallerName,
  resolveCdrAgentName,
  resolveCdrCallerName,
  transportLabel,
} from '@/lib/utils/calling';
import { isJunkCallPhone, type CallTransport } from '@/lib/utils/call-inbox-map';
import { cn } from '@/lib/utils/cn';
import type { CallSession, CDRRecord } from '@/types';
import type { RoutingAgent } from '@/types';
import type { ReactNode } from 'react';

const GRID_CARD =
  'rounded-xl border border-gray-100 p-4 bg-white shadow-sm h-full flex flex-col min-h-[148px]';

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
    <div className="flex justify-between gap-3 py-1.5 border-b border-gray-50 last:border-0 text-xs">
      <span className="text-gray-500 shrink-0">{label}</span>
      <span className="text-gray-900 text-end font-medium truncate">{value}</span>
    </div>
  );
}

function DetailCard({
  title,
  children,
  className,
}: {
  title?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn(GRID_CARD, className)}>
      {title && (
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 shrink-0">
          {title}
        </p>
      )}
      <div className="flex-1 min-h-0">{children}</div>
    </div>
  );
}

function CallerGrid({ children }: { children: ReactNode }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 items-stretch">
      {children}
    </div>
  );
}

export function SessionDetailPanel({ session }: { session: CallSession }) {
  const contactCache = useCallsStore(s => s.contactCache);
  const name = resolveCallerName(session, contactCache);
  const oc = outcomeLabel(session.outcome ?? session.status);
  const transport = (session.transport ?? 'pstn') as CallTransport;

  return (
    <div className="space-y-3">
      <DetailCard>
        <div className="flex items-start gap-3">
          <div className="size-11 rounded-full bg-blue-50 text-brand-primary flex items-center justify-center text-base font-semibold shrink-0">
            {name.slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-base font-semibold truncate">{name}</p>
            <p className="text-sm text-gray-500">{session.customerPhone || '—'}</p>
            <span
              className={cn(
                'inline-flex mt-1 px-2 py-0.5 rounded-full text-[10px] font-medium',
                oc.cls,
              )}
            >
              {session.status === 'connected'
                ? 'Connected'
                : session.status === 'ringing'
                  ? 'Ringing'
                  : oc.text}
            </span>
          </div>
        </div>
      </DetailCard>

      <CallerGrid>
        <DetailCard title="Call details">
          <DetailRow label="Channel" value={transportLabel(session.transport)} />
          <DetailRow
            label="Direction"
            value={session.direction === 'inbound' ? 'Inbound' : 'Outbound'}
          />
          <DetailRow label="Started" value={formatWhen(session.startedAt)} />
          {session.connectedAt && (
            <DetailRow label="Connected" value={formatWhen(session.connectedAt)} />
          )}
          {session.endedAt && <DetailRow label="Ended" value={formatWhen(session.endedAt)} />}
        </DetailCard>

        <CallConversationHistory
          className={cn(GRID_CARD, 'mt-0')}
          transport={transport}
          customerPhone={session.customerPhone}
          conversationId={session.conversationId}
        />
        <CallTicketHistory
          className={cn(GRID_CARD, 'mt-0')}
          customerPhone={session.customerPhone}
          conversationId={session.conversationId}
        />
      </CallerGrid>
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
  const dialPhone =
    record.customerPhone && !isJunkCallPhone(record.customerPhone) ? record.customerPhone : null;
  const transport = (record.transport ?? 'pstn') as CallTransport;

  return (
    <div className="space-y-3">
      <DetailCard>
        <div className="flex items-start gap-3">
          <span
            className={cn(
              'size-11 rounded-full flex items-center justify-center shrink-0',
              missed ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-brand-primary',
            )}
          >
            <DirIcon size={20} aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-base font-semibold truncate">{name}</p>
            {record.customerPhone && record.customerPhone !== name && (
              <p className="text-sm text-gray-500">{record.customerPhone}</p>
            )}
            <span
              className={cn(
                'inline-flex mt-1 px-2 py-0.5 rounded-full text-[10px] font-medium',
                oc.cls,
              )}
            >
              {oc.text}
            </span>
          </div>
          {dialPhone && (
            <Link
              href={`/calling?dial=${encodeURIComponent(dialPhone.replace(/[^\d+]/g, ''))}`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-600 text-white text-xs font-medium hover:bg-green-700 shrink-0"
            >
              <Phone size={14} aria-hidden />
              Call
            </Link>
          )}
        </div>
      </DetailCard>

      <CallerGrid>
        <DetailCard title="Call details">
          <DetailRow label="Channel" value={transportLabel(record.transport)} />
          <DetailRow
            label="Direction"
            value={record.direction === 'inbound' ? 'Inbound' : 'Outbound'}
          />
          <DetailRow label="Agent" value={agent} />
          <DetailRow label="When" value={formatWhen(record.startedAt)} />
          <DetailRow label="Duration" value={formatDuration(record.duration)} />
          {record.endedAt && <DetailRow label="Ended" value={formatWhen(record.endedAt)} />}
        </DetailCard>

        <CallConversationHistory
          className={cn(GRID_CARD, 'mt-0')}
          transport={transport}
          customerPhone={record.customerPhone}
          conversationId={record.conversationId}
        />
        <CallTicketHistory
          className={cn(GRID_CARD, 'mt-0')}
          customerPhone={record.customerPhone}
          conversationId={record.conversationId}
        />
      </CallerGrid>
    </div>
  );
}
