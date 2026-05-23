import type { CWConversation } from '@/types';

/** Chatwoot list API returns `{ data: { payload, meta } }` or legacy `{ data: [] }`. */
export function parseConversationList(response: unknown): CWConversation[] {
  if (!response || typeof response !== 'object') return [];
  const root = response as { data?: unknown };
  if (Array.isArray(root.data)) return root.data as CWConversation[];
  const nested = root.data as { payload?: CWConversation[] } | undefined;
  if (Array.isArray(nested?.payload)) return nested.payload;
  return [];
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
  return (channel ?? 'Chat').replace('Channel::', '');
}

export function extractConversationMeta(res: unknown): { next_page?: number } {
  if (!res || typeof res !== 'object') return {};
  const root = res as {
    data?: { meta?: { next_page?: number } };
    meta?: { next_page?: number };
  };
  const meta = root.data?.meta ?? root.meta;
  if (!meta) return {};
  const next = (meta as { next_page?: number }).next_page;
  return next != null ? { next_page: next } : {};
}
