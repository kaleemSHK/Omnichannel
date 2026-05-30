/**
 * BlinkOne IVR sidecar — /api/ivr
 */

import { bnFetch } from './client';
import type { IVRFlow, IVRNode, IVREdge } from '@/types';
import { builderToGraph, defaultNewFlowGraph, type RuntimeGraph } from '@/lib/ivr/graph';

const SVC = 'ivr';

const BUILDER_NODE_TYPES = new Set([
  'play',
  'voicebot',
  'dtmf',
  'transfer',
  'enqueue',
  'hangup',
  'condition',
]);

interface RawGraphNode {
  id?: string;
  type?: string;
  text?: string;
  label?: string;
  media?: string;
  next?: string;
  options?: Array<{ digit?: string; key?: string; next?: string; label?: string }>;
  [k: string]: unknown;
}

/**
 * The backend stores a runtime IVR graph (`graph.nodes` with {id,type,media,next}),
 * but the visual builder needs top-level `nodes`/`edges` with canvas positions.
 * Normalise so the UI never receives an undefined `nodes` (which crashed the page).
 */
function normalizeFlow(raw: unknown): IVRFlow {
  const r = (raw ?? {}) as Record<string, unknown>;
  // Already in builder shape (e.g. demo fixture) — pass through with safe defaults.
  if (Array.isArray(r.nodes)) {
    return {
      ...(r as unknown as IVRFlow),
      nodes: r.nodes as IVRNode[],
      edges: Array.isArray(r.edges) ? (r.edges as IVREdge[]) : [],
    };
  }

  const graph = (r.graph ?? {}) as { nodes?: RawGraphNode[] };
  const rawNodes: RawGraphNode[] = Array.isArray(graph.nodes) ? graph.nodes : [];

  const nodes: IVRNode[] = rawNodes.map((n, i) => ({
    id: String(n.id ?? `node-${i}`),
    type: (BUILDER_NODE_TYPES.has(String(n.type)) ? n.type : 'play') as IVRNode['type'],
    label: String(n.text ?? n.label ?? n.id ?? n.type ?? 'Step'),
    config: { ...n },
    position: { x: 140 + (i % 3) * 240, y: 80 + Math.floor(i / 3) * 170 },
  }));

  const ids = new Set(nodes.map(n => n.id));
  const edges: IVREdge[] = [];
  for (const n of rawNodes) {
    const src = String(n.id ?? '');
    if (n.next && ids.has(String(n.next))) {
      edges.push({ id: `${src}-${n.next}`, source: src, target: String(n.next) });
    }
    for (const o of Array.isArray(n.options) ? n.options : []) {
      if (o?.next && ids.has(String(o.next))) {
        const key = String(o.digit ?? o.key ?? o.label ?? '');
        edges.push({ id: `${src}-${o.next}-${key}`, source: src, target: String(o.next), label: key });
      }
    }
  }

  return {
    id: String(r.id ?? ''),
    tenantId: String(r.tenantId ?? r.tenant_id ?? ''),
    name: String(r.name ?? 'IVR flow'),
    description: (r.description as string | undefined) ?? undefined,
    version: Number(r.activeVersion ?? r.version ?? 1),
    nodes,
    edges,
    isActive: Boolean(r.isActive ?? r.activeVersionId),
  };
}

export async function listFlows(): Promise<IVRFlow[]> {
  const res = await bnFetch<{ data: unknown[] }>(SVC, '/v1/flows');
  return (res.data ?? []).map(normalizeFlow);
}

export async function getFlow(id: string): Promise<IVRFlow> {
  const res = await bnFetch<{ data: unknown }>(SVC, `/v1/flows/${id}`);
  return normalizeFlow(res.data);
}

export async function createFlow(payload: {
  name: string;
  description?: string;
  graph?: RuntimeGraph;
  nodes?: IVRNode[];
  edges?: IVREdge[];
}): Promise<IVRFlow> {
  const graph = payload.graph ?? builderToGraph({ nodes: payload.nodes ?? [], edges: payload.edges ?? [] });
  const res = await bnFetch<{ data: unknown }>(SVC, '/v1/flows', {
    method: 'POST',
    body: JSON.stringify({ name: payload.name, description: payload.description, graph }),
  });
  return normalizeFlow(res.data);
}

export async function createNewFlow(name: string): Promise<IVRFlow> {
  return createFlow({ name, graph: defaultNewFlowGraph() });
}

export async function saveFlowDraft(flow: IVRFlow, comment = 'Draft save'): Promise<IVRFlow> {
  const graph = builderToGraph(flow);
  const res = await bnFetch<{ data: { flow?: unknown } }>(SVC, `/v1/flows/${flow.id}/versions`, {
    method: 'POST',
    body: JSON.stringify({ graph, comment, setActive: false }),
  });
  return normalizeFlow(res.data?.flow ?? res.data);
}

export async function updateFlow(id: string, data: Partial<Pick<IVRFlow, 'name' | 'description'>>): Promise<IVRFlow> {
  const res = await bnFetch<{ data: unknown }>(SVC, `/v1/flows/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
  return normalizeFlow(res.data);
}

export async function getFlowVersions(id: string): Promise<IVRFlow[]> {
  const res = await bnFetch<{ data: IVRFlow[] }>(SVC, `/v1/flows/${id}/versions`);
  return res.data;
}

export async function publishFlow(id: string, flow?: IVRFlow): Promise<IVRFlow> {
  const body = flow ? JSON.stringify({ graph: builderToGraph(flow) }) : '{}';
  const res = await bnFetch<{ data: unknown }>(SVC, `/v1/flows/${id}/publish`, {
    method: 'POST',
    body,
  });
  return normalizeFlow(res.data);
}
