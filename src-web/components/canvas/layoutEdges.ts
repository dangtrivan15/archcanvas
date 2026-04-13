import type { Edge } from '@/types';

/**
 * Collapse cross-scope edge endpoints (`@refNode/child`) down to the root-scope
 * ref-node (`refNode`) so ELK can lay out the current canvas without choking on
 * IDs that don't exist in the children list.
 *
 * Also drops self-loops (both endpoints collapsing into the same ref-node) and
 * dedupes duplicate `from→to` pairs — layout only needs one instance per pair.
 */
export function remapCrossScopeEdgesForLayout(edges: readonly Edge[]): Edge[] {
  const collapse = (node: string): string =>
    node.startsWith('@') ? node.slice(1).split('/', 1)[0] : node;

  const seen = new Set<string>();
  const result: Edge[] = [];

  for (const edge of edges) {
    const from = collapse(edge.from.node);
    const to = collapse(edge.to.node);
    if (from === to) continue;

    const key = `${from}\u0000${to}`;
    if (seen.has(key)) continue;
    seen.add(key);

    result.push({
      ...edge,
      from: { ...edge.from, node: from },
      to: { ...edge.to, node: to },
    });
  }

  return result;
}
