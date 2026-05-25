'use client';

import { useState } from 'react';
import { Download } from 'lucide-react';
import { ReportRangeTabs } from '@/components/reports/ReportRangeTabs';
import { Skeleton } from '@/components/ui/skeleton';
import { useInboxReport, type ReportRange } from '@/lib/hooks/useReports';
import { downloadCsv } from '@/lib/utils/exportCsv';

export function InboxReport() {
  const [range, setRange] = useState<ReportRange>('7d');
  const { data = [], isLoading, isError } = useInboxReport(range);

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="text-lg font-semibold">Inbox performance</h1>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() =>
              downloadCsv(
                data.map(r => ({
                  Inbox: r.name,
                  Open: r.open,
                  Resolved: r.resolved,
                  'Avg First Response': r.avg_first_response,
                  'Avg Resolution': r.avg_resolution,
                })),
                `inbox-report-${range}-${new Date().toISOString().slice(0, 10)}.csv`,
              )
            }
            disabled={isLoading || data.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs border rounded-lg hover:bg-muted disabled:opacity-50"
          >
            <Download size={13} /> Export CSV
          </button>
          <ReportRangeTabs range={range} onChange={setRange} />
        </div>
      </div>

      {isError && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive mb-4">
          Failed to load inbox report data.
        </div>
      )}

      <div className="border rounded-lg overflow-hidden bg-white">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 border-b">
            <tr>
              <th className="text-start px-4 py-2.5 font-medium text-muted-foreground">Inbox</th>
              <th className="text-start px-4 py-2.5 font-medium text-muted-foreground">Open</th>
              <th className="text-start px-4 py-2.5 font-medium text-muted-foreground">Resolved</th>
              <th className="text-start px-4 py-2.5 font-medium text-muted-foreground">Avg first response</th>
              <th className="text-start px-4 py-2.5 font-medium text-muted-foreground">Avg resolution</th>
            </tr>
          </thead>
          <tbody>
            {isLoading
              ? [1, 2, 3].map(i => (
                  <tr key={i} className="border-b">
                    <td colSpan={5} className="px-4 py-3">
                      <Skeleton className="h-4 w-full" />
                    </td>
                  </tr>
                ))
              : data.map((row, idx) => (
                  <tr key={row.id ?? `${row.name}-${idx}`} className="border-b last:border-0 hover:bg-muted/20">
                    <td className="px-4 py-3 font-medium">{row.name}</td>
                    <td className="px-4 py-3">{row.open}</td>
                    <td className="px-4 py-3">{row.resolved}</td>
                    <td className="px-4 py-3 text-muted-foreground">{row.avg_first_response}</td>
                    <td className="px-4 py-3 text-muted-foreground">{row.avg_resolution}</td>
                  </tr>
                ))}
            {!isLoading && data.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-sm text-muted-foreground">
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
