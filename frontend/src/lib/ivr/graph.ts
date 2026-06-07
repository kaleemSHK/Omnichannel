import type { IVRFlow, IVREdge, IVRNode, IVRNodeType } from '@/types';

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

/** Map frontend node types to the backend runtime types the IVR engine understands. */
function toRuntimeType(type: IVRNodeType): string {
  switch (type) {
    case 'transfer': return 'enqueue';
    case 'set_variable': return 'setvar';
    case 'schedule': return 'timecheck';
    case 'webhook': return 'http';
    case 'voicemail': return 'record';
    case 'sms': return 'sms';
    case 'callback': return 'callback';
    default: return type;
  }
}

/** Convert visual builder nodes/edges into the runtime graph the IVR engine executes. */
export function builderToGraph(flow: Pick<IVRFlow, 'nodes' | 'edges' | 'entry'>): RuntimeGraph {
  const nodes = flow.nodes ?? [];
  const edges = flow.edges ?? [];
  if (!nodes.length) return DEFAULT_NEW_FLOW_GRAPH;

  const nodeIds = new Set(nodes.map(n => n.id));
  const incoming = new Map<string, number>();
  for (const e of edges) {
    incoming.set(e.target, (incoming.get(e.target) ?? 0) + 1);
  }

  const entry =
    flow.entry && nodeIds.has(flow.entry)
      ? flow.entry
      : nodes.find(n => !incoming.has(n.id))?.id ?? nodes[0]?.id ?? 'welcome';

  const runtimeNodes: RuntimeGraphNode[] = nodes.map(n => {
    const out = edges.filter(e => e.source === n.id);
    const type = toRuntimeType(n.type as IVRNodeType);
    const cfg = { ...(n.config ?? {}) };

    const row: RuntimeGraphNode = {
      id: n.id,
      type,
      text: n.label || String(cfg.text ?? n.id),
    };

    if (cfg.media) row.media = String(cfg.media);
    if (cfg.queueKey) row.queueKey = String(cfg.queueKey);
    if (cfg.queue) row.queue = String(cfg.queue);
    if (cfg.url) row.url = cfg.url;
    if (cfg.method) row.method = cfg.method;
    if (cfg.body) row.body = cfg.body;
    if (cfg.storeAs) row.storeAs = cfg.storeAs;
    if (cfg.varName) row.varName = cfg.varName;
    if (cfg.varValue) row.varValue = cfg.varValue;
    if (cfg.timezone) row.timezone = cfg.timezone;
    if (cfg.openHours) row.openHours = cfg.openHours;
    if (cfg.openDays) row.openDays = cfg.openDays;
    if (cfg.variable) row.variable = cfg.variable;
    if (cfg.operator) row.operator = cfg.operator;
    if (cfg.value !== undefined) row.value = cfg.value;
    if (cfg.message) row.message = cfg.message;
    if (cfg.from) row.from = cfg.from;
    if (cfg.maxSeconds) row.maxSeconds = cfg.maxSeconds;
    if (cfg.priority) row.priority = cfg.priority;
    if (cfg.model) row.model = cfg.model;
    if (cfg.systemPrompt) row.systemPrompt = cfg.systemPrompt;
    if (cfg.maxTurns) row.maxTurns = cfg.maxTurns;
    if (cfg.maxRetries) row.maxRetries = cfg.maxRetries;
    if (cfg.prompt) row.prompt = cfg.prompt;
    if (cfg.timeoutSec != null) row.timeoutSec = cfg.timeoutSec;
    if (cfg.defaultDigit != null) row.defaultDigit = cfg.defaultDigit;
    if (cfg.collectDigits != null) row.collectDigits = cfg.collectDigits;

    if (Array.isArray(cfg.skillRequirements)) {
      row.skillRequirements = cfg.skillRequirements as RuntimeGraphNode['skillRequirements'];
    }

    if ((n.type === 'dtmf' || n.type === 'condition' || n.type === 'schedule') && out.length) {
      if (n.type === 'dtmf') {
        row.options = out.map(e => ({
          digit: String(e.label ?? '1'),
          next: e.target,
          label: e.label,
        }));
      } else {
        row.branches = out.map(e => ({ label: e.label ?? 'default', next: e.target }));
      }
      const defaultNext = out.find(e => !e.label || e.label === 'default' || e.label === 'open');
      if (defaultNext) row.next = defaultNext.target;
    } else if (n.type === 'play' && out.length > 1) {
      row.collectDigits = true;
      row.routes = Object.fromEntries(
        out.map(e => [String(e.label ?? '1'), e.target]),
      );
      const defaultNext = out.find(e => e.label === 'default') ?? out[0];
      if (defaultNext) row.next = defaultNext.target;
    } else if (n.type !== 'hangup') {
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

export function graphToBuilderNodes(
  graph: RuntimeGraph,
): { nodes: IVRNode[]; edges: IVREdge[]; entry?: string } {
  const rawNodes = graph.nodes ?? [];

  const fromRuntimeType = (type: string): IVRNodeType => {
    switch (type) {
      case 'enqueue': return 'transfer';
      case 'setvar': return 'set_variable';
      case 'timecheck': return 'schedule';
      case 'http': return 'webhook';
      case 'record': return 'voicemail';
      default: return type as IVRNodeType;
    }
  };

  const nodes: IVRNode[] = rawNodes.map((n, i) => ({
    id: String(n.id),
    type: fromRuntimeType(String(n.type)),
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
    for (const b of (n.branches as Array<{ label: string; next: string }> | undefined) ?? []) {
      if (b.next && ids.has(String(b.next))) {
        edges.push({
          id: `${src}-${b.next}-${b.label}`,
          source: src,
          target: String(b.next),
          label: b.label,
        });
      }
    }
    if (n.routes && typeof n.routes === 'object') {
      for (const [digit, target] of Object.entries(n.routes)) {
        if (target && ids.has(String(target))) {
          edges.push({
            id: `${src}-${target}-${digit}`,
            source: src,
            target: String(target),
            label: digit,
          });
        }
      }
    }
  }

  return { nodes, edges, entry: graph.entry };
}
