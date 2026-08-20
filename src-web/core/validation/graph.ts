import type { Edge } from '@/types';

/**
 * Build a directed adjacency map over the given edges, scoped to `nodeIds`.
 *
 * Cross-scope edge endpoints (any endpoint id starting with `@`, real form
 * `@<refNodeId>/<childId>`) are skipped entirely, mirroring the precedent set
 * by the existing schema validator (`core/graph/validation.ts`):
 * `if (endpoint.node.startsWith('@')) continue;`. Endpoints that aren't in
 * `nodeIds` (e.g. a dangling reference) are also dropped.
 */
export function buildAdjacency(
  edges: Edge[],
  nodeIds: Set<string>,
): Map<string, { out: string[]; in: string[] }> {
  const adjacency = new Map<string, { out: string[]; in: string[] }>();

  for (const id of nodeIds) {
    adjacency.set(id, { out: [], in: [] });
  }

  for (const edge of edges) {
    const from = edge.from.node;
    const to = edge.to.node;

    if (from.startsWith('@') || to.startsWith('@')) continue;
    if (!nodeIds.has(from) || !nodeIds.has(to)) continue;

    adjacency.get(from)!.out.push(to);
    adjacency.get(to)!.in.push(from);
  }

  return adjacency;
}

/**
 * Find directed cycles in the adjacency map via iterative DFS with
 * white/grey/black coloring. Returns each cycle as an ordered node-id list
 * (rotations of the same cycle are deduplicated).
 */
export function findCycles(
  adjacency: Map<string, { out: string[]; in: string[] }>,
): string[][] {
  const WHITE = 0, GREY = 1, BLACK = 2;
  const color = new Map<string, number>();
  for (const id of adjacency.keys()) color.set(id, WHITE);

  const cycles: string[][] = [];
  const seenCycleKeys = new Set<string>();

  function canonicalKey(cycle: string[]): string {
    // Rotate to start at the lexicographically smallest node id, so
    // rotations of the same cycle produce the same key.
    let minIdx = 0;
    for (let i = 1; i < cycle.length; i++) {
      if (cycle[i] < cycle[minIdx]) minIdx = i;
    }
    const rotated = [...cycle.slice(minIdx), ...cycle.slice(0, minIdx)];
    return rotated.join('→');
  }

  for (const start of adjacency.keys()) {
    if (color.get(start) !== WHITE) continue;

    // Iterative DFS: stack of [nodeId, neighborIndex]
    const stack: Array<{ id: string; idx: number }> = [{ id: start, idx: 0 }];
    const path: string[] = [start];
    color.set(start, GREY);

    while (stack.length > 0) {
      const frame = stack[stack.length - 1];
      const neighbors = adjacency.get(frame.id)?.out ?? [];

      if (frame.idx < neighbors.length) {
        const next = neighbors[frame.idx];
        frame.idx++;

        const nextColor = color.get(next);
        if (nextColor === GREY) {
          // Found a cycle: the portion of `path` from `next` to the end.
          const cycleStart = path.indexOf(next);
          if (cycleStart !== -1) {
            const cycle = path.slice(cycleStart);
            const key = canonicalKey(cycle);
            if (!seenCycleKeys.has(key)) {
              seenCycleKeys.add(key);
              cycles.push(cycle);
            }
          }
        } else if (nextColor === WHITE) {
          color.set(next, GREY);
          path.push(next);
          stack.push({ id: next, idx: 0 });
        }
        // BLACK neighbors are fully explored — nothing to do.
      } else {
        color.set(frame.id, BLACK);
        path.pop();
        stack.pop();
      }
    }
  }

  return cycles;
}

/** True when a node has no inbound or outbound in-scope edges. */
export function isOrphan(
  nodeId: string,
  adjacency: Map<string, { out: string[]; in: string[] }>,
): boolean {
  const entry = adjacency.get(nodeId);
  if (!entry) return true;
  return entry.out.length === 0 && entry.in.length === 0;
}
