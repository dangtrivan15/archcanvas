/**
 * Pure diff engine — compares two Canvas objects and produces a CanvasDiff.
 *
 * All functions are pure (no side effects, no store access) and operate on
 * the Canvas type from schema.ts.
 */

import type { Canvas, Edge, Node } from '@/types';
import type {
  CanvasDiff,
  DiffOptions,
  DiffSummary,
  EdgeDiff,
  EdgeKey,
  NodeDiff,
  ProjectDiff,
  PropertyDiff,
  DiffStatus,
} from './types';

// ---------------------------------------------------------------------------
// Edge key helpers
// ---------------------------------------------------------------------------

export function edgeKey(edge: Edge): EdgeKey {
  const fromPort = edge.from.port ?? '';
  const toPort = edge.to.port ?? '';
  return `${edge.from.node}:${fromPort}→${edge.to.node}:${toPort}`;
}

// ---------------------------------------------------------------------------
// Property comparison helpers
// ---------------------------------------------------------------------------

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || b === null) return false;
  if (a === undefined || b === undefined) return false;
  if (typeof a !== typeof b) return false;

  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((v, i) => deepEqual(v, b[i]));
  }

  if (typeof a === 'object' && typeof b === 'object') {
    const aObj = a as Record<string, unknown>;
    const bObj = b as Record<string, unknown>;
    const keysA = Object.keys(aObj);
    const keysB = Object.keys(bObj);
    if (keysA.length !== keysB.length) return false;
    return keysA.every((k) => deepEqual(aObj[k], bObj[k]));
  }

  return false;
}

/**
 * Compare two sets of properties (from a node or edge) and return diffs.
 * Skips 'position' by default (configurable via options).
 */
function diffProperties(
  base: Record<string, unknown>,
  current: Record<string, unknown>,
  options: DiffOptions = {},
): PropertyDiff[] {
  const skip = new Set<string>(['id']); // id is identity, not a property
  if (!options.includePosition) skip.add('position');

  const diffs: PropertyDiff[] = [];
  const allKeys = new Set([...Object.keys(base), ...Object.keys(current)]);

  for (const key of allKeys) {
    if (skip.has(key)) continue;

    const hasBase = key in base && base[key] !== undefined;
    const hasCurrent = key in current && current[key] !== undefined;

    if (hasBase && !hasCurrent) {
      diffs.push({ key, status: 'removed', oldValue: base[key] });
    } else if (!hasBase && hasCurrent) {
      diffs.push({ key, status: 'added', newValue: current[key] });
    } else if (hasBase && hasCurrent && !deepEqual(base[key], current[key])) {
      diffs.push({ key, status: 'modified', oldValue: base[key], newValue: current[key] });
    }
  }

  return diffs;
}

// ---------------------------------------------------------------------------
// Node diffing
// ---------------------------------------------------------------------------

function nodeToRecord(node: Node): Record<string, unknown> {
  // Spread all properties into a flat record for comparison
  return { ...node } as Record<string, unknown>;
}

