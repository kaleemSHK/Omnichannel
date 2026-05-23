'use client';

import { FileText, Loader2 } from 'lucide-react';
import type { RagDocument } from '@/lib/utils/ai';
import { documentMetaLine, fileTypeColor } from '@/lib/utils/ai';
import { cn } from '@/lib/utils/cn';

interface Props {
  document: RagDocument;
  selected?: boolean;
  onSelect: () => void;
}

function StatusChip({ doc }: { doc: RagDocument }) {
  if (doc.status === 'indexed') {
    return (
      <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-green-50 text-green-700">
        Indexed
      </span>
    );
  }
  if (doc.status === 'indexing') {
    return (
      <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 inline-flex items-center gap-1">
        <Loader2 size={10} className="animate-spin" />
        Indexing…
      </span>
    );
  }
  return (
    <span
      className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-red-50 text-red-700 cursor-help"
      title={doc.errorMessage ?? 'Indexing failed'}
    >
      Error
    </span>
  );
}

export function DocumentListItem({ document, selected, onSelect }: Props) {
  const color = fileTypeColor(document.name);

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'w-full flex items-start gap-3 px-4 py-3 text-start border-b border-gray-50 hover:bg-gray-50/80 transition-colors',
        selected && 'bg-blue-50/60',
      )}
    >
      <FileText size={20} className={cn('shrink-0 mt-0.5', color)} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">{document.name}</p>
        <p className="text-xs text-gray-500 mt-0.5">{documentMetaLine(document)}</p>
      </div>
      <StatusChip doc={document} />
    </button>
  );
}
