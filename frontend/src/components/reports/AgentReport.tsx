'use client';

import { useMemo, useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { DateRangePicker } from '@/components/reports/DateRangePicker';
import { ExportButton } from '@/components/reports/ExportButton';
import {
  useAgentReport,
  parseDurationToSeconds,
  type DateRangeValue,
  rangeLabelOf,
} from '@/lib/hooks/useReports';
import { cn } from '@/lib/utils/cn';

type SortKey = 'name' | 'open' | 'resolved' | 'avg_first_response' | 'avg_resolution' | 'online_time';

const TIME_SORT_KEYS: SortKey[] = ['avg_first_response', 'avg_resolution', 'online_time'];

export function AgentReport() {
  const [range, setRange] = useState<DateRangeValue>('7d');
  const [sortKey, setSortKey] = useState<SortKey>('resolved');
  const [sortAsc, setSortAsc] = useState(false);
  const { data = [], isLoading, isError } = useAgentReport(range);

  const sorted = useMemo(() => {
    return [...data].sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (typeof av === 'number' && typeof bv === 'number') {
        return sortAsc ? av - bv : bv - av;
      }
      if (TIME_SORT_KEYS.includes(sortKey)) {
        const as = parseDurationToSeconds(String(av));
        const bs = parseDurationToSeconds(String(bv));
        return sortAsc ? as - bs : bs - as;
      }
      return sortAsc
        ? String(av).localeCompare(String(bv))
        : String(bv).localeCompare(String(av));
    });
  }, [data, sortKey, sortAsc]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortAsc(v => !v);
    else {
      setSortKey(key);
      setSortAsc(false);
    }
  }

  const cols: { key: SortKey; label: string }[] = [
    { key: 'name', label: 'Agent' },
    { key: 'open', label: 'Open' },
    { key: 'resolved', label: 'Resolved' },
    { key: 'avg_first_response', label: 'Avg first response' },
    { key: 'avg_resolution', label: 'Avg resolution' },
    { key: 'online_time', label: 'Online time' },
  ];

  const exportSpec = useMemo(() => ({
    title: 'Agent Performance Report',
    dateLabel: rangeLabelOf(range),
    filename: `agent-report-${new Date().toISOString().slice(0, 10)}`,
    columns: [
      { header: 'Agent', key: 'name' },
      { header: 'Open', key: 'open', align: 'right' as const },
      { header: 'Resolved', key: 'resolved', align: 'right' as const },
      { header: 'Avg First Response', key: 'avg_first_response' },
      { header: 'Avg Resolution', key: 'avg_resolution' },
      { header: 'Online Time', key: 'online_time' },
    ],
    rows: sorted.map(r => ({
      name: r.name,
      open: r.open,
      resolved: r.resolved,
      avg_first_response: r.avg_first_response,
      avg_resolution: r.avg_resolution,
      online_time: r.online_time,
    })),
  }), [range, sorted]);

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="text-lg font-semibold">Agent performance</h1>
        <div className="flex items-center gap-2 flex-wrap">
          <DateRangePicker value={range} onChange={setRange} />
          <ExportButton
            spec={exportSpec}
            disabled={isLoading || data.length === 0}
          />
        </div>
      </div>

      {isError && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          Failed to load agent report data.
        </div>
      )}

      <div className="border rounded-lg overflow-hidden bg-white">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 border-b">
            <tr>
              {cols.map(col => (
                <th key={col.key} className="text-start px-4 py-2.5 font-medium text-muted-foreground">
                  <button
                    type="button"
                    onClick={() => toggleSort(col.key)}
                    className={cn('hover:text-foreground', sortKey === col.key && 'text-brand-primary')}
                  >
                    {col.label} {sortKey === col.key ? (sortAsc ? '↑' : '↓') : ''}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading
              ? [1, 2, 3].map(i => (
                  <tr key={i} className="border-b">
                    <td colSpan={6} className="px-4 py-3">
                      <Skeleton className="h-4 w-full" />
                    </td>
                  </tr>
                ))
              : sorted.map((row, idx) => (
                  <tr
                    key={row.id ?? `${row.name}-${idx}`}
                    className="border-b last:border-0 hover:bg-muted/20"
                  >
                    <td className="px-4 py-3 font-medium">{row.name}</td>
                    <td className="px-4 py-3">{row.open}</td>
                    <td className="px-4 py-3">{row.resolved}</td>
                    <td className="px-4 py-3 text-muted-foreground">{row.avg_first_response}</td>
                    <td className="px-4 py-3 text-muted-foreground">{row.avg_resolution}</td>
                    <td className="px-4 py-3 text-muted-foreground">{row.online_time}</td>
                  </tr>
                ))}
            {!isLoading && data.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-sm text-muted-foreground">
                  No data for this period
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
