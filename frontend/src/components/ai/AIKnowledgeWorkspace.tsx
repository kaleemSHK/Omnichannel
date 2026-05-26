'use client';

import { useState } from 'react';
import { CollectionsSidebar } from '@/components/ai/CollectionsSidebar';
import { DocumentList } from '@/components/ai/DocumentList';
import { QueryTester } from '@/components/ai/QueryTester';
import { DemoBanner } from '@/components/ui/DemoBanner';
import { useAiDemoMode, useRagCollections } from '@/lib/hooks/useAiKnowledge';
import { isGatewayAuthFailed } from '@/lib/demo/config';
import { BlinkoneApiError } from '@/lib/api/client';

export function AIKnowledgeWorkspace() {
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(null);
  const { data: collections = [], isError, error, refetch } = useRagCollections();
  const demoMode = useAiDemoMode();
  const featureBlocked =
    error instanceof BlinkoneApiError && error.code === 'FEATURE_DISABLED';
  const authBlocked = isGatewayAuthFailed();

  const selectedName = collections.find(c => c.id === selectedCollectionId)?.name;

  return (
    <div className="flex flex-col h-full min-h-[calc(100vh-3rem)] bg-surface-tertiary">
      <header className="shrink-0 bg-white border-b border-gray-200 px-4 py-3">
        <h1 className="text-base font-semibold text-gray-900">AI knowledge base</h1>
        <p className="text-xs text-gray-500 mt-0.5">
          Create collections, upload documents, and test live retrieval against the AI service
        </p>
      </header>

      {demoMode && (
        <div className="px-4 py-2">
          <DemoBanner label="AI knowledge base demo data" />
        </div>
      )}

      {authBlocked && !demoMode && (
        <div className="mx-4 mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Session expired or not signed in to the gateway.{' '}
          <a href="/login" className="font-medium underline">
            Log in again
          </a>{' '}
          to load collections.
        </div>
      )}

      {featureBlocked && (
        <div className="mx-4 mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          RAG knowledge base is not enabled for this workspace (Business plan or higher). Ask a
          platform admin to enable the <strong>rag</strong> feature for your tenant, or open{' '}
          <a href="/platform" className="font-medium underline">
            Platform Admin
          </a>
          .
        </div>
      )}

      {isError && !featureBlocked && !authBlocked && (
        <div className="mx-4 mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          Could not load collections.{' '}
          <button type="button" className="font-medium underline" onClick={() => refetch()}>
            Retry
          </button>
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
