import type { CWContact } from '@/types';

export type SlaTier = 'gold' | 'silver' | 'bronze';

/** Chatwoot list/search returns `{ payload, meta }` or `{ data }`. */
export function parseContactsList(response: unknown): CWContact[] {
  if (!response || typeof response !== 'object') return [];
  const root = response as { payload?: CWContact[]; data?: unknown };
  if (Array.isArray(root.payload)) return root.payload;
  if (Array.isArray(root.data)) return root.data as CWContact[];
  const nested = root.data as { payload?: CWContact[] } | undefined;
  if (Array.isArray(nested?.payload)) return nested.payload;
  return [];
}

export function contactInitials(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

export function contactAvatarClass(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  const hues = [
    'bg-blue-100 text-blue-700',
    'bg-violet-100 text-violet-700',
    'bg-teal-100 text-teal-700',
    'bg-rose-100 text-rose-700',
    'bg-amber-100 text-amber-800',
  ];
  return hues[Math.abs(hash) % hues.length];
}

export function contactSlaTier(contact: CWContact): SlaTier {
  const labels = (contact.labels ?? []).map(l => l.toLowerCase());
  if (labels.some(l => l.includes('vip') || l === 'gold')) return 'gold';
  if (labels.some(l => l.includes('bronze') || l === 'billing')) return 'bronze';
  if (labels.some(l => l.includes('silver'))) return 'silver';
  const custom = contact as CWContact & { custom_attributes?: Record<string, string> };
  const tier = custom.custom_attributes?.sla_tier?.toLowerCase();
  if (tier === 'gold' || tier === 'silver' || tier === 'bronze') return tier;
  return 'silver';
}

export function slaTierBadgeClass(tier: SlaTier): string {
  if (tier === 'gold') return 'bg-amber-100 text-amber-800';
  if (tier === 'bronze') return 'bg-orange-100 text-orange-800';
  return 'bg-gray-100 text-gray-600';
}

export function contactPlan(contact: CWContact): string {
  const custom = contact as CWContact & { custom_attributes?: Record<string, string> };
  const plan = custom.custom_attributes?.plan;
  if (plan) return plan;
  const labels = (contact.labels ?? []).map(l => l.toLowerCase());
  if (labels.includes('enterprise')) return 'Enterprise';
  if (labels.includes('professional')) return 'Professional';
  return 'Standard';
}

export function ticketDisplayId(id: string): string {
  const digits = id.replace(/\D/g, '').slice(-4);
  return `TKT-${digits || id.slice(0, 4)}`;
}

export function ticketPriorityClass(priority: string): string {
  const p = priority.toLowerCase();
  if (p === 'p1' || p === 'high' || p === 'urgent') return 'bg-red-100 text-red-700';
  if (p === 'p3' || p === 'low') return 'bg-gray-100 text-gray-600';
  return 'bg-amber-100 text-amber-700';
}

export function formatRelativeDate(iso: string | number): string {
  const d = typeof iso === 'number' ? new Date(iso * 1000) : new Date(iso);
  const diff = Date.now() - d.getTime();
  const days = Math.floor(diff / 86_400_000);
  if (days < 1) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 30) return `${days} days ago`;
  return d.toLocaleDateString();
}
