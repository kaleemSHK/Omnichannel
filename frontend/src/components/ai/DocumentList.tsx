'use client';

import { Loader2, Search, Upload } from 'lucide-react';
import { useMemo, useState } from 'react';
import { DocumentListItem } from '@/components/ai/DocumentListItem';
import { UploadDocumentModal } from '@/components/ai/UploadDocumentModal';
import { useRagDocuments } from '@/lib/hooks/useAiKnowledge';

interface Props {
  collectionId: string | null;
  collectionName?: string;
}

export function DocumentList({ collectionId, collectionName }: Props) {
  const { data: documents = [], isLoading } = useRagDocuments(collectionId);
  const [search, setSearch] = useState('');
  const [uploadOpen, setUploadOpen] = useState(false);
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return documents;
    return documents.filter(d => d.name.toLowerCase().includes(q));
  }, [documents, search]);

  return (
    <section className="flex-1 min-w-0 flex flex-col bg-white border-e border-gray-200">
      <div className="shrink-0 flex items-center gap-2 px-4 py-3 border-b border-gray-100">
        <div className="flex-1 relative">
          <Search size={16} className="absolute start-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search documents…"
            className="w-full ps-8 pe-3 py-1.5 text-sm rounded-md border border-gray-200 outline-none focus:border-[#0B5FFF]"
          />
        </div>
        <button
          type="button"
          disabled={!collectionId}
          onClick={() => setUploadOpen(true)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm bg-[#0B5FFF] text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
        >
          <Upload size={16} />
          Upload
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {isLoading && (
          <div className="flex justify-center py-12">
            <Loader2 className="animate-spin text-gray-400" size={24} />
          </div>
        )}
        {!isLoading && !collectionId && (
          <p className="text-sm text-gray-400 text-center py-12">Select a collection</p>
        )}
        {!isLoading && collectionId && filtered.length === 0 && (
          <p className="text-sm text-gray-500 text-center py-12 px-4">
            No documents in this collection. Upload your first document.
          </p>
        )}
        {!isLoading &&
          filtered.map(doc => (
            <DocumentListItem
              key={doc.id}
              document={doc}
              selected={selectedDocId === doc.id}
              onSelect={() => setSelectedDocId(doc.id)}
            />
          ))}
      </div>

      <UploadDocumentModal
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        collectionId={collectionId}
        collectionName={collectionName}
      />
    </section>
  );
}
