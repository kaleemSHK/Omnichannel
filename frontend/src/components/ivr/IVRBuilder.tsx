'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { listFlows, getFlow, updateFlow, publishFlow } from '@/lib/api/ivr';
import { DEMO_IVR_FLOW } from '@/lib/demo/callingFixture';
import { IVRFlowCanvas } from '@/components/ivr/IVRFlowCanvas';
import { IVRNodePalette } from '@/components/ivr/IVRNodePalette';
import { IVRPropertiesPanel } from '@/components/ivr/IVRPropertiesPanel';
import type { IVRNode } from '@/types';

export function IVRBuilder() {
  const [flowId, setFlowId] = useState(DEMO_IVR_FLOW.id);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(
    DEMO_IVR_FLOW.nodes[0]?.id ?? null,
  );
  const [label, setLabel] = useState('');

  const { data: flows = [] } = useQuery({
    queryKey: ['ivr-flows'],
    queryFn: async () => {
      try {
        return await listFlows();
      } catch {
        return [DEMO_IVR_FLOW];
      }
    },
  });

  const { data: flow = DEMO_IVR_FLOW } = useQuery({
    queryKey: ['ivr-flow', flowId],
    queryFn: async () => {
      try {
        return await getFlow(flowId);
      } catch {
        return DEMO_IVR_FLOW;
      }
    },
  });

  const selected = flow.nodes.find(n => n.id === selectedNodeId) ?? null;

  const saveNode = () => {
    if (!selected || !label.trim()) return;
    const nodes = flow.nodes.map(n => (n.id === selected.id ? { ...n, label: label.trim() } : n));
    void updateFlow(flow.id, { nodes }).catch(() => undefined);
  };

  const handlePublish = () => {
    void publishFlow(flow.id).catch(() => void updateFlow(flow.id, { isActive: true }));
  };

  return (
    <div className="flex h-full min-h-[calc(100vh-3rem)] overflow-hidden bg-surface-tertiary">
      <IVRNodePalette
        flows={(flows.length ? flows : [DEMO_IVR_FLOW]).map(f => ({ id: f.id, name: f.name }))}
        activeFlowId={flowId}
        onSelectFlow={id => {
          setFlowId(id);
          setSelectedNodeId(null);
        }}
      />

      <div className="flex-1 flex flex-col p-3 min-w-0">
        <div className="flex justify-end gap-2 mb-2 shrink-0">
          <button type="button" className="px-3 py-1 text-xs border border-gray-200 rounded-lg bg-white">
            Test flow
          </button>
          <button type="button" className="px-3 py-1 text-xs border border-gray-200 rounded-lg bg-white">
            History
          </button>
          <button
            type="button"
            onClick={handlePublish}
            className="px-3 py-1 text-xs rounded-lg bg-brand-primary text-white"
          >
            Publish
          </button>
        </div>
        <IVRFlowCanvas
          flow={flow}
          selectedId={selectedNodeId}
          onSelect={id => {
            setSelectedNodeId(id);
            const node = flow.nodes.find(n => n.id === id);
            setLabel(node?.label ?? '');
          }}
        />
      </div>

      <IVRPropertiesPanel
        selected={selected}
        label={label || selected?.label || ''}
        onLabelChange={setLabel}
        onSave={saveNode}
      />
    </div>
  );
}
