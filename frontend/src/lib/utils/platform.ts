import type { Tenant, TenantFeatures } from '@/types';

/** UI feature keys (maps to TenantFeatures + billing/ivr aliases in API patch). */
export type PlatformFeatureKey =
  | keyof TenantFeatures
  | 'aiAssist'
  | 'ivr'
  | 'billing';

export const PLATFORM_FEATURE_FLAGS: { key: PlatformFeatureKey; label: string }[] = [
  { key: 'pstn', label: 'PSTN calling' },
  { key: 'whatsappCalling', label: 'WhatsApp' },
  { key: 'aiAssist', label: 'AI assist' },
  { key: 'ivr', label: 'IVR builder' },
  { key: 'sla', label: 'SLA' },
  { key: 'voiceBot', label: 'Voice bot' },
  { key: 'rag', label: 'RAG knowledge base' },
  { key: 'billing', label: 'Billing module' },
];

export interface PlatformTenantView extends Omit<Tenant, 'features'> {
  location?: string;
  features: Record<PlatformFeatureKey, boolean>;
}

export function normalizeTenant(raw: unknown): PlatformTenantView {
  const r = raw as Record<string, unknown>;
  const featuresRaw = (r.features ?? {}) as Record<string, unknown>;
  const planRaw = r.plan ?? r.billingPlanId ?? r.billing_plan_id;
  let plan = (planRaw as Tenant['plan']) ?? 'starter';
  if (r.status === 'trial') plan = 'trial';
  return {
    id: String(r.id ?? ''),
    slug: String(r.slug ?? ''),
    name: String(r.name ?? 'Tenant'),
    domain: String(r.domain ?? `${r.slug ?? 'tenant'}.blinkone.local`),
    plan,
    status: (r.status as Tenant['status']) ?? 'active',
    agentCount: Number(r.agentCount ?? r.agent_count ?? 0),
    createdAt: String(r.createdAt ?? r.created_at ?? new Date().toISOString()),
    location: String(r.location ?? r.region ?? 'Muscat, OM'),
    features: defaultFeatures(featuresRaw),
  };
}

export function featureEnabled(val: unknown): boolean {
  if (typeof val === 'boolean') return val;
  if (val && typeof val === 'object' && 'enabled' in val) {
    return (val as { enabled?: boolean }).enabled !== false;
  }
  return Boolean(val);
}

export function defaultFeatures(partial?: Record<string, unknown>): Record<PlatformFeatureKey, boolean> {
  const base: Record<PlatformFeatureKey, boolean> = {
    telephony: false,
    pstn: false,
    whatsappCalling: false,
    rag: false,
    voiceBot: false,
    sla: false,
    outboundDialer: false,
    aiAssist: false,
    ivr: false,
    billing: false,
  };
  if (!partial) return base;
  for (const def of PLATFORM_FEATURE_FLAGS) {
    if (partial[def.key] != null) base[def.key] = featureEnabled(partial[def.key]);
  }
  if (partial.telephony != null) base.ivr = featureEnabled(partial.telephony);
  if (partial.rag != null && partial.aiAssist == null) base.aiAssist = featureEnabled(partial.rag);
  if (partial.outboundDialer != null && partial.billing == null) {
    base.billing = featureEnabled(partial.outboundDialer);
  }
  return base;
}

export function featuresToApiPatch(
  key: PlatformFeatureKey,
  value: boolean,
): Partial<TenantFeatures> & Record<string, boolean> {
  if (key === 'aiAssist') return { rag: value };
  if (key === 'ivr') return { telephony: value, outboundDialer: value };
  if (key === 'billing') return { outboundDialer: value };
  return { [key]: value } as Partial<TenantFeatures>;
}

export function tenantInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

const AVATAR_COLORS = [
  'bg-blue-100 text-blue-700',
  'bg-indigo-100 text-indigo-700',
  'bg-violet-100 text-violet-700',
  'bg-emerald-100 text-emerald-700',
  'bg-amber-100 text-amber-700',
];

export function avatarColor(id: string): string {
  let n = 0;
  for (let i = 0; i < id.length; i++) n += id.charCodeAt(i);
  return AVATAR_COLORS[n % AVATAR_COLORS.length]!;
}

export function planLabel(plan: Tenant['plan']): string {
  const map: Record<string, string> = {
    trial: 'Trial',
    starter: 'Starter',
    pro: 'Professional',
    enterprise: 'Enterprise',
  };
  return map[plan] ?? plan;
}

export function statusPill(status: Tenant['status']): { label: string; className: string } {
  if (status === 'active') return { label: 'Active', className: 'bg-green-50 text-green-700 border-green-200' };
  if (status === 'trial') return { label: 'Trial', className: 'bg-amber-50 text-amber-700 border-amber-200' };
  return { label: 'Suspended', className: 'bg-red-50 text-red-700 border-red-200' };
}

export function slugFromName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export interface PlatformKpis {
  total: number;
  active: number;
  trial: number;
  agents: number;
}

export function aggregateKpis(tenants: PlatformTenantView[]): PlatformKpis {
  return {
    total: tenants.length,
    active: tenants.filter(t => t.status === 'active').length,
    trial: tenants.filter(t => t.status === 'trial').length,
    agents: tenants.reduce((s, t) => s + t.agentCount, 0),
  };
}
