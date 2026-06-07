/** Resolve Chatwoot message → UI sender (customer vs agent). */

export type MessageSender = 'customer' | 'agent';

export type SenderLike = {
  message_type?: number | string;
  private?: boolean;
  sender?: { type?: string; name?: string };
};

export function resolveMessageSender(m: SenderLike): MessageSender {
  const st = (m.sender?.type || '').toLowerCase();
  if (st === 'contact') return 'customer';
  if (st === 'user' || st === 'agent_bot' || st === 'agents') return 'agent';

  const t = m.message_type;
  if (t === 0 || t === '0' || t === 'incoming') return 'customer';
  if (t === 1 || t === '1' || t === 'outgoing') return 'agent';
  if (Boolean(m.private)) return 'agent';

  return 'agent';
}

export function parseMessageType(
  raw: unknown,
  sender?: { type?: string },
): 0 | 1 | 2 | 3 {
  if (raw === 0 || raw === '0' || raw === 'incoming') return 0;
  if (raw === 1 || raw === '1' || raw === 'outgoing') return 1;
  if (raw === 2 || raw === '2' || raw === 'activity') return 2;
  if (raw === 3 || raw === '3' || raw === 'template') return 3;

  const n = typeof raw === 'string' ? parseInt(raw, 10) : Number(raw);
  if (n === 0 || n === 1 || n === 2 || n === 3) return n as 0 | 1 | 2 | 3;

  return resolveMessageSender({ message_type: raw as string | number | undefined, sender }) === 'customer'
    ? 0
    : 1;
}

export function normalizeMessageSender<T extends Record<string, unknown>>(raw: T): T {
  const sender = raw.sender as { type?: string; name?: string } | undefined;
  return {
    ...raw,
    message_type: parseMessageType(raw.message_type, sender),
    sender,
  } as T;
}
