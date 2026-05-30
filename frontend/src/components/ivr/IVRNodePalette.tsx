'use client';

import type { IVRNode } from '@/types';

const NODE_TYPES: { type: IVRNode['type']; label: string; color: string }[] = [
  { type: 'play', label: 'Play message', color: 'bg-blue-500' },
  { type: 'dtmf', label: 'DTMF menu', color: 'bg-green-500' },
  { type: 'voicebot', label: 'Voice bot', color: 'bg-amber-500' },
  { type: 'transfer', label: 'Route to queue', color: 'bg-teal-500' },
  { type: 'condition', label: 'Condition', color: 'bg-purple-500' },
  { type: 'hangup', label: 'Hangup', color: 'bg-red-500' },
];

interface Props {
  flows: { id: string; name: string }[];
  activeFlowId: string;
  onSelectFlow: (id: string) => void;
  onAddNode?: (type: IVRNode['type']) => void;
  onCreateFlow?: () => void;
  creating?: boolean;
}

export function IVRNodePalette({ flows, activeFlowId, onSelectFlow, onAddNode, onCreateFlow, creating }: Props) {
  return (
    <aside className="w-[180px] shrink-0 bg-white border-e border-gray-200 flex flex-col h-full">
      <div className="p-2 border-b border-gray-100">
        <p className="text-xs font-semibold text-muted-foreground uppercase px-1">Nodes</p>
        <ul className="mt-2 space-y-1">
          {NODE_TYPES.map(n => (
            <li key={n.type}>
              <button
                type="button"
                onClick={() => onAddNode?.(n.type)}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs hover:bg-muted text-start"
              >
                <span className={`size-2 rounded-full shrink-0 ${n.color}`} />
                {n.label}
              </button>
            </li>
          ))}
        </ul>
      </div>
      <div className="p-2 flex-1 overflow-y-auto">
        <p className="text-xs font-semibold text-muted-foreground uppercase px-1">Flows</p>
        <ul className="mt-2 space-y-1">
          {flows.map(f => (
            <li key={f.id}>
              <button
                type="button"
                onClick={() => onSelectFlow(f.id)}
                className={
                  activeFlowId === f.id
                    ? 'w-full text-start px-2 py-1.5 rounded text-xs bg-blue-50 text-brand-primary font-medium'
                    : 'w-full text-start px-2 py-1.5 rounded text-xs hover:bg-muted'
                }
              >
                {f.name}
              </button>
            </li>
          ))}
        </ul>
        <button
          type="button"
          disabled={creating}
          onClick={() => onCreateFlow?.()}
          className="mt-2 w-full py-1.5 text-xs border border-dashed border-gray-200 rounded text-muted-foreground hover:border-brand-primary hover:text-brand-primary disabled:opacity-50"
        >
          {creating ? 'Creating…' : 'New flow'}
        </button>
      </div>
    </aside>
  );
}
