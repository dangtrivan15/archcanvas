/**
 * Graph query functions for navigation-level-aware node/edge retrieval,
 * neighbor discovery, and full-text search.
 */

import type { ArchGraph, ArchNode, ArchEdge } from '@/types/graph';
import type { SearchResult } from '@/types/api';

/**
 * Get nodes at a given navigation level.
 * - path = [] -> root-level nodes
 * - path = ["node-id"] -> children of node-id
 * - path = ["a", "b"] -> children of node "b" (which is child of "a")
 */
export function getNodesAtLevel(graph: ArchGraph, path: string[]): ArchNode[] {
  if (path.length === 0) {
    return graph.nodes;
  }

  let currentNodes = graph.nodes;
  for (const segmentId of path) {
    const parent = currentNodes.find((n) => n.id === segmentId);
    if (!parent) {
      return [];
    }
    currentNodes = parent.children;
  }

  return currentNodes;
}

/**
 * Get edges at a given navigation level.
 * Only returns edges whose both endpoints are visible at the current level.
 */
export function getEdgesAtLevel(graph: ArchGraph, path: string[]): ArchEdge[] {
  const visibleNodes = getNodesAtLevel(graph, path);
  const visibleIds = new Set(visibleNodes.map((n) => n.id));

  return graph.edges.filter((e) => visibleIds.has(e.fromNode) && visibleIds.has(e.toNode));
}

/**
 * Get external (boundary) edges that cross navigation levels.
 * These connect nodes at the current level with nodes outside the current view.
 */
export function getExternalEdges(graph: ArchGraph, path: string[]): ArchEdge[] {
  const visibleNodes = getNodesAtLevel(graph, path);
  const visibleIds = new Set(visibleNodes.map((n) => n.id));

  return graph.edges.filter(
    (e) =>
      (visibleIds.has(e.fromNode) && !visibleIds.has(e.toNode)) ||
      (!visibleIds.has(e.fromNode) && visibleIds.has(e.toNode)),
  );
}

/**
 * Get neighbors of a node within N hops.
 */
export function getNeighbors(
  graph: ArchGraph,
  nodeId: string,
  maxHops: number = 1,
): { nodes: ArchNode[]; edges: ArchEdge[] } {
  const visitedNodeIds = new Set<string>([nodeId]);
  const relevantEdgeIds = new Set<string>();

  let frontier = new Set<string>([nodeId]);

  for (let hop = 0; hop < maxHops; hop++) {
    const nextFrontier = new Set<string>();

    for (const edge of graph.edges) {
      if (frontier.has(edge.fromNode) && !visitedNodeIds.has(edge.toNode)) {
        nextFrontier.add(edge.toNode);
        relevantEdgeIds.add(edge.id);
      }
      if (frontier.has(edge.toNode) && !visitedNodeIds.has(edge.fromNode)) {
        nextFrontier.add(edge.fromNode);
        relevantEdgeIds.add(edge.id);
      }
    }

    for (const id of nextFrontier) {
      visitedNodeIds.add(id);
    }
    frontier = nextFrontier;
  }

  // Also include edges between visited nodes
  for (const edge of graph.edges) {
    if (visitedNodeIds.has(edge.fromNode) && visitedNodeIds.has(edge.toNode)) {
      relevantEdgeIds.add(edge.id);
    }
  }

  // Remove the original node from results
  visitedNodeIds.delete(nodeId);

  const allNodes = flattenNodes(graph.nodes);
  const neighborNodes = allNodes.filter((n) => visitedNodeIds.has(n.id));
  const neighborEdges = graph.edges.filter((e) => relevantEdgeIds.has(e.id));

  return { nodes: neighborNodes, edges: neighborEdges };
}

/**
 * Full-text search across node names, properties, notes, and edge labels.
 */
export function searchGraph(graph: ArchGraph, query: string): SearchResult[] {
  if (!query.trim()) return [];

  const lowerQuery = query.toLowerCase();
  const results: SearchResult[] = [];

  // Search nodes (recursively)
  searchNodesRecursive(graph.nodes, lowerQuery, results);

  // Search edges
  for (const edge of graph.edges) {
    let score = 0;
    let matchContext = '';

    if (edge.label && edge.label.toLowerCase().includes(lowerQuery)) {
      score += 10;
      matchContext = `Label: ${edge.label}`;
    }

    // Search edge notes
    for (const note of edge.notes) {
      if (note.content.toLowerCase().includes(lowerQuery)) {
        score += 5;
        matchContext = matchContext || `Note: ${note.content.slice(0, 100)}`;
      }
    }

    if (score > 0) {
      results.push({
        type: 'edge',
        id: edge.id,
        displayName: edge.label ?? `${edge.fromNode} → ${edge.toNode}`,
        matchContext,
        score,
      });
    }
  }

  // Sort by score descending
  results.sort((a, b) => b.score - a.score);

  return results;
}

function searchNodesRecursive(
  nodes: ArchNode[],
  query: string,
  results: SearchResult[],
  parentId?: string,
): void {
  for (const node of nodes) {
    let score = 0;
    let matchContext = '';

    // Search display name
    if (node.displayName.toLowerCase().includes(query)) {
      score += 20;
      matchContext = `Name: ${node.displayName}`;
    }

    // Search type
    if (node.type.toLowerCase().includes(query)) {
      score += 10;
      matchContext = matchContext || `Type: ${node.type}`;
    }

    // Search args
    for (const [key, value] of Object.entries(node.args)) {
      const valStr = String(value).toLowerCase();
      if (key.toLowerCase().includes(query) || valStr.includes(query)) {
        score += 5;
        matchContext = matchContext || `Arg ${key}: ${value}`;
      }
    }

    // Search properties
    for (const [key, value] of Object.entries(node.properties)) {
      const valStr = String(value).toLowerCase();
      if (key.toLowerCase().includes(query) || valStr.includes(query)) {
        score += 5;
        matchContext = matchContext || `Property ${key}: ${value}`;
      }
    }

    // Search notes
    for (const note of node.notes) {
      if (note.content.toLowerCase().includes(query)) {
        score += 5;
        results.push({
          type: 'note',
          id: note.id,
          parentId: node.id,
          displayName: `Note on ${node.displayName}`,
          matchContext: note.content.slice(0, 100),
          score: 5,
        });
      }
    }

    if (score > 0) {
      results.push({
        type: 'node',
        id: node.id,
        parentId,
        displayName: node.displayName,
        matchContext,
        score,
      });
    }

    // Search children recursively
    if (node.children.length > 0) {
      searchNodesRecursive(node.children, query, results, node.id);
    }
  }
}

/**
 * Flatten all nodes (including children) into a single array.
 */
export function flattenNodes(nodes: ArchNode[]): ArchNode[] {
  const result: ArchNode[] = [];
  for (const node of nodes) {
    result.push(node);
    if (node.children.length > 0) {
      result.push(...flattenNodes(node.children));
    }
  }
  return result;
}

/**
 * Count all nodes recursively (including children).
 */
export function countAllNodes(graph: ArchGraph): number {
  return flattenNodes(graph.nodes).length;
}
