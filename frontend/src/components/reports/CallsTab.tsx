'use client';

import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import type { DayStat, HourStat } from '@/lib/demo/reportsFixture';
import { downloadCsv } from '@/lib/utils/exportCsv';
import { Download } from 'lucide-react';

// ─── Colour palette ────────────────────────────────────────────────────────────

const PALETTE = {
  answered: '#10b981',
  missed: '#ef4444',
  abandoned: '#f59e0b',
  inbound: '#0B5FFF',
  outbound: '#8b5cf6',
  pstn: '#0B5FFF',
  whatsapp: '#25d366',
  webrtc: '#f97316',
};

// ─── Section wrapper ───────────────────────────────────────────────────────────

function Section({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
        {action}
      </div>
      {children}
    </div>
  );
}

// ─── Tooltip styles ────────────────────────────────────────────────────────────

const tooltipStyle = {
  contentStyle: {
    fontSize: 11,
    borderRadius: 8,
    border: '1px solid #e5e7eb',
    boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
  },
};

// ─── Call Volume + Outcome area chart ─────────────────────────────────────────

function CallVolumeChart({ days }: { days: DayStat[] }) {
  const data = days.map(d => ({
    date: d.date.slice(5),
    Answered: d.answered,
    Missed: d.missed,
    Abandoned: d.abandoned,
  }));

  const exportData = () =>
    downloadCsv(
      days.map(d => ({ date: d.date, answered: d.answered, missed: d.missed, abandoned: d.abandoned })),
      'call-volume.csv',
    );

  return (
    <Section
      title="Call Volume — Answered / Missed / Abandoned"
      action={
        <button
          type="button"
          onClick={exportData}
          className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-gray-700 border border-gray-200 rounded-md px-2 py-1"
        >
          <Download className="w-3 h-3" /> CSV
        </button>
      }
    >
      <ResponsiveContainer width="100%" height={220}>
        <AreaChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -8 }}>
          <defs>
            <linearGradient id="gAns" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={PALETTE.answered} stopOpacity={0.2} />
              <stop offset="95%" stopColor={PALETTE.answered} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
          <XAxis dataKey="date" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
          <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
          <Tooltip {...tooltipStyle} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Area type="monotone" dataKey="Answered" stroke={PALETTE.answered} fill="url(#gAns)" strokeWidth={2} dot={false} />
          <Area type="monotone" dataKey="Missed" stroke={PALETTE.missed} fill="none" strokeWidth={2} dot={false} strokeDasharray="4 2" />
          <Area type="monotone" dataKey="Abandoned" stroke={PALETTE.abandoned} fill="none" strokeWidth={1.5} dot={false} strokeDasharray="2 2" />
        </AreaChart>
      </ResponsiveContainer>
    </Section>
  );
}

// ─── Hourly today ─────────────────────────────────────────────────────────────

function HourlyChart({ hours }: { hours: HourStat[] }) {
  const data = hours.map(h => ({
    hour: `${h.hour.toString().padStart(2, '0')}:00`,
    Answered: h.answered,
    Missed: h.missed,
  }));

  return (
    <Section title="Today by Hour">
      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
          <XAxis dataKey="hour" tick={{ fontSize: 9 }} tickLine={false} axisLine={false} interval={1} />
          <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
          <Tooltip {...tooltipStyle} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Bar dataKey="Answered" stackId="a" fill={PALETTE.answered} radius={[0, 0, 0, 0]} maxBarSize={14} />
          <Bar dataKey="Missed" stackId="a" fill={PALETTE.missed} radius={[2, 2, 0, 0]} maxBarSize={14} />
        </BarChart>
      </ResponsiveContainer>
    </Section>
  );
}

// ─── Outcome donut ────────────────────────────────────────────────────────────

