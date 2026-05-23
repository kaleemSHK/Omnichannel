export type RagIndexStatus = 'indexed' | 'indexing' | 'error';

export interface RagCollection {
  id: string;
  name: string;
  docCount: number;
}

export interface RagDocument {
  id: string;
  collectionId: string;
  name: string;
  type: string;
  sizeBytes: number;
  pageCount?: number;
  uploadedAt: string;
  status: RagIndexStatus;
  errorMessage?: string;
}

export interface RagQueryResult {
  id: string;
  excerpt: string;
  score: number;
  filename: string;
  page?: number;
  collectionId: string;
}

const EXT_COLORS: Record<string, string> = {
  pdf: 'text-red-600',
  xlsx: 'text-green-600',
  xls: 'text-green-600',
  md: 'text-blue-600',
  docx: 'text-indigo-600',
};

export function fileExtension(name: string): string {
  const i = name.lastIndexOf('.');
  return i >= 0 ? name.slice(i + 1).toLowerCase() : '';
}

export function fileTypeColor(name: string): string {
  return EXT_COLORS[fileExtension(name)] ?? 'text-gray-500';
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatUploadDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}

export function documentMetaLine(doc: RagDocument): string {
  const parts = [doc.type.toUpperCase(), formatFileSize(doc.sizeBytes)];
  if (doc.pageCount != null) parts.push(`${doc.pageCount} pages`);
  parts.push(formatUploadDate(doc.uploadedAt));
  return parts.join(' · ');
}

export function scorePercent(score: number): number {
  return Math.round(Math.max(0, Math.min(1, score)) * 100);
}

export function normalizeCollection(row: {
  id?: string;
  collection_id?: string;
  name: string;
  doc_count?: number;
  docCount?: number;
}): RagCollection {
  return {
    id: row.id ?? row.collection_id ?? '',
    name: row.name,
    docCount: row.docCount ?? row.doc_count ?? 0,
  };
}

export const ACCEPTED_UPLOAD_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
  'text/markdown',
];

export const ACCEPTED_UPLOAD_EXT = ['.pdf', '.docx', '.xlsx', '.txt', '.md'];

export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

export function isAcceptedUpload(file: File): boolean {
  const ext = fileExtension(file.name);
  if (['pdf', 'docx', 'xlsx', 'txt', 'md'].includes(ext)) return true;
  return ACCEPTED_UPLOAD_TYPES.includes(file.type);
}
