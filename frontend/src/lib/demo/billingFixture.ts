import type { UsageGaugeData, UsageHistoryPoint, BillingPlanView, InvoiceView } from '@/lib/utils/billing';

function daysFromNow(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(0, 0, 0, 0);
  return d;
}

export const DEMO_SUBSCRIPTION: BillingPlanView = {
  id: 'enterprise',
  name: 'Enterprise',
  badgeClass: 'bg-blue-100 text-blue-800',
  monthlyPrice: 432,
  currency: 'OMR',
  renewalDate: daysFromNow(8),
  daysUntilRenewal: 8,
  status: 'active',
};

/** Mix of healthy, warning (amber), and over-limit (red) gauges */
export const DEMO_GAUGES: UsageGaugeData[] = [
  { key: 'agents', label: 'Agents', used: 18, total: 20, unit: 'agents' },
  { key: 'pstn', label: 'PSTN minutes', used: 4625, total: 5000, unit: 'min' },
  { key: 'whatsapp', label: 'WhatsApp messages', used: 8200, total: 10000, unit: 'msgs' },
  {
    key: 'ai',
    label: 'AI assist tokens',
    used: 985000,
    total: 1000000,
    unit: 'tokens',
  },
  {
    key: 'storage',
    label: 'Storage',
    used: 52,
    total: 50,
    unit: 'GB',
    overage: 2,
    overageCost: 1.0,
  },
  { key: 'sms', label: 'SMS', used: 120, total: 500, unit: 'msgs' },
];

export const DEMO_INVOICES: InvoiceView[] = [
  {
    id: 'inv-may-2026',
    period: 'May 2026',
    amount: 456.5,
    overage: 24.5,
    currency: 'OMR',
    status: 'paid',
    pdfUrl: '#demo-invoice-may',
  },
  {
    id: 'inv-apr-2026',
    period: 'April 2026',
    amount: 407.5,
    overage: 0,
    currency: 'OMR',
    status: 'paid',
    pdfUrl: '#demo-invoice-apr',
  },
  {
    id: 'inv-mar-2026',
    period: 'March 2026',
    amount: 440.2,
    overage: 8.2,
    currency: 'OMR',
    status: 'paid',
    pdfUrl: '#demo-invoice-mar',
  },
  {
    id: 'inv-feb-2026',
    period: 'February 2026',
    amount: 432,
    overage: 0,
    currency: 'OMR',
    status: 'paid',
    pdfUrl: '#demo-invoice-feb',
  },
  {
    id: 'inv-jan-2026',
    period: 'January 2026',
    amount: 518.75,
    overage: 86.75,
    currency: 'OMR',
    status: 'paid',
    pdfUrl: '#demo-invoice-jan',
  },
  {
    id: 'inv-jun-2026',
    period: 'June 2026',
    amount: 432,
    overage: 12.4,
    currency: 'OMR',
    status: 'pending',
    pdfUrl: '#demo-invoice-jun',
  },
];

export const DEMO_ADDONS = [
  {
    id: 'addon-wa-calling',
    name: 'WhatsApp Calling',
    description: 'Voice calls over WhatsApp Business API for Muscat retail queue',
    price: 45,
    enabled: true,
  },
  {
    id: 'addon-recordings',
    name: 'Extended recording retention',
    description: 'Keep call recordings for 24 months (compliance)',
    price: 25,
    enabled: false,
  },
  {
    id: 'addon-ai-plus',
    name: 'AI Assist Plus',
    description: '+2M tokens per month for agent assist and summarization',
    price: 60,
    enabled: false,
  },
  {
    id: 'addon-sms-pack',
    name: 'SMS broadcast pack',
    description: '+5,000 outbound SMS per billing cycle',
    price: 18,
    enabled: false,
  },
];

const MONTHS = ['Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May'];

export const DEMO_USAGE_HISTORY: UsageHistoryPoint[] = MONTHS.map((month, i) => ({
  month: `${month} 2026`,
  agents: 14 + i,
  pstn: 3200 + i * 220,
  whatsapp: 5800 + i * 420,
  ai: 680000 + i * 52000,
  storage: 36 + i * 2.8,
  sms: 70 + i * 15,
}));

export const DEMO_PLANS = [
  {
    id: 'starter',
    name: 'Starter',
    monthlyPrice: 99,
    seats: 5,
    features: ['Unified inbox', 'Email & chat', 'Basic SLA'],
  },
  {
    id: 'professional',
    name: 'Professional',
    monthlyPrice: 249,
    seats: 15,
    features: ['PSTN', 'WhatsApp', 'AI assist', 'IVR'],
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    monthlyPrice: 432,
    seats: 50,
    features: ['All channels', 'Wallboard', 'Platform API', 'Dedicated CSM'],
  },
];
