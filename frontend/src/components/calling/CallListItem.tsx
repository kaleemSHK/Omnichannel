'use client';

import { cn } from '@/lib/utils/cn';
import { demoCallerName } from '@/lib/demo/callsFixture';
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
  const name = demoCallerName(session);
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
        {initials(name)}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{name}</p>
        <p className="text-xs text-muted-foreground truncate">{session.customerPhone}</p>
      </div>
      <div className="text-end shrink-0">
        <span className="inline-flex px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-green-100 text-green-700">
          Live
        </span>
        {elapsed && <p className="text-[10px] text-muted-foreground tabular-nums mt-0.5">{elapsed}</p>}
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
  const mins = Math.floor(record.duration / 60);
  const secs = String(record.duration % 60).padStart(2, '0');
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
        {initials(label)}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{label}</p>
        <p className="text-xs text-muted-foreground">{record.transport.toUpperCase()}</p>
      </div>
      <div className="text-end shrink-0">
        <span
          className={cn(
            'inline-flex px-1.5 py-0.5 rounded-full text-[10px] font-medium',
            missed ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-600',
          )}
        >
          {missed ? 'Missed' : 'Ended'}
        </span>
        <p className="text-[10px] text-muted-foreground tabular-nums mt-0.5">
          {mins}:{secs}
        </p>
      </div>
    </button>
  );
}
