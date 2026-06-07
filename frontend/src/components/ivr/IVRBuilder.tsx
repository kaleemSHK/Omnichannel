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
  deleteFlow,
} from '@/lib/api/ivr';
import { BlinkoneApiError } from '@/lib/api/client';
import { DEMO_IVR_FLOW } from '@/lib/demo/callingFixture';
import { isDemoDataEnabled, isGatewayQueryEnabled } from '@/lib/demo/config';
import { useAuthStore } from '@/lib/store/auth';
import { IVRFlowCanvas } from './IVRFlowCanvas';
import { IVRNodePalette } from './IVRNodePalette';
import { IVRPropertiesPanel } from './IVRPropertiesPanel';
import { NODE_META } from './IVRNodeCard';
import type { IVRFlow, IVRNode, IVREdge, IVRNodeType } from '@/types';
import { cn } from '@/lib/utils/cn';

function makeId() {
  return `node-${Date.now().toString(36)}`;
}

function defaultLabelFor(type: IVRNodeType): string {
  return NODE_META[type]?.label ?? type;
}

function defaultConfigFor(type: IVRNodeType): Record<string, unknown> {
  switch (type) {
    case 'transfer':
    case 'enqueue':
      return { queueKey: 'support' };
    case 'dtmf':
      return { maxRetries: 3, timeoutSec: 8 };
    case 'voicemail':
      return { maxSeconds: 120 };
    case 'sms':
      return { message: 'Thank you for calling.' };
    case 'webhook':
      return { method: 'POST' };
    case 'schedule':
      return { timezone: 'Asia/Muscat' };
    default:
      return {};
  }
}

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

