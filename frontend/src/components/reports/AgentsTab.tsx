'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { TrendingUp, TrendingDown, Minus, Download } from 'lucide-react';
import type { AgentStat } from '@/lib/demo/reportsFixture';
import { exportSheetToExcel } from '@/lib/utils/exportXlsx';
import { cn } from '@/lib/utils/cn';

// ─── Helpers ───────────────────────────────────────────────────────────────────

function fmtSec(s: number) {
  const m = Math.floor(s / 60);
  const sec = Math.round(s % 60);
  return `${m}m ${sec}s`;
}

function pct(n: number) {
  return `${Math.round(n * 100)}%`;
}

function mosColor(mos: number) {
  if (mos >= 4.2) return 'text-green-600 bg-green-50';
  if (mos >= 3.6) return 'text-amber-600 bg-amber-50';
  return 'text-red-600 bg-red-50';
}

const tooltipStyle = {
  contentStyle: {
    fontSize: 11,
    borderRadius: 8,
    border: '1px solid #e5e7eb',
    boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
  },
};

// ─── Utilization bar ──────────────────────────────────────────────────────────

function UtilizationChart({ agents }: { agents: AgentStat[] }) {
  const data = [...agents]
    .sort((a, b) => b.utilization - a.utilization)
    .map(a => ({
      name: a.name.split(' ')[0],
      Utilization: Math.round(a.utilization * 100),
    }));

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      <h3 className="text-sm font-semibold text-gray-900 mb-4">Agent Utilization %</h3>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 16, bottom: 0, left: 40 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" horizontal={false} />
          <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10 }} tickLine={false} axisLine={false} unit="%" />
          <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={60} />
          <Tooltip {...tooltipStyle} formatter={(v: number) => [`${v}%`, 'Utilization']} />
          <Bar dataKey="Utilization" radius={[0, 4, 4, 0]} maxBarSize={14}>
            {data.map((d, i) => (
              <Cell
                key={i}
                fill={d.Utilization >= 85 ? '#ef4444' : d.Utilization >= 70 ? '#0B5FFF' : '#10b981'}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <p className="text-[10px] text-muted-foreground mt-2">
        <span className="inline-block w-2 h-2 rounded-full bg-green-500 mr-1" />{'<70% '}
        <span className="inline-block w-2 h-2 rounded-full bg-blue-500 mx-1" />70–85%
        <span className="inline-block w-2 h-2 rounded-full bg-red-500 mx-1" />{'>85% overloaded'}
      </p>
    </div>
  );
}

// ─── AHT comparison chart ─────────────────────────────────────────────────────

function AHTCompare({ agents }: { agents: AgentStat[] }) {
  const data = [...agents]
    .sort((a, b) => a.avgHandleTimeSec - b.avgHandleTimeSec)
    .map(a => ({
      name: a.name.split(' ')[0],
      'AHT (s)': Math.round(a.avgHandleTimeSec),
    }));

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      <h3 className="text-sm font-semibold text-gray-900 mb-4">Avg Handle Time by Agent</h3>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 16, bottom: 0, left: 40 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" horizontal={false} />
          <XAxis type="number" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} unit="s" />
          <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={60} />
          <Tooltip {...tooltipStyle} formatter={(v: number) => [fmtSec(v), 'AHT']} />
          <Bar dataKey="AHT (s)" fill="#8b5cf6" radius={[0, 4, 4, 0]} maxBarSize={14} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── Agent leaderboard table ───────────────────────────────────────────────────

function LeaderboardTable({ agents }: { agents: AgentStat[] }) {
  const sorted = [...agents].sort((a, b) => b.handled - a.handled);

  const exportTable = () => {
    exportSheetToExcel(
      sorted.map(a => ({
        Agent: a.name,
        Handled: a.handled,
        Missed: a.missed,
        'Miss Rate': `${Math.round((a.missed / Math.max(1, a.handled + a.missed)) * 100)}%`,
        'AHT (s)': Math.round(a.avgHandleTimeSec),
        'Utilization': `${Math.round(a.utilization * 100)}%`,
        'MOS Avg': a.mosAvg,
      })),
      'agent-performance',
      'Agents',
    );
  };

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 col-span-full">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-900">Agent Performance Leaderboard</h3>
        <button
          type="button"
          onClick={exportTable}
          className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-gray-700 border border-gray-200 rounded-md px-2 py-1"
        >
          <Download className="w-3 h-3" /> Excel
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-gray-100">
              {['#', 'Agent', 'Handled', 'Missed', 'Miss Rate', 'AHT', 'AHT Trend', 'Utilization', 'MOS'].map(h => (
                <th key={h} className="text-left py-2 pr-4 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((a, i) => {
              const missRate = (a.missed / Math.max(1, a.handled + a.missed)) * 100;
              return (
                <tr key={a.agentId} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                  <td className="py-2.5 pr-4 text-muted-foreground font-mono">{i + 1}</td>
                  <td className="py-2.5 pr-4 font-medium text-gray-900 whitespace-nowrap">{a.name}</td>
                  <td className="py-2.5 pr-4 tabular-nums font-semibold">{a.handled}</td>
                  <td className="py-2.5 pr-4 tabular-nums text-red-600">{a.missed}</td>
                  <td className="py-2.5 pr-4">
                    <span className={cn(
                      'px-1.5 py-0.5 rounded text-[10px] font-semibold',
                      missRate > 10 ? 'bg-red-50 text-red-700' : missRate > 5 ? 'bg-amber-50 text-amber-700' : 'bg-green-50 text-green-700',
                    )}>
                      {missRate.toFixed(1)}%
                    </span>
                  </td>
                  <td className="py-2.5 pr-4 tabular-nums">{fmtSec(a.avgHandleTimeSec)}</td>
                  <td className="py-2.5 pr-4">
                    <span className={cn(
                      'flex items-center gap-1',
                      a.ahtTrend > 10 ? 'text-red-500' : a.ahtTrend < -10 ? 'text-green-600' : 'text-gray-400',
                    )}>
                      {Math.abs(a.ahtTrend) < 5 ? (
                        <Minus className="w-3 h-3" />
                      ) : a.ahtTrend > 0 ? (
                        <TrendingUp className="w-3 h-3" />
                      ) : (
                        <TrendingDown className="w-3 h-3" />
                      )}
                      {a.ahtTrend > 0 ? '+' : ''}{a.ahtTrend}s
                    </span>
                  </td>
                  <td className="py-2.5 pr-4">
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={cn(
                            'h-full rounded-full',
                            a.utilization > 0.85 ? 'bg-red-500' : a.utilization > 0.70 ? 'bg-blue-500' : 'bg-green-500',
                          )}
                          style={{ width: `${Math.min(100, Math.round(a.utilization * 100))}%` }}
                        />
                      </div>
                      <span className="tabular-nums text-[11px]">{pct(a.utilization)}</span>
                    </div>
                  </td>
                  <td className="py-2.5 pr-4">
                    <span className={cn('px-1.5 py-0.5 rounded text-[10px] font-semibold', mosColor(a.mosAvg))}>
                      {a.mosAvg.toFixed(1)}
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

interface Props { agents: AgentStat[] }

export function AgentsTab({ agents }: Props) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <UtilizationChart agents={agents} />
        <AHTCompare agents={agents} />
      </div>
      <div className="grid grid-cols-1">
        <LeaderboardTable agents={agents} />
      </div>
    </div>
  );
}
