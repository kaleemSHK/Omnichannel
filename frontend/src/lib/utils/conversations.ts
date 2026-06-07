import type { ConversationPriority, CWConversation } from '@/types';

/**
 * Chatwoot listConversations returns:
 * { data: { payload: CWConversation[], meta: { ... } } }
 * OR
 * { payload: CWConversation[] }
 */
export function normalizeConversation(raw: unknown): CWConversation | null {
  if (!raw || typeof raw !== 'object') return null;

  let c = raw as Record<string, unknown>;
  if (c.payload && typeof c.payload === 'object' && !Array.isArray(c.payload)) {
    c = c.payload as Record<string, unknown>;
  }

  const id = typeof c.id === 'number' ? c.id : null;
  if (id == null) return null;

  const metaRaw =
    c.meta && typeof c.meta === 'object'
      ? { ...(c.meta as Record<string, unknown>) }
      : {};

  const rootAssignee = c.assignee as { id?: number; name?: string } | null | undefined;
  if (rootAssignee?.id && !metaRaw.assignee) {
    metaRaw.assignee = { id: rootAssignee.id, name: rootAssignee.name ?? 'Agent' };
  }

  const rootTeam = c.team as { id?: number; name?: string } | null | undefined;
  if (rootTeam?.id && !metaRaw.team) {
    metaRaw.team = { id: rootTeam.id, name: rootTeam.name ?? 'Team' };
  }

  const priorityRaw = c.priority;
  const priority =
    priorityRaw == null || priorityRaw === ''
      ? null
      : (String(priorityRaw) as ConversationPriority);

  return {
    ...(c as unknown as CWConversation),
    id,
    meta: metaRaw as CWConversation['meta'],
    priority,
    labels: Array.isArray(c.labels) ? (c.labels as string[]) : [],
  };
}

export function parseConversationList(res: unknown): CWConversation[] {
  if (!res || typeof res !== 'object') return [];
  const r = res as Record<string, unknown>;

  let items: unknown[] = [];

  if (r.data && typeof r.data === 'object') {
    const d = r.data as Record<string, unknown>;
    if (Array.isArray(d.payload)) items = d.payload;
    else if (Array.isArray(d)) items = d;
  } else if (Array.isArray(r.payload)) {
    items = r.payload;
  }

  return items
    .map(item => normalizeConversation(item))
    .filter((c): c is CWConversation => c != null);
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
