import type { Canvas, Node, Edge, InlineNode } from '@/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Serialized clipboard payload — a snapshot of selected nodes and their edges. */
export interface ClipboardPayload {
  nodes: InlineNode[];
  edges: Edge[];
}

// ---------------------------------------------------------------------------
// serializeSelection
// ---------------------------------------------------------------------------

/**
 * Snapshot the selected items from a canvas into a ClipboardPayload.
 *
 * - Only InlineNodes are included — RefNodes are silently excluded (they
 *   reference subsystem canvases that cannot be shallow-copied).
 * - Edges are included when *both* endpoints belong to the selected set.
 * - `codeRefs` and `notes` are stripped from the copied nodes because they
 *   are file-specific annotations that should not be duplicated.
 */
export function serializeSelection(
  canvas: Canvas,
  selectedNodeIds: Set<string>,
): ClipboardPayload {
  if (selectedNodeIds.size === 0) {
    return { nodes: [], edges: [] };
  }

  const allNodes = canvas.nodes ?? [];
  const allEdges = canvas.edges ?? [];

  // Collect only InlineNodes — filter out RefNodes
  const nodes: InlineNode[] = [];
  const includedIds = new Set<string>();

  for (const node of allNodes) {
    if (!selectedNodeIds.has(node.id)) continue;
    if ('ref' in node) continue; // skip RefNodes

    const { codeRefs, notes, ...rest } = node as InlineNode;
    nodes.push(rest);
    includedIds.add(node.id);
  }

  // Include edges only when both endpoints are in the included set
  const edges: Edge[] = allEdges
    .filter((e) => includedIds.has(e.from.node) && includedIds.has(e.to.node))
    .map(({ notes, ...rest }) => rest);

  return { nodes, edges };
}

// ---------------------------------------------------------------------------
// computeCascadeOffset
// ---------------------------------------------------------------------------

/**
 * Compute a paste offset that cascades with each successive paste.
 *
 * Each paste adds `(pasteCount * 30, pasteCount * 30)` to the original
 * positions so that pasted items fan out diagonally and never perfectly
 * overlap the source.
 */
export function computeCascadeOffset(pasteCount: number): { dx: number; dy: number } {
  const step = 30;
  return { dx: pasteCount * step, dy: pasteCount * step };
}

// ---------------------------------------------------------------------------
// preparePaste
// ---------------------------------------------------------------------------

/**
 * Produce a set of new nodes and edges ready to be added to a canvas.
 *
 * - Every node receives a fresh `node-{8hex}` ID.
 * - `displayName` is passed through as-is (no dedup suffix).
 * - Positions are shifted by the cascade offset. Nodes without a position
 *   default to `(0, 0)` before the offset is applied.
 * - Edge endpoints are rewritten to reference the new IDs.
 */
export function preparePaste(
  payload: ClipboardPayload,
  pasteCount: number,
  idGenerator: () => string = () => `node-${crypto.randomUUID().slice(0, 8)}`,
): { nodes: Node[]; edges: Edge[] } {
  if (payload.nodes.length === 0) {
    return { nodes: [], edges: [] };
  }

  const { dx, dy } = computeCascadeOffset(pasteCount);

  // Build old-id → new-id mapping
  const idMap = new Map<string, string>();
  for (const node of payload.nodes) {
    idMap.set(node.id, idGenerator());
  }

  // Create new nodes with remapped IDs and offset positions
  const nodes: Node[] = payload.nodes.map((node) => {
    const pos = node.position ?? { x: 0, y: 0 };
    return {
      ...node,
      id: idMap.get(node.id)!,
      position: {
        ...pos,
        x: pos.x + dx,
        y: pos.y + dy,
      },
    };
  });

  // Rewrite edge endpoints to use new IDs
  const edges: Edge[] = payload.edges
    .filter((e) => idMap.has(e.from.node) && idMap.has(e.to.node))
    .map((e) => ({
      ...e,
      from: { ...e.from, node: idMap.get(e.from.node)! },
      to: { ...e.to, node: idMap.get(e.to.node)! },
    }));

  return { nodes, edges };
}