function OutcomeDonut({ days }: { days: DayStat[] }) {
  const answered = days.reduce((a, d) => a + d.answered, 0);
  const missed = days.reduce((a, d) => a + d.missed, 0);
  const abandoned = days.reduce((a, d) => a + d.abandoned, 0);
  const data = [
    { name: 'Answered', value: answered, color: PALETTE.answered },
    { name: 'Missed', value: missed, color: PALETTE.missed },
    { name: 'Abandoned', value: abandoned, color: PALETTE.abandoned },
  ];

  return (
    <Section title="Outcome Breakdown">
      <ResponsiveContainer width="100%" height={180}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={50}
            outerRadius={78}
            paddingAngle={2}
            dataKey="value"
            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
            labelLine={false}
          >
            {data.map((d, i) => (
              <Cell key={i} fill={d.color} />
            ))}
          </Pie>
          <Tooltip {...tooltipStyle} />
        </PieChart>
      </ResponsiveContainer>
    </Section>
  );
}

// ─── Channel mix ──────────────────────────────────────────────────────────────

function ChannelMix({ days }: { days: DayStat[] }) {
  const pstn = days.reduce((a, d) => a + d.pstn, 0);
  const wa = days.reduce((a, d) => a + d.whatsapp, 0);
  const wrtc = days.reduce((a, d) => a + d.webrtc, 0);
  const data = [
    { name: 'PSTN', value: pstn, color: PALETTE.pstn },
    { name: 'WhatsApp', value: wa, color: PALETTE.whatsapp },
    { name: 'WebRTC', value: wrtc, color: PALETTE.webrtc },
  ];

  return (
    <Section title="Channel Mix">
      <ResponsiveContainer width="100%" height={180}>
        <PieChart>
          <Pie data={data} cx="50%" cy="50%" outerRadius={75} paddingAngle={2} dataKey="value"
            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
            labelLine={false}
          >
            {data.map((d, i) => <Cell key={i} fill={d.color} />)}
          </Pie>
          <Tooltip {...tooltipStyle} />
        </PieChart>
      </ResponsiveContainer>
    </Section>
  );
}

// ─── Inbound vs Outbound ──────────────────────────────────────────────────────

function DirectionChart({ days }: { days: DayStat[] }) {
  const data = days.slice(-14).map(d => ({
    date: d.date.slice(5),
    Inbound: d.inbound,
    Outbound: d.outbound,
  }));

  return (
    <Section title="Inbound vs Outbound (last 14 days)">
      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
          <XAxis dataKey="date" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
          <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
          <Tooltip {...tooltipStyle} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Bar dataKey="Inbound" fill={PALETTE.inbound} radius={[2, 2, 0, 0]} maxBarSize={18} />
          <Bar dataKey="Outbound" fill={PALETTE.outbound} radius={[2, 2, 0, 0]} maxBarSize={18} />
        </BarChart>
      </ResponsiveContainer>
    </Section>
  );
}

// ─── AHT Trend ────────────────────────────────────────────────────────────────

function AHTTrend({ days }: { days: DayStat[] }) {
  const data = days.map(d => ({
    date: d.date.slice(5),
    'AHT (s)': d.avgHandleTimeSec,
    'Wait (s)': d.avgWaitSec,
  }));

  return (
    <Section title="Avg Handle Time & Avg Wait Time">
      <ResponsiveContainer width="100%" height={180}>
        <AreaChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -8 }}>
          <defs>
            <linearGradient id="gAHT" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.15} />
              <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
          <XAxis dataKey="date" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
          <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
          <Tooltip {...tooltipStyle} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Area type="monotone" dataKey="AHT (s)" stroke="#8b5cf6" fill="url(#gAHT)" strokeWidth={2} dot={false} />
          <Area type="monotone" dataKey="Wait (s)" stroke="#f97316" fill="none" strokeWidth={1.5} dot={false} strokeDasharray="4 2" />
          <ReferenceLine y={240} stroke="#ef4444" strokeDasharray="3 3" label={{ value: 'AHT target', fontSize: 9, fill: '#ef4444' }} />
        </AreaChart>
      </ResponsiveContainer>
    </Section>
  );
}

// ─── Main tab ─────────────────────────────────────────────────────────────────

interface Props {
  days: DayStat[];
  hourlyToday: HourStat[];
}

export function CallsTab({ days, hourlyToday }: Props) {
  return (
    <div className="space-y-4">
      <CallVolumeChart days={days} />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <HourlyChart hours={hourlyToday} />
        <OutcomeDonut days={days} />
        <ChannelMix days={days} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <DirectionChart days={days} />
        <AHTTrend days={days} />
      </div>
    </div>
  );
}
