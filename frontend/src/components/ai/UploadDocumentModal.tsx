'use client';

import { Loader2, Upload } from 'lucide-react';
import { useCallback, useRef, useState } from 'react';
import { Dialog } from '@/components/ui/Dialog';
import { useUploadRagDocuments } from '@/lib/hooks/useAiKnowledge';
import {
  ACCEPTED_UPLOAD_EXT,
  formatFileSize,
  isAcceptedUpload,
  MAX_UPLOAD_BYTES,
} from '@/lib/utils/ai';
import { cn } from '@/lib/utils/cn';

interface Props {
  open: boolean;
  onClose: () => void;
  collectionId: string | null;
  collectionName?: string;
}

type QueuedFile = {
  file: File;
  progress: number;
  status: 'pending' | 'uploading' | 'done' | 'error';
};

export function UploadDocumentModal({ open, onClose, collectionId, collectionName }: Props) {
  const upload = useUploadRagDocuments(collectionId);
  const inputRef = useRef<HTMLInputElement>(null);
  const [queue, setQueue] = useState<QueuedFile[]>([]);
  const [dragOver, setDragOver] = useState(false);

  const addFiles = useCallback((files: FileList | File[]) => {
    const next: QueuedFile[] = [];
    for (const file of Array.from(files)) {
      if (!isAcceptedUpload(file)) continue;
      if (file.size > MAX_UPLOAD_BYTES) continue;
      next.push({ file, progress: 0, status: 'pending' });
    }
    if (next.length) setQueue(prev => [...prev, ...next]);
  }, []);

  const resetAndClose = () => {
    setQueue([]);
    onClose();
  };

  const startUpload = async () => {
    if (!collectionId || queue.length === 0) return;
    const files = queue.map(q => q.file);
    setQueue(prev => prev.map(q => ({ ...q, status: 'uploading' as const })));
    try {
      await upload.mutateAsync({
        files,
        onFileProgress: (fileIndex, pct) => {
          setQueue(prev =>
            prev.map((q, i) =>
              q.file === files[fileIndex] ? { ...q, progress: pct, status: 'uploading' } : q,
            ),
          );
        },
      });
      setQueue(prev => prev.map(q => ({ ...q, progress: 100, status: 'done' })));
      resetAndClose();
    } catch {
      setQueue(prev => prev.map(q => ({ ...q, status: 'error' })));
    }
  };

  return (
    <Dialog
      open={open}
      onClose={resetAndClose}
      title={collectionName ? `Upload to ${collectionName}` : 'Upload documents'}
    >
      <div
        role="button"
        tabIndex={0}
        onDragOver={e => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={e => {
          e.preventDefault();
          setDragOver(false);
          if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
        onKeyDown={e => e.key === 'Enter' && inputRef.current?.click()}
        className={cn(
          'border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors',
          dragOver ? 'border-[#0B5FFF] bg-blue-50/40' : 'border-gray-200 hover:border-gray-300',
        )}
      >
        <Upload size={32} className="mx-auto text-gray-400 mb-2" />
        <p className="text-sm text-gray-700">Drop files here or click to browse</p>
        <p className="text-xs text-gray-500 mt-1">
          PDF, DOCX, XLSX, TXT, MD · max {formatFileSize(MAX_UPLOAD_BYTES)} per file
        </p>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPTED_UPLOAD_EXT.join(',')}
          className="hidden"
          onChange={e => {
            if (e.target.files?.length) addFiles(e.target.files);
            e.target.value = '';
          }}
        />
      </div>

      {queue.length > 0 && (
        <ul className="mt-4 space-y-2 max-h-40 overflow-y-auto">
          {queue.map((q, i) => (
            <li key={`${q.file.name}-${i}`} className="text-sm">
              <div className="flex justify-between gap-2">
                <span className="truncate font-medium text-gray-900">{q.file.name}</span>
                <span className="text-gray-500 shrink-0">{formatFileSize(q.file.size)}</span>
              </div>
              {q.status === 'uploading' && (
                <div className="mt-1 h-1.5 w-full rounded-full bg-gray-100 overflow-hidden">
                  <div
                    className="h-full bg-[#0B5FFF] transition-all"
                    style={{ width: `${q.progress}%` }}
                  />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="mt-5 flex justify-end gap-2">
        <button
          type="button"
          onClick={resetAndClose}
          className="px-3 py-1.5 text-sm border border-gray-200 rounded-md text-gray-700 hover:bg-gray-50"
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={!collectionId || queue.length === 0 || upload.isPending}
          onClick={() => void startUpload()}
          className="px-4 py-1.5 text-sm bg-[#0B5FFF] text-white rounded-md hover:bg-blue-700 disabled:opacity-50 inline-flex items-center gap-2"
        >
          {upload.isPending ? <Loader2 size={16} className="animate-spin" /> : null}
          Start upload
        </button>
      </div>
    </Dialog>
  );
}
