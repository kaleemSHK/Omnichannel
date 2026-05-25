import { CHATWOOT_URL } from '@/lib/env';
import { attachmentTypeForFile } from '@/lib/utils/attachments';
import type { CWAttachment, CWMessage } from '@/types';

/** Resolve relative attachment URLs from Chatwoot to absolute paths. */
export function resolveAttachmentUrl(url: string | undefined): string {
  if (!url) return '';
  if (/^(https?:|blob:|data:)/.test(url)) return url;
  const base = CHATWOOT_URL.replace(/\/$/, '');
  return url.startsWith('/') ? `${base}${url}` : `${base}/${url}`;
}

function normalizeFileType(raw: unknown): string {
  const t = String(raw ?? 'file').toLowerCase();
  if (t === 'document') return 'file';
  return t;
}

export function normalizeAttachment(raw: unknown): CWAttachment | null {
  if (!raw || typeof raw !== 'object') return null;
  const a = raw as Record<string, unknown>;
  const rawUrl =
    a.data_url ??
    a.file_url ??
    a.download_url ??
    a.url ??
    a.redirect_url;
  const dataUrl = resolveAttachmentUrl(
    typeof rawUrl === 'string' ? rawUrl : '',
  );
  if (!dataUrl) return null;

  return {
    id: Number(a.id ?? Date.now()),
    file_type: normalizeFileType(a.file_type ?? a.extension),
    data_url: dataUrl,
    thumb_url: a.thumb_url
      ? resolveAttachmentUrl(String(a.thumb_url))
      : undefined,
  };
}

export function normalizeMessage(raw: unknown): CWMessage {
  const m = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const attachments = Array.isArray(m.attachments)
    ? m.attachments
        .map(normalizeAttachment)
        .filter((a): a is CWAttachment => a !== null)
    : undefined;

  const isPrivate = Boolean(m.private);
  let contentType = String(m.content_type ?? 'text');
  if (isPrivate && contentType === 'text') {
    contentType = 'private_note';
  }

  return {
    id: Number(m.id ?? Date.now()),
    content: String(m.content ?? ''),
    message_type: Number(m.message_type ?? 1) as CWMessage['message_type'],
    content_type: contentType,
    created_at: Number(m.created_at ?? Math.floor(Date.now() / 1000)),
    sender: m.sender as CWMessage['sender'],
    attachments: attachments?.length ? attachments : undefined,
  };
}

export function normalizeMessages(raw: unknown): CWMessage[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.map(normalizeMessage);

  if (typeof raw === 'object') {
    const r = raw as Record<string, unknown>;
    if (Array.isArray(r.payload)) return r.payload.map(normalizeMessage);
    if (r.data && typeof r.data === 'object') {
      const d = r.data as Record<string, unknown>;
      if (Array.isArray(d.payload)) return d.payload.map(normalizeMessage);
    }
  }

  return [];
}

export function chatwootFileType(file: File): string {
  const type = attachmentTypeForFile(file);
  if (type === 'file') return 'document';
  return type;
}

export function unwrapMessageResponse(res: unknown): CWMessage {
  if (res && typeof res === 'object') {
    const r = res as Record<string, unknown>;
    if (r.payload && typeof r.payload === 'object') {
      return normalizeMessage(r.payload);
    }
  }
  return normalizeMessage(res);
}
