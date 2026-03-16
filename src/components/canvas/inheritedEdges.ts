import type { Edge } from '../../types/schema';

export interface InheritedEdge {
  edge: Edge;
  localEndpoint: string;
  ghostEndpoint: string;
  direction: 'inbound' | 'outbound'; // relative to the child canvas
}

export function extractInheritedEdges(parentEdges: Edge[], refNodeId: string): InheritedEdge[] {
  const prefix = `@${refNodeId}/`;
  const results: InheritedEdge[] = [];

  for (const edge of parentEdges) {
    const fromIsLocal = edge.from.node.startsWith(prefix);
    const toIsLocal = edge.to.node.startsWith(prefix);
    if (!fromIsLocal && !toIsLocal) continue;

    results.push({
      edge,
      localEndpoint: fromIsLocal ? edge.from.node.slice(prefix.length) : edge.to.node.slice(prefix.length),
      ghostEndpoint: fromIsLocal ? edge.to.node : edge.from.node,
      direction: toIsLocal ? 'inbound' : 'outbound',
    });
  }
  return results;
}
