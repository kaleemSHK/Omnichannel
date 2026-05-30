import type { IVRFlow, IVREdge, IVRNode } from '@/types';

export interface RuntimeGraphNode {
  id: string;
  type: string;
  text?: string;
  media?: string;
  next?: string;
  options?: Array<{ digit: string; next: string; label?: string }>;
  queueKey?: string;
  skillRequirements?: Array<{ skill: string; required?: boolean }>;
  [key: string]: unknown;
}

export interface RuntimeGraph {
  entry: string;
  nodes: RuntimeGraphNode[];
}

const DEFAULT_NEW_FLOW_GRAPH: RuntimeGraph = {
  entry: 'welcome',
  nodes: [
    {
      id: 'welcome',
      type: 'play',
      text: 'Thank you for calling.',
      media: 'sound:hello-world',
      next: 'hangup',
    },
    { id: 'hangup', type: 'hangup' },
  ],
};

/** Convert visual builder nodes/edges into the runtime graph the IVR engine executes. */
export function builderToGraph(flow: Pick<IVRFlow, 'nodes' | 'edges'>): RuntimeGraph {
  const nodes = flow.nodes ?? [];
  const edges = flow.edges ?? [];
  if (!nodes.length) return DEFAULT_NEW_FLOW_GRAPH;

  const entry = nodes[0]?.id ?? 'welcome';

  const runtimeNodes: RuntimeGraphNode[] = nodes.map(n => {
    const out = edges.filter(e => e.source === n.id);
    const type = n.type === 'transfer' ? 'enqueue' : n.type;
    const cfg = { ...(n.config ?? {}) };
    const row: RuntimeGraphNode = {
      id: n.id,
      type,
      text: n.label || String(cfg.text ?? n.id),
    };

    if (cfg.media) row.media = String(cfg.media);
    if (cfg.queueKey) row.queueKey = String(cfg.queueKey);
    if (Array.isArray(cfg.skillRequirements)) {
      row.skillRequirements = cfg.skillRequirements as RuntimeGraphNode['skillRequirements'];
    }

    if (type === 'dtmf' && out.length) {
      row.options = out.map(e => ({
        digit: String(e.label ?? '1'),
        next: e.target,
        label: e.label,
      }));
      const defaultNext = out.find(e => e.label === 'default' || e.label === '*');
      if (defaultNext) row.next = defaultNext.target;
    } else if (type !== 'hangup') {
      const next = out[0]?.target ?? (cfg.next ? String(cfg.next) : undefined);
      if (next) row.next = next;
    }

    return row;
  });

  return { entry, nodes: runtimeNodes };
}

export function defaultNewFlowGraph(): RuntimeGraph {
  return structuredClone(DEFAULT_NEW_FLOW_GRAPH);
}

export function graphToBuilderNodes(graph: RuntimeGraph): { nodes: IVRNode[]; edges: IVREdge[] } {
  const rawNodes = graph.nodes ?? [];
  const nodes: IVRNode[] = rawNodes.map((n, i) => ({
    id: String(n.id),
    type: (n.type === 'enqueue' ? 'transfer' : n.type) as IVRNode['type'],
    label: String(n.text ?? n.id),
    config: { ...n },
    position: { x: 140 + (i % 3) * 240, y: 80 + Math.floor(i / 3) * 170 },
  }));
  const ids = new Set(nodes.map(n => n.id));
  const edges: IVREdge[] = [];
  for (const n of rawNodes) {
    const src = String(n.id);
    if (n.next && ids.has(String(n.next))) {
      edges.push({ id: `${src}-${n.next}`, source: src, target: String(n.next) });
    }
    for (const o of n.options ?? []) {
      if (o.next && ids.has(String(o.next))) {
        edges.push({
          id: `${src}-${o.next}-${o.digit}`,
          source: src,
          target: String(o.next),
          label: o.digit,
        });
      }
    }
  }
  return { nodes, edges };
}
