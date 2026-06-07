'use client';

import { Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { RAGResultCard } from '@/components/ai/RAGResultCard';
import { VoiceBotStatus } from '@/components/ai/VoiceBotStatus';
import { useRagCollections, useRagQuery } from '@/lib/hooks/useAiKnowledge';

interface Props {
  defaultCollectionId: string | null;
}

export function QueryTester({ defaultCollectionId }: Props) {
  const { data: collections = [] } = useRagCollections();
  const query = useRagQuery();
  const [question, setQuestion] = useState('');
  const [collectionId, setCollectionId] = useState(defaultCollectionId ?? '');
  const [topK, setTopK] = useState(3);

  useEffect(() => {
    if (defaultCollectionId) setCollectionId(defaultCollectionId);
  }, [defaultCollectionId]);

  const handleRun = () => {
    const q = question.trim();
    if (!q || !collectionId) return;
    const k = Math.min(10, Math.max(1, topK));
    void query.mutateAsync({ query: q, collectionId, topK: k });
  };

  return (
    <aside className="w-[280px] shrink-0 bg-white flex flex-col border-s border-gray-200">
      <div className="px-4 py-3 border-b border-gray-100">
        <h2 className="text-sm font-semibold text-gray-900">Query tester</h2>
        <p className="text-xs text-gray-500 mt-0.5">Test RAG retrieval against your knowledge base</p>
      </div>

      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
        <VoiceBotStatus />
        <label className="block">
          <span className="text-xs font-medium text-gray-600">Ask a question</span>
          <textarea
            rows={3}
            value={question}
            onChange={e => setQuestion(e.target.value)}
            placeholder="e.g. How do I upgrade to Fiber 500?"
            className="mt-1 w-full px-3 py-2 text-sm rounded-md border border-gray-200 outline-none focus:border-[#0B5FFF] resize-none"
          />
        </label>

        <label className="block">
          <span className="text-xs font-medium text-gray-600">Collection</span>
          <select
            value={collectionId}
            onChange={e => setCollectionId(e.target.value)}
            className="mt-1 w-full px-2 py-1.5 text-sm rounded-md border border-gray-200 outline-none focus:border-[#0B5FFF] bg-white"
          >
            <option value="">Select…</option>
            {collections.map(c => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="text-xs font-medium text-gray-600">Top K results</span>
          <input
            type="number"
            min={1}
            max={10}
            value={topK}
            onChange={e => setTopK(Number(e.target.value))}
            className="mt-1 w-full px-2 py-1.5 text-sm rounded-md border border-gray-200 outline-none focus:border-[#0B5FFF]"
          />
        </label>

        <button
          type="button"
          disabled={!question.trim() || !collectionId || query.isPending}
          onClick={handleRun}
          className="w-full py-2 text-sm bg-[#0B5FFF] text-white rounded-md hover:bg-blue-700 disabled:opacity-50 inline-flex items-center justify-center gap-2"
        >
          {query.isPending ? <Loader2 size={16} className="animate-spin" /> : null}
          Run query
        </button>

        {query.data && query.data.length > 0 && (
          <div className="space-y-2 pt-2 border-t border-gray-100">
            {query.data.map(r => (
              <RAGResultCard key={r.id} result={r} />
            ))}
          </div>
        )}

        {query.isSuccess && query.data?.length === 0 && (
          <p className="text-xs text-gray-500">
            No matching chunks found. Try a specific question about your documents (e.g. &quot;What is
            the dispatch architecture?&quot;). If you uploaded .docx files before today, re-upload them
            so text is extracted correctly.
          </p>
        )}
      </div>
    </aside>
  );
}
