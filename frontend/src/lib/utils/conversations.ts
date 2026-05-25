import type { CWConversation } from '@/types';

/**
 * Chatwoot listConversations returns:
 * { data: { payload: CWConversation[], meta: { ... } } }
 * OR
 * { payload: CWConversation[] }
 */
export function parseConversationList(res: unknown): CWConversation[] {
  if (!res || typeof res !== 'object') return [];
  const r = res as Record<string, unknown>;

  if (r.data && typeof r.data === 'object') {
    const d = r.data as Record<string, unknown>;
    if (Array.isArray(d.payload)) return d.payload as CWConversation[];
    if (Array.isArray(d)) return d as CWConversation[];
  }

  if (Array.isArray(r.payload)) return r.payload as CWConversation[];

  return [];
}

export function extractConversationMeta(res: unknown): { next_page?: number } {
  if (!res || typeof res !== 'object') return {};
  const r = res as Record<string, unknown>;

  const meta =
    (r.data as Record<string, unknown> | undefined)?.meta ?? r.meta;

  if (!meta || typeof meta !== 'object') return {};
  const m = meta as Record<string, unknown>;

  return {
    next_page: typeof m.next_page === 'number' ? m.next_page : undefined,
  };
}

export function conversationContactName(c: CWConversation): string {
  return c.meta?.sender?.name ?? `Conversation #${c.id}`;
}

export function initials(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

export function formatMessageTime(ts: number): string {
  const d = new Date(ts * 1000);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function relativeTime(dateInput: string | number): string {
  const ms =
    typeof dateInput === 'number'
      ? dateInput > 1e12
        ? dateInput
        : dateInput * 1000
      : new Date(dateInput).getTime();
  const diff = Date.now() - ms;
  if (diff < 60_000) return 'just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

export function conversationSnippet(c: CWConversation): string {
  const ext = c as CWConversation & {
    messages?: { content?: string }[];
    last_non_activity_message?: { content?: string };
  };
  return (
    ext.last_non_activity_message?.content ??
    ext.messages?.[0]?.content ??
    ''
  ).replace(/\s+/g, ' ');
}

export function inboxLabel(channel?: string): string {
  return (channel ?? 'Chat').replace('Channel::', '').replace(/^Channel::/, '');
}
