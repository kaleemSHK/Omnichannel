import type { CWConversation } from '@/types';

/** Chatwoot listConversations: `{ data: { payload, meta } }` or `{ payload }`. */
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

export function extractConversationMeta(res: unknown): {
  count?: number;
  current_page?: number;
  next_page?: number;
  total_pages?: number;
  total_count?: number;
} {
  if (!res || typeof res !== 'object') return {};
  const r = res as Record<string, unknown>;
  const meta =
    (r.data as Record<string, unknown> | undefined)?.meta ?? r.meta;

  if (!meta || typeof meta !== 'object') return {};
  return meta as ReturnType<typeof extractConversationMeta>;
}
