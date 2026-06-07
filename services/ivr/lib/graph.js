/**
 * Valid node types (both backend-native and frontend-canvas aliases).
 * IVR1: 'transfer' is the frontend canvas alias for 'enqueue'.
 */
const VALID_TYPES = new Set([
  'play',
  'enqueue',
  'transfer',
  'voicebot',
  'dtmf',
  'hangup',
  'condition',
  'timecheck',
  'schedule',
  'http',
  'webhook',
  'setvar',
  'set_variable',
  'record',
  'voicemail',
  'sms',
  'callback',
]);

/** Validate IVR flow DAG shape. */
export function validateGraph(g) {
  if (!g?.entry || !Array.isArray(g.nodes) || !g.nodes.length) {
    return 'graph.entry and graph.nodes[] required';
  }
  const ids = new Set(g.nodes.map((n) => n.id));
  if (!ids.has(g.entry)) return `entry node "${g.entry}" not found`;
  for (const n of g.nodes) {
    if (!n.id || !n.type) return 'each node needs id and type';
    if (!VALID_TYPES.has(n.type)) return `unsupported node type "${n.type}"`;
    if (n.next && !ids.has(n.next)) return `node "${n.id}" next "${n.next}" not found`;
    if (n.routes && typeof n.routes === 'object') {
      for (const [digit, target] of Object.entries(n.routes)) {
        if (target && !ids.has(String(target))) {
          return `node "${n.id}" route "${digit}" → "${target}" not found`;
        }
      }
    }
    if (Array.isArray(n.options)) {
      for (const o of n.options) {
        if (o?.next && !ids.has(String(o.next))) {
          return `node "${n.id}" option → "${o.next}" not found`;
        }
      }
    }
    if (Array.isArray(n.branches)) {
      for (const b of n.branches) {
        if (b?.next && !ids.has(String(b.next))) {
          return `node "${n.id}" branch → "${b.next}" not found`;
        }
      }
    }
    if (n.digit != null) {
      const dup = g.nodes.filter((x) => x.digit === String(n.digit) && x.id !== n.id);
      if (dup.length) return `duplicate digit "${n.digit}"`;
    }
    // IVR1: validate skillRequirements on transfer/enqueue nodes
    const skillReqs = n.skillRequirements ?? n.config?.skillRequirements;
    if (skillReqs != null) {
      if (!Array.isArray(skillReqs)) {
        return `node "${n.id}" skillRequirements must be an array`;
      }
      for (const sr of skillReqs) {
        if (!sr?.skill || typeof sr.skill !== 'string') {
          return `node "${n.id}" skillRequirements entries must have a skill string`;
        }
      }
    }
  }
  return null;
}

export function nodeById(graph, id) {
  return graph?.nodes?.find((n) => n.id === id) ?? null;
}

export function resolveDigitTarget(graph, fromNodeId, digit) {
  const d = String(digit);
  const direct = graph.nodes.find((n) => n.digit === d);
  if (direct) return direct;
  const from = nodeById(graph, fromNodeId);
  if (from?.routes?.[d]) return nodeById(graph, from.routes[d]);
  return null;
}
