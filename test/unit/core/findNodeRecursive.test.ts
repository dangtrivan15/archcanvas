/**
 * Feature #23: Find node by ID searches recursively through children
 * Verifies findNode() locates a node by ID at any depth in the nested hierarchy.
 */

import { describe, it, expect } from 'vitest';
import {
  createEmptyGraph,
  createNode,
  addNode,
  addChildNode,
  findNode,
} from '@/core/graph/graphEngine';

describe('Feature #23: findNode() recursive search through children', () => {
  // Setup: root node A, child B under A, grandchild C under B
  function createNestedArchitecture() {
    const nodeA = createNode({ type: 'compute/service', displayName: 'Node A' });
    const nodeB = createNode({ type: 'compute/function', displayName: 'Node B' });
    const nodeC = createNode({ type: 'data/database', displayName: 'Node C' });

    let graph = createEmptyGraph('Nested Test');
    graph = addNode(graph, nodeA);
    graph = addChildNode(graph, nodeA.id, nodeB);
    graph = addChildNode(graph, nodeB.id, nodeC);

    return { graph, nodeA, nodeB, nodeC };
  }

  it('should find root node A by ID', () => {
    const { graph, nodeA } = createNestedArchitecture();
    const found = findNode(graph, nodeA.id);
    expect(found).toBeDefined();
    expect(found!.id).toBe(nodeA.id);
    expect(found!.displayName).toBe('Node A');
    expect(found!.type).toBe('compute/service');
  });

  it('should find child node B by ID (1 level deep)', () => {
    const { graph, nodeB } = createNestedArchitecture();
    const found = findNode(graph, nodeB.id);
    expect(found).toBeDefined();
    expect(found!.id).toBe(nodeB.id);
    expect(found!.displayName).toBe('Node B');
    expect(found!.type).toBe('compute/function');
  });

  it('should find grandchild node C by ID (2 levels deep)', () => {
    const { graph, nodeC } = createNestedArchitecture();
    const found = findNode(graph, nodeC.id);
    expect(found).toBeDefined();
    expect(found!.id).toBe(nodeC.id);
    expect(found!.displayName).toBe('Node C');
    expect(found!.type).toBe('data/database');
  });

  it('should return undefined for nonexistent ID', () => {
    const { graph } = createNestedArchitecture();
    const found = findNode(graph, 'nonexistent');
    expect(found).toBeUndefined();
  });

  it('should return undefined for empty string ID', () => {
    const { graph } = createNestedArchitecture();
    const found = findNode(graph, '');
    expect(found).toBeUndefined();
  });

  it('should return correct node properties at each level', () => {
    const { graph, nodeA, nodeB, nodeC } = createNestedArchitecture();

    // Verify A has B as child
    const foundA = findNode(graph, nodeA.id);
    expect(foundA!.children).toHaveLength(1);
    expect(foundA!.children[0].id).toBe(nodeB.id);

    // Verify B has C as child
    const foundB = findNode(graph, nodeB.id);
    expect(foundB!.children).toHaveLength(1);
    expect(foundB!.children[0].id).toBe(nodeC.id);

    // Verify C has no children
    const foundC = findNode(graph, nodeC.id);
    expect(foundC!.children).toHaveLength(0);
  });

  it('should work with empty graph', () => {
    const graph = createEmptyGraph('Empty');
    const found = findNode(graph, 'any-id');
    expect(found).toBeUndefined();
  });

  it('should find nodes across multiple branches', () => {
    const nodeA = createNode({ type: 'compute/service', displayName: 'Root A' });
    const nodeB = createNode({ type: 'compute/function', displayName: 'Child B' });
    const nodeC = createNode({ type: 'data/database', displayName: 'Child C' });
    const nodeD = createNode({ type: 'compute/worker', displayName: 'Grandchild D' });

    let graph = createEmptyGraph('Branching Test');
    graph = addNode(graph, nodeA);
    graph = addChildNode(graph, nodeA.id, nodeB);
    graph = addChildNode(graph, nodeA.id, nodeC);
    graph = addChildNode(graph, nodeC.id, nodeD);

    // Find all nodes at different depths and branches
    expect(findNode(graph, nodeA.id)!.displayName).toBe('Root A');
    expect(findNode(graph, nodeB.id)!.displayName).toBe('Child B');
    expect(findNode(graph, nodeC.id)!.displayName).toBe('Child C');
    expect(findNode(graph, nodeD.id)!.displayName).toBe('Grandchild D');
  });

  it('should find the same node object reference on repeated calls', () => {
    const { graph, nodeB } = createNestedArchitecture();
    const first = findNode(graph, nodeB.id);
    const second = findNode(graph, nodeB.id);
    expect(first).toBe(second);
  });

  it('should distinguish between nodes with similar names but different IDs', () => {
    const node1 = createNode({ type: 'compute/service', displayName: 'Service' });
    const node2 = createNode({ type: 'compute/service', displayName: 'Service' });

    let graph = createEmptyGraph('Test');
    graph = addNode(graph, node1);
    graph = addNode(graph, node2);

    const found1 = findNode(graph, node1.id);
    const found2 = findNode(graph, node2.id);
    expect(found1!.id).toBe(node1.id);
    expect(found2!.id).toBe(node2.id);
    expect(found1!.id).not.toBe(found2!.id);
  });
});
