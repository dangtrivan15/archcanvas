/**
 * Calculate the impact of deleting a node from the graph.
 * Used by the confirmation dialog to show what will be removed.
 */

import type { ArchGraph, ArchNode } from '@/types/graph';

export interface DeletionImpact {
  /** Number of edges that will be removed (connected to the node or its descendants) */
  edgeCount: number;
  /** Number of child nodes (direct + nested) that will be removed along with the node */
  childCount: number;
}

/**
 * Collect all descendant node IDs for a given node (not including the node itself).
 */
function countDescendants(node: ArchNode): number {
  let count = node.children.length;
  for (const child of node.children) {
    count += countDescendants(child);
  }
  return count;
}

/**
 * Find a node by ID in the node tree (recursive).
 */
function findNodeInList(nodes: ArchNode[], nodeId: string): ArchNode | undefined {
  for (const node of nodes) {
    if (node.id === nodeId) return node;
    if (node.children.length > 0) {
      const found = findNodeInList(node.children, nodeId);
      if (found) return found;
    }
  }
  return undefined;
}

/**
 * Collect all IDs (node + all descendants) for a node.
 */
function collectAllIds(node: ArchNode): Set<string> {
  const ids = new Set<string>();
  ids.add(node.id);
  for (const child of node.children) {
    for (const id of collectAllIds(child)) {
      ids.add(id);
    }
  }
  return ids;
}

/**
 * Calculate the deletion impact for a node.
 * Returns counts of edges and children that will be removed.
 */
export function calculateDeletionImpact(graph: ArchGraph, nodeId: string): DeletionImpact {
  const node = findNodeInList(graph.nodes, nodeId);
  if (!node) {
    return { edgeCount: 0, childCount: 0 };
  }

  // Count all descendants
  const childCount = countDescendants(node);

  // Collect all IDs that will be removed (the node + all its descendants)
  const removedIds = collectAllIds(node);

  // Count edges connected to any removed node
  const edgeCount = graph.edges.filter(
    (e) => removedIds.has(e.fromNode) || removedIds.has(e.toNode),
  ).length;

  return { edgeCount, childCount };
}
