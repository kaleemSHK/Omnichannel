'use client';

/**
 * Sprint 3 A1 — Advanced Analytics Dashboard
 *
 * Charts:
 *   1. CSAT trend  — line chart (score %) + bar (satisfied/unsatisfied counts)
 *   2. Agent occupancy heatmap  — 7 days × 24 hours CSS grid
 *   3. SLA breach rate  — bar chart with % labels
 *   4. Conversation funnel  — horizontal funnel bars
 */

import { useState, useMemo } from 'react';
import {
  ComposedChart,
  Line,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
} from 'recharts';
import { Skeleton } from '@/components/ui/skeleton';
import { DateRangePicker } from '@/components/reports/DateRangePicker';
import { ExportButton } from '@/components/reports/ExportButton';
import {
  useCsatReport,
  useHourlyHeatmap,
  useSlaBreachReport,
  useConversionFunnel,
  rangeLabelOf,
  type DateRangeValue,
} from '@/lib/hooks/useReports';
import { cn } from '@/lib/utils/cn';

// ─── Heatmap colour scale ─────────────────────────────────────────────────────

const MAX_HEAT = 18; // saturates at this count

function heatColour(v: number): string {
  if (v === 0) return 'bg-gray-100';
  const ratio = Math.min(v / MAX_HEAT, 1);
  if (ratio < 0.25) return 'bg-blue-100';
  if (ratio < 0.5)  return 'bg-blue-300';
  if (ratio < 0.75) return 'bg-blue-500';
  return 'bg-blue-700';
}

function heatText(v: number): string {
  const ratio = Math.min(v / MAX_HEAT, 1);
  return ratio >= 0.5 ? 'text-white' : 'text-gray-700';
}

const HOURS = Array.from({ length: 24 }, (_, i) => `${i.toString().padStart(2, '0')}:00`);

// ─── Funnel bar ───────────────────────────────────────────────────────────────

function FunnelBar({ stage, count, pct, max }: { stage: string; count: number; pct: number; max: number }) {
  const width = max > 0 ? (count / max) * 100 : 0;
  return (
    <div className="flex items-center gap-3">
      <div className="w-28 text-xs text-muted-foreground text-right shrink-0">{stage}</div>
      <div className="flex-1 bg-gray-100 rounded-full h-7 relative overflow-hidden">
        <div
          className="absolute left-0 top-0 h-full bg-brand-primary/80 rounded-full transition-all duration-500"
          style={{ width: `${width}%` }}
        />
        <span className="absolute inset-0 flex items-center justify-end pr-3 text-xs font-medium text-gray-700">
          {count.toLocaleString()} <span className="text-muted-foreground ml-1">({pct}%)</span>
        </span>
      </div>
    </div>
  );
}

// ─── Custom tooltip for CSAT ──────────────────────────────────────────────────

function CsatTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border rounded-lg shadow-lg p-3 text-xs space-y-1">
      <p className="font-semibold">{label}</p>
      {payload.map(p => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name}: {p.name === 'Score' ? `${p.value}%` : p.value}
        </p>
      ))}
    </div>
  );
}

// ─── Custom tooltip for SLA ───────────────────────────────────────────────────

function SlaTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number }>; label?: string }) {
  if (!active || !payload?.length) return null;
  const d = payload[0];
  return (
    <div className="bg-white border rounded-lg shadow-lg p-3 text-xs space-y-1">
      <p className="font-semibold">{label}</p>
      <p className="text-red-600">Breach rate: {d?.value?.toFixed(1)}%</p>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function AnalyticsDashboard() {
  const [range, setRange] = useState<DateRangeValue>('7d');

  const { data: csatData, isLoading: csatLoading } = useCsatReport(range);
  const { days: heatDays, matrix: heatMatrix } = useHourlyHeatmap();
  const { data: slaData, isLoading: slaLoading } = useSlaBreachReport(range);
  const { data: funnelData, isLoading: funnelLoading } = useConversionFunnel(range);

  const avgCsat = useMemo(() => {
    if (!csatData.length) return 0;
    return Math.round(csatData.reduce((s, d) => s + d.score, 0) / csatData.length);
  }, [csatData]);

  const totalSatisfied = useMemo(() =>
    csatData.reduce((s, d) => s + d.satisfied, 0), [csatData]);

  const avgBreachRate = useMemo(() => {
    if (!slaData.length) return 0;
    return (slaData.reduce((s, d) => s + d.breachRate, 0) / slaData.length).toFixed(1);
  }, [slaData]);

  const funnelMax = funnelData[0]?.count ?? 1;

  const exportSpec = useMemo(() => ({
    title: 'BlinkOne Advanced Analytics',
    dateLabel: rangeLabelOf(range),
    filename: `analytics-${new Date().toISOString().slice(0, 10)}`,
    columns: [
      { header: 'Day', key: 'date' },
      { header: 'CSAT Score %', key: 'score', align: 'right' as const },
      { header: 'Satisfied', key: 'satisfied', align: 'right' as const },
      { header: 'Unsatisfied', key: 'unsatisfied', align: 'right' as const },
    ],
    rows: csatData.map(d => ({ date: d.date, score: d.score, satisfied: d.satisfied, unsatisfied: d.unsatisfied })),
  }), [range, csatData]);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-lg font-semibold">Advanced Analytics</h1>
          <p className="text-xs text-muted-foreground mt-0.5">CSAT · Occupancy heatmap · SLA breach · Conversion funnel</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <DateRangePicker value={range} onChange={setRange} />
          <ExportButton spec={exportSpec} disabled={csatLoading || csatData.length === 0} />
        </div>
      </div>

      {/* Summary KPI strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Avg CSAT score', value: csatLoading ? '…' : `${avgCsat}%`, tone: avgCsat >= 85 ? 'text-green-600' : avgCsat >= 70 ? 'text-amber-600' : 'text-red-600' },
          { label: 'Satisfied responses', value: csatLoading ? '…' : totalSatisfied, tone: 'text-brand-primary' },
          { label: 'Avg SLA breach rate', value: slaLoading ? '…' : `${avgBreachRate}%`, tone: Number(avgBreachRate) > 5 ? 'text-red-600' : 'text-green-600' },
          { label: 'Funnel conversion', value: funnelLoading ? '…' : `${funnelData[funnelData.length - 1]?.pct ?? 0}%`, tone: 'text-brand-primary' },
        ].map(card => (
          <div key={card.label} className="border rounded-lg p-4 bg-white">
            <p className="text-xs text-muted-foreground">{card.label}</p>
            <p className={cn('text-2xl font-bold mt-1', card.tone)}>{card.value}</p>
          </div>
        ))}
      </div>

      {/* ── CSAT Trend ── */}
      <div className="border rounded-lg p-5 bg-white">
        <h2 className="text-sm font-semibold mb-4">CSAT trend</h2>
        {csatLoading ? (
          <Skeleton className="h-[220px] w-full" />
        ) : csatData.length === 0 ? (
          <EmptyState height={220} />
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <ComposedChart data={csatData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis yAxisId="left" tick={{ fontSize: 11 }} allowDecimals={false} />
              <YAxis yAxisId="right" orientation="right" domain={[0, 100]} unit="%" tick={{ fontSize: 11 }} />
              <Tooltip content={<CsatTooltip />} />
              <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
              <Bar yAxisId="left" dataKey="satisfied" name="Satisfied" fill="#10b981" radius={[3, 3, 0, 0]} maxBarSize={28} />
              <Bar yAxisId="left" dataKey="unsatisfied" name="Unsatisfied" fill="#f87171" radius={[3, 3, 0, 0]} maxBarSize={28} />
              <Line yAxisId="right" type="monotone" dataKey="score" name="Score" stroke="#0B5FFF" strokeWidth={2} dot={{ r: 3 }} />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* ── Occupancy Heatmap ── */}
      <div className="border rounded-lg p-5 bg-white overflow-x-auto">
        <h2 className="text-sm font-semibold mb-1">Agent occupancy heatmap</h2>
        <p className="text-xs text-muted-foreground mb-4">Conversations handled by hour-of-day (last 7 days)</p>

        <div className="min-w-[700px]">
          {/* Hour labels */}
          <div className="flex mb-1 pl-[52px]">
            {HOURS.map((h, i) => (
              <div
                key={h}
                className="flex-1 text-[9px] text-muted-foreground text-center"
                style={{ minWidth: 0 }}
              >
                {i % 3 === 0 ? h.slice(0, 2) : ''}
              </div>
            ))}
          </div>

          {heatDays.map((day, di) => (
            <div key={day} className="flex items-center gap-1 mb-0.5">
              <div className="w-[44px] text-[10px] text-muted-foreground text-right shrink-0 pr-2">{day}</div>
              {heatMatrix[di]?.map((v, hi) => (
                <div
                  key={hi}
                  title={`${day} ${HOURS[hi]}: ${v} conversations`}
                  className={cn(
                    'flex-1 h-6 rounded-[2px] flex items-center justify-center text-[9px] font-medium cursor-default transition-opacity hover:opacity-80',
                    heatColour(v),
                    heatText(v),
                  )}
                  style={{ minWidth: 0 }}
                >
                  {v > 0 ? v : ''}
                </div>
              ))}
            </div>
          ))}

          {/* Legend */}
          <div className="flex items-center gap-2 mt-3 pl-[52px]">
            <span className="text-[10px] text-muted-foreground">Low</span>
            {['bg-gray-100', 'bg-blue-100', 'bg-blue-300', 'bg-blue-500', 'bg-blue-700'].map(cls => (
              <div key={cls} className={`w-5 h-3 rounded-sm ${cls}`} />
            ))}
            <span className="text-[10px] text-muted-foreground">High</span>
          </div>
        </div>
      </div>

      {/* ── SLA Breach Rate ── */}
      <div className="border rounded-lg p-5 bg-white">
        <h2 className="text-sm font-semibold mb-1">SLA breach rate</h2>
        <p className="text-xs text-muted-foreground mb-4">% of conversations that exceeded first-response SLA target</p>
        {slaLoading ? (
          <Skeleton className="h-[200px] w-full" />
        ) : slaData.length === 0 ? (
          <EmptyState height={200} />
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={slaData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} unit="%" domain={[0, 15]} />
              <Tooltip content={<SlaTooltip />} />
              <Bar
                dataKey="breachRate"
                name="Breach rate"
                fill="#f87171"
                radius={[4, 4, 0, 0]}
                maxBarSize={40}
                label={{ position: 'top', fontSize: 10, formatter: (v: number) => v > 0 ? `${v.toFixed(1)}%` : '' }}
              />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* ── Conversion Funnel ── */}
      <div className="border rounded-lg p-5 bg-white">
        <h2 className="text-sm font-semibold mb-1">Conversation funnel</h2>
        <p className="text-xs text-muted-foreground mb-5">From first contact to CSAT response</p>
        {funnelLoading ? (
          <Skeleton className="h-[160px] w-full" />
        ) : (
          <div className="space-y-3 max-w-2xl">
            {funnelData.map(f => (
              <FunnelBar key={f.stage} stage={f.stage} count={f.count} pct={f.pct} max={funnelMax} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function EmptyState({ height }: { height: number }) {
  return (
    <div
      className="flex items-center justify-center text-sm text-muted-foreground"
      style={{ height }}
    >
      No data for this period
    </div>
  );
}
