'use client';

import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  listFlows,
  getFlow,
  saveFlowDraft,
  publishFlow,
  createNewFlow,
} from '@/lib/api/ivr';
import { DEMO_IVR_FLOW } from '@/lib/demo/callingFixture';
import { IVRFlowCanvas } from '@/components/ivr/IVRFlowCanvas';
import { IVRNodePalette } from '@/components/ivr/IVRNodePalette';
import { IVRPropertiesPanel } from '@/components/ivr/IVRPropertiesPanel';
import type { IVRFlow, IVRNode } from '@/types';

export function IVRBuilder() {
  const qc = useQueryClient();
  const [flowId, setFlowId] = useState<string | null>(null);
  const [localFlow, setLocalFlow] = useState<IVRFlow | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [label, setLabel] = useState('');
  const [draftConfig, setDraftConfig] = useState<Record<string, unknown>>({});
  const [creating, setCreating] = useState(false);

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

  useEffect(() => {
    if (!flowId && flows.length) setFlowId(flows[0].id);
  }, [flows, flowId]);

  const { data: loadedFlow } = useQuery({
    queryKey: ['ivr-flow', flowId],
    enabled: !!flowId,
    queryFn: async () => {
      try {
        return await getFlow(flowId as string);
      } catch {
        return DEMO_IVR_FLOW;
      }
    },
  });

  useEffect(() => {
    if (loadedFlow) setLocalFlow(loadedFlow);
  }, [loadedFlow]);

  const flow = localFlow ?? loadedFlow ?? DEMO_IVR_FLOW;
  const flowNodes = flow?.nodes ?? [];
  const selected = flowNodes.find(n => n.id === selectedNodeId) ?? null;

  const handleSelectNode = (id: string) => {
    setSelectedNodeId(id);
    const node = flowNodes.find(n => n.id === id);
    setLabel(node?.label ?? '');
    setDraftConfig({ ...(node?.config ?? {}) });
  };

  const updateLocalNodes = (nodes: IVRNode[]) => {
    setLocalFlow(prev => (prev ? { ...prev, nodes, edges: prev.edges ?? [] } : prev));
  };

  const saveNode = () => {
    if (!selected || !label.trim() || !flow?.id) return;
    const nodes = flowNodes.map(n =>
      n.id === selected.id
        ? {
            ...n,
            label: label.trim(),
            config: { ...(n.config ?? {}), ...draftConfig },
          }
        : n,
    );
    updateLocalNodes(nodes);
    const nextFlow = { ...flow, nodes };
    void saveFlowDraft(nextFlow, 'Node edit')
      .then(saved => {
        setLocalFlow(saved);
        toast.success('Node saved');
      })
      .catch(() => toast.error('Could not save node'));
  };

  const handlePublish = () => {
    if (!flow?.id) return;
    void publishFlow(flow.id, flow)
      .then(saved => {
        setLocalFlow(saved);
        void qc.invalidateQueries({ queryKey: ['ivr-flow', flow.id] });
        toast.success('Flow published');
      })
      .catch(() => toast.error('Publish failed'));
  };

  const handleCreateFlow = async () => {
    const name = window.prompt('Name for the new IVR flow', 'My IVR flow');
    if (!name?.trim()) return;
    setCreating(true);
    try {
      const created = await createNewFlow(name.trim());
      setFlowId(created.id);
      setLocalFlow(created);
      setSelectedNodeId(created.nodes[0]?.id ?? null);
      void qc.invalidateQueries({ queryKey: ['ivr-flows'] });
      toast.success(`Created "${name.trim()}"`);
    } catch {
      toast.error('Could not create flow');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="flex h-full min-h-[calc(100vh-3rem)] overflow-hidden bg-surface-tertiary">
      <IVRNodePalette
        flows={(flows.length ? flows : [DEMO_IVR_FLOW]).map(f => ({ id: f.id, name: f.name }))}
        activeFlowId={flowId ?? ''}
        onSelectFlow={id => {
          setFlowId(id);
          setLocalFlow(null);
          setSelectedNodeId(null);
          setDraftConfig({});
        }}
        onCreateFlow={handleCreateFlow}
        creating={creating}
      />

      <div className="flex-1 flex flex-col p-3 min-w-0">
        <div className="flex justify-between items-center gap-2 mb-2 shrink-0">
          <p className="text-sm font-medium text-gray-800 truncate">{flow.name}</p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handlePublish}
              className="px-3 py-1 text-xs rounded-lg bg-brand-primary text-white"
            >
              Publish
            </button>
          </div>
        </div>
        <IVRFlowCanvas flow={flow} selectedId={selectedNodeId} onSelect={handleSelectNode} />
      </div>

      <IVRPropertiesPanel
        selected={selected}
        label={label || selected?.label || ''}
        onLabelChange={setLabel}
        nodeConfig={draftConfig}
        onConfigChange={setDraftConfig}
        onSave={saveNode}
      />
    </div>
  );
}
