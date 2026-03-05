/**
 * Unit tests for Feature #27: getEdgesAtLevel() filters correctly.
 *
 * Verifies that getEdgesAtLevel() returns only edges connecting nodes
 * visible at the current navigation level, excluding cross-level edges.
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
import { getEdgesAtLevel } from '@/core/graph/graphQuery';

// Helper: build graph with 3 root nodes + 2 children under root1
function buildHierarchicalGraph() {
  const root1 = createNode({ type: 'compute/service', displayName: 'Root1' });
  const root2 = createNode({ type: 'compute/service', displayName: 'Root2' });
  const root3 = createNode({ type: 'data/database', displayName: 'Root3' });
  const child1 = createNode({ type: 'compute/function', displayName: 'Child1' });
  const child2 = createNode({ type: 'compute/function', displayName: 'Child2' });

  // Root-level edges
  const edgeR1R2 = createEdge({
    fromNode: root1.id,
    toNode: root2.id,
    type: 'sync',
    label: 'root1-to-root2',
  });
  const edgeR2R3 = createEdge({
    fromNode: root2.id,
    toNode: root3.id,
    type: 'async',
    label: 'root2-to-root3',
  });

  // Child-level edge (both endpoints are children of root1)
  const edgeC1C2 = createEdge({
    fromNode: child1.id,
    toNode: child2.id,
    type: 'data-flow',
    label: 'child1-to-child2',
  });

  // Cross-level edge (child1 connects to root2) - should be excluded from both levels
  const edgeCross = createEdge({
    fromNode: child1.id,
    toNode: root2.id,
    type: 'sync',
    label: 'cross-level',
  });

  let graph = createEmptyGraph('Test Hierarchy');
  graph = addNode(graph, root1);
  graph = addNode(graph, root2);
  graph = addNode(graph, root3);
  graph = addChildNode(graph, root1.id, child1);
  graph = addChildNode(graph, root1.id, child2);
  graph = addEdge(graph, edgeR1R2);
  graph = addEdge(graph, edgeR2R3);
  graph = addEdge(graph, edgeC1C2);
  graph = addEdge(graph, edgeCross);

  return { graph, root1, root2, root3, child1, child2, edgeR1R2, edgeR2R3, edgeC1C2, edgeCross };
}

// ============================================================
// Feature #27: getEdgesAtLevel filters correctly
// ============================================================
describe('Feature #27: getEdgesAtLevel filters correctly', () => {
  // Step 1: Create graph with 3 root nodes + edges, 2 children + edge
  it('should set up graph with 3 root nodes, 2 children, root edges, and child edge', () => {
    const { graph, root1, root2, root3, child1, child2 } = buildHierarchicalGraph();
    // 3 root nodes
    expect(graph.nodes).toHaveLength(3);
    // root1 has 2 children
    const r1 = graph.nodes.find((n) => n.id === root1.id)!;
    expect(r1.children).toHaveLength(2);
    // 4 edges total (2 root, 1 child, 1 cross)
    expect(graph.edges).toHaveLength(4);
  });

  // Step 2: getEdgesAtLevel([]) returns only root-level edges
  it('should return only root-level edges when path is empty', () => {
    const { graph, edgeR1R2, edgeR2R3 } = buildHierarchicalGraph();
    const rootEdges = getEdgesAtLevel(graph, []);

    // Should have exactly 2 root-level edges
    expect(rootEdges).toHaveLength(2);
    const edgeIds = rootEdges.map((e) => e.id);
    expect(edgeIds).toContain(edgeR1R2.id);
    expect(edgeIds).toContain(edgeR2R3.id);
  });

  it('root-level edges should NOT include child-to-child edge', () => {
    const { graph, edgeC1C2 } = buildHierarchicalGraph();
    const rootEdges = getEdgesAtLevel(graph, []);
    const edgeIds = rootEdges.map((e) => e.id);
    expect(edgeIds).not.toContain(edgeC1C2.id);
  });

  it('root-level edges should NOT include cross-level edge', () => {
    const { graph, edgeCross } = buildHierarchicalGraph();
    const rootEdges = getEdgesAtLevel(graph, []);
    const edgeIds = rootEdges.map((e) => e.id);
    expect(edgeIds).not.toContain(edgeCross.id);
  });

  // Step 3: getEdgesAtLevel([parentId]) returns only child-level edges
  it('should return only child-level edges when navigating into root1', () => {
    const { graph, root1, edgeC1C2 } = buildHierarchicalGraph();
    const childEdges = getEdgesAtLevel(graph, [root1.id]);

    // Should have exactly 1 child-level edge
    expect(childEdges).toHaveLength(1);
    expect(childEdges[0].id).toBe(edgeC1C2.id);
    expect(childEdges[0].label).toBe('child1-to-child2');
  });

  it('child-level edges should NOT include root-level edges', () => {
    const { graph, root1, edgeR1R2, edgeR2R3 } = buildHierarchicalGraph();
    const childEdges = getEdgesAtLevel(graph, [root1.id]);
    const edgeIds = childEdges.map((e) => e.id);
    expect(edgeIds).not.toContain(edgeR1R2.id);
    expect(edgeIds).not.toContain(edgeR2R3.id);
  });

  it('child-level edges should NOT include cross-level edge', () => {
    const { graph, root1, edgeCross } = buildHierarchicalGraph();
    const childEdges = getEdgesAtLevel(graph, [root1.id]);
    const edgeIds = childEdges.map((e) => e.id);
    expect(edgeIds).not.toContain(edgeCross.id);
  });

  // Step 4: Cross-level edges excluded from both levels
  it('cross-level edge is excluded from root level AND child level', () => {
    const { graph, root1, edgeCross } = buildHierarchicalGraph();

    const rootEdgeIds = getEdgesAtLevel(graph, []).map((e) => e.id);
    const childEdgeIds = getEdgesAtLevel(graph, [root1.id]).map((e) => e.id);

    expect(rootEdgeIds).not.toContain(edgeCross.id);
    expect(childEdgeIds).not.toContain(edgeCross.id);
  });

  // Additional edge cases
  it('should return empty array for node with no children', () => {
    const { graph, root2 } = buildHierarchicalGraph();
    const edges = getEdgesAtLevel(graph, [root2.id]);
    expect(edges).toHaveLength(0);
  });

  it('should return empty array for non-existent path', () => {
    const { graph } = buildHierarchicalGraph();
    const edges = getEdgesAtLevel(graph, ['non-existent-id']);
    expect(edges).toHaveLength(0);
  });

  it('should return empty array for empty graph', () => {
    const graph = createEmptyGraph('Empty');
    const edges = getEdgesAtLevel(graph, []);
    expect(edges).toHaveLength(0);
  });

  it('should handle grandchild level edges correctly', () => {
    const { graph, root1, child1 } = buildHierarchicalGraph();

    // Add grandchildren with an edge between them
    const gc1 = createNode({ type: 'compute/worker', displayName: 'GC1' });
    const gc2 = createNode({ type: 'compute/worker', displayName: 'GC2' });
    const gcEdge = createEdge({ fromNode: gc1.id, toNode: gc2.id, type: 'sync', label: 'gc-edge' });

    let g = addChildNode(graph, child1.id, gc1);
    g = addChildNode(g, child1.id, gc2);
    g = addEdge(g, gcEdge);

    // At grandchild level [root1, child1], only gcEdge should appear
    const gcEdges = getEdgesAtLevel(g, [root1.id, child1.id]);
    expect(gcEdges).toHaveLength(1);
    expect(gcEdges[0].id).toBe(gcEdge.id);
  });

  it('should preserve edge properties in results', () => {
    const { graph, edgeR1R2 } = buildHierarchicalGraph();
    const rootEdges = getEdgesAtLevel(graph, []);
    const found = rootEdges.find((e) => e.id === edgeR1R2.id)!;

    expect(found.type).toBe('sync');
    expect(found.label).toBe('root1-to-root2');
    expect(found.fromNode).toBe(edgeR1R2.fromNode);
    expect(found.toNode).toBe(edgeR1R2.toNode);
  });

  it('should handle multiple root-level edges of different types', () => {
    const nodeA = createNode({ type: 'compute/service', displayName: 'A' });
    const nodeB = createNode({ type: 'compute/service', displayName: 'B' });
    const nodeC = createNode({ type: 'data/database', displayName: 'C' });

    const e1 = createEdge({ fromNode: nodeA.id, toNode: nodeB.id, type: 'sync' });
    const e2 = createEdge({ fromNode: nodeB.id, toNode: nodeC.id, type: 'async' });
    const e3 = createEdge({ fromNode: nodeA.id, toNode: nodeC.id, type: 'data-flow' });

    let graph = createEmptyGraph('Multi-Edge');
    graph = addNode(graph, nodeA);
    graph = addNode(graph, nodeB);
    graph = addNode(graph, nodeC);
    graph = addEdge(graph, e1);
    graph = addEdge(graph, e2);
    graph = addEdge(graph, e3);

    const rootEdges = getEdgesAtLevel(graph, []);
    expect(rootEdges).toHaveLength(3);

    const types = rootEdges.map((e) => e.type).sort();
    expect(types).toEqual(['async', 'data-flow', 'sync']);
  });

  it('should return zero edges when all edges are cross-level', () => {
    const root1 = createNode({ type: 'compute/service', displayName: 'R1' });
    const root2 = createNode({ type: 'compute/service', displayName: 'R2' });
    const child = createNode({ type: 'compute/function', displayName: 'C' });

    // Only cross-level edge (child -> root2)
    const crossEdge = createEdge({ fromNode: child.id, toNode: root2.id, type: 'sync' });

    let graph = createEmptyGraph('Cross Only');
    graph = addNode(graph, root1);
    graph = addNode(graph, root2);
    graph = addChildNode(graph, root1.id, child);
    graph = addEdge(graph, crossEdge);

    // At root: child is not visible, so edge filtered out
    const rootEdges = getEdgesAtLevel(graph, []);
    expect(rootEdges).toHaveLength(0);

    // At child level: root2 is not visible, so edge filtered out
    const childEdges = getEdgesAtLevel(graph, [root1.id]);
    expect(childEdges).toHaveLength(0);
  });
});