function diffNodes(
  baseNodes: Node[],
  currentNodes: Node[],
  options: DiffOptions = {},
): Map<string, NodeDiff> {
  const result = new Map<string, NodeDiff>();

  const baseMap = new Map<string, Node>();
  for (const n of baseNodes) baseMap.set(n.id, n);

  const currentMap = new Map<string, Node>();
  for (const n of currentNodes) currentMap.set(n.id, n);

  // Find removed and modified nodes
  for (const [id, baseNode] of baseMap) {
    const currentNode = currentMap.get(id);
    if (!currentNode) {
      result.set(id, {
        nodeId: id,
        status: 'removed',
        properties: diffProperties(nodeToRecord(baseNode), {}, options),
      });
    } else {
      const properties = diffProperties(
        nodeToRecord(baseNode),
        nodeToRecord(currentNode),
        options,
      );
      if (properties.length > 0) {
        result.set(id, { nodeId: id, status: 'modified', properties });
      }
    }
  }

  // Find added nodes
  for (const [id, currentNode] of currentMap) {
    if (!baseMap.has(id)) {
      result.set(id, {
        nodeId: id,
        status: 'added',
        properties: diffProperties({}, nodeToRecord(currentNode), options),
      });
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Edge diffing
// ---------------------------------------------------------------------------

function edgeToRecord(edge: Edge): Record<string, unknown> {
  return { ...edge } as Record<string, unknown>;
}

function diffEdges(
  baseEdges: Edge[],
  currentEdges: Edge[],
  options: DiffOptions = {},
): Map<EdgeKey, EdgeDiff> {
  const result = new Map<EdgeKey, EdgeDiff>();

  const baseMap = new Map<EdgeKey, Edge>();
  for (const e of baseEdges) baseMap.set(edgeKey(e), e);

  const currentMap = new Map<EdgeKey, Edge>();
  for (const e of currentEdges) currentMap.set(edgeKey(e), e);

  // Find removed and modified edges
  for (const [key, baseEdge] of baseMap) {
    const currentEdge = currentMap.get(key);
    if (!currentEdge) {
      result.set(key, {
        edgeKey: key,
        status: 'removed',
        properties: diffProperties(edgeToRecord(baseEdge), {}, options),
      });
    } else {
      const properties = diffProperties(
        edgeToRecord(baseEdge),
        edgeToRecord(currentEdge),
        options,
      );
      if (properties.length > 0) {
        result.set(key, { edgeKey: key, status: 'modified', properties });
      }
    }
  }

  // Find added edges
  for (const [key, currentEdge] of currentMap) {
    if (!baseMap.has(key)) {
      result.set(key, {
        edgeKey: key,
        status: 'added',
        properties: diffProperties({}, edgeToRecord(currentEdge), options),
      });
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Summary computation
// ---------------------------------------------------------------------------

function computeSummary(
  nodes: Map<string, NodeDiff>,
  edges: Map<EdgeKey, EdgeDiff>,
): DiffSummary {
  let nodesAdded = 0, nodesRemoved = 0, nodesModified = 0;
  let edgesAdded = 0, edgesRemoved = 0, edgesModified = 0;

  for (const nd of nodes.values()) {
    if (nd.status === 'added') nodesAdded++;
    else if (nd.status === 'removed') nodesRemoved++;
    else if (nd.status === 'modified') nodesModified++;
  }

  for (const ed of edges.values()) {
    if (ed.status === 'added') edgesAdded++;
    else if (ed.status === 'removed') edgesRemoved++;
    else if (ed.status === 'modified') edgesModified++;
  }

  return { nodesAdded, nodesRemoved, nodesModified, edgesAdded, edgesRemoved, edgesModified };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Diff two Canvas objects and produce a CanvasDiff.
 */
export function diffCanvas(
  base: Canvas,
  current: Canvas,
  canvasId: string,
  options: DiffOptions = {},
): CanvasDiff {
  const nodes = diffNodes(
    base.nodes ?? [],
    current.nodes ?? [],
    options,
  );

  const edges = diffEdges(
    base.edges ?? [],
    current.edges ?? [],
    options,
  );

  return {
    canvasId,
    nodes,
    edges,
    summary: computeSummary(nodes, edges),
  };
}

/**
 * Diff two projects (maps of canvasId → Canvas) and produce a ProjectDiff.
 */
export function diffProject(
  base: Map<string, Canvas>,
  current: Map<string, Canvas>,
  options: DiffOptions = {},
): ProjectDiff {
  const canvases = new Map<string, CanvasDiff>();
  const addedCanvases: string[] = [];
  const removedCanvases: string[] = [];

  // Diff matching canvases + detect removals
  for (const [id, baseCanvas] of base) {
    const currentCanvas = current.get(id);
    if (!currentCanvas) {
      removedCanvases.push(id);
      // Create a CanvasDiff showing everything as removed
      const diff = diffCanvas(baseCanvas, { nodes: [], edges: [], entities: [] }, id, options);
      canvases.set(id, diff);
    } else {
      const diff = diffCanvas(baseCanvas, currentCanvas, id, options);
      // Only include canvases with actual changes
      if (diff.nodes.size > 0 || diff.edges.size > 0) {
        canvases.set(id, diff);
      }
    }
  }

  // Detect additions
  for (const [id, currentCanvas] of current) {
    if (!base.has(id)) {
      addedCanvases.push(id);
      const diff = diffCanvas({ nodes: [], edges: [], entities: [] }, currentCanvas, id, options);
      canvases.set(id, diff);
    }
  }

  // Aggregate summary
  const summary: DiffSummary = {
    nodesAdded: 0, nodesRemoved: 0, nodesModified: 0,
    edgesAdded: 0, edgesRemoved: 0, edgesModified: 0,
  };
  for (const diff of canvases.values()) {
    summary.nodesAdded += diff.summary.nodesAdded;
    summary.nodesRemoved += diff.summary.nodesRemoved;
    summary.nodesModified += diff.summary.nodesModified;
    summary.edgesAdded += diff.summary.edgesAdded;
    summary.edgesRemoved += diff.summary.edgesRemoved;
    summary.edgesModified += diff.summary.edgesModified;
  }

  return { canvases, addedCanvases, removedCanvases, summary };
}

/**
 * Get the diff status for a specific node in a canvas diff.
 */
export function getNodeDiffStatus(
  diff: CanvasDiff | undefined,
  nodeId: string,
): DiffStatus | undefined {
  return diff?.nodes.get(nodeId)?.status;
}

/**
 * Get the diff status for a specific edge in a canvas diff.
 */
export function getEdgeDiffStatus(
  diff: CanvasDiff | undefined,
  edge: Edge,
): DiffStatus | undefined {
  return diff?.edges.get(edgeKey(edge))?.status;
}
