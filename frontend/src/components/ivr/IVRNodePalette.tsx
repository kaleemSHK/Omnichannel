'use client';

import { useState } from 'react';
import {
  Search,
  Plus,
  ChevronRight,
  ChevronDown,
  Zap,
  Trash2,
  Loader2,
} from 'lucide-react';
import { NODE_META } from './IVRNodeCard';
import type { IVRNodeType } from '@/types';
import { cn } from '@/lib/utils/cn';

// ─── Category groups ───────────────────────────────────────────────────────────

const CATEGORIES: { name: string; types: IVRNodeType[] }[] = [
  { name: 'Messaging', types: ['play', 'voicemail', 'sms'] },
  { name: 'Input', types: ['dtmf', 'voicebot'] },
  { name: 'Logic', types: ['condition', 'schedule'] },
  { name: 'Routing', types: ['transfer', 'callback'] },
  { name: 'Actions', types: ['webhook', 'set_variable'] },
  { name: 'Terminal', types: ['hangup'] },
];

// ─── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  flows: { id: string; name: string; isActive?: boolean }[];
  activeFlowId: string;
  onSelectFlow: (id: string) => void;
  onAddNode: (type: IVRNodeType) => void;
  onCreateFlow?: () => void;
  onDeleteFlow?: (id: string) => void;
  deletingFlowId?: string | null;
  creating?: boolean;
  tenantLabel?: string;
}

// ─── Palette item ──────────────────────────────────────────────────────────────

function PaletteItem({ type, onAdd }: { type: IVRNodeType; onAdd: (t: IVRNodeType) => void }) {
  const meta = NODE_META[type];
  const Icon = meta.icon;

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('application/ivr-node-type', type);
    e.dataTransfer.effectAllowed = 'copy';
  };

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      className="group flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-grab active:cursor-grabbing hover:bg-gray-50 border border-transparent hover:border-gray-200 transition-colors"
    >
      <span
        className={cn(
          'flex items-center justify-center w-6 h-6 rounded-md shrink-0',
          meta.bg,
        )}
      >
        <Icon className="w-3 h-3 text-white" />
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-medium text-gray-800 truncate">{meta.label}</p>
        <p className="text-[10px] text-muted-foreground truncate hidden group-hover:block">
          {meta.description}
        </p>
      </div>
      <button
        type="button"
        onClick={() => onAdd(type)}
        title={`Add ${meta.label}`}
        className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-gray-200"
      >
        <Plus className="w-3 h-3 text-gray-500" />
      </button>
    </div>
  );
}

// ─── Category section ──────────────────────────────────────────────────────────

function CategorySection({
  name,
  types,
  defaultOpen = true,
  onAdd,
}: {
  name: string;
  types: IVRNodeType[];
  defaultOpen?: boolean;
  onAdd: (t: IVRNodeType) => void;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="mb-1">
      <button
        type="button"
        onClick={() => setOpen(p => !p)}
        className="w-full flex items-center gap-1 px-2 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide hover:text-gray-700 transition-colors"
      >
        {open ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
        {name}
      </button>
      {open && (
        <div className="space-y-0.5">
          {types.map(t => (
            <PaletteItem key={t} type={t} onAdd={onAdd} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main palette ──────────────────────────────────────────────────────────────

export function IVRNodePalette({
  flows,
  activeFlowId,
  onSelectFlow,
  onAddNode,
  onCreateFlow,
  onDeleteFlow,
  deletingFlowId,
  creating,
  tenantLabel,
}: Props) {
  const [search, setSearch] = useState('');

  const filtered = search.trim()
    ? (Object.entries(NODE_META) as [IVRNodeType, (typeof NODE_META)[IVRNodeType]][])
        .filter(([, m]) =>
          m.label.toLowerCase().includes(search.toLowerCase()) ||
          m.description.toLowerCase().includes(search.toLowerCase()),
        )
        .map(([t]) => t)
    : null;

  return (
    <aside className="w-[200px] shrink-0 bg-white border-e border-gray-200 flex flex-col h-full">
      {/* Header */}
      <div className="px-3 py-2.5 border-b border-gray-100">
        <div className="flex items-center gap-1.5 mb-2">
          <Zap className="w-3.5 h-3.5 text-brand-primary" />
          <span className="text-xs font-semibold text-gray-800">IVR Builder</span>
        </div>
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search nodes…"
            className="w-full pl-6 pr-2 py-1 text-[11px] border border-gray-200 rounded-md bg-gray-50 focus:outline-none focus:ring-1 focus:ring-brand-primary focus:bg-white"
          />
        </div>
      </div>

      {/* Node catalogue */}
      <div className="flex-1 overflow-y-auto px-1 py-2">
        <p className="px-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">
          Drag or click to add
        </p>
        {filtered ? (
          <div className="space-y-0.5">
            {filtered.map(t => (
              <PaletteItem key={t} type={t} onAdd={onAddNode} />
            ))}
            {filtered.length === 0 && (
              <p className="text-[11px] text-muted-foreground px-2 py-3 text-center">No match</p>
            )}
          </div>
        ) : (
          CATEGORIES.map((cat, i) => (
            <CategorySection
              key={cat.name}
              name={cat.name}
              types={cat.types}
              defaultOpen={i < 3}
              onAdd={onAddNode}
            />
          ))
        )}
      </div>

      {/* Flows list */}
      <div className="border-t border-gray-100 px-1 py-2 max-h-[40%] flex flex-col min-h-0">
        <div className="flex items-center justify-between px-2 mb-1 gap-1">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
            Flows
          </p>
          {tenantLabel && (
            <span className="text-[9px] text-muted-foreground truncate" title={tenantLabel}>
              {tenantLabel}
            </span>
          )}
        </div>
        <ul className="overflow-y-auto flex-1 space-y-0.5">
          {flows.map(f => (
            <li key={f.id} className="group flex items-center gap-0.5">
              <button
                type="button"
                onClick={() => onSelectFlow(f.id)}
                className={cn(
                  'flex-1 min-w-0 text-start px-2 py-1.5 rounded-lg text-[11px] transition-colors flex items-center gap-1.5',
                  activeFlowId === f.id
                    ? 'bg-blue-50 text-brand-primary font-semibold'
                    : 'hover:bg-gray-50 text-gray-700',
                )}
              >
                <span
                  className={cn(
                    'w-1.5 h-1.5 rounded-full shrink-0',
                    f.isActive ? 'bg-green-400' : 'bg-gray-300',
                  )}
                />
                <span className="truncate">{f.name}</span>
              </button>
              {onDeleteFlow && (
                <button
                  type="button"
                  title={`Delete ${f.name}`}
                  disabled={deletingFlowId === f.id || flows.length <= 1}
                  onClick={() => onDeleteFlow(f.id)}
                  className="shrink-0 p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-red-50 text-red-500 disabled:opacity-30 transition-all"
                >
                  {deletingFlowId === f.id ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Trash2 className="w-3 h-3" />
                  )}
                </button>
              )}
            </li>
          ))}
        </ul>
        <button
          type="button"
          disabled={creating}
          onClick={() => onCreateFlow?.()}
          className="mt-1 w-full py-1.5 text-[11px] border border-dashed border-gray-200 rounded-lg text-muted-foreground hover:border-brand-primary hover:text-brand-primary disabled:opacity-50 flex items-center justify-center gap-1 transition-colors"
        >
          <Plus className="w-3 h-3" />
          {creating ? 'Creating…' : 'New flow'}
        </button>
      </div>
    </aside>
  );
}
