/**
 * Unit tests for Feature #29: getNeighbors() within N hops returns correct set.
 *
 * Verifies that getNeighbors() returns all nodes reachable within N edge hops
 * from a starting node, with bidirectional traversal.
 */

import { describe, it, expect } from 'vitest';
import {
  createEmptyGraph,
  createNode,
  createEdge,
  addNode,
  addEdge,
} from '@/core/graph/graphEngine';
import { getNeighbors } from '@/core/graph/graphQuery';

// Helper: build chain A -> B -> C -> D
function buildChainGraph() {
  const nodeA = createNode({ type: 'compute/service', displayName: 'A' });
  const nodeB = createNode({ type: 'compute/service', displayName: 'B' });
  const nodeC = createNode({ type: 'data/database', displayName: 'C' });
  const nodeD = createNode({ type: 'messaging/message-queue', displayName: 'D' });

  const edgeAB = createEdge({ fromNode: nodeA.id, toNode: nodeB.id, type: 'sync', label: 'A->B' });
  const edgeBC = createEdge({ fromNode: nodeB.id, toNode: nodeC.id, type: 'async', label: 'B->C' });
  const edgeCD = createEdge({ fromNode: nodeC.id, toNode: nodeD.id, type: 'data-flow', label: 'C->D' });

  let graph = createEmptyGraph('Chain');
  graph = addNode(graph, nodeA);
  graph = addNode(graph, nodeB);
  graph = addNode(graph, nodeC);
  graph = addNode(graph, nodeD);
  graph = addEdge(graph, edgeAB);
  graph = addEdge(graph, edgeBC);
  graph = addEdge(graph, edgeCD);

  return { graph, nodeA, nodeB, nodeC, nodeD, edgeAB, edgeBC, edgeCD };
}

