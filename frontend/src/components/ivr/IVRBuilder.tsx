'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  CheckCircle2,
  Circle,
  CloudUpload,
  Edit2,
  Check,
  X,
  LayoutDashboard,
  History,
  Loader2,
} from 'lucide-react';
import {
  listFlows,
  getFlow,
  saveFlowDraft,
  publishFlow,
  createNewFlow,
} from '@/lib/api/ivr';
import { DEMO_IVR_FLOW } from '@/lib/demo/callingFixture';
import { IVRFlowCanvas } from './IVRFlowCanvas';
import { IVRNodePalette } from './IVRNodePalette';
import { IVRPropertiesPanel } from './IVRPropertiesPanel';
import { NODE_META } from './IVRNodeCard';
import type { IVRFlow, IVRNode, IVREdge, IVRNodeType } from '@/types';
import { cn } from '@/lib/utils/cn';

// ─── Helpers ───────────────────────────────────────────────────────────────────

function makeId() {
  return `node-${Date.now().toString(36)}`;
}

function defaultLabelFor(type: IVRNodeType): string {
  return NODE_META[type]?.label ?? type;
}

// ─── Save-status indicator ─────────────────────────────────────────────────────

type SaveStatus = 'saved' | 'saving' | 'dirty' | 'idle';

function SaveStatusBadge({ status }: { status: SaveStatus }) {
  if (status === 'saving')
    return (
      <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
        <Loader2 className="w-3 h-3 animate-spin" />
        Saving…
      </span>
    );
  if (status === 'saved')
    return (
      <span className="flex items-center gap-1 text-[11px] text-green-600">
        <CheckCircle2 className="w-3 h-3" />
        Saved
      </span>
    );
  if (status === 'dirty')
    return (
      <span className="flex items-center gap-1 text-[11px] text-amber-600">
        <Circle className="w-3 h-3 fill-amber-400" />
        Unsaved changes
      </span>
    );
  return null;
}

// ─── Inline rename ─────────────────────────────────────────────────────────────

function FlowName({ name, onRename }: { name: string; onRename: (n: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (editing) inputRef.current?.select(); }, [editing]);

  const commit = () => {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== name) onRename(trimmed);
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="flex items-center gap-1">
        <input
          ref={inputRef}
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') commit();
            if (e.key === 'Escape') setEditing(false);
          }}
          className="text-sm font-semibold text-gray-900 border-b border-brand-primary outline-none bg-transparent w-40"
          autoFocus
        />
        <button type="button" onClick={commit} className="text-green-600 hover:text-green-700">
          <Check className="w-3.5 h-3.5" />
        </button>
        <button type="button" onClick={() => setEditing(false)} className="text-gray-400 hover:text-gray-600">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => { setDraft(name); setEditing(true); }}
      className="flex items-center gap-1.5 group"
    >
      <span className="text-sm font-semibold text-gray-900 truncate max-w-[200px]">{name}</span>
      <Edit2 className="w-3 h-3 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
    </button>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

