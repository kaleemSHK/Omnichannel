'use client';

/**
 * VoicebotAnalyticsPanel — Sprint 3 V1
 * Shows voicebot KPIs: session volume, intent distribution, latency metrics,
 * escalation rate, and a session transcript viewer.
 */

import { useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  Cell,
} from 'recharts';
import { Bot, ChevronDown, ChevronUp, Mic, Zap, Volume2, Phone, ArrowUpRight } from 'lucide-react';
import { useVoicebotAnalytics, useSessionTranscript } from '@/lib/hooks/useVoicebot';
import { DEMO_VOICEBOT_SESSIONS } from '@/lib/demo/voicebotFixture';
import { cn } from '@/lib/utils/cn';
import type { VoicebotTurn } from '@/lib/api/voicebot';

// ─── Intent label map ─────────────────────────────────────────────────────────

const INTENT_LABELS: Record<string, string> = {
  billing_inquiry:   'Billing',
  technical_support: 'Tech Support',
  plan_change:       'Plan Change',
  complaint:         'Complaint',
  human_request:     'Human Request',
  unrecognized:      'Unrecognized',
};

const INTENT_COLORS: Record<string, string> = {
  billing_inquiry:   '#3B82F6',
  technical_support: '#10B981',
  plan_change:       '#8B5CF6',
  complaint:         '#EF4444',
  human_request:     '#F59E0B',
  unrecognized:      '#9CA3AF',
};

// ─── KPI card ─────────────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  sub,
  icon: Icon,
  tone = 'default',
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ElementType;
  tone?: 'default' | 'warning' | 'success';
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{label}</span>
        <Icon
          size={15}
          className={
            tone === 'warning' ? 'text-amber-500' :
            tone === 'success' ? 'text-green-500' :
            'text-blue-500'
          }
        />
      </div>
      <span className={cn(
        'text-2xl font-bold tabular-nums',
        tone === 'warning' ? 'text-amber-600' :
        tone === 'success' ? 'text-green-600' :
        'text-gray-900',
      )}>
        {value}
      </span>
      {sub && <span className="text-xs text-muted-foreground">{sub}</span>}
    </div>
  );
}

// ─── Transcript viewer ────────────────────────────────────────────────────────

