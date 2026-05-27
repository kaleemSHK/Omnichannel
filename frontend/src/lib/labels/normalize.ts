import type { Label } from '@/lib/api/settings';

export const DEFAULT_LABEL_COLOR = '#6B7280';

/** Coerce Chatwoot label API rows into a safe in-app shape (never throws). */
export function normalizeLabel(
  input: unknown,
  fallback?: Partial<Label>,
): Label | null {
  if (input == null || typeof input !== 'object') {
    if (!fallback?.title?.trim()) return null;
    const id = Number(fallback.id);
    return {
      id: Number.isFinite(id) && id > 0 ? id : 0,
      title: fallback.title.trim().toLowerCase(),
      description: fallback.description,
      color: fallback.color ?? DEFAULT_LABEL_COLOR,
      show_on_sidebar: fallback.show_on_sidebar ?? false,
    };
  }

  const raw = input as Record<string, unknown>;
  const nested =
    raw.payload && typeof raw.payload === 'object'
      ? (raw.payload as Record<string, unknown>)
      : raw;

  const id = Number(nested.id);
  const title = String(nested.title ?? fallback?.title ?? '')
    .trim()
    .toLowerCase();

  if (!Number.isFinite(id) || id <= 0 || !title) return null;

  return {
    id,
    title,
    description:
      (nested.description as string | undefined) ?? fallback?.description,
    color:
      (nested.color as string | undefined) ??
      fallback?.color ??
      DEFAULT_LABEL_COLOR,
    show_on_sidebar:
      (nested.show_on_sidebar as boolean | undefined) ??
      fallback?.show_on_sidebar ??
      false,
  };
}

export function normalizeLabelList(
  items: unknown,
  fallback?: Partial<Label>,
): Label[] {
  const list = Array.isArray(items) ? items : [];
  return list
    .map(item => normalizeLabel(item, fallback))
    .filter((l): l is Label => l !== null);
}
