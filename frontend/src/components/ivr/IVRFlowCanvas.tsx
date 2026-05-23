'use client';

import type { IVRFlow, IVRNode } from '@/types';

const NODE_COLORS: Record<string, string> = {
  play: 'bg-blue-100 text-blue-800',
  dtmf: 'bg-green-100 text-green-800',
  voicebot: 'bg-amber-100 text-amber-800',
  transfer: 'bg-teal-100 text-teal-800',
  condition: 'bg-purple-100 text-purple-800',
  hangup: 'bg-red-100 text-red-800',
};

interface Props {
  flow: IVRFlow;
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function IVRFlowCanvas({ flow, selectedId, onSelect }: Props) {
  const nodes = flow.nodes ?? [];
  const edges = flow.edges ?? [];

  const maxX = Math.max(...nodes.map(n => n.position.x), 400) + 160;
  const maxY = Math.max(...nodes.map(n => n.position.y), 200) + 100;

  return (
    <div
      className="relative flex-1 min-h-[400px] overflow-auto rounded-lg border border-gray-200"
      style={{
        backgroundImage: 'radial-gradient(circle, #e5e7eb 1px, transparent 1px)',
        backgroundSize: '24px 24px',
        backgroundColor: '#f9fafb',
      }}
    >
      <svg className="absolute inset-0 pointer-events-none" width={maxX} height={maxY}>
        {edges.map(e => {
          const from = nodes.find(n => n.id === e.source);
          const to = nodes.find(n => n.id === e.target);
          if (!from || !to) return null;
          const x1 = from.position.x + 60;
          const y1 = from.position.y + 48;
          const x2 = to.position.x + 60;
          const y2 = to.position.y;
          return (
            <line
              key={e.id}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke="#0B5FFF"
              strokeWidth={2}
              opacity={0.45}
            />
          );
        })}
      </svg>
      {nodes.map((node: IVRNode) => (
        <button
          key={node.id}
          type="button"
          onClick={() => onSelect(node.id)}
          style={{ left: node.position.x, top: node.position.y }}
          className={`absolute w-[120px] text-start p-2 rounded-lg border bg-white shadow-sm ${
            selectedId === node.id ? 'border-brand-primary ring-2 ring-brand-primary/20' : 'border-gray-200'
          }`}
        >
          <span
            className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium mb-1 ${NODE_COLORS[node.type] ?? 'bg-gray-100'}`}
          >
            {node.type}
          </span>
          <p className="text-xs font-medium text-gray-900">{node.label}</p>
        </button>
      ))}
    </div>
  );
}
