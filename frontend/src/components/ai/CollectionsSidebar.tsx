'use client';

import { FolderOpen, Loader2, Plus } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useCreateRagCollection, useRagCollections } from '@/lib/hooks/useAiKnowledge';
import type { RagCollection } from '@/lib/utils/ai';
import { cn } from '@/lib/utils/cn';

interface Props {
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function CollectionsSidebar({ selectedId, onSelect }: Props) {
  const { data: collections = [], isLoading } = useRagCollections();
  const create = useCreateRagCollection();
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (creating) inputRef.current?.focus();
  }, [creating]);

  useEffect(() => {
    if (!selectedId && collections.length > 0) {
      onSelect(collections[0].id);
    }
  }, [collections, selectedId, onSelect]);

  const submitNew = async () => {
    const name = newName.trim();
    if (!name) {
      setCreating(false);
      return;
    }
    await create.mutateAsync(name);
    setNewName('');
    setCreating(false);
  };

  return (
    <aside className="w-[190px] shrink-0 border-e border-gray-200 bg-white flex flex-col">
      <div className="px-3 py-2.5 border-b border-gray-100">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Collections</p>
      </div>
      <div className="flex-1 overflow-y-auto py-1">
        {isLoading && (
          <div className="flex justify-center py-6">
            <Loader2 className="animate-spin text-gray-400" size={18} />
          </div>
        )}
        {!isLoading &&
          collections.map((c: RagCollection) => (
            <button
              key={c.id}
              type="button"
              onClick={() => onSelect(c.id)}
              className={cn(
                'w-full flex items-center gap-2 px-3 py-2 text-sm text-start transition-colors',
                selectedId === c.id ? 'bg-blue-50 text-[#0B5FFF]' : 'text-gray-700 hover:bg-gray-50',
              )}
            >
              <FolderOpen size={16} className="shrink-0 opacity-80" />
              <span className="font-medium truncate flex-1">{c.name}</span>
              <span className="text-xs text-gray-400 tabular-nums">{c.docCount}</span>
            </button>
          ))}
      </div>
      <div className="p-2 border-t border-gray-100">
        {creating ? (
          <input
            ref={inputRef}
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') void submitNew();
              if (e.key === 'Escape') {
                setCreating(false);
                setNewName('');
              }
            }}
            onBlur={() => {
              if (!newName.trim()) setCreating(false);
            }}
            placeholder="Collection name"
            className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded-md outline-none focus:border-[#0B5FFF]"
          />
        ) : (
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="w-full flex items-center justify-center gap-1 py-2 text-xs text-gray-500 border border-dashed border-gray-200 rounded-md hover:border-[#0B5FFF] hover:text-[#0B5FFF]"
          >
            <Plus size={14} />
            New collection
          </button>
        )}
      </div>
    </aside>
  );
}
