import { DEMO_CANNED } from '@/lib/demo/settingsFixture';

export interface DemoCannedResponse {
  id: number;
  short_code: string;
  content: string;
}

export interface DemoLabel {
  id: number;
  title: string;
  color: string;
  show_on_sidebar: boolean;
}

export interface DemoTeam {
  id: number;
  name: string;
}

/** Same canned responses as Settings → Canned Responses (demo + fallback). */
export const DEMO_CANNED_RESPONSES: DemoCannedResponse[] = DEMO_CANNED;

export const DEMO_LABELS: DemoLabel[] = [
  { id: 1, title: 'billing', color: '#F59E0B', show_on_sidebar: true },
  { id: 2, title: 'vip', color: '#8B5CF6', show_on_sidebar: true },
  { id: 3, title: 'technical', color: '#0B5FFF', show_on_sidebar: true },
  { id: 4, title: 'sales', color: '#10B981', show_on_sidebar: false },
];

export const DEMO_TEAMS: DemoTeam[] = [
  { id: 1, name: 'Support' },
  { id: 2, name: 'Sales' },
  { id: 3, name: 'Billing' },
];

export const DEMO_REPORT_SUMMARY = {
  account: {
    conversations_count: 248,
    resolved_conversations_count: 198,
    avg_first_response_time: '4m 12s',
    avg_resolution_time: '2h 18m',
  },
  chartData: [
    { date: 'Mon', open: 12, resolved: 18 },
    { date: 'Tue', open: 15, resolved: 22 },
    { date: 'Wed', open: 9, resolved: 25 },
    { date: 'Thu', open: 14, resolved: 20 },
    { date: 'Fri', open: 11, resolved: 28 },
    { date: 'Sat', open: 6, resolved: 12 },
    { date: 'Sun', open: 4, resolved: 8 },
  ],
  byAgent: [
    { name: 'Sarah Al-Hinai', count: 62 },
    { name: 'Omar Al-Kindi', count: 54 },
    { name: 'Fatima Al-Zahraa', count: 48 },
    { name: 'Ahmed Al-Balushi', count: 41 },
    { name: 'Layla Al-Mamari', count: 35 },
  ],
  byInbox: [
    { name: 'WhatsApp', count: 98 },
    { name: 'Email', count: 72 },
    { name: 'Web Chat', count: 48 },
    { name: 'SMS', count: 30 },
  ],
};

export const DEMO_AGENT_REPORT = [
  {
    name: 'Sarah Al-Hinai',
    open: 8,
    resolved: 54,
    avg_first_response: '3m 40s',
    avg_resolution: '1h 55m',
    online_time: '6h 12m',
  },
  {
    name: 'Omar Al-Kindi',
    open: 6,
    resolved: 48,
    avg_first_response: '4m 05s',
    avg_resolution: '2h 10m',
    online_time: '5h 48m',
  },
  {
    name: 'Fatima Al-Zahraa',
    open: 5,
    resolved: 43,
    avg_first_response: '4m 30s',
    avg_resolution: '2h 22m',
    online_time: '5h 30m',
  },
];

export const DEMO_INBOX_REPORT = [
  { name: 'WhatsApp Support', open: 14, resolved: 84, avg_first_response: '3m 20s', avg_resolution: '1h 48m' },
  { name: 'Email Billing', open: 9, resolved: 63, avg_first_response: '5m 10s', avg_resolution: '2h 40m' },
  { name: 'Web Chat', open: 7, resolved: 41, avg_first_response: '4m 00s', avg_resolution: '2h 05m' },
];

export const DEMO_TEAM_REPORT = [
  { name: 'Support', open: 18, resolved: 120, avg_first_response: '4m 00s', avg_resolution: '2h 05m' },
  { name: 'Sales', open: 8, resolved: 45, avg_first_response: '3m 30s', avg_resolution: '1h 30m' },
  { name: 'Billing', open: 6, resolved: 33, avg_first_response: '5m 20s', avg_resolution: '2h 45m' },
];

// ─── A1 Advanced Analytics fixtures ─────────────────────────────────────────

export interface CsatPoint {
  date: string;
  satisfied: number;
  unsatisfied: number;
  score: number; // 0-100
}

export const DEMO_CSAT_DATA: CsatPoint[] = [
  { date: 'Mon', satisfied: 42, unsatisfied: 5, score: 89 },
  { date: 'Tue', satisfied: 38, unsatisfied: 7, score: 84 },
  { date: 'Wed', satisfied: 51, unsatisfied: 4, score: 93 },
  { date: 'Thu', satisfied: 44, unsatisfied: 6, score: 88 },
  { date: 'Fri', satisfied: 47, unsatisfied: 3, score: 94 },
  { date: 'Sat', satisfied: 22, unsatisfied: 2, score: 92 },
  { date: 'Sun', satisfied: 15, unsatisfied: 1, score: 94 },
];

/** 7 days × 24 hours heat matrix — value is conversations handled in that cell. */
export const DEMO_HOURLY_HEATMAP: number[][] = [
  // Sun
  [0,0,0,0,0,0,1,2,3,4,4,3, 3,4,3,2,2,1,1,0,0,0,0,0],
  // Mon
  [0,0,0,0,0,0,2,5,9,12,14,15,14,13,12,10,8,6,4,2,1,0,0,0],
  // Tue
  [0,0,0,0,0,0,2,6,10,13,16,17,15,14,11,9,7,5,3,2,1,0,0,0],
  // Wed
  [0,0,0,0,0,0,1,5,11,14,17,18,17,15,13,11,9,6,4,2,1,0,0,0],
  // Thu
  [0,0,0,0,0,0,2,6,10,12,15,16,14,13,11,9,8,5,3,2,1,0,0,0],
  // Fri
  [0,0,0,0,0,0,2,5,9,11,14,15,13,12,10,8,7,4,3,1,1,0,0,0],
  // Sat
  [0,0,0,0,0,0,0,1,3,5,6,7, 6,5,4,3,2,1,1,0,0,0,0,0],
];

export const DEMO_HEATMAP_DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

export interface SlaBreachPoint {
  date: string;
  breaches: number;
  total: number;
  breachRate: number; // 0-100 (%)
}

export const DEMO_SLA_BREACH: SlaBreachPoint[] = [
  { date: 'Mon', breaches: 3, total: 74, breachRate: 4.1 },
  { date: 'Tue', breaches: 5, total: 82, breachRate: 6.1 },
  { date: 'Wed', breaches: 2, total: 88, breachRate: 2.3 },
  { date: 'Thu', breaches: 6, total: 79, breachRate: 7.6 },
  { date: 'Fri', breaches: 4, total: 86, breachRate: 4.7 },
  { date: 'Sat', breaches: 1, total: 36, breachRate: 2.8 },
  { date: 'Sun', breaches: 0, total: 24, breachRate: 0 },
];

export interface FunnelPoint {
  stage: string;
  count: number;
  pct: number;
}

export const DEMO_FUNNEL: FunnelPoint[] = [
  { stage: 'Opened', count: 248, pct: 100 },
  { stage: 'Responded', count: 231, pct: 93 },
  { stage: 'Resolved', count: 198, pct: 80 },
  { stage: 'CSAT sent', count: 159, pct: 64 },
  { stage: 'CSAT received', count: 116, pct: 47 },
];
