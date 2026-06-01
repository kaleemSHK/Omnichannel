'use client';

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Phone,
  PhoneMissed,
  Clock,
  Users,
  TrendingUp,
  Download,
  CalendarDays,
  RefreshCw,
  Loader2,
} from 'lucide-react';
import { fetchReport } from '@/lib/api/reports';
import { computeKPIs, getDemoReport } from '@/lib/demo/reportsFixture';
import { KPICard } from './KPICard';
import { CallsTab } from './CallsTab';
import { AgentsTab } from './AgentsTab';
import { QueuesTab } from './QueuesTab';
import { exportSheetToExcel } from '@/lib/utils/exportXlsx';
import { cn } from '@/lib/utils/cn';

// ─── Date helpers ──────────────────────────────────────────────────────────────

type Preset = '7d' | '14d' | '30d' | '90d';

function toISO(d: Date) { return d.toISOString().slice(0, 10); }

function presetRange(p: Preset) {
  const to = new Date();
  const from = new Date();
  const days = p === '7d' ? 6 : p === '14d' ? 13 : p === '30d' ? 29 : 89;
  from.setDate(from.getDate() - days);
  return { from: toISO(from), to: toISO(to) };
}

const TABS = [
  { id: 'calls',   label: 'Call Volume' },
  { id: 'agents',  label: 'Agent Performance' },
  { id: 'queues',  label: 'Queue Health' },
] as const;

type TabId = (typeof TABS)[number]['id'];

// ─── Main component ────────────────────────────────────────────────────────────

export function CallingReport() {
  const [preset, setPreset] = useState<Preset>('30d');
  const [tab, setTab] = useState<TabId>('calls');

  const { from, to } = useMemo(() => presetRange(preset), [preset]);

  const { data: report, isFetching, refetch } = useQuery({
    queryKey: ['calling-report', from, to],
    queryFn: () => fetchReport({ from, to }),
    staleTime: 5 * 60_000,
  });

  const data = report ?? getDemoReport(30);

  const periodDays = data.days.filter(d => d.date >= from && d.date <= to);
  const activeDays = periodDays.length ? periodDays : data.days;

  // Previous period for delta
  const prevDays = useMemo(() => {
    const diff = activeDays.length;
    const prevTo = new Date(from);
    prevTo.setDate(prevTo.getDate() - 1);
    const prevFrom = new Date(prevTo);
    prevFrom.setDate(prevFrom.getDate() - diff + 1);
    return data.days.filter(d => d.date >= toISO(prevFrom) && d.date <= toISO(prevTo));
  }, [activeDays.length, from, data.days]);

  const kpis = computeKPIs(activeDays, prevDays);

  const fmtSec = (s: number) => {
    const m = Math.floor(s / 60);
    return m ? `${m}m ${Math.round(s % 60)}s` : `${Math.round(s)}s`;
  };

  const handleExport = () => {
    exportSheetToExcel(
      activeDays.map(d => ({
        Date: d.date,
        'Total': d.totalCalls,
        Answered: d.answered,
        Missed: d.missed,
        Abandoned: d.abandoned,
        'AHT (s)': d.avgHandleTimeSec,
        'Wait (s)': d.avgWaitSec,
        'SLA %': d.slaPercent,
        PSTN: d.pstn,
        WhatsApp: d.whatsapp,
        WebRTC: d.webrtc,
      })),
      `calling-report-${from}-${to}`,
      'Calls',
    );
  };

  return (
    <div className="flex flex-col h-full">
      {/* ── Toolbar ── */}
      <div className="flex items-center gap-3 px-6 py-3 border-b bg-white flex-wrap shrink-0">
        <h1 className="text-base font-semibold text-gray-900">Calling Analytics</h1>

        <div className="flex gap-1 border border-gray-200 rounded-lg p-0.5 bg-gray-50 ml-2">
          {(['7d', '14d', '30d', '90d'] as const).map(p => (
            <button
              key={p}
              type="button"
              onClick={() => setPreset(p)}
              className={cn(
                'px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors',
                preset === p
                  ? 'bg-white text-gray-900 shadow-sm border border-gray-200'
                  : 'text-muted-foreground hover:text-gray-700',
              )}
            >
              {p === '7d' ? '7 days' : p === '14d' ? '14 days' : p === '30d' ? '30 days' : '90 days'}
            </button>
          ))}
        </div>

        <span className="text-[11px] text-muted-foreground hidden lg:block">{from} → {to}</span>

        <div className="flex-1" />

        <button
          type="button"
          onClick={() => void refetch()}
          className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-gray-700 border border-gray-200 rounded-md px-2 py-1"
        >
          {isFetching ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
          Refresh
        </button>

        <button
          type="button"
          onClick={handleExport}
          className="flex items-center gap-1.5 text-[11px] font-medium bg-brand-primary text-white rounded-md px-3 py-1.5 hover:bg-brand-primary/90 transition-colors"
        >
          <Download className="w-3 h-3" /> Export Excel
        </button>
      </div>

      {/* ── KPI bar ── */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 px-6 py-3 bg-gray-50 border-b shrink-0">
        <KPICard label="Total Calls" value={kpis.totalCalls.toLocaleString()} delta={kpis.totalCallsDelta} icon={Phone} iconColor="text-blue-600" accent="bg-blue-50" />
        <KPICard label="Answer Rate" value={`${kpis.answerRate.toFixed(1)}%`} delta={kpis.answerRateDelta} icon={TrendingUp} iconColor="text-green-600" accent="bg-green-50" />
        <KPICard label="Missed Calls" value={kpis.missedCalls.toLocaleString()} delta={kpis.missedDelta} lowerIsBetter icon={PhoneMissed} iconColor="text-red-500" accent="bg-red-50" />
        <KPICard label="Avg Handle Time" value={fmtSec(kpis.avgHandleTime)} delta={kpis.avgHandleTimeDelta} lowerIsBetter icon={Clock} iconColor="text-purple-600" accent="bg-purple-50" deltaLabel="vs prev" />
        <KPICard label="Avg Wait Time" value={fmtSec(kpis.avgWaitTime)} delta={kpis.avgWaitTimeDelta} lowerIsBetter icon={Users} iconColor="text-amber-600" accent="bg-amber-50" deltaLabel="vs prev" />
        <KPICard label="SLA Compliance" value={`${kpis.slaPercent.toFixed(1)}%`} delta={kpis.slaPercentDelta} icon={TrendingUp} iconColor="text-teal-600" accent="bg-teal-50" />
      </div>

      {/* ── Tabs ── */}
      <div className="flex gap-0.5 px-6 border-b bg-white shrink-0">
        {TABS.map(t => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              'px-4 py-2.5 text-xs font-medium border-b-2 transition-colors',
              tab === t.id
                ? 'border-brand-primary text-brand-primary'
                : 'border-transparent text-muted-foreground hover:text-gray-700 hover:border-gray-300',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Content ── */}
      <div className="flex-1 overflow-y-auto px-6 py-5 bg-gray-50">
        {tab === 'calls'  && <CallsTab  days={activeDays} hourlyToday={data.hourlyToday} />}
        {tab === 'agents' && <AgentsTab agents={data.agents} />}
        {tab === 'queues' && <QueuesTab queues={data.queues} />}
      </div>
    </div>
  );
}
