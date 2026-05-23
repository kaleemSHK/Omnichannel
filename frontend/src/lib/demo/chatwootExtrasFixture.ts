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

export const DEMO_CANNED_RESPONSES: DemoCannedResponse[] = [
  {
    id: 1,
    short_code: 'greet',
    content: 'Hello! Thank you for contacting LABBIK Telecom. How can I help you today?',
  },
  {
    id: 2,
    short_code: 'hold',
    content: 'Please hold while I look into this for you.',
  },
  {
    id: 3,
    short_code: 'thanks',
    content: 'Thank you for your patience. Is there anything else I can help with?',
  },
  {
    id: 4,
    short_code: 'close',
    content: 'Glad we could resolve this. Have a great day!',
  },
];

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
