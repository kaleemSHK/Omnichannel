'use client';

import { useState } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ReportRangeTabs } from '@/components/reports/ReportRangeTabs';
import { Skeleton } from '@/components/ui/skeleton';
import { useReportSummary, type ReportRange } from '@/lib/hooks/useReports';

export function OverviewReport() {
  const [range, setRange] = useState<ReportRange>('7d');
  const { data: summary, isLoading } = useReportSummary(range);

  const KPI_CARDS = [
    { label: 'Total conversations', value: summary?.account?.conversations_count ?? 0 },
    { label: 'Resolved', value: summary?.account?.resolved_conversations_count ?? 0 },
    { label: 'Avg first response', value: summary?.account?.avg_first_response_time ?? '—' },
    { label: 'Avg resolution time', value: summary?.account?.avg_resolution_time ?? '—' },
  ];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="text-lg font-semibold">Overview</h1>
        <ReportRangeTabs range={range} onChange={setRange} />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {isLoading
          ? [1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24 rounded-lg" />)
          : KPI_CARDS.map(card => (
              <div key={card.label} className="border rounded-lg p-4 bg-white">
                <p className="text-xs text-muted-foreground">{card.label}</p>
                <p className="text-2xl font-bold mt-1 text-brand-primary">{card.value}</p>
              </div>
            ))}
      </div>

      <div className="border rounded-lg p-4 bg-white">
        <h2 className="text-sm font-semibold mb-4">Conversations over time</h2>
        {isLoading ? (
          <Skeleton className="h-[200px] w-full" />
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={summary?.chartData ?? []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Area type="monotone" dataKey="open" stroke="#0B5FFF" fill="#EFF6FF" name="Open" />
              <Area type="monotone" dataKey="resolved" stroke="#10b981" fill="#ECFDF5" name="Resolved" />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="border rounded-lg p-4 bg-white">
        <h2 className="text-sm font-semibold mb-4">By agent (top 10)</h2>
        {isLoading ? (
          <Skeleton className="h-[200px] w-full" />
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={summary?.byAgent ?? []} layout="vertical">
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={100} />
              <Tooltip />
              <Bar dataKey="count" fill="#0B5FFF" radius={[0, 4, 4, 0]} name="Conversations" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
