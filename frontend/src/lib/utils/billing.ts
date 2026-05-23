import type { BillingSubscription, Invoice } from '@/types';

export interface UsageGaugeData {
  key: string;
  label: string;
  used: number;
  total: number;
  unit: string;
  overage?: number;
  overageCost?: number;
}

export interface BillingPlanView {
  id: string;
  name: string;
  badgeClass: string;
  monthlyPrice: number;
  currency: string;
  renewalDate: Date;
  daysUntilRenewal: number;
  status: BillingSubscription['status'];
}

export interface InvoiceView {
  id: string;
  period: string;
  amount: number;
  overage: number;
  currency: string;
  status: 'paid' | 'pending' | 'failed';
  pdfUrl?: string;
}

export interface UsageHistoryPoint {
  month: string;
  agents: number;
  pstn: number;
  whatsapp: number;
  ai: number;
  storage: number;
  sms: number;
}

const PLAN_BADGE: Record<string, string> = {
  enterprise: 'bg-blue-100 text-blue-800',
  professional: 'bg-indigo-100 text-indigo-800',
  pro: 'bg-indigo-100 text-indigo-800',
  starter: 'bg-gray-100 text-gray-700',
  trial: 'bg-gray-100 text-gray-600',
};

export function formatOmr(amount: number): string {
  return `OMR ${amount.toFixed(2)}`;
}

export function formatPeriodLabel(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
}

export function daysUntil(date: Date): number {
  const ms = date.getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
}

export function planBadgeClass(planName: string): string {
  const key = planName.toLowerCase();
  if (key.includes('enterprise')) return PLAN_BADGE.enterprise;
  if (key.includes('professional') || key.includes('pro')) return PLAN_BADGE.professional;
  return PLAN_BADGE.starter;
}

export function normalizeSubscription(raw: unknown, monthlyPrice = 432): BillingPlanView {
  const r = raw as Record<string, unknown>;
  const planName = String(r.planName ?? r.plan_name ?? 'Professional');
  const end = String(r.currentPeriodEnd ?? r.current_period_end ?? '');
  const renewalDate = end ? new Date(end) : new Date(Date.now() + 8 * 86400000);
  return {
    id: String(r.planId ?? r.plan_id ?? 'pro'),
    name: planName,
    badgeClass: planBadgeClass(planName),
    monthlyPrice: Number(r.monthlyAmount ?? r.base_price_omr ?? r.basePriceOmr ?? monthlyPrice),
    currency: String(r.currency ?? 'OMR'),
    renewalDate,
    daysUntilRenewal: daysUntil(renewalDate),
    status: (r.status as BillingSubscription['status']) ?? 'active',
  };
}

type Comparison = Record<string, { used?: number; allowed?: number; overage?: number }>;

const OVERAGE_RATES: Record<string, number> = {
  agent: 12,
  minute: 0.08,
  message: 0.02,
  ai_token: 0.001,
  storage: 0.5,
  sms: 0.04,
};

export function gaugesFromUsageBundle(bundle: {
  comparison?: Comparison;
  usage?: Record<string, number>;
  subscription?: { included?: Record<string, number> };
}): UsageGaugeData[] {
  const comp = bundle.comparison ?? {};
  const inc = bundle.subscription?.included ?? {};

  const defs: { key: string; label: string; dim: string; incKey: string; unit: string }[] = [
    { key: 'agents', label: 'Agents', dim: 'agent', incKey: 'agents', unit: 'agents' },
    { key: 'pstn', label: 'PSTN minutes', dim: 'minute', incKey: 'minutes', unit: 'min' },
    { key: 'whatsapp', label: 'WhatsApp messages', dim: 'message', incKey: 'messages', unit: 'msgs' },
    { key: 'ai', label: 'AI assist tokens', dim: 'ai_token', incKey: 'aiCredits', unit: 'tokens' },
    { key: 'storage', label: 'Storage', dim: 'storage', incKey: 'storageGb', unit: 'GB' },
    { key: 'sms', label: 'SMS', dim: 'sms', incKey: 'sms', unit: 'msgs' },
  ];

  return defs.map(d => {
    const c = comp[d.dim];
    const used = c?.used ?? bundle.usage?.[d.dim] ?? bundle.usage?.[`usage.${d.dim}`] ?? 0;
    const total = c?.allowed ?? (inc[d.incKey as keyof typeof inc] as number) ?? 100;
    const overage = c?.overage ?? Math.max(0, used - total);
    const rate = OVERAGE_RATES[d.dim] ?? 0.05;
    return {
      key: d.key,
      label: d.label,
      used: Math.round(used * 100) / 100,
      total,
      unit: d.unit,
      overage: overage > 0 ? overage : undefined,
      overageCost: overage > 0 ? Math.round(overage * rate * 100) / 100 : undefined,
    };
  });
}

export function normalizeInvoice(raw: unknown): InvoiceView {
  const row = raw as Record<string, unknown>;
  const start = String(row.periodStart ?? row.period ?? row.issuedAt ?? row.issued_at ?? '');
  const total = Number(row.totalOmr ?? row.amount ?? 0);
  const lines = (row.lines as { amountOmr?: number; description?: string }[]) ?? [];
  const overageFromLines = lines
    .filter(l => String(l.description ?? '').toLowerCase().includes('overage'))
    .reduce((s, l) => s + Number(l.amountOmr ?? 0), 0);
  const overage = Number(row.overageOmr ?? row.overage ?? overageFromLines);
  const st = String(row.status ?? 'due').toLowerCase();
  let status: InvoiceView['status'] = 'pending';
  if (st === 'paid') status = 'paid';
  else if (st === 'overdue' || st === 'failed' || st === 'past_due') status = 'failed';
  else if (st === 'draft' || st === 'sent' || st === 'due') status = 'pending';

  const pdfKey = row.pdfMinioKey ?? row.pdfUrl;
  const pdfUrl =
    typeof pdfKey === 'string' && pdfKey.startsWith('http')
      ? pdfKey
      : pdfKey
        ? `/_gw/api/billing/v1/invoices/${row.id}/pdf`
        : undefined;

  return {
    id: String(row.id),
    period: start ? formatPeriodLabel(start) : String(row.period ?? '—'),
    amount: total,
    overage,
    currency: String(row.currency ?? 'OMR'),
    status,
    pdfUrl,
  };
}

export function gaugeColor(used: number, total: number): string {
  if (total <= 0) return 'bg-blue-500';
  const pct = (used / total) * 100;
  if (pct >= 100) return 'bg-red-500';
  if (pct >= 85) return 'bg-amber-500';
  return 'bg-blue-500';
}

export function gaugePercent(used: number, total: number): number {
  if (total <= 0) return 0;
  return Math.min(100, (used / total) * 100);
}
