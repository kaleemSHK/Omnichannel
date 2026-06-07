'use client';

import { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  useReactFlow,
  ReactFlowProvider,
  type Connection,
  type Edge,
  type Node,
  type OnConnect,
  BackgroundVariant,
  MarkerType,
  Panel,
} from '@xyflow/react';
import { IVRNodeCard, type IVRNodeData, NODE_META } from './IVRNodeCard';
import type { IVRFlow, IVRNode, IVREdge, IVRNodeType } from '@/types';

const NODE_COLOR_HEX: Record<IVRNodeType, string> = {
  play: '#3b82f6',
  dtmf: '#10b981',
  voicebot: '#f59e0b',
  transfer: '#14b8a6',
  enqueue: '#14b8a6',
  condition: '#8b5cf6',
  schedule: '#6366f1',
  webhook: '#f97316',
  set_variable: '#64748b',
  voicemail: '#ec4899',
  sms: '#06b6d4',
  callback: '#84cc16',
  hangup: '#ef4444',
};

function flowNodesToRF(nodes: IVRNode[], entryId: string): Node<IVRNodeData>[] {
  return nodes.map(n => ({
    id: n.id,
    type: 'ivrNode',
    position: n.position ?? { x: 0, y: 0 },
    data: {
      nodeType: n.type as IVRNodeType,
      label: n.label,
      config: n.config ?? {},
      isEntry: n.id === entryId,
      dtmfOptions: Array.isArray(n.config?.options)
        ? (n.config.options as Array<{ digit: string }>).map(o => o.digit)
        : undefined,
      conditionBranches: Array.isArray(n.config?.branches)
        ? (n.config.branches as string[])
        : undefined,
    },
  }));
}

function flowEdgesToRF(edges: IVREdge[]): Edge[] {
  return edges.map(e => ({
    id: e.id,
    source: e.source,
    target: e.target,
    sourceHandle: e.label ?? undefined,
    label: e.label,
    animated: false,
    markerEnd: { type: MarkerType.ArrowClosed, width: 14, height: 14, color: '#0B5FFF' },
    style: { stroke: '#0B5FFF', strokeWidth: 2, opacity: 0.75 },
    labelStyle: { fontSize: 10, fontWeight: 600, fill: '#374151' },
    labelBgStyle: { fill: '#fff', fillOpacity: 0.9 },
    labelBgPadding: [4, 2] as [number, number],
  }));
}

function rfNodesToFlow(rfNodes: Node<IVRNodeData>[]): IVRNode[] {
  return rfNodes.map(rn => ({
    id: rn.id,
    type: rn.data.nodeType,
    label: rn.data.label,
    config: rn.data.config ?? {},
    position: rn.position,
  }));
}

function rfEdgesToFlow(rfEdges: Edge[]): IVREdge[] {
  return rfEdges.map(e => ({
    id: e.id,
    source: e.source,
    target: e.target,
    label: typeof e.label === 'string' ? e.label : e.sourceHandle ?? undefined,
  }));
}

function flowSignature(flow: IVRFlow): string {
  const nodes = flow.nodes ?? [];
  const edges = flow.edges ?? [];
  return JSON.stringify({
    nodes: nodes.map(n => `${n.id}:${n.type}:${Math.round(n.position?.x ?? 0)}:${Math.round(n.position?.y ?? 0)}:${n.label}`),
    edges: edges.map(e => `${e.id}:${e.source}->${e.target}:${e.label ?? ''}`),
    entry: flow.entry ?? '',
  });
}

const nodeTypes = { ivrNode: IVRNodeCard };

interface CanvasProps {
  flow: IVRFlow;
  onFlowChange: (nodes: IVRNode[], edges: IVREdge[]) => void;
  onSelectNode: (id: string | null) => void;
  onAddNode?: (type: IVRNodeType, position: { x: number; y: number }) => void;
}

