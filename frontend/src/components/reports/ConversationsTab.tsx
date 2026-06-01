'use client';

import {
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import type { ConversationStat, InboxStat, LabelStat } from '@/lib/demo/reportsFixture';

const tooltipStyle = {
  contentStyle: {
    fontSize: 11,
    borderRadius: 8,
    border: '1px solid #e5e7eb',
    boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
  },
};

function fmtSec(s: number): string {
  if (s < 60) return `${Math.round(s)}s`;
  if (s < 3600) return `${Math.round(s / 60)}m`;
  return `${(s / 3600).toFixed(1)}h`;
}

// ─── Volume Trend ──────────────────────────────────────────────────────────────

function VolumeTrend({ data }: { data: ConversationStat[] }) {
  const chart = data.map(d => ({
    date: d.date.slice(5),
    Total: d.total,
    Resolved: d.resolved,
    Open: d.open,
  }));

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      <h3 className="text-sm font-semibold text-gray-900 mb-4">Conversation Volume</h3>
      <ResponsiveContainer width="100%" height={220}>
        <AreaChart data={chart} margin={{ top: 4, right: 8, bottom: 0, left: -8 }}>
          <defs>
            <linearGradient id="gRes" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
              <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
          <XAxis dataKey="date" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
          <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
          <Tooltip {...tooltipStyle} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Area type="monotone" dataKey="Total" stroke="#0B5FFF" fill="none" strokeWidth={2} dot={false} />
          <Area type="monotone" dataKey="Resolved" stroke="#10b981" fill="url(#gRes)" strokeWidth={2} dot={false} />
          <Area type="monotone" dataKey="Open" stroke="#f59e0b" fill="none" strokeWidth={1.5} dot={false} strokeDasharray="4 2" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── FRT Trend ─────────────────────────────────────────────────────────────────

function FRTTrend({ data }: { data: ConversationStat[] }) {
  const chart = data.map(d => ({
    date: d.date.slice(5),
    'FRT (min)': Math.round(d.avgFrtSec / 60),
    'Resolution (h)': Math.round(d.avgResolutionHours * 10) / 10,
  }));

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      <h3 className="text-sm font-semibold text-gray-900 mb-4">First Response & Resolution Time</h3>
      <ResponsiveContainer width="100%" height={220}>
        <AreaChart data={chart} margin={{ top: 4, right: 8, bottom: 0, left: -8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
          <XAxis dataKey="date" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
          <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
          <Tooltip {...tooltipStyle} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Area type="monotone" dataKey="FRT (min)" stroke="#8b5cf6" fill="none" strokeWidth={2} dot={false} />
          <Area type="monotone" dataKey="Resolution (h)" stroke="#f97316" fill="none" strokeWidth={1.5} dot={false} strokeDasharray="4 2" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── Inbox breakdown ───────────────────────────────────────────────────────────

const INBOX_COLORS = ['#0B5FFF', '#10b981', '#25d366', '#1877f2', '#1da1f2'];

function InboxBreakdown({ inboxes }: { inboxes: InboxStat[] }) {
  const data = inboxes.map(i => ({
    inbox: i.inbox,
    Total: i.total,
    Resolved: i.resolved,
    'FRT': Math.round(i.avgFrtSec),
  }));

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      <h3 className="text-sm font-semibold text-gray-900 mb-4">Volume by Inbox</h3>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
          <XAxis dataKey="inbox" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
          <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
          <Tooltip {...tooltipStyle} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Bar dataKey="Total" fill="#e5e7eb" radius={[2, 2, 0, 0]} maxBarSize={24}>
            {data.map((_, i) => <Cell key={i} fill={INBOX_COLORS[i % INBOX_COLORS.length]} opacity={0.3} />)}
          </Bar>
          <Bar dataKey="Resolved" fill="#10b981" radius={[2, 2, 0, 0]} maxBarSize={24}>
            {data.map((_, i) => <Cell key={i} fill={INBOX_COLORS[i % INBOX_COLORS.length]} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      {/* FRT table */}
      <table className="w-full text-[11px] mt-3">
        <thead>
          <tr className="border-b border-gray-100">
            <th className="text-left py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Inbox</th>
            <th className="text-right py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Total</th>
            <th className="text-right py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Resolved</th>
            <th className="text-right py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Avg FRT</th>
          </tr>
        </thead>
        <tbody>
          {inboxes.map((inbox, i) => (
            <tr key={inbox.inbox} className="border-b border-gray-50">
              <td className="py-1.5 font-medium flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: INBOX_COLORS[i % INBOX_COLORS.length] }} />
                {inbox.inbox}
              </td>
              <td className="py-1.5 text-right tabular-nums">{inbox.total}</td>
              <td className="py-1.5 text-right tabular-nums text-green-600">{inbox.resolved}</td>
              <td className="py-1.5 text-right tabular-nums text-muted-foreground">{fmtSec(inbox.avgFrtSec)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Labels bar chart ──────────────────────────────────────────────────────────

function LabelDistribution({ labels }: { labels: LabelStat[] }) {
  const sorted = [...labels].sort((a, b) => b.count - a.count);
  const data = sorted.map(l => ({ label: l.label.replace('-', ' '), Count: l.count }));

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      <h3 className="text-sm font-semibold text-gray-900 mb-4">Top Labels</h3>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 16, bottom: 0, left: 16 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" horizontal={false} />
          <XAxis type="number" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
          <YAxis type="category" dataKey="label" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} width={100} />
          <Tooltip {...tooltipStyle} />
          <Bar dataKey="Count" fill="#0B5FFF" radius={[0, 4, 4, 0]} maxBarSize={12} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── Main tab ─────────────────────────────────────────────────────────────────

interface Props {
  conversations: ConversationStat[];
  inboxes: InboxStat[];
  labels: LabelStat[];
}

export function ConversationsTab({ conversations, inboxes, labels }: Props) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <VolumeTrend data={conversations} />
        <FRTTrend data={conversations} />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <InboxBreakdown inboxes={inboxes} />
        <LabelDistribution labels={labels} />
      </div>
    </div>
  );
}
