'use client';

import { FileText, Loader2, Trash2 } from 'lucide-react';
import type { RagDocument } from '@/lib/utils/ai';
import { documentMetaLine, fileTypeColor } from '@/lib/utils/ai';
import { cn } from '@/lib/utils/cn';

interface Props {
  document: RagDocument;
  selected?: boolean;
  onSelect: () => void;
  onDelete?: () => void;
  deletePending?: boolean;
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

export function DocumentListItem({
  document,
  selected,
  onSelect,
  onDelete,
  deletePending,
}: Props) {
  const color = fileTypeColor(document.name);

  return (
    <div
      className={cn(
        'w-full flex items-start gap-3 px-4 py-3 border-b border-gray-50 hover:bg-gray-50/80 transition-colors group',
        selected && 'bg-blue-50/60',
      )}
    >
      <button type="button" onClick={onSelect} className="flex flex-1 min-w-0 items-start gap-3 text-start">
        <FileText size={20} className={cn('shrink-0 mt-0.5', color)} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900 truncate">{document.name}</p>
          <p className="text-xs text-gray-500 mt-0.5">{documentMetaLine(document)}</p>
        </div>
      </button>
      <div className="flex shrink-0 items-center gap-1.5">
        <StatusChip doc={document} />
        {onDelete && (
          <button
            type="button"
            title="Delete document"
            disabled={deletePending || document.status === 'indexing'}
            onClick={e => {
              e.stopPropagation();
              onDelete();
            }}
            className="p-1.5 rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-40 transition-colors"
          >
            {deletePending ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
          </button>
        )}
      </div>
    </div>
  );
}
