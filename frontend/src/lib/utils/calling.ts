import { isDemoDataEnabled } from '@/lib/demo/config';
import { demoCallerName } from '@/lib/demo/callsFixture';
import type { CallSession, CDRRecord, CWConversation, RoutingAgent } from '@/types';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SIP_DESK_ALIASES = new Set(['customer', 'desk', 'web', 'blinkone', 'unknown']);

function isDisplayablePhone(phone: string): boolean {
  const p = phone.trim();
  if (!p || UUID_RE.test(p) || /^\d{1,8}$/.test(p)) return false;
  return !SIP_DESK_ALIASES.has(p.toLowerCase());
}

function metaCallerName(session: Partial<CallSession>): string | undefined {
  const meta = session.metadata as { callerName?: string } | undefined;
  const name = meta?.callerName?.trim();
  return name || undefined;
}

function cdrDisplayName(record: Partial<CDRRecord>): string | undefined {
  const explicit = record.callerDisplayName?.trim();
  if (explicit) return explicit;
  const phone = record.customerPhone?.trim() ?? '';
  if (!isDisplayablePhone(phone)) return undefined;
  return phone;
}

/** Prefer CRM name over raw SIP user / contact id / session uuid. */
export function resolveCallerName(
  session: Partial<CallSession>,
  cache: Map<string, string>,
): string {
  const phone = session.customerPhone ?? '';
  if (isDemoDataEnabled()) {
    return demoCallerName(session as CallSession);
  }

  const fromMeta = metaCallerName(session);
  if (fromMeta) return fromMeta;

  const cached = phone ? cache.get(phone) : undefined;
  if (cached) return cached;

  if (phone && isDisplayablePhone(phone)) {
    return phone;
  }

  const label = session.agentLabel?.trim();
  if (label && label !== phone && !UUID_RE.test(label)) return label;

  return phone || 'Unknown caller';
}

export function resolveCdrAgentName(
  record: Pick<CDRRecord, 'agentId' | 'agentLabel'>,
  agents: Pick<RoutingAgent, 'id' | 'agentId' | 'name' | 'displayName'>[] = [],
): string {
  const label = record.agentLabel?.trim();
  if (label && label !== record.agentId) return label;
  const id = record.agentId?.trim();
  if (!id) return '—';
  const match = agents.find(a => a.agentId === id || a.id === id);
  const name = match?.displayName?.trim() || match?.name?.trim();
  return name && name !== id ? name : label || id;
}

export function resolveCdrCallerName(
  record: CDRRecord,
  cache: Map<string, string>,
): string {
  if (isDemoDataEnabled()) {
    return (
      cache.get(record.callSessionId) ??
      demoCallerName({ id: record.callSessionId, customerPhone: record.customerPhone ?? record.callSessionId })
    );
  }

  const display = cdrDisplayName(record);
  if (display) {
    const cached = cache.get(record.customerPhone ?? '') ?? cache.get(record.callSessionId);
    return cached && cached !== record.callSessionId ? cached : display;
  }

  const phone = record.customerPhone?.trim() ?? '';
  if (phone && !UUID_RE.test(phone)) {
    return cache.get(phone) ?? phone;
  }

  return cache.get(record.callSessionId) ?? 'Unknown caller';
}

/** Normalize phone for matching conversation contact ↔ call session */
export function normalizePhoneDigits(phone: string | undefined | null): string {
  return String(phone ?? '').replace(/\D/g, '');
}

/** True when a ringing/connected call belongs to this Chatwoot conversation */
export function callMatchesConversation(session: CallSession, conversation: CWConversation): boolean {
  if (session.conversationId && String(session.conversationId) === String(conversation.id)) {
    return true;
  }
  const contactPhone = conversation.meta?.sender?.phone_number;
  if (!contactPhone || !session.customerPhone) return false;
  const a = normalizePhoneDigits(contactPhone);
  const b = normalizePhoneDigits(session.customerPhone);
  if (!a || !b) return false;
  return a === b || a.endsWith(b) || b.endsWith(a);
}

export function transportLabel(transport: CallSession['transport']): string {
  if (transport === 'whatsapp') return 'WhatsApp';
  if (transport === 'webrtc') return 'WebRTC';
  return 'PSTN';
}
