'use client';

import { useMemo, useState } from 'react';
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
import { Skeleton } from '@/components/ui/skeleton';
import { DateRangePicker } from '@/components/reports/DateRangePicker';
import { ExportButton } from '@/components/reports/ExportButton';
import {
  useReportSummary,
  useReportChart,
  useOverviewAgents,
  type DateRangeValue,
  rangeLabelOf,
} from '@/lib/hooks/useReports';

export function OverviewReport() {
  const [range, setRange] = useState<DateRangeValue>('7d');

  const { data: summary, isLoading: summaryLoading, isError: summaryError } =
    useReportSummary(range);
  const { data: chartData = [], isLoading: chartLoading } = useReportChart(range);
  const { data: byAgent = [] } = useOverviewAgents(range);

  const isLoading = summaryLoading || chartLoading;

  const KPI_CARDS = [
    { label: 'Total conversations', value: summary?.account?.conversations_count ?? 0 },
    { label: 'Resolved', value: summary?.account?.resolved_conversations_count ?? 0 },
    { label: 'Avg first response', value: summary?.account?.avg_first_response_time ?? '—' },
    { label: 'Avg resolution time', value: summary?.account?.avg_resolution_time ?? '—' },
  ];

  const yAxisWidth = useMemo(() => {
    const longest = byAgent.reduce((max, a) => Math.max(max, a.name.length), 0);
    return Math.min(160, Math.max(100, longest * 7));
  }, [byAgent]);

  const exportSpec = useMemo(() => ({
    title: 'BlinkOne Overview Report',
    dateLabel: rangeLabelOf(range),
    filename: `blinkone-overview-${new Date().toISOString().slice(0, 10)}`,
    columns: [
      { header: 'Agent', key: 'name' },
      { header: 'Conversations', key: 'count', align: 'right' as const },
    ],
    rows: byAgent.slice(0, 10).map(a => ({ name: a.name, count: a.count })),
  }), [range, byAgent]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="text-lg font-semibold">Overview</h1>
        <div className="flex items-center gap-2 flex-wrap">
          <DateRangePicker value={range} onChange={setRange} />
          <ExportButton
            spec={exportSpec}
            disabled={isLoading || byAgent.length === 0}
          />
        </div>
      </div>

      {summaryError && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          Failed to load report data. Check your Chatwoot connection.
        </div>
      )}

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
        {chartLoading ? (
          <Skeleton className="h-[200px] w-full" />
        ) : chartData.length === 0 ? (
          <div className="h-[200px] flex items-center justify-center text-sm text-muted-foreground">
            No data for this period
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
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
        ) : byAgent.length === 0 ? (
          <div className="h-[200px] flex items-center justify-center text-sm text-muted-foreground">
            No agent data for this period
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={Math.max(200, byAgent.length * 36)}>
            <BarChart data={byAgent.slice(0, 10)} layout="vertical">
              <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
              <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={yAxisWidth} />
              <Tooltip />
              <Bar dataKey="count" fill="#0B5FFF" radius={[0, 4, 4, 0]} name="Conversations" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
