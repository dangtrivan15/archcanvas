/**
 * Feature #24: Find node parent returns correct parent reference
 * Verifies findNodeParent() returns the parent node or null/undefined for root-level nodes.
 */

import { describe, it, expect } from 'vitest';
import {
  createEmptyGraph,
  createNode,
  addNode,
  addChildNode,
  findNodeParent,
} from '@/core/graph/graphEngine';

describe('Feature #24: findNodeParent() returns correct parent reference', () => {
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

  it('should return B as parent of grandchild C', () => {
    const { graph, nodeB, nodeC } = createNestedArchitecture();
    const parent = findNodeParent(graph, nodeC.id);
    expect(parent).toBeDefined();
    expect(parent!.id).toBe(nodeB.id);
    expect(parent!.displayName).toBe('Node B');
    expect(parent!.type).toBe('compute/function');
  });

  it('should return A as parent of child B', () => {
    const { graph, nodeA, nodeB } = createNestedArchitecture();
    const parent = findNodeParent(graph, nodeB.id);
    expect(parent).toBeDefined();
    expect(parent!.id).toBe(nodeA.id);
    expect(parent!.displayName).toBe('Node A');
    expect(parent!.type).toBe('compute/service');
  });

  it('should return undefined for root-level node A (no parent)', () => {
    const { graph, nodeA } = createNestedArchitecture();
    const parent = findNodeParent(graph, nodeA.id);
    expect(parent).toBeUndefined();
  });

  it('should return undefined for nonexistent node ID', () => {
    const { graph } = createNestedArchitecture();
    const parent = findNodeParent(graph, 'nonexistent-id');
    expect(parent).toBeUndefined();
  });

  it('should return undefined for empty string ID', () => {
    const { graph } = createNestedArchitecture();
    const parent = findNodeParent(graph, '');
    expect(parent).toBeUndefined();
  });

  it('should return undefined on empty graph', () => {
    const graph = createEmptyGraph('Empty');
    const parent = findNodeParent(graph, 'any-id');
    expect(parent).toBeUndefined();
  });

  it('should return correct parent when node has multiple siblings', () => {
    const nodeA = createNode({ type: 'compute/service', displayName: 'Parent A' });
    const nodeB = createNode({ type: 'compute/function', displayName: 'Child B' });
    const nodeC = createNode({ type: 'data/database', displayName: 'Child C' });
    const nodeD = createNode({ type: 'compute/worker', displayName: 'Child D' });

    let graph = createEmptyGraph('Multiple Children Test');
    graph = addNode(graph, nodeA);
    graph = addChildNode(graph, nodeA.id, nodeB);
    graph = addChildNode(graph, nodeA.id, nodeC);
    graph = addChildNode(graph, nodeA.id, nodeD);

    // All children should have nodeA as parent
    expect(findNodeParent(graph, nodeB.id)!.id).toBe(nodeA.id);
    expect(findNodeParent(graph, nodeC.id)!.id).toBe(nodeA.id);
    expect(findNodeParent(graph, nodeD.id)!.id).toBe(nodeA.id);
  });

  it('should work with multiple root-level nodes', () => {
    const nodeA = createNode({ type: 'compute/service', displayName: 'Root A' });
    const nodeB = createNode({ type: 'compute/function', displayName: 'Root B' });
    const nodeC = createNode({ type: 'data/database', displayName: 'Child of B' });

    let graph = createEmptyGraph('Multi-root Test');
    graph = addNode(graph, nodeA);
    graph = addNode(graph, nodeB);
    graph = addChildNode(graph, nodeB.id, nodeC);

    // Root nodes have no parent
    expect(findNodeParent(graph, nodeA.id)).toBeUndefined();
    expect(findNodeParent(graph, nodeB.id)).toBeUndefined();
    // Child of B has B as parent
    expect(findNodeParent(graph, nodeC.id)!.id).toBe(nodeB.id);
  });

  it('should find parent in branching hierarchy', () => {
    // A -> B -> D, A -> C -> E
    const nodeA = createNode({ type: 'compute/service', displayName: 'Root A' });
    const nodeB = createNode({ type: 'compute/function', displayName: 'Branch B' });
    const nodeC = createNode({ type: 'data/database', displayName: 'Branch C' });
    const nodeD = createNode({ type: 'compute/worker', displayName: 'Leaf D' });
    const nodeE = createNode({ type: 'messaging/queue', displayName: 'Leaf E' });

    let graph = createEmptyGraph('Branching Test');
    graph = addNode(graph, nodeA);
    graph = addChildNode(graph, nodeA.id, nodeB);
    graph = addChildNode(graph, nodeA.id, nodeC);
    graph = addChildNode(graph, nodeB.id, nodeD);
    graph = addChildNode(graph, nodeC.id, nodeE);

    expect(findNodeParent(graph, nodeD.id)!.id).toBe(nodeB.id);
    expect(findNodeParent(graph, nodeE.id)!.id).toBe(nodeC.id);
    expect(findNodeParent(graph, nodeB.id)!.id).toBe(nodeA.id);
    expect(findNodeParent(graph, nodeC.id)!.id).toBe(nodeA.id);
    expect(findNodeParent(graph, nodeA.id)).toBeUndefined();
  });

  it('should return parent with correct children array containing the target', () => {
    const { graph, nodeA, nodeB } = createNestedArchitecture();
    const parent = findNodeParent(graph, nodeB.id);
    expect(parent).toBeDefined();
    // Parent should contain nodeB in its children
    const childIds = parent!.children.map((c) => c.id);
    expect(childIds).toContain(nodeB.id);
  });

  it('should handle deeply nested nodes (4 levels)', () => {
    const nodeA = createNode({ type: 'compute/service', displayName: 'Level 0' });
    const nodeB = createNode({ type: 'compute/function', displayName: 'Level 1' });
    const nodeC = createNode({ type: 'data/database', displayName: 'Level 2' });
    const nodeD = createNode({ type: 'compute/worker', displayName: 'Level 3' });

    let graph = createEmptyGraph('Deep Nesting Test');
    graph = addNode(graph, nodeA);
    graph = addChildNode(graph, nodeA.id, nodeB);
    graph = addChildNode(graph, nodeB.id, nodeC);
    graph = addChildNode(graph, nodeC.id, nodeD);

    // 4-level chain: A -> B -> C -> D
    expect(findNodeParent(graph, nodeD.id)!.id).toBe(nodeC.id);
    expect(findNodeParent(graph, nodeC.id)!.id).toBe(nodeB.id);
    expect(findNodeParent(graph, nodeB.id)!.id).toBe(nodeA.id);
    expect(findNodeParent(graph, nodeA.id)).toBeUndefined();
  });
});
