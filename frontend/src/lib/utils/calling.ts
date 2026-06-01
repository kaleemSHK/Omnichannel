import { isDemoDataEnabled } from '@/lib/demo/config';
import { demoCallerName } from '@/lib/demo/callsFixture';
import type { CallSession, CWConversation } from '@/types';

export function resolveCallerName(
  session: Partial<CallSession>,
  cache: Map<string, string>,
): string {
  if (isDemoDataEnabled()) {
    return demoCallerName(session as CallSession);
  }
  const phone = session.customerPhone ?? '';
  return cache.get(phone) ?? session.agentLabel ?? phone ?? 'Unknown';
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
  return 'Voice';
}
