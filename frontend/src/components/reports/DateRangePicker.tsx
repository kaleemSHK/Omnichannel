'use client';

/**
 * DateRangePicker — replaces ReportRangeTabs.
 * Preset quick-picks + custom from/to date inputs.
 * Emits DateRangeValue (preset string OR { since, until, label }).
 */
import { useEffect, useRef, useState } from 'react';
import { CalendarDays, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import {
  type DateRangeValue,
  type CustomDateRange,
  isCustomRange,
  rangeLabelOf,
} from '@/lib/hooks/useReports';

interface Preset {
  value: DateRangeValue;
  label: string;
}

const PRESETS: Preset[] = [
  { value: 'today', label: 'Today' },
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
];

interface Props {
  value: DateRangeValue;
  onChange: (v: DateRangeValue) => void;
}

/** Format Date to yyyy-MM-dd for <input type="date"> */
function toInputDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

function startOfDayTs(dateStr: string): number {
  const d = new Date(dateStr);
  d.setHours(0, 0, 0, 0);
  return Math.floor(d.getTime() / 1000);
}

function endOfDayTs(dateStr: string): number {
  const d = new Date(dateStr);
  d.setHours(23, 59, 59, 999);
  return Math.floor(d.getTime() / 1000);
}

/** Active preset label match */
function activePreset(v: DateRangeValue): string | null {
  if (isCustomRange(v)) return null;
  return v;
}

export function DateRangePicker({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Custom range input state
  const today = new Date();
  const sevenDaysAgo = new Date(today.getTime() - 7 * 86_400_000);
  const [fromStr, setFromStr] = useState(() =>
    isCustomRange(value)
      ? toInputDate(new Date(value.since * 1000))
      : toInputDate(sevenDaysAgo),
  );
  const [toStr, setToStr] = useState(() =>
    isCustomRange(value) ? toInputDate(new Date(value.until * 1000)) : toInputDate(today),
  );
  const [customErr, setCustomErr] = useState('');

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  function handlePreset(preset: Preset) {
    onChange(preset.value);
    setOpen(false);
  }

  function applyCustom() {
    if (!fromStr || !toStr) return;
    const since = startOfDayTs(fromStr);
    const until = endOfDayTs(toStr);
    if (since > until) {
      setCustomErr('"From" must be before "To"');
      return;
    }
    setCustomErr('');
    const label = `${fromStr} → ${toStr}`;
    const custom: CustomDateRange = { since, until, label };
    onChange(custom);
    setOpen(false);
  }

  const displayLabel = rangeLabelOf(value);
  const ap = activePreset(value);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs border rounded-lg bg-white hover:bg-muted transition-colors"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <CalendarDays size={13} className="text-muted-foreground" />
        <span className="max-w-[160px] truncate">{displayLabel}</span>
        <ChevronDown size={12} className="text-muted-foreground" />
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Select date range"
          className="absolute end-0 top-full mt-1.5 w-60 bg-white border rounded-xl shadow-lg z-50 p-3"
        >
          {/* Preset buttons */}
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            Presets
          </p>
          <div className="space-y-0.5 mb-3">
            {PRESETS.map(p => (
              <button
                key={String(p.value)}
                type="button"
                onClick={() => handlePreset(p)}
                className={cn(
                  'w-full text-start px-2.5 py-1.5 text-xs rounded-md transition-colors',
                  ap === p.value
                    ? 'bg-blue-50 text-brand-primary font-medium'
                    : 'hover:bg-muted text-foreground',
                )}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Custom range */}
          <div className="border-t pt-3">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              Custom range
            </p>
            <div className="space-y-2">
              <div>
                <label className="text-[10px] text-muted-foreground block mb-0.5">From</label>
                <input
                  type="date"
                  value={fromStr}
                  max={toStr || undefined}
                  onChange={e => { setFromStr(e.target.value); setCustomErr(''); }}
                  className="w-full text-xs border rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-brand-primary"
                />
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground block mb-0.5">To</label>
                <input
                  type="date"
                  value={toStr}
                  min={fromStr || undefined}
                  onChange={e => { setToStr(e.target.value); setCustomErr(''); }}
                  className="w-full text-xs border rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-brand-primary"
                />
              </div>
              {customErr && (
                <p className="text-[10px] text-destructive">{customErr}</p>
              )}
              <button
                type="button"
                onClick={applyCustom}
                disabled={!fromStr || !toStr}
                className="w-full text-xs bg-brand-primary text-white rounded-md py-1.5 hover:opacity-90 disabled:opacity-40"
              >
                Apply custom range
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
