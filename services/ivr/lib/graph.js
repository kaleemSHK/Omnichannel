/** Validate IVR flow DAG shape. */
export function validateGraph(g) {
  if (!g?.entry || !Array.isArray(g.nodes) || !g.nodes.length) {
    return 'graph.entry and graph.nodes[] required';
  }
  const ids = new Set(g.nodes.map((n) => n.id));
  if (!ids.has(g.entry)) return `entry node "${g.entry}" not found`;
  for (const n of g.nodes) {
    if (!n.id || !n.type) return 'each node needs id and type';
    if (n.next && !ids.has(n.next)) return `node "${n.id}" next "${n.next}" not found`;
    if (n.digit != null) {
      const dup = g.nodes.filter((x) => x.digit === String(n.digit) && x.id !== n.id);
      if (dup.length) return `duplicate digit "${n.digit}"`;
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
