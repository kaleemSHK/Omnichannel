import type { CWMessage } from '@/types';

/** Chatwoot activity / system lines — not valid for knowledge search or AI reply. */
const SYSTEM_NOISE = [
  /^assigned to\b/i,
  /^conversation (was )?(resolved|reopened|marked)/i,
  /^automatically resolved/i,
  /^status changed/i,
  /^labels added/i,
];

export function isSystemOrActivityContent(text: string | undefined | null): boolean {
  const t = String(text ?? '').trim();
  if (!t || t.length < 2) return true;
  return SYSTEM_NOISE.some((re) => re.test(t));
}

/** Real customer (incoming) chat message — type 0 only, not activity noise. */
export function isCustomerChatMessage(m: CWMessage): boolean {
  if (m.message_type !== 0) return false;
  const content = String(m.content ?? '').trim();
  if (!content || isSystemOrActivityContent(content)) return false;
  if ((m as { private?: boolean }).private) return false;
  return true;
}

/** Customer or agent chat bubble — excludes activity (2) and templates (3). */
export function isAgentAssistChatMessage(m: CWMessage): boolean {
  if (m.message_type !== 0 && m.message_type !== 1) return false;
  const content = String(m.content ?? '').trim();
  if (!content || isSystemOrActivityContent(content)) return false;
  if ((m as { private?: boolean }).private) return false;
  return true;
}

export function lastCustomerMessageText(messages: CWMessage[]): string {
  const msg = [...messages].reverse().find(isCustomerChatMessage);
  return msg?.content?.trim() ?? '';
}

export function toAssistMessagePayload(messages: CWMessage[]) {
  return messages
    .filter(isAgentAssistChatMessage)
    .slice(-8)
    .map((m) => ({
      role: (m.message_type === 1 ? 'assistant' : 'user') as 'user' | 'assistant',
      content: String(m.content ?? '').trim(),
    }));
}

export function hasCustomerMessage(messages: CWMessage[]): boolean {
  return messages.some(isCustomerChatMessage);
}

/** Knowledge search needs a substantive query (3+ chars). Greetings use opening-line suggest only. */
export function isSubstantiveCustomerQuery(text: string): boolean {
  const t = text.trim();
  return t.length >= 3 && !isSystemOrActivityContent(t);
}
