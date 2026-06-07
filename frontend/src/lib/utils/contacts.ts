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

/** Chatwoot GET /contacts/:id returns `{ payload: contact }` or a flat contact. */
export function parseContactDetail(response: unknown): CWContact {
  if (!response || typeof response !== 'object') {
    throw new Error('Invalid contact response');
  }
  const root = response as Record<string, unknown>;
  if (typeof root.id === 'number') return root as unknown as CWContact;

  const payload = root.payload;
  if (payload && typeof payload === 'object') {
    const p = payload as Record<string, unknown>;
    if (p.contact && typeof p.contact === 'object' && typeof (p.contact as CWContact).id === 'number') {
      return p.contact as CWContact;
    }
    if (typeof p.id === 'number') return p as unknown as CWContact;
  }

  const data = root.data;
  if (data && typeof data === 'object') {
    const d = data as Record<string, unknown>;
    if (d.contact && typeof d.contact === 'object') return d.contact as CWContact;
    if (typeof d.id === 'number') return d as unknown as CWContact;
  }

  throw new Error('Contact not found');
}

function looksLikePhone(value?: string | null): boolean {
  if (!value?.trim()) return false;
  const digits = value.replace(/\D/g, '');
  return digits.length >= 7 && /^[\d+\s().-]+$/.test(value.trim());
}

/** E.164-ish digits for outbound dial (phone_number, then identifier fallback). */
export function resolveContactDialNumber(
  contact: Pick<CWContact, 'phone_number' | 'name' | 'email'> & {
    identifier?: string;
    additional_attributes?: Record<string, unknown>;
    custom_attributes?: Record<string, string>;
  },
): string {
  const fromAttr = (obj: Record<string, unknown> | undefined, key: string): string => {
    const v = obj?.[key];
    return typeof v === 'string' ? v.trim() : '';
  };

  const candidates = [
    contact.phone_number,
    contact.identifier,
    fromAttr(contact.additional_attributes, 'phone_number'),
    fromAttr(contact.additional_attributes, 'phone'),
    contact.custom_attributes?.phone_number,
    contact.custom_attributes?.phone,
    looksLikePhone(contact.name) ? contact.name : '',
  ];

  for (const raw of candidates) {
    const trimmed = (raw ?? '').trim();
    if (!trimmed) continue;
    const digits = trimmed.replace(/[^\d+]/g, '');
    if (digits.replace(/\D/g, '').length >= 7) return digits;
  }
  return '';
}

/** Fallback label when Chatwoot omits `name` (phone/email-only contacts). */
export function contactDisplayName(
  contact: Pick<CWContact, 'name' | 'email' | 'phone_number'> & { identifier?: string },
): string {
  const name = contact.name?.trim();
  if (name) return name;
  const email = contact.email?.trim();
  if (email) return email;
  const phone = contact.phone_number?.trim();
  if (phone) return phone;
  const identifier = contact.identifier?.trim();
  if (identifier) return identifier;
  return 'Unknown';
}

export function contactInitials(name?: string | null): string {
  const label = name?.trim() || 'Unknown';
  const parts = label.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return label.slice(0, 2).toUpperCase();
}

export function contactAvatarClass(name?: string | null): string {
  const label = name?.trim() || 'Unknown';
  let hash = 0;
  for (let i = 0; i < label.length; i++) hash = label.charCodeAt(i) + ((hash << 5) - hash);
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
