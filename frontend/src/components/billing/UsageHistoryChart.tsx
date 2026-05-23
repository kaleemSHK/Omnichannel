'use client';

import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { UsageHistoryPoint } from '@/lib/utils/billing';

interface Props {
  data: UsageHistoryPoint[];
  metric?: keyof Omit<UsageHistoryPoint, 'month'>;
}

const METRICS: { key: keyof Omit<UsageHistoryPoint, 'month'>; label: string; color: string }[] = [
  { key: 'agents', label: 'Agents', color: '#0B5FFF' },
  { key: 'pstn', label: 'PSTN min', color: '#6366f1' },
  { key: 'whatsapp', label: 'WhatsApp', color: '#22c55e' },
  { key: 'ai', label: 'AI tokens', color: '#a855f7' },
];

export function UsageHistoryChart({ data, metric }: Props) {
  const series = metric
    ? METRICS.filter(m => m.key === metric)
    : METRICS.slice(0, 3);

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="month" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} width={48} />
          <Tooltip />
          <Legend />
          {series.map(s => (
            <Area
              key={s.key}
              type="monotone"
              dataKey={s.key}
              name={s.label}
              stroke={s.color}
              fill={s.color}
              fillOpacity={0.15}
              strokeWidth={2}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
