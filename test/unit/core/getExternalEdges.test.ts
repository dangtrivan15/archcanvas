/**
 * Feature #28: Get external edges returns boundary-crossing edges
 * Verifies getExternalEdges() identifies edges that cross navigation level boundaries.
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
import { getExternalEdges } from '@/core/graph/graphQuery';

describe('Feature #28: getExternalEdges() returns boundary-crossing edges', () => {
  // Setup: parent with children, and an edge from a child to a root-level node
  function buildHierarchicalGraph() {
    const root1 = createNode({ type: 'compute/service', displayName: 'Root1' });
    const root2 = createNode({ type: 'compute/service', displayName: 'Root2' });
    const root3 = createNode({ type: 'data/database', displayName: 'Root3' });
    const child1 = createNode({ type: 'compute/function', displayName: 'Child1' });
    const child2 = createNode({ type: 'compute/function', displayName: 'Child2' });

    // Root-level edge (both endpoints at root)
    const edgeR1R2 = createEdge({ fromNode: root1.id, toNode: root2.id, type: 'sync', label: 'root1-to-root2' });
    const edgeR2R3 = createEdge({ fromNode: root2.id, toNode: root3.id, type: 'async', label: 'root2-to-root3' });

    // Child-level edge (both endpoints are children of root1)
    const edgeC1C2 = createEdge({ fromNode: child1.id, toNode: child2.id, type: 'data-flow', label: 'child1-to-child2' });

    // Cross-level edge (child1 connects to root2) - THIS is the boundary-crossing edge
    const edgeCross = createEdge({ fromNode: child1.id, toNode: root2.id, type: 'sync', label: 'cross-level' });

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

  // Step 1: Create parent with children and an edge from a child to a root-level node
  it('should set up graph with cross-level edge from child to root node', () => {
    const { graph, edgeCross, child1, root2 } = buildHierarchicalGraph();
    expect(graph.edges).toHaveLength(4);
    expect(edgeCross.fromNode).toBe(child1.id);
    expect(edgeCross.toNode).toBe(root2.id);
  });

  // Step 2: Call getExternalEdges for root level
  it('should return cross-level edge at root level (path=[])', () => {
    const { graph, edgeCross } = buildHierarchicalGraph();
    const externalEdges = getExternalEdges(graph, []);
    // At root level, child1 and child2 are not visible; cross-level edge has
    // child1 (not visible) -> root2 (visible), so it's external
    const externalIds = externalEdges.map((e) => e.id);
    expect(externalIds).toContain(edgeCross.id);
  });

  // Step 3: Verify the boundary-crossing edge is returned
  it('should return cross-level edge with correct properties', () => {
    const { graph, edgeCross, child1, root2 } = buildHierarchicalGraph();
    const externalEdges = getExternalEdges(graph, []);
    const found = externalEdges.find((e) => e.id === edgeCross.id);
    expect(found).toBeDefined();
    expect(found!.fromNode).toBe(child1.id);
    expect(found!.toNode).toBe(root2.id);
    expect(found!.label).toBe('cross-level');
    expect(found!.type).toBe('sync');
  });

  // Step 4: Verify internal edges within the level are NOT returned
  it('should NOT return root-level internal edges', () => {
    const { graph, edgeR1R2, edgeR2R3 } = buildHierarchicalGraph();
    const externalEdges = getExternalEdges(graph, []);
    const externalIds = externalEdges.map((e) => e.id);
    expect(externalIds).not.toContain(edgeR1R2.id);
    expect(externalIds).not.toContain(edgeR2R3.id);
  });

  it('should NOT return child-level internal edges at root level', () => {
    const { graph, edgeC1C2 } = buildHierarchicalGraph();
    const externalEdges = getExternalEdges(graph, []);
    const externalIds = externalEdges.map((e) => e.id);
    // edgeC1C2 has both endpoints as children (neither visible at root), so neither
    // endpoint is visible - it's NOT external (both outside, not one-in-one-out)
    expect(externalIds).not.toContain(edgeC1C2.id);
  });

  it('should return cross-level edge at child level too', () => {
    const { graph, root1, edgeCross } = buildHierarchicalGraph();
    // At child level (navigated into root1), child1 is visible but root2 is not
    const externalEdges = getExternalEdges(graph, [root1.id]);
    const externalIds = externalEdges.map((e) => e.id);
    expect(externalIds).toContain(edgeCross.id);
  });

  it('should NOT return child-level internal edges at child level', () => {
    const { graph, root1, edgeC1C2 } = buildHierarchicalGraph();
    const externalEdges = getExternalEdges(graph, [root1.id]);
    const externalIds = externalEdges.map((e) => e.id);
    // edgeC1C2 has both endpoints as children of root1 - both visible at child level
    // So it's an internal edge, not external
    expect(externalIds).not.toContain(edgeC1C2.id);
  });

  it('should NOT return root-level internal edges at child level', () => {
    const { graph, root1, edgeR1R2, edgeR2R3 } = buildHierarchicalGraph();
    const externalEdges = getExternalEdges(graph, [root1.id]);
    const externalIds = externalEdges.map((e) => e.id);
    // Root-level edges have neither endpoint visible at child level
    expect(externalIds).not.toContain(edgeR1R2.id);
    expect(externalIds).not.toContain(edgeR2R3.id);
  });

  it('should return empty array when no boundary-crossing edges exist', () => {
    const nodeA = createNode({ type: 'compute/service', displayName: 'A' });
    const nodeB = createNode({ type: 'compute/service', displayName: 'B' });
    const edgeAB = createEdge({ fromNode: nodeA.id, toNode: nodeB.id, type: 'sync' });

    let graph = createEmptyGraph('No Cross');
    graph = addNode(graph, nodeA);
    graph = addNode(graph, nodeB);
    graph = addEdge(graph, edgeAB);

    const externalEdges = getExternalEdges(graph, []);
    expect(externalEdges).toHaveLength(0);
  });

  it('should return empty array for empty graph', () => {
    const graph = createEmptyGraph('Empty');
    const externalEdges = getExternalEdges(graph, []);
    expect(externalEdges).toHaveLength(0);
  });

  it('should return empty array for non-existent path', () => {
    const { graph } = buildHierarchicalGraph();
    const externalEdges = getExternalEdges(graph, ['non-existent-id']);
    expect(externalEdges).toHaveLength(0);
  });

  it('should handle multiple cross-level edges', () => {
    const root1 = createNode({ type: 'compute/service', displayName: 'Root1' });
    const root2 = createNode({ type: 'compute/service', displayName: 'Root2' });
    const child1 = createNode({ type: 'compute/function', displayName: 'Child1' });
    const child2 = createNode({ type: 'compute/function', displayName: 'Child2' });

    // Two cross-level edges
    const cross1 = createEdge({ fromNode: child1.id, toNode: root2.id, type: 'sync', label: 'cross1' });
    const cross2 = createEdge({ fromNode: child2.id, toNode: root2.id, type: 'async', label: 'cross2' });

    let graph = createEmptyGraph('Multi Cross');
    graph = addNode(graph, root1);
    graph = addNode(graph, root2);
    graph = addChildNode(graph, root1.id, child1);
    graph = addChildNode(graph, root1.id, child2);
    graph = addEdge(graph, cross1);
    graph = addEdge(graph, cross2);

    // At root level: child1 and child2 not visible, root2 visible
    const externalEdges = getExternalEdges(graph, []);
    expect(externalEdges).toHaveLength(2);
    const externalIds = externalEdges.map((e) => e.id);
    expect(externalIds).toContain(cross1.id);
    expect(externalIds).toContain(cross2.id);
  });

  it('should handle inbound cross-level edge (root to child)', () => {
    const root1 = createNode({ type: 'compute/service', displayName: 'Root1' });
    const root2 = createNode({ type: 'compute/service', displayName: 'Root2' });
    const child1 = createNode({ type: 'compute/function', displayName: 'Child1' });

    // Edge from root2 to child1 (inbound to child level)
    const crossInbound = createEdge({ fromNode: root2.id, toNode: child1.id, type: 'sync', label: 'inbound-cross' });

    let graph = createEmptyGraph('Inbound Cross');
    graph = addNode(graph, root1);
    graph = addNode(graph, root2);
    graph = addChildNode(graph, root1.id, child1);
    graph = addEdge(graph, crossInbound);

    // At root level: root2 visible, child1 not visible -> external
    const rootExternal = getExternalEdges(graph, []);
    expect(rootExternal).toHaveLength(1);
    expect(rootExternal[0].id).toBe(crossInbound.id);

    // At child level [root1]: child1 visible, root2 not visible -> external
    const childExternal = getExternalEdges(graph, [root1.id]);
    expect(childExternal).toHaveLength(1);
    expect(childExternal[0].id).toBe(crossInbound.id);
  });

  it('should return node with no children has zero external edges at its child level', () => {
    const { graph, root2 } = buildHierarchicalGraph();
    // root2 has no children, so navigating into it yields empty nodes
    const externalEdges = getExternalEdges(graph, [root2.id]);
    expect(externalEdges).toHaveLength(0);
  });
});
