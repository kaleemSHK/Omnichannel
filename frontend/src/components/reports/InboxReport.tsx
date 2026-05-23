'use client';

import { useState } from 'react';
import { ReportRangeTabs } from '@/components/reports/ReportRangeTabs';
import { Skeleton } from '@/components/ui/skeleton';
import { useInboxReport, type ReportRange } from '@/lib/hooks/useReports';

export function InboxReport() {
  const [range, setRange] = useState<ReportRange>('7d');
  const { data = [], isLoading } = useInboxReport(range);

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="text-lg font-semibold">Inbox performance</h1>
        <ReportRangeTabs range={range} onChange={setRange} />
      </div>

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
              : data.map(row => (
                  <tr key={row.name} className="border-b last:border-0 hover:bg-muted/20">
                    <td className="px-4 py-3 font-medium">{row.name}</td>
                    <td className="px-4 py-3">{row.open}</td>
                    <td className="px-4 py-3">{row.resolved}</td>
                    <td className="px-4 py-3 text-muted-foreground">{row.avg_first_response}</td>
                    <td className="px-4 py-3 text-muted-foreground">{row.avg_resolution}</td>
                  </tr>
                ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
