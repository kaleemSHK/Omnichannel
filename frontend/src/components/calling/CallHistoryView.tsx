'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDownLeft,
  ArrowUpRight,
  Download,
  Loader2,
  Pause,
  Phone,
  Play,
  RefreshCw,
  Search,
  Voicemail,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { useCDR } from '@/lib/hooks/useCalls';
import { getMosHistory, type MosHistory } from '@/lib/api/calls';
import { fetchRecordingAudioBlob } from '@/lib/api/recording';
import { useCallsStore } from '@/lib/store/calls';
import { cn } from '@/lib/utils/cn';
import type { CDRRecord } from '@/types';

const PAGE_SIZE = 25;

type RangeKey = 'today' | '7d' | '30d' | 'all';
type DirFilter = 'all' | 'inbound' | 'outbound';
type OutcomeFilter = 'all' | 'completed' | 'missed' | 'failed';

const RANGES: { key: RangeKey; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: '7d', label: '7 days' },
  { key: '30d', label: '30 days' },
  { key: 'all', label: 'All time' },
];

function rangeToFrom(range: RangeKey): string | undefined {
  if (range === 'all') return undefined;
  const now = new Date();
  if (range === 'today') {
    const d = new Date(now);
    d.setHours(0, 0, 0, 0);
    return d.toISOString();
  }
  const days = range === '7d' ? 7 : 30;
  return new Date(now.getTime() - days * 86_400_000).toISOString();
}

function formatDuration(sec: number): string {
  if (!sec || sec < 0) return '0:00';
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function formatWhen(iso: string): { date: string; time: string } {
  const d = new Date(iso);
  return {
    date: d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
    time: d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }),
  };
}

function outcomeStyle(outcome: string): { label: string; cls: string } {
  const o = (outcome || '').toLowerCase();
  if (o === 'completed' || o === 'answered' || o === 'ended')
    return { label: 'Completed', cls: 'bg-green-100 text-green-800' };
  if (o === 'missed' || o === 'timeout' || o === 'no_answer')
    return { label: o === 'timeout' ? 'No answer' : 'Missed', cls: 'bg-red-100 text-red-700' };
  if (o === 'declined' || o === 'rejected')
    return { label: 'Declined', cls: 'bg-orange-100 text-orange-800' };
  if (o === 'failed') return { label: 'Failed', cls: 'bg-red-100 text-red-700' };
  return { label: outcome || 'Unknown', cls: 'bg-gray-100 text-gray-600' };
}

function isMissed(outcome: string): boolean {
  const o = (outcome || '').toLowerCase();
  return o === 'missed' || o === 'timeout' || o === 'no_answer' || o === 'declined' || o === 'rejected' || o === 'failed';
}

