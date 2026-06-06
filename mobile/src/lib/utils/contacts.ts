import type { CWContact } from '@/types';

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

export function extractContactsMeta(response: unknown): {
  count?: number;
  current_page?: number;
  has_more?: boolean;
} {
  if (!response || typeof response !== 'object') return {};
  const root = response as { meta?: Record<string, unknown>; data?: { meta?: Record<string, unknown> } };
  const meta = root.meta ?? root.data?.meta;
  if (!meta || typeof meta !== 'object') return {};
  return meta as ReturnType<typeof extractContactsMeta>;
}
