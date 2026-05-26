/**
 * BlinkOne AI sidecar — /api/ai
 * Suggest reply, summarize, classify, sentiment, RAG query, STT
 */

import { GATEWAY_URL } from '@/lib/env';
import { useAuthStore } from '@/lib/store/auth';
import { bnFetch, BlinkoneApiError } from './client';
import type { RagDocument } from '@/lib/utils/ai';
import type { AIAssistResponse, RAGSource } from '@/types';

const SVC = 'ai';

export async function suggestReply(payload: {
  conversationId: string;
  messages: { role: 'user' | 'assistant'; content: string }[];
  language?: 'ar' | 'en';
}): Promise<AIAssistResponse> {
  const res = await bnFetch<{ data: AIAssistResponse }>(SVC, '/v1/assist', {
    method: 'POST',
    body: JSON.stringify({ action: 'suggestReply', ...payload }),
  });
  return res.data;
}

export async function summarizeConversation(conversationId: string): Promise<{
  summary: string;
  keyPoints: string[];
  sentiment: string;
}> {
  const res = await bnFetch<{ data: unknown }>(SVC, '/v1/assist', {
    method: 'POST',
    body: JSON.stringify({ action: 'summarize', conversationId }),
  });
  return res.data as { summary: string; keyPoints: string[]; sentiment: string };
}

export async function classifyConversation(conversationId: string): Promise<{
  category: string;
  intent: string;
  confidence: number;
}> {
  const res = await bnFetch<{ data: unknown }>(SVC, '/v1/assist', {
    method: 'POST',
    body: JSON.stringify({ action: 'classify', conversationId }),
  });
  return res.data as { category: string; intent: string; confidence: number };
}

export async function queryRAG(payload: {
  query: string;
  collectionId?: string;
  topK?: number;
  language?: 'ar' | 'en';
}): Promise<RAGSource[]> {
  const res = await bnFetch<{ data: RAGSource[] | { chunks?: RagChunkRow[] } }>(
    SVC,
    '/v1/rag/query',
    {
      method: 'POST',
      body: JSON.stringify({
        query: payload.query,
        collection_id: payload.collectionId,
        top_k: payload.topK,
        language: payload.language,
      }),
    },
  );
  const data = res.data;
  if (Array.isArray(data)) return data;
  return (data.chunks ?? []).map(row => ({
    id: row.chunk_id,
    title: row.metadata?.filename ?? row.source_ref ?? 'Document',
    excerpt: row.content,
    score: row.score,
    collectionId: payload.collectionId ?? '',
  }));
}

type RagChunkRow = {
  chunk_id: string;
  content: string;
  score: number;
  document_id: string;
  source_ref?: string;
  metadata?: { filename?: string; page?: number };
};

export async function listCollections(): Promise<
  { id: string; name: string; docCount: number }[]
> {
  const res = await bnFetch<{ data: unknown[] }>(SVC, '/v1/rag/collections');
  return (res.data as { id: string; name: string; doc_count?: number; docCount?: number }[]).map(
    row => ({
      id: row.id,
      name: row.name,
      docCount: row.docCount ?? row.doc_count ?? 0,
    }),
  );
}

export async function createCollection(payload: {
  name: string;
  language?: 'ar' | 'en';
}): Promise<{ id: string; name: string }> {
  const res = await bnFetch<{
    data: { id?: string; collection_id?: string; name: string };
  }>(SVC, '/v1/rag/collections', {
    method: 'POST',
    body: JSON.stringify({ name: payload.name, language: payload.language }),
  });
  const row = res.data;
  return { id: row.collection_id ?? row.id ?? '', name: row.name };
}

export async function listDocuments(collectionId: string): Promise<RagDocument[]> {
  try {
    const res = await bnFetch<{ data: unknown[] }>(
      SVC,
      `/v1/rag/collections/${encodeURIComponent(collectionId)}/documents`,
    );
    return (res.data as Record<string, unknown>[]).map(mapApiDocument);
  } catch (e) {
    if (e instanceof BlinkoneApiError && (e.status === 404 || e.status === 501)) {
      return [];
    }
    throw e;
  }
}

function mapApiDocument(row: Record<string, unknown>): RagDocument {
  const statusRaw = String(row.status ?? 'indexed');
  const status =
    statusRaw === 'indexing'
      ? 'indexing'
      : statusRaw === 'error' || statusRaw === 'failed'
        ? 'error'
        : 'indexed';
  return {
    id: String(row.id ?? ''),
    collectionId: String(row.collection_id ?? row.collectionId ?? ''),
    name: String(row.source_ref ?? row.name ?? 'document'),
    type: String(row.source_type ?? row.type ?? 'txt').replace('plain_text', 'txt'),
    sizeBytes: Number(row.size_bytes ?? row.sizeBytes ?? 0),
    pageCount: row.page_count != null ? Number(row.page_count) : undefined,
    uploadedAt: String(row.created_at ?? row.uploadedAt ?? new Date().toISOString()),
    status,
    errorMessage: row.error_message != null ? String(row.error_message) : undefined,
  };
}

async function readFileText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

export async function uploadDocument(
  collectionId: string,
  file: File,
  onProgress?: (pct: number) => void,
): Promise<void> {
  const ext = file.name.includes('.') ? file.name.split('.').pop()?.toLowerCase() : 'txt';
  const textTypes = new Set(['txt', 'md']);
  let content: string | undefined;
  if (textTypes.has(ext ?? '')) {
    content = await readFileText(file);
  }

  const body = JSON.stringify({
    collection_id: collectionId,
    source_type: ext === 'md' ? 'markdown' : ext ?? 'plain_text',
    source_ref: file.name,
    content: content ?? `[binary upload ${file.name}]`,
  });

  const { tokens } = useAuthStore.getState();
  const url = `${GATEWAY_URL}/api/${SVC}/v1/rag/index`;

  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url);
    xhr.setRequestHeader('Content-Type', 'application/json');
    if (tokens?.gatewayJwt) {
      xhr.setRequestHeader('Authorization', `Bearer ${tokens.gatewayJwt}`);
    }
    xhr.upload.onprogress = e => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress?.(100);
        resolve();
        return;
      }
      reject(
        new BlinkoneApiError('UPLOAD_FAILED', xhr.responseText || 'Upload failed', xhr.status),
      );
    };
    xhr.onerror = () => reject(new BlinkoneApiError('NETWORK', 'Upload failed', 0));
    xhr.send(body);
  });
}

export async function listRAGCollections(): Promise<{
  id: string;
  name: string;
  docCount: number;
}[]> {
  return listCollections();
}

export type VoicebotStatus = {
  stt_mode: 'stub' | 'google_chirp_v2' | `whisper_${string}` | string;
  tts_mode: 'stub' | 'piper_arabic';
  language: string;
  piper_voice?: string;
  active_sessions: number;
};

export async function getVoicebotStatus(): Promise<VoicebotStatus> {
  const res = await bnFetch<{ data: VoicebotStatus }>(SVC, '/v1/voicebot/status');
  return res.data;
}

export async function submitSTTJob(payload: {
  audioUrl: string;
  language?: string;
  conversationId?: string;
}): Promise<{ jobId: string; status: string }> {
  const res = await bnFetch<{ data: unknown }>(SVC, '/v1/stt/jobs', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return res.data as { jobId: string; status: string };
}