function TurnRow({ turn }: { turn: VoicebotTurn }) {
  const intentColor = INTENT_COLORS[turn.intent] ?? '#9CA3AF';
  const intentLabel = INTENT_LABELS[turn.intent] ?? turn.intent;
  return (
    <div className="border border-gray-100 rounded-md p-3 space-y-1.5">
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-semibold text-muted-foreground">Turn {turn.turn_index + 1}</span>
        <span
          className="text-[10px] px-1.5 py-0.5 rounded-full font-medium text-white"
          style={{ backgroundColor: intentColor }}
        >
          {intentLabel}
        </span>
        {turn.barge_in && (
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-700 font-medium">
            barge-in
          </span>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <p className="text-[10px] font-medium text-muted-foreground mb-0.5">Caller</p>
          <p className="text-xs text-gray-700 bg-gray-50 rounded p-1.5 font-mono" dir="rtl">{turn.transcript || '—'}</p>
        </div>
        <div>
          <p className="text-[10px] font-medium text-muted-foreground mb-0.5">Bot</p>
          <p className="text-xs text-blue-700 bg-blue-50 rounded p-1.5 font-mono" dir="rtl">{turn.response_text || '—'}</p>
        </div>
      </div>
      <div className="flex gap-3 text-[10px] text-muted-foreground">
        <span>STT {turn.stt_latency_ms}ms</span>
        <span>LLM {turn.llm_latency_ms}ms</span>
        <span>TTS {turn.tts_latency_ms}ms</span>
      </div>
    </div>
  );
}

function TranscriptViewer({ sessionId }: { sessionId: string }) {
  const { data, isLoading } = useSessionTranscript(sessionId);

  if (isLoading) return <p className="text-xs text-muted-foreground py-4 text-center">Loading transcript…</p>;
  if (!data) return <p className="text-xs text-muted-foreground py-4 text-center">No transcript found.</p>;

  return (
    <div className="space-y-2 mt-3">
      <div className="flex items-center gap-4 text-xs text-muted-foreground pb-2 border-b">
        <span>Call ID: <strong>{data.session.call_id}</strong></span>
        <span>State: <strong>{data.session.state}</strong></span>
        {data.session.transfer_to_queue_id && (
          <span>Queue: <strong>{data.session.transfer_to_queue_id}</strong></span>
        )}
      </div>
      {data.turns.map(t => <TurnRow key={t.turn_index} turn={t} />)}
      {data.turns.length === 0 && (
        <p className="text-xs text-muted-foreground text-center py-4">No turns recorded.</p>
      )}
    </div>
  );
}

// ─── Sessions list ────────────────────────────────────────────────────────────

const STATE_CHIP: Record<string, string> = {
  ended:       'bg-gray-100 text-gray-600',
  transferring:'bg-amber-100 text-amber-700',
  listening:   'bg-blue-100 text-blue-700',
  responding:  'bg-purple-100 text-purple-700',
  greeting:    'bg-green-100 text-green-700',
};

function SessionList({ onSelect }: { onSelect: (id: string) => void }) {
  const sessions = DEMO_VOICEBOT_SESSIONS;
  return (
    <div className="space-y-1.5 mt-2">
      {sessions.map(s => (
        <button
          key={s.id}
          type="button"
          onClick={() => onSelect(s.id)}
          className="w-full text-start border border-gray-200 rounded-md p-2.5 hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Phone size={12} className="text-muted-foreground" />
              <span className="text-xs font-medium text-gray-800">{s.call_id}</span>
            </div>
            <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full font-medium', STATE_CHIP[s.state] ?? 'bg-gray-100 text-gray-600')}>
              {s.state}
            </span>
          </div>
          <div className="flex items-center gap-3 mt-1 text-[10px] text-muted-foreground">
            <span>{new Date(s.created_at).toLocaleTimeString()}</span>
            <span>{s.misunderstanding_count} misunderstandings</span>
            {s.transfer_to_queue_id && <span className="text-amber-600">→ {s.transfer_to_queue_id}</span>}
          </div>
        </button>
      ))}
    </div>
  );
}

// ─── Collapsible section ──────────────────────────────────────────────────────

function Section({ title, children, defaultOpen = true }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between mb-3"
      >
        <span className="text-sm font-semibold text-gray-800">{title}</span>
        {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>
      {open && children}
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

type Range = 'today' | '7d' | '30d';

export function VoicebotAnalyticsPanel() {
  const [range, setRange] = useState<Range>('7d');
  const [selectedSession, setSelectedSession] = useState<string | null>(null);
  const { data, isLoading } = useVoicebotAnalytics(range);

  const intentData = (data?.intent_distribution ?? []).map(d => ({
    name: INTENT_LABELS[d.intent] ?? d.intent,
    count: d.count,
    color: INTENT_COLORS[d.intent] ?? '#9CA3AF',
  }));

  const totalSessions = data?.total_sessions ?? 0;
  const completedSessions = data?.completed_sessions ?? 0;
  const containmentRate = totalSessions > 0
    ? Math.round((completedSessions / totalSessions) * 100)
    : 0;

  return (
    <div className="p-4 space-y-4 min-w-0">
      {/* Header + range selector */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bot size={18} className="text-blue-600" />
          <h2 className="text-base font-semibold text-gray-900">Voicebot Analytics</h2>
        </div>
        <div className="flex gap-1 bg-gray-100 rounded-md p-0.5">
          {(['today', '7d', '30d'] as Range[]).map(r => (
            <button
              key={r}
              type="button"
              onClick={() => setRange(r)}
              className={cn(
                'px-3 py-1 rounded text-xs font-medium transition-colors',
                range === r ? 'bg-white text-gray-800 shadow-sm' : 'text-muted-foreground hover:text-gray-700',
              )}
            >
              {r === 'today' ? 'Today' : r === '7d' ? '7 days' : '30 days'}
            </button>
          ))}
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard
          label="Total sessions"
          value={isLoading ? '…' : totalSessions}
          icon={Phone}
        />
        <KpiCard
          label="Escalation rate"
          value={isLoading ? '…' : `${data?.escalation_rate ?? 0}%`}
          sub="Transferred to agent"
          icon={ArrowUpRight}
          tone={(data?.escalation_rate ?? 0) > 40 ? 'warning' : 'default'}
        />
        <KpiCard
          label="Containment rate"
          value={isLoading ? '…' : `${containmentRate}%`}
          sub="Resolved by bot"
          icon={Bot}
          tone={containmentRate > 60 ? 'success' : 'default'}
        />
        <KpiCard
          label="Avg turns to handoff"
          value={isLoading ? '…' : data?.avg_turns_to_handoff ?? 0}
          sub="Turns before escalation"
          icon={Zap}
        />
      </div>

      {/* Latency KPIs */}
      <div className="grid grid-cols-3 gap-3">
        <KpiCard label="Avg STT latency" value={isLoading ? '…' : `${data?.avg_stt_ms ?? 0}ms`} icon={Mic} />
        <KpiCard label="Avg LLM latency" value={isLoading ? '…' : `${data?.avg_llm_ms ?? 0}ms`} icon={Bot} />
        <KpiCard label="Avg TTS latency" value={isLoading ? '…' : `${data?.avg_tts_ms ?? 0}ms`} icon={Volume2} />
      </div>

      {/* Intent distribution */}
      <Section title="Intent distribution">
        {intentData.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-8">No data for selected period.</p>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={intentData} margin={{ top: 4, right: 8, left: -10, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip
                formatter={(value: number) => [value, 'Turns']}
                contentStyle={{ fontSize: 12 }}
              />
              <Bar dataKey="count" radius={[3, 3, 0, 0]}>
                {intentData.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </Section>

      {/* Daily sessions trend */}
      <Section title="Daily sessions">
        {(data?.daily_sessions?.length ?? 0) === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-8">No data for selected period.</p>
        ) : (
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={data?.daily_sessions ?? []} margin={{ top: 4, right: 8, left: -10, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={d => d.slice(5)} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip contentStyle={{ fontSize: 12 }} labelFormatter={d => `Date: ${d}`} />
              <Line
                type="monotone"
                dataKey="sessions"
                stroke="#3B82F6"
                strokeWidth={2}
                dot={{ r: 3, fill: '#3B82F6' }}
                activeDot={{ r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </Section>

      {/* Session transcript viewer */}
      <Section title="Session transcripts" defaultOpen={false}>
        {selectedSession ? (
          <>
            <button
              type="button"
              onClick={() => setSelectedSession(null)}
              className="text-xs text-blue-600 hover:underline mb-2"
            >
              ← Back to session list
            </button>
            <TranscriptViewer sessionId={selectedSession} />
          </>
        ) : (
          <SessionList onSelect={setSelectedSession} />
        )}
      </Section>
    </div>
  );
}