function IVRFlowCanvasInner({ flow, onFlowChange, onSelectNode, onAddNode }: CanvasProps) {
  const entryId = flow.entry ?? flow.nodes?.[0]?.id ?? '';
  const { screenToFlowPosition } = useReactFlow();
  const syncingFromProp = useRef(false);
  const lastPushedSig = useRef('');

  const initialNodes = useMemo(
    () => flowNodesToRF(flow.nodes ?? [], entryId),
    [flow.id, entryId],
  );
  const initialEdges = useMemo(
    () => flowEdgesToRF(flow.edges ?? []),
    [flow.id],
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  const propSig = useMemo(() => flowSignature(flow), [flow]);

  // Sync canvas when parent adds/removes nodes (palette click, load, save response).
  useEffect(() => {
    if (propSig === lastPushedSig.current) return;
    syncingFromProp.current = true;
    setNodes(flowNodesToRF(flow.nodes ?? [], entryId));
    setEdges(flowEdgesToRF(flow.edges ?? []));
  }, [propSig, flow, entryId, setNodes, setEdges]);

  const pushToParent = useCallback(
    (ns: Node<IVRNodeData>[], es: Edge[]) => {
      const nextNodes = rfNodesToFlow(ns);
      const nextEdges = rfEdgesToFlow(es);
      const sig = JSON.stringify({
        nodes: nextNodes.map(n => `${n.id}:${n.type}:${Math.round(n.position.x)}:${Math.round(n.position.y)}:${n.label}`),
        edges: nextEdges.map(e => `${e.id}:${e.source}->${e.target}:${e.label ?? ''}`),
        entry: flow.entry ?? '',
      });
      lastPushedSig.current = sig;
      onFlowChange(nextNodes, nextEdges);
    },
    [onFlowChange, flow.entry],
  );

  const onConnect: OnConnect = useCallback(
    (params: Connection) => {
      setEdges(prev => {
        const next = addEdge(
          {
            ...params,
            markerEnd: { type: MarkerType.ArrowClosed, width: 14, height: 14, color: '#0B5FFF' },
            style: { stroke: '#0B5FFF', strokeWidth: 2, opacity: 0.75 },
          },
          prev,
        );
        pushToParent(nodes, next);
        return next;
      });
    },
    [nodes, setEdges, pushToParent],
  );

  const onNodeDragStop = useCallback(() => {
    if (syncingFromProp.current) {
      syncingFromProp.current = false;
      return;
    }
    pushToParent(nodes, edges);
  }, [nodes, edges, pushToParent]);

  const onNodesDelete = useCallback(
    (deleted: Node[]) => {
      const deletedIds = new Set(deleted.map(n => n.id));
      setNodes(prev => {
        const nextNodes = prev.filter(n => !deletedIds.has(n.id));
        setEdges(prevEdges => {
          const nextEdges = prevEdges.filter(
            e => !deletedIds.has(e.source) && !deletedIds.has(e.target),
          );
          pushToParent(nextNodes, nextEdges);
          return nextEdges;
        });
        return nextNodes;
      });
    },
    [setNodes, setEdges, pushToParent],
  );

  const onEdgesDelete = useCallback(
    (deleted: Edge[]) => {
      const deletedIds = new Set(deleted.map(e => e.id));
      setEdges(prev => {
        const next = prev.filter(e => !deletedIds.has(e.id));
        pushToParent(nodes, next);
        return next;
      });
    },
    [nodes, setEdges, pushToParent],
  );

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const type = e.dataTransfer.getData('application/ivr-node-type') as IVRNodeType;
      if (!type || !NODE_META[type]) return;
      const position = screenToFlowPosition({ x: e.clientX, y: e.clientY });
      onAddNode?.(type, position);
    },
    [onAddNode, screenToFlowPosition],
  );

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => onSelectNode(node.id),
    [onSelectNode],
  );

  const onPaneClick = useCallback(() => onSelectNode(null), [onSelectNode]);

  return (
    <div className="flex-1 min-h-0 rounded-xl overflow-hidden border border-gray-200">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeDragStop={onNodeDragStop}
        onNodesDelete={onNodesDelete}
        onEdgesDelete={onEdgesDelete}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        onDrop={onDrop}
        onDragOver={onDragOver}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        deleteKeyCode={['Backspace', 'Delete']}
        minZoom={0.3}
        maxZoom={2}
        snapToGrid
        snapGrid={[16, 16]}
        className="bg-gray-50"
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#d1d5db" />
        <Controls className="!border-gray-200 !shadow-sm !rounded-lg overflow-hidden" />
        <MiniMap
          nodeColor={n => NODE_COLOR_HEX[(n.data as IVRNodeData)?.nodeType ?? 'play'] ?? '#6b7280'}
          className="!border-gray-200 !rounded-lg !shadow-sm"
          pannable
          zoomable
        />
        <Panel position="top-right" className="flex gap-1.5 text-[11px] text-muted-foreground">
          <span className="bg-white border border-gray-200 rounded-md px-2 py-1 shadow-sm">
            {nodes.length} nodes · {edges.length} edges
          </span>
        </Panel>
      </ReactFlow>
    </div>
  );
}

export function IVRFlowCanvas(props: CanvasProps) {
  return (
    <ReactFlowProvider>
      <IVRFlowCanvasInner {...props} />
    </ReactFlowProvider>
  );
}
