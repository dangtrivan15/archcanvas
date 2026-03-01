/**
 * Unit tests for graph query functions.
 * Covers: getNodesAtLevel, getEdgesAtLevel, getExternalEdges, getNeighbors, searchGraph
 */

import { describe, it, expect } from 'vitest';
import {
  createEmptyGraph,
  createNode,
  createEdge,
  addNode,
  addChildNode,
  addEdge,
} from '@/core/graph/graphEngine';
import {
  getNodesAtLevel,
  getEdgesAtLevel,
  getExternalEdges,
  getNeighbors,
  searchGraph,
  flattenNodes,
  countAllNodes,
} from '@/core/graph/graphQuery';

// ============================================================
// Feature #26: getNodesAtLevel returns correct set
// ============================================================
describe('getNodesAtLevel - navigation level filtering', () => {
  function buildTestGraph() {
    // Create architecture with 3 root nodes and 2 children under first root
    const root1 = createNode({ type: 'compute/service', displayName: 'Root Service 1' });
    const root2 = createNode({ type: 'compute/service', displayName: 'Root Service 2' });
    const root3 = createNode({ type: 'data/database', displayName: 'Root DB' });
    const child1 = createNode({ type: 'compute/function', displayName: 'Child A' });
    const child2 = createNode({ type: 'compute/function', displayName: 'Child B' });

    let graph = createEmptyGraph('Test');
    graph = addNode(graph, root1);
    graph = addNode(graph, root2);
    graph = addNode(graph, root3);
    graph = addChildNode(graph, root1.id, child1);
    graph = addChildNode(graph, root1.id, child2);

    return { graph, root1, root2, root3, child1, child2 };
  }

  it('should return all 3 root nodes when path is empty', () => {
    const { graph } = buildTestGraph();
    const rootNodes = getNodesAtLevel(graph, []);
    expect(rootNodes).toHaveLength(3);
  });

  it('should return 2 children when navigating into first root', () => {
    const { graph, root1 } = buildTestGraph();
    const children = getNodesAtLevel(graph, [root1.id]);
    expect(children).toHaveLength(2);
    expect(children[0].displayName).toBe('Child A');
    expect(children[1].displayName).toBe('Child B');
  });

  it('should NOT include root nodes when viewing children', () => {
    const { graph, root1, root2, root3 } = buildTestGraph();
    const children = getNodesAtLevel(graph, [root1.id]);
    const childIds = children.map((n) => n.id);

    // Root nodes should not appear in child level
    expect(childIds).not.toContain(root1.id);
    expect(childIds).not.toContain(root2.id);
    expect(childIds).not.toContain(root3.id);
  });

  it('should return empty array for non-existent path', () => {
    const { graph } = buildTestGraph();
    const result = getNodesAtLevel(graph, ['non-existent-id']);
    expect(result).toHaveLength(0);
  });

  it('should return empty array for leaf node with no children', () => {
    const { graph, root2 } = buildTestGraph();
    const result = getNodesAtLevel(graph, [root2.id]);
    expect(result).toHaveLength(0);
  });

  it('should handle multi-level path (grandchildren)', () => {
    const { graph, root1, child1 } = buildTestGraph();

    // Add a grandchild to child1
    const grandchild = createNode({ type: 'compute/worker', displayName: 'Grandchild' });
    const updatedGraph = addChildNode(graph, child1.id, grandchild);

    const grandchildren = getNodesAtLevel(updatedGraph, [root1.id, child1.id]);
    expect(grandchildren).toHaveLength(1);
    expect(grandchildren[0].displayName).toBe('Grandchild');
  });
});

// ============================================================
// getEdgesAtLevel
// ============================================================
describe('getEdgesAtLevel', () => {
  it('should return edges only between visible nodes at root level', () => {
    const nodeA = createNode({ type: 'compute/service', displayName: 'A' });
    const nodeB = createNode({ type: 'compute/service', displayName: 'B' });
    const child = createNode({ type: 'compute/function', displayName: 'Child' });
    const edgeAB = createEdge({ fromNode: nodeA.id, toNode: nodeB.id, type: 'sync' });
    const edgeChildB = createEdge({ fromNode: child.id, toNode: nodeB.id, type: 'async' });

    let graph = createEmptyGraph('Test');
    graph = addNode(graph, nodeA);
    graph = addNode(graph, nodeB);
    graph = addChildNode(graph, nodeA.id, child);
    graph = addEdge(graph, edgeAB);
    graph = addEdge(graph, edgeChildB);

    // At root level, only edgeAB should be visible (both A and B are root nodes)
    const rootEdges = getEdgesAtLevel(graph, []);
    expect(rootEdges).toHaveLength(1);
    expect(rootEdges[0].id).toBe(edgeAB.id);
  });
});