export function CallHistoryView() {
  const [range, setRange] = useState<RangeKey>('7d');
  const [dir, setDir] = useState<DirFilter>('all');
  const [outcome, setOutcome] = useState<OutcomeFilter>('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<CDRRecord[]>([]);
  const [selected, setSelected] = useState<CDRRecord | null>(null);

  const contactCache = useCallsStore(s => s.contactCache);
  const from = useMemo(() => rangeToFrom(range), [range]);

  const { data: batch = [], isFetching, isError, refetch } = useCDR({
    page,
    limit: PAGE_SIZE,
    from,
  });

  // Reset accumulation whenever the server-side filter (date range) changes.
  useEffect(() => {
    setPage(1);
    setRows([]);
  }, [range]);

  useEffect(() => {
    if (page === 1) {
      setRows(batch);
      return;
    }
    setRows(prev => {
      const seen = new Set(prev.map(r => r.id));
      return [...prev, ...batch.filter(r => !seen.has(r.id))];
    });
  }, [batch, page]);

  function labelFor(r: CDRRecord): string {
    return contactCache.get(r.callSessionId) || r.customerPhone || 'Unknown number';
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter(r => {
      if (dir !== 'all' && r.direction !== dir) return false;
      if (outcome !== 'all') {
        if (outcome === 'completed' && isMissed(r.outcome)) return false;
        if (outcome === 'missed' && !isMissed(r.outcome)) return false;
        if (outcome === 'failed' && (r.outcome || '').toLowerCase() !== 'failed') return false;
      }
      if (q) {
        const hay = `${labelFor(r)} ${r.customerPhone ?? ''} ${r.agentLabel ?? ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, dir, outcome, search, contactCache]);

  const stats = useMemo(() => {
    const total = filtered.length;
    const missed = filtered.filter(r => isMissed(r.outcome)).length;
    const totalSec = filtered.reduce((a, r) => a + (r.duration || 0), 0);
    const withRec = filtered.filter(r => r.recordingId).length;
    return { total, missed, totalSec, withRec };
  }, [filtered]);

  function exportCsv() {
    const header = ['Direction', 'Contact', 'Number', 'Agent', 'Started', 'Duration (s)', 'Outcome', 'Recording'];
    const lines = filtered.map(r =>
      [
        r.direction,
        labelFor(r),
        r.customerPhone ?? '',
        r.agentLabel ?? r.agentId ?? '',
        r.startedAt,
        String(r.duration ?? 0),
        r.outcome ?? '',
        r.recordingId ? 'yes' : 'no',
      ]
        .map(v => `"${String(v).replace(/"/g, '""')}"`)
        .join(','),
    );
    const csv = [header.join(','), ...lines].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `call-history-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex h-full min-h-0 bg-slate-50">
      <div className="flex-1 flex flex-col min-w-0 min-h-0">
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-200 bg-white shrink-0">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <h1 className="text-lg font-semibold text-gray-900">Call history</h1>
              <p className="text-xs text-gray-500 mt-0.5">
                {stats.total} call{stats.total === 1 ? '' : 's'} · {stats.missed} missed ·{' '}
                {formatDuration(stats.totalSec)} talk time · {stats.withRec} recorded
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => void refetch()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
              >
                <RefreshCw size={14} className={cn(isFetching && 'animate-spin')} aria-hidden />
                Refresh
              </button>
              <button
                type="button"
                onClick={exportCsv}
                disabled={filtered.length === 0}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                <Download size={14} aria-hidden />
                Export CSV
              </button>
            </div>
          </div>

          {/* Filters */}
          <div className="flex items-center gap-2 mt-3 flex-wrap">
            <div className="relative">
              <Search size={14} className="absolute start-2.5 top-1/2 -translate-y-1/2 text-gray-400" aria-hidden />
              <input
                type="search"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search number, contact, agent…"
                className="ps-8 pe-3 py-1.5 text-xs rounded-lg border border-gray-200 w-60 focus:outline-none focus:ring-2 focus:ring-brand-primary/30"
              />
            </div>

            <SegmentedControl
              value={dir}
              onChange={v => setDir(v as DirFilter)}
              options={[
                { value: 'all', label: 'All' },
                { value: 'inbound', label: 'Inbound' },
                { value: 'outbound', label: 'Outbound' },
              ]}
            />
            <SegmentedControl
              value={outcome}
              onChange={v => setOutcome(v as OutcomeFilter)}
              options={[
                { value: 'all', label: 'Any' },
                { value: 'completed', label: 'Completed' },
                { value: 'missed', label: 'Missed' },
              ]}
            />
            <div className="ms-auto">
              <SegmentedControl
                value={range}
                onChange={v => setRange(v as RangeKey)}
                options={RANGES.map(r => ({ value: r.key, label: r.label }))}
              />
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {isError && (
            <div className="m-5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              Could not load call history. Check your connection and try Refresh.
            </div>
          )}

          {!isError && filtered.length === 0 && !isFetching && (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-14 h-14 rounded-full bg-blue-50 text-brand-primary flex items-center justify-center mb-4">
                <Phone size={26} aria-hidden />
              </div>
              <h2 className="text-base font-semibold text-gray-900">No calls found</h2>
              <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                {rows.length === 0
                  ? 'Completed and missed calls will appear here once you start making and receiving calls.'
                  : 'No calls match the current filters. Try widening the date range or clearing filters.'}
              </p>
            </div>
          )}

          {filtered.length > 0 && (
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-slate-50/95 backdrop-blur border-b border-gray-200 z-10">
                <tr className="text-[11px] uppercase tracking-wider text-gray-400">
                  <th className="text-start font-semibold px-5 py-2.5 w-10" />
                  <th className="text-start font-semibold px-2 py-2.5">Contact</th>
                  <th className="text-start font-semibold px-2 py-2.5 hidden md:table-cell">Agent</th>
                  <th className="text-start font-semibold px-2 py-2.5">When</th>
                  <th className="text-start font-semibold px-2 py-2.5">Duration</th>
                  <th className="text-start font-semibold px-2 py-2.5">Outcome</th>
                  <th className="text-end font-semibold px-5 py-2.5">Recording</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map(r => (
                  <HistoryRow
                    key={r.id}
                    record={r}
                    label={labelFor(r)}
                    onOpen={() => setSelected(r)}
                    selected={selected?.id === r.id}
                  />
                ))}
              </tbody>
            </table>
          )}

          {/* Load more */}
          {batch.length >= PAGE_SIZE && (
            <div className="p-4 text-center">
              <button
                type="button"
                onClick={() => setPage(p => p + 1)}
                disabled={isFetching}
                className="inline-flex items-center gap-2 text-xs font-medium px-4 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                {isFetching && <Loader2 size={14} className="animate-spin" aria-hidden />}
                {isFetching ? 'Loading…' : 'Load more'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Detail drawer */}
      {selected && (
        <CallDetailDrawer record={selected} label={labelFor(selected)} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}

function SegmentedControl({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="inline-flex items-center rounded-lg border border-gray-200 bg-white p-0.5 text-xs">
      {options.map(o => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn(
            'px-2.5 py-1 rounded-md font-medium transition-colors',
            value === o.value ? 'bg-brand-primary text-white' : 'text-gray-500 hover:text-gray-800',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function DirectionBadge({ direction, missed }: { direction: string; missed: boolean }) {
  const inbound = direction === 'inbound';
  const Icon = missed ? Voicemail : inbound ? ArrowDownLeft : ArrowUpRight;
  return (
    <span
      className={cn(
        'inline-flex items-center justify-center size-8 rounded-full shrink-0',
        missed ? 'bg-red-50 text-red-600' : inbound ? 'bg-blue-50 text-brand-primary' : 'bg-green-50 text-green-700',
      )}
      title={inbound ? 'Inbound' : 'Outbound'}
    >
      <Icon size={16} aria-hidden />
    </span>
  );
}

function HistoryRow({
  record,
  label,
  onOpen,
  selected,
}: {
  record: CDRRecord;
  label: string;
  onOpen: () => void;
  selected: boolean;
}) {
  const when = formatWhen(record.startedAt);
  const oc = outcomeStyle(record.outcome);
  const missed = isMissed(record.outcome);
  return (
    <tr
      onClick={onOpen}
      className={cn('cursor-pointer hover:bg-blue-50/40 transition-colors', selected && 'bg-blue-50/60')}
    >
      <td className="px-5 py-2.5">
        <DirectionBadge direction={record.direction} missed={missed} />
      </td>
      <td className="px-2 py-2.5">
        <p className="font-medium text-gray-900 truncate max-w-[200px]">{label}</p>
        {record.customerPhone && label !== record.customerPhone && (
          <p className="text-xs text-gray-400 truncate">{record.customerPhone}</p>
        )}
      </td>
      <td className="px-2 py-2.5 hidden md:table-cell text-gray-600 truncate max-w-[140px]">
        {record.agentLabel || record.agentId || '—'}
      </td>
      <td className="px-2 py-2.5 text-gray-600 whitespace-nowrap">
        <span className="text-gray-900">{when.date}</span> <span className="text-gray-400">{when.time}</span>
      </td>
      <td className="px-2 py-2.5 tabular-nums text-gray-700">{formatDuration(record.duration)}</td>
      <td className="px-2 py-2.5">
        <span className={cn('inline-flex px-2 py-0.5 rounded-full text-[11px] font-medium', oc.cls)}>{oc.label}</span>
      </td>
      <td className="px-5 py-2.5 text-end" onClick={e => e.stopPropagation()}>
        {record.recordingId ? (
          <InlineRecordingButton recordingId={record.recordingId} />
        ) : (
          <span className="text-xs text-gray-300">—</span>
        )}
      </td>
    </tr>
  );
}

// Single shared audio element across the view so only one recording plays at a time.
function InlineRecordingButton({ recordingId }: { recordingId: string }) {
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
      toast.error('Recording not available yet');
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={state === 'playing' ? 'Pause recording' : 'Play recording'}
      className="inline-flex items-center justify-center size-8 rounded-full bg-blue-50 hover:bg-blue-100 text-brand-primary transition-colors"
    >
      {state === 'loading' ? (
        <Loader2 size={15} className="animate-spin" />
      ) : state === 'playing' ? (
        <Pause size={15} />
      ) : (
        <Play size={15} />
      )}
    </button>
  );
}

function CallDetailDrawer({
  record,
  label,
  onClose,
}: {
  record: CDRRecord;
  label: string;
  onClose: () => void;
}) {
  const when = formatWhen(record.startedAt);
  const oc = outcomeStyle(record.outcome);
  const missed = isMissed(record.outcome);
  const [mos, setMos] = useState<MosHistory | null>(null);
  const [mosLoaded, setMosLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setMos(null);
    setMosLoaded(false);
    getMosHistory(record.callSessionId)
      .then(m => {
        if (!cancelled) setMos(m);
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setMosLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [record.callSessionId]);

  return (
    <>
      <div className="fixed inset-0 bg-black/20 z-30" onClick={onClose} aria-hidden />
      <aside className="fixed end-0 top-0 h-full w-full max-w-sm bg-white border-s border-gray-200 shadow-xl z-40 flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-900">Call details</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="p-1 rounded-md hover:bg-gray-100 text-gray-500"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          <div className="flex items-center gap-3">
            <DirectionBadge direction={record.direction} missed={missed} />
            <div className="min-w-0">
              <p className="font-semibold text-gray-900 truncate">{label}</p>
              <p className="text-xs text-gray-500">
                {record.direction === 'inbound' ? 'Inbound' : 'Outbound'} · {record.transport?.toUpperCase() || 'PSTN'}
              </p>
            </div>
            <span className={cn('ms-auto inline-flex px-2 py-0.5 rounded-full text-[11px] font-medium', oc.cls)}>
              {oc.label}
            </span>
          </div>

          <dl className="grid grid-cols-2 gap-3 text-sm">
            <DetailField label="Number" value={record.customerPhone || '—'} />
            <DetailField label="Agent" value={record.agentLabel || record.agentId || '—'} />
            <DetailField label="Date" value={`${when.date}, ${when.time}`} />
            <DetailField label="Duration" value={formatDuration(record.duration)} />
          </dl>

          {/* Recording */}
          <div>
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Recording</p>
            {record.recordingId ? (
              <RecordingBlock recordingId={record.recordingId} sessionId={record.callSessionId} />
            ) : (
              <p className="text-sm text-muted-foreground">No recording for this call.</p>
            )}
          </div>

          {/* Voice quality (MOS) */}
          <div>
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Voice quality</p>
            {!mosLoaded ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : mos && mos.avg != null ? (
              <div className="flex items-center gap-4">
                <div className="text-3xl font-bold tabular-nums text-gray-900">{mos.avg.toFixed(1)}</div>
                <div className="text-xs text-gray-500">
                  <p>Mean Opinion Score (1–5)</p>
                  <p className="mt-0.5">
                    min {mos.min?.toFixed(1) ?? '—'} · max {mos.max?.toFixed(1) ?? '—'} · {mos.samples.length} samples
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No quality samples recorded.</p>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">{label}</dt>
      <dd className="text-sm text-gray-900 mt-0.5 truncate">{value}</dd>
    </div>
  );
}

function RecordingBlock({ recordingId, sessionId }: { recordingId: string; sessionId: string }) {
  const [state, setState] = useState<'idle' | 'loading' | 'playing'>('idle');
  const audioRef = useRef<HTMLAudioElement | null>(null);

  async function play() {
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
      toast.error('Recording not available yet');
    }
  }

  async function download() {
    try {
      const blob = await fetchRecordingAudioBlob(recordingId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `recording-${sessionId || recordingId}.wav`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Download failed');
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={play}
        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-brand-primary text-white text-xs font-medium hover:bg-brand-primary/90 transition-colors"
      >
        {state === 'loading' ? (
          <Loader2 size={14} className="animate-spin" />
        ) : state === 'playing' ? (
          <Pause size={14} />
        ) : (
          <Play size={14} />
        )}
        {state === 'playing' ? 'Pause' : 'Play recording'}
      </button>
      <button
        type="button"
        onClick={download}
        aria-label="Download recording"
        className="inline-flex items-center justify-center size-8 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
      >
        <Download size={15} />
      </button>
    </div>
  );
}
