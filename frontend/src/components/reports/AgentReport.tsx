'use client';

import { useMemo, useState } from 'react';
import { ReportRangeTabs } from '@/components/reports/ReportRangeTabs';
import { Skeleton } from '@/components/ui/skeleton';
import { useAgentReport, type ReportRange } from '@/lib/hooks/useReports';
import { cn } from '@/lib/utils/cn';

type SortKey = 'name' | 'open' | 'resolved' | 'avg_first_response' | 'avg_resolution' | 'online_time';

export function AgentReport() {
  const [range, setRange] = useState<ReportRange>('7d');
  const [sortKey, setSortKey] = useState<SortKey>('resolved');
  const [sortAsc, setSortAsc] = useState(false);
  const { data = [], isLoading } = useAgentReport(range);

  const sorted = useMemo(() => {
    return [...data].sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (typeof av === 'number' && typeof bv === 'number') {
        return sortAsc ? av - bv : bv - av;
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

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="text-lg font-semibold">Agent performance</h1>
        <ReportRangeTabs range={range} onChange={setRange} />
      </div>

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
              : sorted.map(row => (
                  <tr key={row.name} className="border-b last:border-0 hover:bg-muted/20">
                    <td className="px-4 py-3 font-medium">{row.name}</td>
                    <td className="px-4 py-3">{row.open}</td>
                    <td className="px-4 py-3">{row.resolved}</td>
                    <td className="px-4 py-3 text-muted-foreground">{row.avg_first_response}</td>
                    <td className="px-4 py-3 text-muted-foreground">{row.avg_resolution}</td>
                    <td className="px-4 py-3 text-muted-foreground">{row.online_time}</td>
                  </tr>
                ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
