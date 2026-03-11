/**
 * Graph query functions for navigation-level-aware node/edge retrieval,
 * neighbor discovery, and full-text search.
 */

import type { ArchGraph, ArchNode, ArchEdge } from '@/types/graph';
import type { SearchResult } from '@/types/api';

/**
 * Get nodes at a given navigation level (fractal zoom).
 *
 * @param graph - The architecture graph
 * @param path - Navigation path: `[]` = root, `['id']` = children of id, `['a','b']` = children of b under a
 * @returns Array of nodes visible at the specified navigation level, or empty if path is invalid
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
 * Get edges visible at a given navigation level.
 * Only returns edges where both endpoints are in the current level's node set.
 *
 * @param graph - The architecture graph
 * @param path - Navigation path (same as getNodesAtLevel)
 * @returns Edges connecting nodes visible at this level
 */
export function getEdgesAtLevel(graph: ArchGraph, path: string[]): ArchEdge[] {
  const visibleNodes = getNodesAtLevel(graph, path);
  const visibleIds = new Set(visibleNodes.map((n) => n.id));

  return graph.edges.filter((e) => visibleIds.has(e.fromNode) && visibleIds.has(e.toNode));
}

/**
 * Get boundary edges that cross navigation levels - connecting visible nodes
 * with nodes outside the current view.
 *
 * @param graph - The architecture graph
 * @param path - Navigation path
 * @returns Edges where exactly one endpoint is visible at this level
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
 * Get neighbor nodes and connecting edges within N hops of a given node.
 * Uses BFS to expand outward from the source node.
 *
 * @param graph - The architecture graph
 * @param nodeId - Starting node ID
 * @param maxHops - Maximum number of edge hops to traverse (default: 1)
 * @returns Object with `nodes` (neighbor nodes, excluding source) and `edges` (connecting edges)
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
 * Full-text search across node names, types, args, properties, notes, and edge labels.
 * Results are scored by relevance (name matches score highest) and sorted descending.
 *
 * @param graph - The architecture graph to search
 * @param query - Case-insensitive search string
 * @returns Array of SearchResult objects sorted by relevance score
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
 * Flatten a hierarchical node tree into a single flat array.
 * Includes all nested children at every depth level.
 *
 * @param nodes - Root-level node array (may contain nested children)
 * @returns Flat array of all nodes in depth-first order
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
 * Count all nodes in the graph, including nested children at all depths.
 *
 * @param graph - The architecture graph
 * @returns Total number of nodes (root + all descendants)
 */
export function countAllNodes(graph: ArchGraph): number {
  return flattenNodes(graph.nodes).length;
}
