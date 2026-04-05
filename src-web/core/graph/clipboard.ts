import type { Canvas, Node, Edge } from '@/types';

// ---------------------------------------------------------------------------
// Clipboard payload — the unit of data that lives in the clipboard store
// ---------------------------------------------------------------------------

export interface ClipboardPayload {
  nodes: Node[];
  edges: Edge[];
  sourceCanvasId: string;
}

// ---------------------------------------------------------------------------
// Serialization — extract selected nodes + internal edges from a canvas
// ---------------------------------------------------------------------------

/**
 * Deep-clone the selected nodes and collect only the edges whose
 * **both** endpoints belong to the selected set. Cross-scope refs
 * (`@refNodeId/childId`) are included only when the ref-node is in
 * the selection.
 */
export function serializeSelection(
  canvas: Canvas,
  selectedNodeIds: Set<string>,
  sourceCanvasId: string,
): ClipboardPayload | null {
  if (selectedNodeIds.size === 0) return null;

  const nodes = (canvas.nodes ?? []).filter((n) => selectedNodeIds.has(n.id));
  if (nodes.length === 0) return null;

  const edges = (canvas.edges ?? []).filter((e) => {
    const fromInSelection = isEndpointInSelection(e.from.node, selectedNodeIds);
    const toInSelection = isEndpointInSelection(e.to.node, selectedNodeIds);
    return fromInSelection && toInSelection;
  });

  // Deep-clone so the clipboard is decoupled from live state
  return {
    nodes: structuredClone(nodes),
    edges: structuredClone(edges),
    sourceCanvasId,
  };
}

// ---------------------------------------------------------------------------
// Deserialization — prepare pasted nodes with fresh IDs + offset positions
// ---------------------------------------------------------------------------

export interface DeserializeOptions {
  /** Pixel offset applied to pasted node positions to avoid stacking */
  positionOffset?: { dx: number; dy: number };
}

/**
 * Generate fresh IDs for every node, remap edge endpoints accordingly,
 * and offset positions so pasted nodes don't stack on top of originals.
 *
 * Returns the new nodes, remapped edges, and the oldId→newId map.
 */
export function deserializeForPaste(
  payload: ClipboardPayload,
  options?: DeserializeOptions,
): { nodes: Node[]; edges: Edge[]; idMap: Map<string, string> } {
  const { dx, dy } = options?.positionOffset ?? { dx: 30, dy: 30 };

  // 1. Build old→new ID map
  const idMap = new Map<string, string>();
  for (const node of payload.nodes) {
    idMap.set(node.id, generateNodeId());
  }

  // 2. Clone nodes with new IDs + offset positions
  const nodes: Node[] = payload.nodes.map((original) => {
    const clone = structuredClone(original);
    clone.id = idMap.get(original.id)!;

    if (clone.position) {
      clone.position = {
        ...clone.position,
        x: clone.position.x + dx,
        y: clone.position.y + dy,
      };
    }

    return clone;
  });

  // 3. Remap edge endpoints
  const edges: Edge[] = payload.edges
    .map((original) => {
      const clone = structuredClone(original);
      clone.from = { ...clone.from, node: remapEndpoint(clone.from.node, idMap) };
      clone.to = { ...clone.to, node: remapEndpoint(clone.to.node, idMap) };
      return clone;
    })
    // Drop any edge whose endpoint couldn't be remapped
    .filter((e) => e.from.node !== '' && e.to.node !== '');

  return { nodes, edges, idMap };
}

// ---------------------------------------------------------------------------
// Helpers (exported for testing)
// ---------------------------------------------------------------------------

/** Generate a new node ID matching the project convention. */
export function generateNodeId(): string {
  return `node-${crypto.randomUUID().slice(0, 8)}`;
}

/**
 * Check whether an edge endpoint (which may be a cross-scope ref like
 * `@refNodeId/childId`) references a node in the selected set.
 */
function isEndpointInSelection(
  endpoint: string,
  selectedIds: Set<string>,
): boolean {
  // Direct match
  if (selectedIds.has(endpoint)) return true;

  // Cross-scope ref: `@refNodeId/childId` — include if the ref-node is selected
  if (endpoint.startsWith('@')) {
    const slashIdx = endpoint.indexOf('/');
    if (slashIdx !== -1) {
      const refNodeId = endpoint.slice(1, slashIdx);
      return selectedIds.has(refNodeId);
    }
  }

  return false;
}

/**
 * Remap an edge endpoint using the old→new ID map. Handles both direct
 * node references and cross-scope refs (`@refNodeId/childId`).
 */
function remapEndpoint(
  endpoint: string,
  idMap: Map<string, string>,
): string {
  // Direct match
  if (idMap.has(endpoint)) return idMap.get(endpoint)!;

  // Cross-scope ref: `@oldRefId/childId` → `@newRefId/childId`
  if (endpoint.startsWith('@')) {
    const slashIdx = endpoint.indexOf('/');
    if (slashIdx !== -1) {
      const refNodeId = endpoint.slice(1, slashIdx);
      const suffix = endpoint.slice(slashIdx); // "/childId"
      const newRefId = idMap.get(refNodeId);
      if (newRefId) return `@${newRefId}${suffix}`;
    }
  }

  // Endpoint not in the map — return empty to signal "drop this edge"
  return '';
}