// ============================================================
// getExternalEdges
// ============================================================
describe('getExternalEdges', () => {
  it('should return edges crossing navigation boundaries', () => {
    const nodeA = createNode({ type: 'compute/service', displayName: 'A' });
    const nodeB = createNode({ type: 'compute/service', displayName: 'B' });
    const child = createNode({ type: 'compute/function', displayName: 'Child' });
    const edgeAB = createEdge({ fromNode: nodeA.id, toNode: nodeB.id, type: 'sync' });
    const edgeCrossing = createEdge({ fromNode: child.id, toNode: nodeB.id, type: 'async' });

    let graph = createEmptyGraph('Test');
    graph = addNode(graph, nodeA);
    graph = addNode(graph, nodeB);
    graph = addChildNode(graph, nodeA.id, child);
    graph = addEdge(graph, edgeAB);
    graph = addEdge(graph, edgeCrossing);

    // At child level of A, the crossing edge connects child to B (outside)
    const externalEdges = getExternalEdges(graph, [nodeA.id]);
    expect(externalEdges).toHaveLength(1);
    expect(externalEdges[0].id).toBe(edgeCrossing.id);
  });
});

// ============================================================
// getNeighbors
// ============================================================
describe('getNeighbors', () => {
  it('should return direct neighbors (1 hop)', () => {
    const nodeA = createNode({ type: 'compute/service', displayName: 'A' });
    const nodeB = createNode({ type: 'compute/service', displayName: 'B' });
    const nodeC = createNode({ type: 'compute/service', displayName: 'C' });
    const edgeAB = createEdge({ fromNode: nodeA.id, toNode: nodeB.id, type: 'sync' });
    const edgeBC = createEdge({ fromNode: nodeB.id, toNode: nodeC.id, type: 'async' });

    let graph = createEmptyGraph('Test');
    graph = addNode(graph, nodeA);
    graph = addNode(graph, nodeB);
    graph = addNode(graph, nodeC);
    graph = addEdge(graph, edgeAB);
    graph = addEdge(graph, edgeBC);

    // Neighbors of A at 1 hop should include B but not C
    const { nodes, edges } = getNeighbors(graph, nodeA.id, 1);
    expect(nodes).toHaveLength(1);
    expect(nodes[0].id).toBe(nodeB.id);
  });

  it('should return 2-hop neighbors', () => {
    const nodeA = createNode({ type: 'compute/service', displayName: 'A' });
    const nodeB = createNode({ type: 'compute/service', displayName: 'B' });
    const nodeC = createNode({ type: 'compute/service', displayName: 'C' });
    const edgeAB = createEdge({ fromNode: nodeA.id, toNode: nodeB.id, type: 'sync' });
    const edgeBC = createEdge({ fromNode: nodeB.id, toNode: nodeC.id, type: 'async' });

    let graph = createEmptyGraph('Test');
    graph = addNode(graph, nodeA);
    graph = addNode(graph, nodeB);
    graph = addNode(graph, nodeC);
    graph = addEdge(graph, edgeAB);
    graph = addEdge(graph, edgeBC);

    const { nodes } = getNeighbors(graph, nodeA.id, 2);
    expect(nodes).toHaveLength(2);
    const ids = nodes.map((n) => n.id);
    expect(ids).toContain(nodeB.id);
    expect(ids).toContain(nodeC.id);
  });
});

// ============================================================
// searchGraph
// ============================================================
describe('searchGraph', () => {
  it('should find nodes by display name', () => {
    const node = createNode({ type: 'compute/service', displayName: 'Order Service' });
    let graph = createEmptyGraph('Test');
    graph = addNode(graph, node);

    const results = searchGraph(graph, 'Order');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].displayName).toBe('Order Service');
  });

  it('should return empty array for empty query', () => {
    const node = createNode({ type: 'compute/service', displayName: 'Service' });
    let graph = createEmptyGraph('Test');
    graph = addNode(graph, node);

    const results = searchGraph(graph, '');
    expect(results).toHaveLength(0);
  });

  it('should find nested child nodes', () => {
    const parent = createNode({ type: 'compute/service', displayName: 'Parent' });
    const child = createNode({ type: 'compute/function', displayName: 'Unique Child Name' });

    let graph = createEmptyGraph('Test');
    graph = addNode(graph, parent);
    graph = addChildNode(graph, parent.id, child);

    const results = searchGraph(graph, 'Unique Child');
    expect(results.length).toBeGreaterThan(0);
    expect(results.some((r) => r.displayName === 'Unique Child Name')).toBe(true);
  });
});

// ============================================================
// Utility functions
// ============================================================
describe('flattenNodes', () => {
  it('should flatten nested nodes into a single array', () => {
    const parent = createNode({ type: 'compute/service', displayName: 'Parent' });
    const child = createNode({ type: 'compute/function', displayName: 'Child' });

    let graph = createEmptyGraph('Test');
    graph = addNode(graph, parent);
    graph = addChildNode(graph, parent.id, child);

    const flat = flattenNodes(graph.nodes);
    expect(flat).toHaveLength(2);
  });
});

describe('countAllNodes', () => {
  it('should count all nodes including children', () => {
    const parent = createNode({ type: 'compute/service', displayName: 'Parent' });
    const child1 = createNode({ type: 'compute/function', displayName: 'Child 1' });
    const child2 = createNode({ type: 'compute/function', displayName: 'Child 2' });

    let graph = createEmptyGraph('Test');
    graph = addNode(graph, parent);
    graph = addChildNode(graph, parent.id, child1);
    graph = addChildNode(graph, parent.id, child2);

    expect(countAllNodes(graph)).toBe(3);
  });
});
