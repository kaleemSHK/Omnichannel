import type { CWMessage } from '@/types';
import { isDemoDataEnabled } from '@/lib/demo/config';

const KEY = 'blinkone_demo_messages';

function readAll(): Record<string, CWMessage[]> {
  if (typeof window === 'undefined' || !isDemoDataEnabled()) return {};
  try {
    const raw = sessionStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Record<string, CWMessage[]>) : {};
  } catch {
    return {};
  }
}

function writeAll(data: Record<string, CWMessage[]>) {
  if (typeof window === 'undefined' || !isDemoDataEnabled()) return;
  try {
    sessionStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    /* quota */
  }
}

export function loadDemoMessages(conversationId: number, base: CWMessage[]): CWMessage[] {
  const extra = readAll()[String(conversationId)] ?? [];
  if (!extra.length) return base;
  const ids = new Set(base.map(m => m.id));
  return [...base, ...extra.filter(m => !ids.has(m.id))];
}

export function appendDemoMessage(conversationId: number, message: CWMessage) {
  const all = readAll();
  const key = String(conversationId);
  const list = all[key] ?? [];
  if (list.some(m => m.id === message.id)) return;
  all[key] = [...list, message];
  writeAll(all);
}