export function IVRBuilder() {
  const qc = useQueryClient();
  const [flowId, setFlowId] = useState<string | null>(null);
  const [localFlow, setLocalFlow] = useState<IVRFlow | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [label, setLabel] = useState('');
  const [draftConfig, setDraftConfig] = useState<Record<string, unknown>>({});
  const [creating, setCreating] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [publishing, setPublishing] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  // ── Queries ──
  const { data: flows = [] } = useQuery({
    queryKey: ['ivr-flows'],
    queryFn: async () => {
      try { return await listFlows(); }
      catch { return [DEMO_IVR_FLOW]; }
    },
  });

  useEffect(() => {
    if (!flowId && flows.length) setFlowId(flows[0].id);
  }, [flows, flowId]);

  const { data: loadedFlow } = useQuery({
    queryKey: ['ivr-flow', flowId],
    enabled: !!flowId,
    queryFn: async () => {
      try { return await getFlow(flowId as string); }
      catch { return DEMO_IVR_FLOW; }
    },
  });

  useEffect(() => {
    if (loadedFlow) { setLocalFlow(loadedFlow); setSaveStatus('idle'); }
  }, [loadedFlow]);

  const flow = localFlow ?? loadedFlow ?? DEMO_IVR_FLOW;

  // ── Select node ──
  const handleSelectNode = useCallback((id: string | null) => {
    setSelectedNodeId(id);
    if (!id) return;
    const node = (flow.nodes ?? []).find(n => n.id === id);
    setLabel(node?.label ?? '');
    setDraftConfig({ ...(node?.config ?? {}) });
  }, [flow.nodes]);

  // ── Auto-save after canvas change ──
  const scheduleAutoSave = useCallback((updated: IVRFlow) => {
    setSaveStatus('dirty');
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      if (!updated.id) return;
      setSaveStatus('saving');
      try {
        const saved = await saveFlowDraft(updated, 'Auto-save');
        setLocalFlow(saved);
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus('idle'), 3000);
      } catch {
        setSaveStatus('dirty');
      }
    }, 1500);
  }, []);

  // ── Canvas change callback ──
  const handleFlowChange = useCallback((nodes: IVRNode[], edges: IVREdge[]) => {
    setLocalFlow(prev => {
      if (!prev) return prev;
      const updated = { ...prev, nodes, edges };
      scheduleAutoSave(updated);
      return updated;
    });
  }, [scheduleAutoSave]);

  // ── Add node (from palette click or drop) ──
  const handleAddNode = useCallback((type: IVRNodeType, position?: { x: number; y: number }) => {
    const newNode: IVRNode = {
      id: makeId(),
      type,
      label: defaultLabelFor(type),
      config: {},
      position: position ?? {
        x: 160 + Math.random() * 300,
        y: 80 + Math.random() * 200,
      },
    };
    setLocalFlow(prev => {
      if (!prev) return prev;
      const updated = { ...prev, nodes: [...(prev.nodes ?? []), newNode] };
      scheduleAutoSave(updated);
      return updated;
    });
    handleSelectNode(newNode.id);
  }, [scheduleAutoSave, handleSelectNode]);

  // ── Canvas drop ──
  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const type = e.dataTransfer.getData('application/ivr-node-type') as IVRNodeType;
    if (!type || !NODE_META[type]) return;
    const rect = canvasRef.current?.getBoundingClientRect();
    const position = rect
      ? { x: e.clientX - rect.left - 90, y: e.clientY - rect.top - 40 }
      : undefined;
    handleAddNode(type, position);
  }, [handleAddNode]);

  // ── Save node properties ──
  const saveNode = useCallback(() => {
    if (!selectedNodeId || !label.trim()) return;
    setLocalFlow(prev => {
      if (!prev) return prev;
      const nodes = (prev.nodes ?? []).map(n =>
        n.id === selectedNodeId
          ? { ...n, label: label.trim(), config: { ...(n.config ?? {}), ...draftConfig } }
          : n,
      );
      const updated = { ...prev, nodes };
      scheduleAutoSave(updated);
      return updated;
    });
    toast.success('Node saved');
  }, [selectedNodeId, label, draftConfig, scheduleAutoSave]);

  // ── Delete selected node ──
  const deleteNode = useCallback(() => {
    if (!selectedNodeId) return;
    setLocalFlow(prev => {
      if (!prev) return prev;
      const nodes = (prev.nodes ?? []).filter(n => n.id !== selectedNodeId);
      const edges = (prev.edges ?? []).filter(
        e => e.source !== selectedNodeId && e.target !== selectedNodeId,
      );
      const updated = { ...prev, nodes, edges };
      scheduleAutoSave(updated);
      return updated;
    });
    setSelectedNodeId(null);
    toast.success('Node deleted');
  }, [selectedNodeId, scheduleAutoSave]);

  // ── Publish ──
  const handlePublish = useCallback(async () => {
    if (!flow?.id) return;
    setPublishing(true);
    try {
      const saved = await publishFlow(flow.id, flow);
      setLocalFlow(saved);
      void qc.invalidateQueries({ queryKey: ['ivr-flow', flow.id] });
      toast.success('Flow published — live!');
    } catch {
      toast.error('Publish failed');
    } finally {
      setPublishing(false);
    }
  }, [flow, qc]);

  // ── Create flow ──
  const handleCreateFlow = useCallback(async () => {
    const name = window.prompt('Name for the new IVR flow', 'My IVR flow');
    if (!name?.trim()) return;
    setCreating(true);
    try {
      const created = await createNewFlow(name.trim());
      setFlowId(created.id);
      setLocalFlow(created);
      setSelectedNodeId(null);
      void qc.invalidateQueries({ queryKey: ['ivr-flows'] });
      toast.success(`Created "${name.trim()}"`);
    } catch {
      toast.error('Could not create flow');
    } finally {
      setCreating(false);
    }
  }, [qc]);

  // ── Switch flow ──
  const switchFlow = useCallback((id: string) => {
    setFlowId(id);
    setLocalFlow(null);
    setSelectedNodeId(null);
    setDraftConfig({});
    setSaveStatus('idle');
  }, []);

  const selected = (flow.nodes ?? []).find(n => n.id === selectedNodeId) ?? null;
  const flowList = (flows.length ? flows : [DEMO_IVR_FLOW]).map(f => ({
    id: f.id,
    name: f.name,
    isActive: f.isActive,
  }));

  return (
    <div className="flex h-full min-h-[calc(100vh-3rem)] overflow-hidden bg-gray-50">
      {/* Left palette */}
      <IVRNodePalette
        flows={flowList}
        activeFlowId={flowId ?? ''}
        onSelectFlow={switchFlow}
        onAddNode={handleAddNode}
        onCreateFlow={handleCreateFlow}
        creating={creating}
      />

      {/* Main canvas area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Toolbar */}
        <div className="h-11 bg-white border-b border-gray-200 flex items-center px-3 gap-3 shrink-0">
          <LayoutDashboard className="w-4 h-4 text-muted-foreground" />
          <FlowName
            name={flow.name}
            onRename={async name => {
              if (!flow.id) return;
              const { updateFlow } = await import('@/lib/api/ivr');
              try {
                const updated = await updateFlow(flow.id, { name });
                setLocalFlow(updated);
                void qc.invalidateQueries({ queryKey: ['ivr-flows'] });
              } catch {
                toast.error('Could not rename flow');
              }
            }}
          />

          <div className="flex items-center gap-1.5 ms-1">
            <span
              className={cn(
                'text-[10px] font-semibold px-2 py-0.5 rounded-full border',
                flow.isActive
                  ? 'bg-green-50 text-green-700 border-green-200'
                  : 'bg-gray-50 text-gray-500 border-gray-200',
              )}
            >
              {flow.isActive ? 'Live' : 'Draft'}
            </span>
            <span className="text-[10px] text-muted-foreground">v{flow.version}</span>
          </div>

          <div className="flex-1" />

          <SaveStatusBadge status={saveStatus} />

          <button
            type="button"
            className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-gray-700 px-2 py-1 rounded border border-gray-200 hover:bg-gray-50 transition-colors"
            title="Version history (coming soon)"
          >
            <History className="w-3.5 h-3.5" />
            History
          </button>

          <button
            type="button"
            disabled={publishing}
            onClick={handlePublish}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-brand-primary text-white hover:bg-brand-primary/90 disabled:opacity-60 transition-colors"
          >
            {publishing ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <CloudUpload className="w-3.5 h-3.5" />
            )}
            Publish
          </button>
        </div>

        {/* Canvas with drag-drop */}
        <div
          ref={canvasRef}
          className="flex-1 min-h-0 p-3 flex flex-col"
          onDrop={handleDrop}
          onDragOver={e => e.preventDefault()}
        >
          <IVRFlowCanvas
            key={flow.id}
            flow={flow}
            onFlowChange={handleFlowChange}
            onSelectNode={handleSelectNode}
            selectedId={selectedNodeId}
          />
        </div>
      </div>

      {/* Right properties */}
      <IVRPropertiesPanel
        selected={selected}
        label={label || selected?.label || ''}
        onLabelChange={setLabel}
        nodeConfig={draftConfig}
        onConfigChange={setDraftConfig}
        onSave={saveNode}
        onDelete={selected ? deleteNode : undefined}
      />
    </div>
  );
}
