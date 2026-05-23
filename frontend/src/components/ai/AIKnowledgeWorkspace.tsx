'use client';

import { useState } from 'react';
import { CollectionsSidebar } from '@/components/ai/CollectionsSidebar';
import { DocumentList } from '@/components/ai/DocumentList';
import { QueryTester } from '@/components/ai/QueryTester';
import { DemoBanner } from '@/components/ui/DemoBanner';
import { useAiDemoMode, useRagCollections } from '@/lib/hooks/useAiKnowledge';

export function AIKnowledgeWorkspace() {
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(null);
  const { data: collections = [] } = useRagCollections();
  const demoMode = useAiDemoMode();

  const selectedName = collections.find(c => c.id === selectedCollectionId)?.name;

  return (
    <div className="flex flex-col h-full min-h-[calc(100vh-3rem)] bg-surface-tertiary">
      <header className="shrink-0 bg-white border-b border-gray-200 px-4 py-3">
        <h1 className="text-base font-semibold text-gray-900">AI knowledge base</h1>
        <p className="text-xs text-gray-500 mt-0.5">
          Manage RAG collections, documents, and test retrieval queries
        </p>
      </header>

      {demoMode && (
        <div className="px-4 py-2">
          <DemoBanner label="AI knowledge base demo data" />
        </div>
      )}

      <div className="flex flex-1 min-h-0 overflow-hidden">
        <CollectionsSidebar
          selectedId={selectedCollectionId}
          onSelect={setSelectedCollectionId}
        />
        <DocumentList collectionId={selectedCollectionId} collectionName={selectedName} />
        <QueryTester defaultCollectionId={selectedCollectionId} />
      </div>
    </div>
  );
}
