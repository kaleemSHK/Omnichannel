'use client';

import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import type { QueueStat } from '@/lib/demo/reportsFixture';
import { cn } from '@/lib/utils/cn';

const tooltipStyle = {
  contentStyle: {
    fontSize: 11,
    borderRadius: 8,
    border: '1px solid #e5e7eb',
    boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
  },
};

const QUEUE_COLORS = ['#0B5FFF', '#10b981', '#f59e0b', '#8b5cf6'];

// ─── SLA Trend ─────────────────────────────────────────────────────────────────

function SLATrend({ queues }: { queues: QueueStat[] }) {
  const days = queues[0]?.slaTrend ?? [];
  const data = days.slice(-14).map((d, i) => {
    const row: Record<string, number | string> = { date: d.date.slice(5) };
    queues.forEach(q => {
      row[q.name] = Math.round(q.slaTrend[q.slaTrend.length - 14 + i]?.slaPercent ?? 0);
    });
    return row;
  });

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      <h3 className="text-sm font-semibold text-gray-900 mb-4">SLA % Trend by Queue (last 14 days)</h3>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
          <XAxis dataKey="date" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
          <YAxis domain={[60, 100]} tick={{ fontSize: 10 }} tickLine={false} axisLine={false} unit="%" />
          <Tooltip {...tooltipStyle} formatter={(v: number) => [`${v}%`]} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <ReferenceLine y={80} stroke="#ef4444" strokeDasharray="4 2" label={{ value: 'SLA target 80%', fontSize: 9, fill: '#ef4444', position: 'right' }} />
          {queues.map((q, i) => (
            <Line key={q.queueKey} type="monotone" dataKey={q.name} stroke={QUEUE_COLORS[i]} strokeWidth={2} dot={false} />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── Wait time bar ─────────────────────────────────────────────────────────────

function WaitTimeBar({ queues }: { queues: QueueStat[] }) {
  const data = queues.map(q => ({
    queue: q.name,
    'Avg Wait (s)': Math.round(q.avgWaitSec),
    'Max Wait (s)': Math.round(q.maxWaitSec),
  }));

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      <h3 className="text-sm font-semibold text-gray-900 mb-4">Wait Times by Queue</h3>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
          <XAxis dataKey="queue" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
          <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} unit="s" />
          <Tooltip {...tooltipStyle} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Bar dataKey="Avg Wait (s)" fill="#0B5FFF" radius={[2, 2, 0, 0]} maxBarSize={20} />
          <Bar dataKey="Max Wait (s)" fill="#e5e7eb" radius={[2, 2, 0, 0]} maxBarSize={20} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── Queue health table ─────────────────────────────────────────────────────────

function QueueHealthTable({ queues }: { queues: QueueStat[] }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 col-span-full">
      <h3 className="text-sm font-semibold text-gray-900 mb-4">Queue Health Summary</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-gray-100">
              {['Queue', 'Total Calls', 'SLA %', 'Avg Wait', 'Max Wait', 'Abandoned', 'Health'].map(h => (
                <th key={h} className="text-left py-2 pr-4 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {queues.map(q => {
              const health = q.slaPercent >= 90 ? 'Excellent' : q.slaPercent >= 80 ? 'Good' : q.slaPercent >= 70 ? 'Fair' : 'Poor';
              const healthColor = q.slaPercent >= 90 ? 'bg-green-50 text-green-700' : q.slaPercent >= 80 ? 'bg-blue-50 text-blue-700' : q.slaPercent >= 70 ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-700';
              return (
                <tr key={q.queueKey} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                  <td className="py-2.5 pr-4 font-medium text-gray-900">{q.name}</td>
                  <td className="py-2.5 pr-4 tabular-nums">{q.totalCalls.toLocaleString()}</td>
                  <td className="py-2.5 pr-4">
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={cn('h-full rounded-full', q.slaPercent >= 80 ? 'bg-green-500' : 'bg-red-500')}
                          style={{ width: `${Math.min(100, q.slaPercent)}%` }}
                        />
                      </div>
                      <span className="tabular-nums font-semibold">{q.slaPercent.toFixed(1)}%</span>
                    </div>
                  </td>
                  <td className="py-2.5 pr-4 tabular-nums">{Math.round(q.avgWaitSec)}s</td>
                  <td className="py-2.5 pr-4 tabular-nums text-amber-600">{Math.round(q.maxWaitSec)}s</td>
                  <td className="py-2.5 pr-4 tabular-nums text-red-600">{q.abandoned}</td>
                  <td className="py-2.5 pr-4">
                    <span className={cn('px-2 py-0.5 rounded-full text-[10px] font-semibold', healthColor)}>
                      {health}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Main tab ─────────────────────────────────────────────────────────────────

interface Props { queues: QueueStat[] }

export function QueuesTab({ queues }: Props) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <SLATrend queues={queues} />
        <WaitTimeBar queues={queues} />
      </div>
      <QueueHealthTable queues={queues} />
    </div>
  );
}
