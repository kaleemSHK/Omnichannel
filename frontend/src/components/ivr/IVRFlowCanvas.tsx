'use client';

import { useCallback, useMemo } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
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

// ─── Helpers ───────────────────────────────────────────────────────────────────

function flowNodesToRF(nodes: IVRNode[], entryId: string): Node<IVRNodeData>[] {
  return nodes.map(n => ({
    id: n.id,
    type: 'ivrNode',
    position: n.position,
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

function rfNodesToFlow(rfNodes: Node<IVRNodeData>[], originalNodes: IVRNode[]): IVRNode[] {
  return rfNodes.map(rn => {
    const orig = originalNodes.find(n => n.id === rn.id);
    return {
      id: rn.id,
      type: rn.data.nodeType,
      label: rn.data.label,
      config: rn.data.config,
      position: rn.position,
    } satisfies IVRNode;
  });
}

function rfEdgesToFlow(rfEdges: Edge[]): IVREdge[] {
  return rfEdges.map(e => ({
    id: e.id,
    source: e.source,
    target: e.target,
    label: typeof e.label === 'string' ? e.label : e.sourceHandle ?? undefined,
  }));
}

const nodeTypes = { ivrNode: IVRNodeCard };

// ─── Component ─────────────────────────────────────────────────────────────────

interface Props {
  flow: IVRFlow;
  onFlowChange: (nodes: IVRNode[], edges: IVREdge[]) => void;
  onSelectNode: (id: string | null) => void;
  selectedId: string | null;
}

export function IVRFlowCanvas({ flow, onFlowChange, onSelectNode, selectedId }: Props) {
  const entryId = flow.nodes?.[0]?.id ?? '';

  const initialNodes = useMemo(
    () => flowNodesToRF(flow.nodes ?? [], entryId),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [flow.id],
  );
  const initialEdges = useMemo(
    () => flowEdgesToRF(flow.edges ?? []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [flow.id],
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  const commit = useCallback(
    (ns: Node<IVRNodeData>[], es: Edge[]) => {
      onFlowChange(rfNodesToFlow(ns, flow.nodes ?? []), rfEdgesToFlow(es));
    },
    [flow.nodes, onFlowChange],
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
        commit(nodes, next);
        return next;
      });
    },
    [nodes, setEdges, commit],
  );

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => onSelectNode(node.id),
    [onSelectNode],
  );

  const onPaneClick = useCallback(() => onSelectNode(null), [onSelectNode]);

  const onNodesChangeWrapped: typeof onNodesChange = useCallback(
    changes => {
      onNodesChange(changes);
      setNodes(prev => {
        commit(prev, edges);
        return prev;
      });
    },
    [onNodesChange, setNodes, edges, commit],
  );

  const onEdgesChangeWrapped: typeof onEdgesChange = useCallback(
    changes => {
      onEdgesChange(changes);
      setEdges(prev => {
        commit(nodes, prev);
        return prev;
      });
    },
    [onEdgesChange, setEdges, nodes, commit],
  );

  return (
    <div className="flex-1 min-h-0 rounded-xl overflow-hidden border border-gray-200">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChangeWrapped}
        onEdgesChange={onEdgesChangeWrapped}
        onConnect={onConnect}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
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