function FlowName({ name, onRename }: { name: string; onRename: (n: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

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
      onClick={() => {
        setDraft(name);
        setEditing(true);
      }}
      className="flex items-center gap-1.5 group"
    >
      <span className="text-sm font-semibold text-gray-900 truncate max-w-[200px]">{name}</span>
      <Edit2 className="w-3 h-3 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
    </button>
  );
}

function CreateFlowDialog({
  open,
  name,
  onNameChange,
  onCancel,
  onCreate,
  creating,
}: {
  open: boolean;
  name: string;
  onNameChange: (v: string) => void;
  onCancel: () => void;
  onCreate: () => void;
  creating: boolean;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="w-full max-w-sm rounded-xl bg-white shadow-xl border border-gray-100 p-4">
        <h3 className="text-sm font-semibold text-gray-900 mb-1">New IVR flow</h3>
        <p className="text-xs text-muted-foreground mb-3">
          Flows are saved for your tenant only.
        </p>
        <input
          value={name}
          onChange={e => onNameChange(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') onCreate();
            if (e.key === 'Escape') onCancel();
          }}
          placeholder="Flow name"
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary/30"
          autoFocus
        />
        <div className="flex justify-end gap-2 mt-4">
          <button
            type="button"
            onClick={onCancel}
            className="px-3 py-1.5 text-xs rounded-lg border border-gray-200 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={creating || !name.trim()}
            onClick={onCreate}
            className="px-3 py-1.5 text-xs rounded-lg bg-brand-primary text-white hover:bg-brand-primary/90 disabled:opacity-50"
          >
            {creating ? 'Creating…' : 'Create flow'}
          </button>
        </div>
      </div>
    </div>
  );
}

export function IVRBuilder() {
  const qc = useQueryClient();
  const tenantId = String(useAuthStore(s => s.user?.chatwootAccountId ?? s.user?.tenantId ?? '1'));
  const demoMode = isDemoDataEnabled();
  const gatewayEnabled = isGatewayQueryEnabled();

  const [flowId, setFlowId] = useState<string | null>(null);
  const [localFlow, setLocalFlow] = useState<IVRFlow | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [label, setLabel] = useState('');
  const [draftConfig, setDraftConfig] = useState<Record<string, unknown>>({});
  const [creating, setCreating] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [newFlowName, setNewFlowName] = useState('My IVR flow');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [publishing, setPublishing] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data: flows = [], isError: flowsError } = useQuery({
    queryKey: ['ivr-flows', tenantId],
    enabled: gatewayEnabled || demoMode,
    queryFn: async () => {
      if (demoMode) return [DEMO_IVR_FLOW];
      return listFlows();
    },
  });

  useEffect(() => {
    if (!flowId && flows.length) setFlowId(flows[0].id);
  }, [flows, flowId]);

  const { data: loadedFlow, isLoading: flowLoading } = useQuery({
    queryKey: ['ivr-flow', tenantId, flowId],
    enabled: !!flowId && (gatewayEnabled || demoMode),
    queryFn: async () => {
      if (demoMode) return DEMO_IVR_FLOW;
      return getFlow(flowId as string);
    },
  });

  useEffect(() => {
    if (loadedFlow) {
      setLocalFlow(loadedFlow);
      setSaveStatus('idle');
    }
  }, [loadedFlow]);

  const flow = localFlow ?? loadedFlow ?? (demoMode ? DEMO_IVR_FLOW : null);

  const handleSelectNode = useCallback(
    (id: string | null) => {
      setSelectedNodeId(id);
      if (!id || !flow) return;
      const node = (flow.nodes ?? []).find(n => n.id === id);
      setLabel(node?.label ?? '');
      setDraftConfig({ ...(node?.config ?? {}) });
    },
    [flow],
  );

  const scheduleAutoSave = useCallback(
    (updated: IVRFlow) => {
      if (demoMode || !updated.id || updated.id === DEMO_IVR_FLOW.id) return;
      setSaveStatus('dirty');
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(async () => {
        setSaveStatus('saving');
        try {
          const saved = await saveFlowDraft(updated, 'Auto-save');
          setLocalFlow(prev =>
            prev
              ? {
                  ...prev,
                  version: saved.version,
                  isActive: saved.isActive,
                }
              : saved,
          );
          setSaveStatus('saved');
          setTimeout(() => setSaveStatus('idle'), 3000);
        } catch (e) {
          setSaveStatus('dirty');
          if (e instanceof BlinkoneApiError) toast.error(e.message);
        }
      }, 1500);
    },
    [demoMode],
  );

  const handleFlowChange = useCallback(
    (nodes: IVRNode[], edges: IVREdge[]) => {
      setLocalFlow(prev => {
        if (!prev) return prev;
        const updated = { ...prev, nodes, edges };
        scheduleAutoSave(updated);
        return updated;
      });
    },
    [scheduleAutoSave],
  );

  const handleAddNode = useCallback(
    (type: IVRNodeType, position?: { x: number; y: number }) => {
      const newNode: IVRNode = {
        id: makeId(),
        type,
        label: defaultLabelFor(type),
        config: defaultConfigFor(type),
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
    },
    [scheduleAutoSave, handleSelectNode],
  );

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

  const handlePublish = useCallback(async () => {
    if (!flow?.id || demoMode) return;
    setPublishing(true);
    try {
      const saved = await publishFlow(flow.id, flow);
      setLocalFlow(saved);
      void qc.invalidateQueries({ queryKey: ['ivr-flow', tenantId, flow.id] });
      void qc.invalidateQueries({ queryKey: ['ivr-flows', tenantId] });
      toast.success('Flow published — live!');
    } catch (e) {
      toast.error(e instanceof BlinkoneApiError ? e.message : 'Publish failed');
    } finally {
      setPublishing(false);
    }
  }, [flow, demoMode, qc, tenantId]);

  const handleCreateFlow = useCallback(async () => {
    const name = newFlowName.trim();
    if (!name) return;
    setCreating(true);
    try {
      const created = await createNewFlow(name);
      setCreateOpen(false);
      setFlowId(created.id);
      setLocalFlow(created);
      setSelectedNodeId(null);
      void qc.invalidateQueries({ queryKey: ['ivr-flows', tenantId] });
      toast.success(`Created "${name}"`);
    } catch (e) {
      toast.error(e instanceof BlinkoneApiError ? e.message : 'Could not create flow');
    } finally {
      setCreating(false);
    }
  }, [newFlowName, qc, tenantId]);

  const handleDeleteFlow = useCallback(
    async (id: string) => {
      const target = flows.find(f => f.id === id);
      if (!target || demoMode) return;
      if (!window.confirm(`Delete "${target.name}"? This cannot be undone.`)) return;
      setDeletingId(id);
      try {
        await deleteFlow(id);
        void qc.invalidateQueries({ queryKey: ['ivr-flows', tenantId] });
        if (flowId === id) {
          const remaining = flows.filter(f => f.id !== id);
          setFlowId(remaining[0]?.id ?? null);
          setLocalFlow(null);
          setSelectedNodeId(null);
        }
        toast.success('Flow deleted');
      } catch (e) {
        toast.error(e instanceof BlinkoneApiError ? e.message : 'Could not delete flow');
      } finally {
        setDeletingId(null);
      }
    },
    [flows, flowId, demoMode, qc, tenantId],
  );

  const switchFlow = useCallback((id: string) => {
    setFlowId(id);
    setLocalFlow(null);
    setSelectedNodeId(null);
    setDraftConfig({});
    setSaveStatus('idle');
  }, []);

  if (!flow && !flowLoading && !demoMode) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[calc(100vh-3rem)] bg-gray-50 p-8 text-center">
        <p className="text-sm font-semibold text-gray-900 mb-1">No IVR flows yet</p>
        <p className="text-xs text-muted-foreground mb-4 max-w-sm">
          {flowsError
            ? 'Could not load flows from the server. Check your connection and try again.'
            : 'Create your first tenant-scoped IVR flow to route inbound calls.'}
        </p>
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="px-4 py-2 text-sm rounded-lg bg-brand-primary text-white hover:bg-brand-primary/90"
        >
          Create first flow
        </button>
        <CreateFlowDialog
          open={createOpen}
          name={newFlowName}
          onNameChange={setNewFlowName}
          onCancel={() => setCreateOpen(false)}
          onCreate={() => void handleCreateFlow()}
          creating={creating}
        />
      </div>
    );
  }

  if (!flow) {
    return (
      <div className="flex items-center justify-center h-full min-h-[calc(100vh-3rem)]">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const selected = (flow.nodes ?? []).find(n => n.id === selectedNodeId) ?? null;
  const flowList = flows.map(f => ({
    id: f.id,
    name: f.name,
    isActive: f.isActive,
  }));

  return (
    <div className="flex h-full min-h-[calc(100vh-3rem)] overflow-hidden bg-gray-50">
      <CreateFlowDialog
        open={createOpen}
        name={newFlowName}
        onNameChange={setNewFlowName}
        onCancel={() => setCreateOpen(false)}
        onCreate={() => void handleCreateFlow()}
        creating={creating}
      />

      <IVRNodePalette
        flows={flowList}
        activeFlowId={flowId ?? ''}
        onSelectFlow={switchFlow}
        onAddNode={handleAddNode}
        onCreateFlow={() => setCreateOpen(true)}
        onDeleteFlow={demoMode ? undefined : handleDeleteFlow}
        deletingFlowId={deletingId}
        creating={creating}
        tenantLabel={tenantId ? `Tenant ${tenantId}` : undefined}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <div className="h-11 bg-white border-b border-gray-200 flex items-center px-3 gap-3 shrink-0">
          <LayoutDashboard className="w-4 h-4 text-muted-foreground" />
          <FlowName
            name={flow.name}
            onRename={async name => {
              if (!flow.id || demoMode) return;
              const { updateFlow } = await import('@/lib/api/ivr');
              try {
                const updated = await updateFlow(flow.id, { name });
                setLocalFlow(updated);
                void qc.invalidateQueries({ queryKey: ['ivr-flows', tenantId] });
              } catch (e) {
                toast.error(e instanceof BlinkoneApiError ? e.message : 'Could not rename flow');
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
            disabled={publishing || demoMode}
            onClick={() => void handlePublish()}
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

        <div className="flex-1 min-h-0 p-3 flex flex-col">
          <IVRFlowCanvas
            flow={flow}
            onFlowChange={handleFlowChange}
            onSelectNode={handleSelectNode}
            onAddNode={handleAddNode}
          />
        </div>
      </div>

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
