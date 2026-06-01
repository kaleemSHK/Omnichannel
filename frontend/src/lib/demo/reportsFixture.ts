/**
 * Synthetic 30-day analytics fixture for the Reports dashboard.
 * Generates realistic call-center patterns: morning/afternoon peaks, weekday
 * drop on weekends, ~12% missed rate, WhatsApp growing vs PSTN.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DayStat {
  date: string;          // YYYY-MM-DD
  totalCalls: number;
  answered: number;
  missed: number;
  abandoned: number;
  avgHandleTimeSec: number;
  avgWaitSec: number;
  slaPercent: number;
  inbound: number;
  outbound: number;
  pstn: number;
  whatsapp: number;
  webrtc: number;
}

export interface HourStat {
  hour: number;          // 0-23
  calls: number;
  answered: number;
  missed: number;
}

export interface AgentStat {
  agentId: string;
  name: string;
  handled: number;
  missed: number;
  avgHandleTimeSec: number;
  avgWaitSec: number;
  utilization: number;   // 0–1
  ahtTrend: number;      // delta vs previous period (seconds)
  mosAvg: number;
}

export interface QueueStat {
  queueKey: string;
  name: string;
  totalCalls: number;
  slaPercent: number;
  avgWaitSec: number;
  maxWaitSec: number;
  abandoned: number;
  slaTrend: DayStat[];
}

export interface ConversationStat {
  date: string;
  total: number;
  resolved: number;
  open: number;
  avgFrtSec: number;
  avgResolutionHours: number;
}

export interface InboxStat {
  inbox: string;
  total: number;
  resolved: number;
  avgFrtSec: number;
}

export interface LabelStat {
  label: string;
  count: number;
}

export interface ReportSummary {
  days: DayStat[];
  hourlyToday: HourStat[];
  agents: AgentStat[];
  queues: QueueStat[];
  conversations: ConversationStat[];
  inboxes: InboxStat[];
  labels: LabelStat[];
  period: { from: string; to: string };
}

// ─── Generator ────────────────────────────────────────────────────────────────

function rnd(min: number, max: number) {
  return Math.round(min + Math.random() * (max - min));
}

function flt(min: number, max: number) {
  return Math.round((min + Math.random() * (max - min)) * 10) / 10;
}

const AGENT_NAMES = [
  'Sarah Al-Hinai',
  'Omar Al-Kindi',
  'Fatima Al-Zahraa',
  'Ahmed Al-Rashidi',
  'Mohammed Al-Balushi',
  'Layla Hassan',
  'Khalid Ibrahim',
  'Noura Al-Said',
];

function generateDays(count: number): DayStat[] {
  const days: DayStat[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dow = d.getDay(); // 0=Sun
    const isWeekend = dow === 0 || dow === 6;
    const base = isWeekend ? rnd(40, 65) : rnd(90, 140);
    const answered = Math.round(base * flt(0.84, 0.92));
    const missed = Math.round(base * flt(0.06, 0.12));
    const abandoned = base - answered - missed;
    const pstn = Math.round(base * flt(0.55, 0.68));
    const whatsapp = Math.round(base * flt(0.22, 0.32));
    const webrtc = base - pstn - whatsapp;
    days.push({
      date: d.toISOString().slice(0, 10),
      totalCalls: base,
      answered,
      missed,
      abandoned: Math.max(0, abandoned),
      avgHandleTimeSec: rnd(180, 420),
      avgWaitSec: isWeekend ? rnd(8, 25) : rnd(18, 65),
      slaPercent: isWeekend ? flt(92, 99) : flt(78, 97),
      inbound: Math.round(base * flt(0.72, 0.85)),
      outbound: Math.round(base * flt(0.15, 0.28)),
      pstn,
      whatsapp,
      webrtc: Math.max(0, webrtc),
    });
  }
  return days;
}

function generateHourly(): HourStat[] {
  return Array.from({ length: 24 }, (_, h) => {
    const isBusy = h >= 8 && h <= 12 || h >= 14 && h <= 17;
    const isLunch = h >= 12 && h <= 14;
    const base = isBusy ? rnd(12, 22) : isLunch ? rnd(6, 12) : h >= 18 || h < 7 ? rnd(0, 3) : rnd(4, 10);
    const answered = Math.round(base * flt(0.82, 0.94));
    return { hour: h, calls: base, answered, missed: base - answered };
  });
}

function generateAgents(): AgentStat[] {
  return AGENT_NAMES.map((name, i) => {
    const handled = rnd(60, 210);
    return {
      agentId: `a${i + 1}`,
      name,
      handled,
      missed: rnd(2, Math.round(handled * 0.08)),
      avgHandleTimeSec: rnd(200, 480),
      avgWaitSec: rnd(5, 40),
      utilization: flt(0.55, 0.92) / 10 * 10,
      ahtTrend: rnd(-45, 45),
      mosAvg: flt(3.6, 4.4),
    };
  });
}

function generateQueues(days: DayStat[]): QueueStat[] {
  const queues = [
    { queueKey: 'support', name: 'Support' },
    { queueKey: 'sales', name: 'Sales' },
    { queueKey: 'billing', name: 'Billing' },
    { queueKey: 'technical', name: 'Technical' },
  ];
  return queues.map(q => {
    const total = rnd(200, 600);
    const slaDays = days.map(d => ({
      ...d,
      slaPercent: Math.min(100, d.slaPercent + flt(-5, 8)),
    }));
    return {
      ...q,
      totalCalls: total,
      slaPercent: flt(80, 97),
      avgWaitSec: rnd(15, 90),
      maxWaitSec: rnd(120, 480),
      abandoned: rnd(10, Math.round(total * 0.08)),
      slaTrend: slaDays,
    };
  });
}

function generateConversations(days: DayStat[]): ConversationStat[] {
  return days.map(d => {
    const total = rnd(60, 180);
    const resolved = Math.round(total * flt(0.7, 0.9));
    return {
      date: d.date,
      total,
      resolved,
      open: total - resolved,
      avgFrtSec: rnd(60, 900),
      avgResolutionHours: flt(1, 24),
    };
  });
}

function generateInboxes(): InboxStat[] {
  return [
    { inbox: 'Live Chat', total: rnd(300, 500), resolved: rnd(200, 350), avgFrtSec: rnd(30, 120) },
    { inbox: 'Email', total: rnd(200, 400), resolved: rnd(150, 300), avgFrtSec: rnd(1800, 7200) },
    { inbox: 'WhatsApp', total: rnd(150, 280), resolved: rnd(100, 220), avgFrtSec: rnd(120, 600) },
    { inbox: 'Facebook', total: rnd(60, 120), resolved: rnd(40, 100), avgFrtSec: rnd(300, 1800) },
    { inbox: 'Twitter/X', total: rnd(20, 60), resolved: rnd(15, 50), avgFrtSec: rnd(600, 3600) },
  ];
}

function generateLabels(): LabelStat[] {
  return [
    { label: 'billing-issue', count: rnd(60, 120) },
    { label: 'technical-support', count: rnd(80, 160) },
    { label: 'account-query', count: rnd(40, 90) },
    { label: 'complaint', count: rnd(20, 60) },
    { label: 'upgrade-request', count: rnd(30, 80) },
    { label: 'new-customer', count: rnd(25, 70) },
    { label: 'refund', count: rnd(15, 45) },
    { label: 'port-in', count: rnd(10, 35) },
  ];
}

let _cached: ReportSummary | null = null;

export function getDemoReport(days = 30): ReportSummary {
  if (_cached) return _cached;
  const dayStats = generateDays(days);
  const to = new Date().toISOString().slice(0, 10);
  const from = dayStats[0].date;
  _cached = {
    days: dayStats,
    hourlyToday: generateHourly(),
    agents: generateAgents(),
    queues: generateQueues(dayStats),
    conversations: generateConversations(dayStats),
    inboxes: generateInboxes(),
    labels: generateLabels(),
    period: { from, to },
  };
  return _cached;
}

export function computeKPIs(days: DayStat[], prevDays: DayStat[]) {
  const sum = (arr: DayStat[], k: keyof DayStat) =>
    arr.reduce((a, d) => a + Number(d[k]), 0);
  const avg = (arr: DayStat[], k: keyof DayStat) =>
    arr.length ? sum(arr, k) / arr.length : 0;

  const totalCalls = sum(days, 'totalCalls');
  const answered = sum(days, 'answered');
  const missed = sum(days, 'missed');
  const prevTotal = sum(prevDays, 'totalCalls');
  const prevAnswered = sum(prevDays, 'answered');

  const answerRate = totalCalls ? (answered / totalCalls) * 100 : 0;
  const prevAnswerRate = prevTotal ? (prevAnswered / prevTotal) * 100 : 0;

  return {
    totalCalls,
    totalCallsDelta: prevTotal ? ((totalCalls - prevTotal) / prevTotal) * 100 : 0,
    answerRate,
    answerRateDelta: answerRate - prevAnswerRate,
    missedCalls: missed,
    missedDelta: prevTotal ? ((sum(prevDays, 'missed') - missed) / Math.max(1, sum(prevDays, 'missed'))) * 100 : 0,
    avgHandleTime: avg(days, 'avgHandleTimeSec'),
    avgHandleTimeDelta: avg(days, 'avgHandleTimeSec') - avg(prevDays, 'avgHandleTimeSec'),
    avgWaitTime: avg(days, 'avgWaitSec'),
    avgWaitTimeDelta: avg(days, 'avgWaitSec') - avg(prevDays, 'avgWaitSec'),
    slaPercent: avg(days, 'slaPercent'),
    slaPercentDelta: avg(days, 'slaPercent') - avg(prevDays, 'slaPercent'),
  };
}
