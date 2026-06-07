'use client';

import { cn } from '@/lib/utils/cn';
import { useCallsStore } from '@/lib/store/calls';
import { resolveCallerName } from '@/lib/utils/calling';
import { formatCallDuration, formatCallListWhen, formatDisplayPhone } from '@/lib/utils/phone';
import type { CallSession, CDRRecord } from '@/types';

function initials(label: string): string {
  const parts = label.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return label.slice(0, 2).toUpperCase();
}

interface SessionProps {
  session: CallSession;
  active?: boolean;
  elapsed?: string;
  onSelect?: () => void;
}

export function CallSessionItem({ session, active, elapsed, onSelect }: SessionProps) {
  const contactCache = useCallsStore(s => s.contactCache);
  const name = resolveCallerName(session, contactCache);
  const phone = formatDisplayPhone(session.customerPhone);
  const showName = name && phone && name !== phone;
  const when = formatCallListWhen(session.startedAt);

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'w-full text-start px-3 py-2 flex gap-2 border-s-[3px]',
        active ? 'bg-blue-50 border-s-brand-primary' : 'border-s-transparent hover:bg-muted',
      )}
    >
      <div className="size-8 rounded-full bg-green-100 text-green-700 flex items-center justify-center text-xs font-medium shrink-0">
        {initials(showName ? name : phone || name)}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{showName ? name : phone || name}</p>
        <p className="text-[10px] text-muted-foreground truncate">
          {showName ? phone : session.transport.toUpperCase()}
          {showName ? ` · ${session.transport.toUpperCase()}` : ''}
        </p>
      </div>
      <div className="text-end shrink-0 min-w-[52px]">
        <span className="inline-flex px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-green-100 text-green-700">
          Live
        </span>
        {when.day && (
          <p className="text-[9px] text-muted-foreground mt-0.5 leading-tight">{when.day}</p>
        )}
        {(elapsed || when.time) && (
          <p className="text-[9px] text-muted-foreground tabular-nums leading-tight">
            {elapsed ?? when.time}
          </p>
        )}
      </div>
    </button>
  );
}

interface CdrProps {
  record: CDRRecord;
  label: string;
  active?: boolean;
  onSelect?: () => void;
}

export function CdrListItem({ record, label, active, onSelect }: CdrProps) {
  const missed = record.outcome === 'missed';
  const phone = formatDisplayPhone(record.customerPhone);
  const showName = label && phone && label !== phone && !label.startsWith('+');
  const when = formatCallListWhen(record.startedAt);
  const duration = formatCallDuration(record.duration);

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'w-full text-start px-3 py-2 flex gap-2 border-s-[3px]',
        active ? 'bg-blue-50 border-s-brand-primary' : 'border-s-transparent hover:bg-muted',
      )}
    >
      <div className="size-8 rounded-full bg-gray-100 text-gray-600 flex items-center justify-center text-xs font-medium shrink-0">
        {initials(showName ? label : phone || label)}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate font-mono text-[13px]">
          {showName ? label : phone || label}
        </p>
        <p className="text-[10px] text-muted-foreground truncate">
          {showName ? phone : record.transport.toUpperCase()}
          {showName ? ` · ${record.transport.toUpperCase()}` : ''}
        </p>
      </div>
      <div className="text-end shrink-0 min-w-[54px]">
        {when.day && (
          <p className="text-[9px] text-muted-foreground leading-tight tabular-nums">{when.day}</p>
        )}
        {when.time && (
          <p className="text-[9px] text-muted-foreground leading-tight tabular-nums">{when.time}</p>
        )}
        <span
          className={cn(
            'inline-flex px-1.5 py-0.5 rounded-full text-[9px] font-medium mt-0.5',
            missed ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-600',
          )}
        >
          {missed ? 'Missed' : duration}
        </span>
      </div>
    </button>
  );
}