// ============================================================
// Feature #29: getNeighbors within N hops returns correct set
// ============================================================
describe('Feature #29: getNeighbors within N hops returns correct set', () => {
  // Step 1: Chain A -> B -> C -> D is built
  it('should have 4 nodes and 3 edges in the chain', () => {
    const { graph } = buildChainGraph();
    expect(graph.nodes).toHaveLength(4);
    expect(graph.edges).toHaveLength(3);
  });

  // Step 2: getNeighbors(A, 1) returns only B
  it('should return only B when getting 1-hop neighbors of A', () => {
    const { graph, nodeA, nodeB } = buildChainGraph();
    const { nodes } = getNeighbors(graph, nodeA.id, 1);

    expect(nodes).toHaveLength(1);
    expect(nodes[0].id).toBe(nodeB.id);
    expect(nodes[0].displayName).toBe('B');
  });

  it('should NOT include the starting node A in the results', () => {
    const { graph, nodeA } = buildChainGraph();
    const { nodes } = getNeighbors(graph, nodeA.id, 1);

    const ids = nodes.map((n) => n.id);
    expect(ids).not.toContain(nodeA.id);
  });

  it('1-hop from A should return relevant edges', () => {
    const { graph, nodeA, edgeAB } = buildChainGraph();
    const { edges } = getNeighbors(graph, nodeA.id, 1);

    expect(edges.length).toBeGreaterThanOrEqual(1);
    const edgeIds = edges.map((e) => e.id);
    expect(edgeIds).toContain(edgeAB.id);
  });

  // Step 3: getNeighbors(A, 2) returns B and C
  it('should return B and C when getting 2-hop neighbors of A', () => {
    const { graph, nodeA, nodeB, nodeC } = buildChainGraph();
    const { nodes } = getNeighbors(graph, nodeA.id, 2);

    expect(nodes).toHaveLength(2);
    const ids = nodes.map((n) => n.id);
    expect(ids).toContain(nodeB.id);
    expect(ids).toContain(nodeC.id);
  });

  it('2-hop from A should NOT include D', () => {
    const { graph, nodeA, nodeD } = buildChainGraph();
    const { nodes } = getNeighbors(graph, nodeA.id, 2);

    const ids = nodes.map((n) => n.id);
    expect(ids).not.toContain(nodeD.id);
  });

  // Step 4: getNeighbors(A, 3) returns B, C, and D
  it('should return B, C, and D when getting 3-hop neighbors of A', () => {
    const { graph, nodeA, nodeB, nodeC, nodeD } = buildChainGraph();
    const { nodes } = getNeighbors(graph, nodeA.id, 3);

    expect(nodes).toHaveLength(3);
    const ids = nodes.map((n) => n.id);
    expect(ids).toContain(nodeB.id);
    expect(ids).toContain(nodeC.id);
    expect(ids).toContain(nodeD.id);
  });

  it('3-hop from A should return all 3 chain edges', () => {
    const { graph, nodeA, edgeAB, edgeBC, edgeCD } = buildChainGraph();
    const { edges } = getNeighbors(graph, nodeA.id, 3);

    const edgeIds = edges.map((e) => e.id);
    expect(edgeIds).toContain(edgeAB.id);
    expect(edgeIds).toContain(edgeBC.id);
    expect(edgeIds).toContain(edgeCD.id);
  });

  // Step 5: getNeighbors(B, 1) returns A and C (bidirectional)
  it('should return A and C when getting 1-hop neighbors of B (bidirectional)', () => {
    const { graph, nodeA, nodeB, nodeC } = buildChainGraph();
    const { nodes } = getNeighbors(graph, nodeB.id, 1);

    expect(nodes).toHaveLength(2);
    const ids = nodes.map((n) => n.id);
    expect(ids).toContain(nodeA.id);
    expect(ids).toContain(nodeC.id);
  });

  it('1-hop from B should NOT include D (2 hops away)', () => {
    const { graph, nodeB, nodeD } = buildChainGraph();
    const { nodes } = getNeighbors(graph, nodeB.id, 1);

    const ids = nodes.map((n) => n.id);
    expect(ids).not.toContain(nodeD.id);
  });

  // Additional edge cases
  it('should return empty result for isolated node with no edges', () => {
    const isolated = createNode({ type: 'compute/service', displayName: 'Isolated' });
    let graph = createEmptyGraph('Isolated');
    graph = addNode(graph, isolated);

    const { nodes, edges } = getNeighbors(graph, isolated.id, 5);
    expect(nodes).toHaveLength(0);
    expect(edges).toHaveLength(0);
  });

  it('should handle 0 hops returning no neighbors', () => {
    const { graph, nodeA } = buildChainGraph();
    const { nodes } = getNeighbors(graph, nodeA.id, 0);

    expect(nodes).toHaveLength(0);
  });

  it('should not duplicate nodes when hops exceeds chain length', () => {
    const { graph, nodeA } = buildChainGraph();
    const { nodes } = getNeighbors(graph, nodeA.id, 100);

    // Should still only get B, C, D (no duplicates)
    expect(nodes).toHaveLength(3);
    const ids = new Set(nodes.map((n) => n.id));
    expect(ids.size).toBe(3);
  });

  it('2-hop from middle node B should reach A, C, and D', () => {
    const { graph, nodeA, nodeB, nodeC, nodeD } = buildChainGraph();
    const { nodes } = getNeighbors(graph, nodeB.id, 2);

    expect(nodes).toHaveLength(3);
    const ids = nodes.map((n) => n.id);
    expect(ids).toContain(nodeA.id);
    expect(ids).toContain(nodeC.id);
    expect(ids).toContain(nodeD.id);
  });

  it('should work with star topology (one central node, multiple neighbors)', () => {
    const center = createNode({ type: 'compute/service', displayName: 'Center' });
    const spoke1 = createNode({ type: 'compute/service', displayName: 'Spoke1' });
    const spoke2 = createNode({ type: 'compute/service', displayName: 'Spoke2' });
    const spoke3 = createNode({ type: 'data/database', displayName: 'Spoke3' });

    const e1 = createEdge({ fromNode: center.id, toNode: spoke1.id, type: 'sync' });
    const e2 = createEdge({ fromNode: center.id, toNode: spoke2.id, type: 'async' });
    const e3 = createEdge({ fromNode: center.id, toNode: spoke3.id, type: 'data-flow' });

    let graph = createEmptyGraph('Star');
    graph = addNode(graph, center);
    graph = addNode(graph, spoke1);
    graph = addNode(graph, spoke2);
    graph = addNode(graph, spoke3);
    graph = addEdge(graph, e1);
    graph = addEdge(graph, e2);
    graph = addEdge(graph, e3);

    const { nodes } = getNeighbors(graph, center.id, 1);
    expect(nodes).toHaveLength(3);

    const ids = nodes.map((n) => n.id);
    expect(ids).toContain(spoke1.id);
    expect(ids).toContain(spoke2.id);
    expect(ids).toContain(spoke3.id);
  });

  it('should handle node at end of chain (D) correctly', () => {
    const { graph, nodeC, nodeD } = buildChainGraph();
    const { nodes } = getNeighbors(graph, nodeD.id, 1);

    // D only connects to C (via incoming edge C->D)
    expect(nodes).toHaveLength(1);
    expect(nodes[0].id).toBe(nodeC.id);
  });
});
