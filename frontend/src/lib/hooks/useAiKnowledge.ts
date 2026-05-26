'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  createCollection,
  listCollections,
  listDocuments,
  queryRAG,
  uploadDocument,
} from '@/lib/api/ai';
import { isDemoDataEnabled, isGatewayQueryEnabled } from '@/lib/demo/config';
import {
  DEMO_AI_COLLECTIONS,
  DEMO_AI_DOCUMENTS,
  DEMO_RAG_RESULTS,
} from '@/lib/demo/aiFixture';
import {
  normalizeCollection,
  scorePercent,
  type RagCollection,
  type RagDocument,
  type RagQueryResult,
} from '@/lib/utils/ai';
import type { RAGSource } from '@/types';

const COLLECTIONS_KEY = ['collections'];
const documentsKey = (collectionId: string) => ['documents', collectionId];

function demoDocuments(collectionId: string): RagDocument[] {
  return DEMO_AI_DOCUMENTS.filter(d => d.collectionId === collectionId);
}

function withDemoDocCounts(collections: RagCollection[], docs: RagDocument[]): RagCollection[] {
  return collections.map(c => ({
    ...c,
    docCount: docs.filter(d => d.collectionId === c.id).length,
  }));
}

async function loadCollections(): Promise<RagCollection[]> {
  if (isDemoDataEnabled()) {
    return withDemoDocCounts(DEMO_AI_COLLECTIONS, DEMO_AI_DOCUMENTS);
  }
  try {
    const rows = await listCollections();
    return rows.map(normalizeCollection);
  } catch {
    return [];
  }
}

async function loadDocuments(collectionId: string | null): Promise<RagDocument[]> {
  if (!collectionId) return [];
  if (isDemoDataEnabled()) return demoDocuments(collectionId);
  try {
    return await listDocuments(collectionId);
  } catch {
    return [];
  }
}

function mapQueryResults(
  sources: RAGSource[],
  collectionId: string,
): RagQueryResult[] {
  return sources.map(s => ({
    id: s.id,
    excerpt: s.excerpt,
    score: s.score,
    filename: s.title,
    page: undefined,
    collectionId: s.collectionId || collectionId,
  }));
}

export function useAiDemoMode() {
  return isDemoDataEnabled();
}

export function useRagCollections() {
  const gwEnabled = isGatewayQueryEnabled();
  return useQuery({
    queryKey: [...COLLECTIONS_KEY, isDemoDataEnabled()],
    queryFn: loadCollections,
    enabled: gwEnabled,
  });
}

export function useRagDocuments(collectionId: string | null) {
  return useQuery({
    queryKey: [...documentsKey(collectionId ?? ''), isDemoDataEnabled()],
    queryFn: () => loadDocuments(collectionId),
    enabled: Boolean(collectionId),
  });
}

export function useCreateRagCollection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (name: string) => {
      if (isDemoDataEnabled()) {
        const id = `col-${Date.now()}`;
        return { id, name, docCount: 0 } satisfies RagCollection;
      }
      const created = await createCollection({ name });
      return { id: created.id, name: created.name, docCount: 0 } satisfies RagCollection;
    },
    onSuccess: row => {
      void qc.invalidateQueries({ queryKey: COLLECTIONS_KEY });
      toast.success(`Collection "${row.name}" created`);
      return row;
    },
    onError: () => toast.error('Could not create collection'),
  });
}

export function useUploadRagDocuments(collectionId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      files,
      onFileProgress,
    }: {
      files: File[];
      onFileProgress?: (fileIndex: number, pct: number) => void;
    }) => {
      if (!collectionId) throw new Error('No collection selected');
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (isDemoDataEnabled()) {
          for (let p = 0; p <= 100; p += 25) {
            onFileProgress?.(i, p);
            await new Promise(r => setTimeout(r, 80));
          }
          const doc: RagDocument = {
            id: `doc-${Date.now()}-${i}`,
            collectionId,
            name: file.name,
            type: file.name.split('.').pop()?.toLowerCase() ?? 'txt',
            sizeBytes: file.size,
            uploadedAt: new Date().toISOString(),
            status: 'indexing',
          };
          const docKey = [...documentsKey(collectionId), isDemoDataEnabled()];
          qc.setQueryData<RagDocument[]>(docKey, old => [...(old ?? []), doc]);
          setTimeout(() => {
            qc.setQueryData<RagDocument[]>(docKey, old =>
              (old ?? []).map(d =>
                d.id === doc.id ? { ...d, status: 'indexed' as const } : d,
              ),
            );
          }, 2000);
          continue;
        }
        await uploadDocument(collectionId, file, pct => onFileProgress?.(i, pct));
      }
    },
    onSuccess: (_data, _vars, _ctx) => {
      if (!collectionId) return;
      const colKey = [...COLLECTIONS_KEY, isDemoDataEnabled()];
      const docKey = [...documentsKey(collectionId), isDemoDataEnabled()];
      const docs = qc.getQueryData<RagDocument[]>(docKey) ?? [];
      qc.setQueryData<RagCollection[]>(colKey, old =>
        (old ?? []).map(c =>
          c.id === collectionId ? { ...c, docCount: docs.length } : c,
        ),
      );
      if (!isDemoDataEnabled()) {
        void qc.invalidateQueries({ queryKey: documentsKey(collectionId) });
        void qc.invalidateQueries({ queryKey: COLLECTIONS_KEY });
      }
      toast.success('Upload complete');
    },
    onError: () => toast.error('Upload failed'),
  });
}

export function useRagQuery() {
  return useMutation({
    mutationFn: async ({
      query,
      collectionId,
      topK,
    }: {
      query: string;
      collectionId: string;
      topK: number;
    }): Promise<RagQueryResult[]> => {
      if (isDemoDataEnabled()) {
        await new Promise(r => setTimeout(r, 400));
        return DEMO_RAG_RESULTS.filter(
          r => !collectionId || r.collectionId === collectionId,
        ).slice(0, topK);
      }
      const sources = await queryRAG({ query, collectionId, topK });
      return mapQueryResults(sources, collectionId);
    },
  });
}

export { scorePercent };
