/**
 * Unit tests for the graph engine CRUD operations.
 * Covers: addChildNode, findNode (recursive), removeNode with cascading edges.
 */

import { describe, it, expect } from 'vitest';
import {
  createEmptyGraph,
  createNode,
  createEdge,
  addNode,
  addChildNode,
  removeNode,
  findNode,
  findNodeParent,
  getNodePath,
  addEdge,
} from '@/core/graph/graphEngine';

// ============================================================
// Feature #21: Graph engine adds child node for recursive nesting
// ============================================================
describe('addChildNode - recursive nesting', () => {
  it('should add a child node to a parent', () => {
    const parent = createNode({ type: 'compute/service', displayName: 'Order Service' });
    let graph = createEmptyGraph('Test');
    graph = addNode(graph, parent);

    const child = createNode({ type: 'compute/function', displayName: 'API Layer' });
    graph = addChildNode(graph, parent.id, child);

    const updatedParent = findNode(graph, parent.id);
    expect(updatedParent).toBeDefined();
    expect(updatedParent!.children).toHaveLength(1);
    expect(updatedParent!.children[0].id).toBe(child.id);
    expect(updatedParent!.children[0].displayName).toBe('API Layer');
    expect(updatedParent!.children[0].type).toBe('compute/function');
  });

  it('should add multiple children to the same parent', () => {
    const parent = createNode({ type: 'compute/service', displayName: 'Order Service' });
    let graph = createEmptyGraph('Test');
    graph = addNode(graph, parent);

    const child1 = createNode({ type: 'compute/function', displayName: 'API Layer' });
    const child2 = createNode({ type: 'compute/function', displayName: 'Business Logic' });
    graph = addChildNode(graph, parent.id, child1);
    graph = addChildNode(graph, parent.id, child2);

    const updatedParent = findNode(graph, parent.id);
    expect(updatedParent).toBeDefined();
    expect(updatedParent!.children).toHaveLength(2);
    expect(updatedParent!.children[0].displayName).toBe('API Layer');
    expect(updatedParent!.children[1].displayName).toBe('Business Logic');
  });

  it('should support 3 levels deep nesting (grandchild)', () => {
    const parent = createNode({ type: 'compute/service', displayName: 'Order Service' });
    let graph = createEmptyGraph('Test');
    graph = addNode(graph, parent);

    const child = createNode({ type: 'compute/function', displayName: 'API Layer' });
    graph = addChildNode(graph, parent.id, child);

    const grandchild = createNode({ type: 'compute/function', displayName: 'Route Handler' });
    graph = addChildNode(graph, child.id, grandchild);

    // Verify 3-level structure
    const updatedParent = findNode(graph, parent.id);
    expect(updatedParent).toBeDefined();
    expect(updatedParent!.children).toHaveLength(1);

    const updatedChild = updatedParent!.children[0];
    expect(updatedChild.displayName).toBe('API Layer');
    expect(updatedChild.children).toHaveLength(1);

    const updatedGrandchild = updatedChild.children[0];
    expect(updatedGrandchild.displayName).toBe('Route Handler');
    expect(updatedGrandchild.id).toBe(grandchild.id);
  });

  it('should not modify original graph (immutability)', () => {
    const parent = createNode({ type: 'compute/service', displayName: 'Parent' });
    let graph = createEmptyGraph('Test');
    graph = addNode(graph, parent);

    const child = createNode({ type: 'compute/function', displayName: 'Child' });
    const newGraph = addChildNode(graph, parent.id, child);

    // Original graph should be unchanged
    expect(graph.nodes[0].children).toHaveLength(0);
    // New graph should have the child
    expect(newGraph.nodes[0].children).toHaveLength(1);
  });

  it('child node should have correct type and displayName', () => {
    const parent = createNode({ type: 'compute/service', displayName: 'Order Service' });
    let graph = createEmptyGraph('Test');
    graph = addNode(graph, parent);

    const child = createNode({
      type: 'data/database',
      displayName: 'OrderDB',
      args: { engine: 'PostgreSQL' },
    });
    graph = addChildNode(graph, parent.id, child);

    const foundChild = findNode(graph, child.id);
    expect(foundChild).toBeDefined();
    expect(foundChild!.type).toBe('data/database');
    expect(foundChild!.displayName).toBe('OrderDB');
    expect(foundChild!.args).toEqual({ engine: 'PostgreSQL' });
  });

  it('should handle adding child to non-existent parent gracefully', () => {
    const graph = createEmptyGraph('Test');
    const child = createNode({ type: 'compute/function', displayName: 'Orphan' });

    // Adding to non-existent parent should not crash
    const newGraph = addChildNode(graph, 'non-existent-id', child);
    expect(newGraph.nodes).toHaveLength(0); // No root nodes
  });
});

// ============================================================
// Feature #26: Graph engine finds node by ID recursively
// ============================================================
describe('findNode - recursive search', () => {
  it('should find a root-level node', () => {
    const node = createNode({ type: 'compute/service', displayName: 'Root Service' });
    let graph = createEmptyGraph('Test');
    graph = addNode(graph, node);

    const found = findNode(graph, node.id);
    expect(found).toBeDefined();
    expect(found!.id).toBe(node.id);
    expect(found!.displayName).toBe('Root Service');
  });

  it('should find a child node recursively', () => {
    const parent = createNode({ type: 'compute/service', displayName: 'Parent' });
    const child = createNode({ type: 'compute/function', displayName: 'Child' });
    let graph = createEmptyGraph('Test');
    graph = addNode(graph, parent);
    graph = addChildNode(graph, parent.id, child);

    const found = findNode(graph, child.id);
    expect(found).toBeDefined();
    expect(found!.id).toBe(child.id);
    expect(found!.displayName).toBe('Child');
  });

  it('should find a deeply nested node (3+ levels)', () => {
    const root = createNode({ type: 'compute/service', displayName: 'Root' });
    const l2 = createNode({ type: 'compute/function', displayName: 'Level 2' });
    const l3 = createNode({ type: 'compute/worker', displayName: 'Level 3' });
    const l4 = createNode({ type: 'data/database', displayName: 'Level 4' });

    let graph = createEmptyGraph('Test');
    graph = addNode(graph, root);
    graph = addChildNode(graph, root.id, l2);
    graph = addChildNode(graph, l2.id, l3);
    graph = addChildNode(graph, l3.id, l4);

    const found = findNode(graph, l4.id);
    expect(found).toBeDefined();
    expect(found!.displayName).toBe('Level 4');
    expect(found!.type).toBe('data/database');
  });

  it('should return undefined for non-existent node', () => {
    let graph = createEmptyGraph('Test');
    const node = createNode({ type: 'compute/service', displayName: 'Existing' });
    graph = addNode(graph, node);

    const found = findNode(graph, 'non-existent-id');
    expect(found).toBeUndefined();
  });

  it('should return undefined for empty graph', () => {
    const graph = createEmptyGraph('Test');
    const found = findNode(graph, 'any-id');
    expect(found).toBeUndefined();
  });

  it('should find correct node among multiple siblings', () => {
    let graph = createEmptyGraph('Test');
    const node1 = createNode({ type: 'compute/service', displayName: 'Service A' });
    const node2 = createNode({ type: 'compute/service', displayName: 'Service B' });
    const node3 = createNode({ type: 'compute/service', displayName: 'Service C' });
    graph = addNode(graph, node1);
    graph = addNode(graph, node2);
    graph = addNode(graph, node3);

    const found = findNode(graph, node2.id);
    expect(found).toBeDefined();
    expect(found!.displayName).toBe('Service B');
  });

  it('should find child among multiple siblings at different levels', () => {
    let graph = createEmptyGraph('Test');
    const parent1 = createNode({ type: 'compute/service', displayName: 'Parent 1' });
    const parent2 = createNode({ type: 'compute/service', displayName: 'Parent 2' });
    const target = createNode({ type: 'compute/function', displayName: 'Target Child' });

    graph = addNode(graph, parent1);
    graph = addNode(graph, parent2);
    graph = addChildNode(graph, parent2.id, target);

    const found = findNode(graph, target.id);
    expect(found).toBeDefined();
    expect(found!.displayName).toBe('Target Child');
  });
});

// ============================================================
// Feature #26 continued: findNodeParent and getNodePath
// ============================================================
describe('findNodeParent', () => {
  it('should return undefined for root-level nodes', () => {
    const node = createNode({ type: 'compute/service', displayName: 'Root' });
    let graph = createEmptyGraph('Test');
    graph = addNode(graph, node);

    const parent = findNodeParent(graph, node.id);
    expect(parent).toBeUndefined();
  });

  it('should find the parent of a child node', () => {
    const parentNode = createNode({ type: 'compute/service', displayName: 'Parent' });
    const childNode = createNode({ type: 'compute/function', displayName: 'Child' });
    let graph = createEmptyGraph('Test');
    graph = addNode(graph, parentNode);
    graph = addChildNode(graph, parentNode.id, childNode);

    const foundParent = findNodeParent(graph, childNode.id);
    expect(foundParent).toBeDefined();
    expect(foundParent!.id).toBe(parentNode.id);
  });
});

describe('getNodePath', () => {
  it('should return path for root node', () => {
    const node = createNode({ type: 'compute/service', displayName: 'Root' });
    let graph = createEmptyGraph('Test');
    graph = addNode(graph, node);

    const path = getNodePath(graph, node.id);
    expect(path).toEqual([node.id]);
  });

  it('should return full path for nested node', () => {
    const root = createNode({ type: 'compute/service', displayName: 'Root' });
    const child = createNode({ type: 'compute/function', displayName: 'Child' });
    const grandchild = createNode({ type: 'compute/worker', displayName: 'Grandchild' });

    let graph = createEmptyGraph('Test');
    graph = addNode(graph, root);
    graph = addChildNode(graph, root.id, child);
    graph = addChildNode(graph, child.id, grandchild);

    const path = getNodePath(graph, grandchild.id);
    expect(path).toEqual([root.id, child.id, grandchild.id]);
  });

  it('should return empty array for non-existent node', () => {
    const graph = createEmptyGraph('Test');
    const path = getNodePath(graph, 'non-existent');
    expect(path).toEqual([]);
  });

  // Feature #25 specific steps:
  it('should return full breadcrumb path for deeply nested handler (4-level hierarchy)', () => {
    // Create hierarchy: Service A > API Layer > Handler (Service A is root-level)
    const serviceA = createNode({ type: 'compute/service', displayName: 'Service A' });
    const apiLayer = createNode({ type: 'compute/function', displayName: 'API Layer' });
    const handler = createNode({ type: 'compute/function', displayName: 'Handler' });

    let graph = createEmptyGraph('Test');
    graph = addNode(graph, serviceA);
    graph = addChildNode(graph, serviceA.id, apiLayer);
    graph = addChildNode(graph, apiLayer.id, handler);

    // Path for Handler should include all ancestors
    const pathForHandler = getNodePath(graph, handler.id);
    expect(pathForHandler).toEqual([serviceA.id, apiLayer.id, handler.id]);
  });

  it('should return single-element path for root-level node (Service A)', () => {
    const serviceA = createNode({ type: 'compute/service', displayName: 'Service A' });
    let graph = createEmptyGraph('Test');
    graph = addNode(graph, serviceA);

    const pathForServiceA = getNodePath(graph, serviceA.id);
    expect(pathForServiceA).toEqual([serviceA.id]);
  });
});

// ============================================================
// Feature #25: Graph engine removes node and its connected edges
// ============================================================
describe('removeNode - with connected edge cleanup', () => {
  it('should remove a root node', () => {
    const node = createNode({ type: 'compute/service', displayName: 'Service' });
    let graph = createEmptyGraph('Test');
    graph = addNode(graph, node);

    graph = removeNode(graph, node.id);
    expect(graph.nodes).toHaveLength(0);
  });

  it('should remove connected edges when node is removed', () => {
    const nodeA = createNode({ type: 'compute/service', displayName: 'Service A' });
    const nodeB = createNode({ type: 'compute/service', displayName: 'Service B' });
    const nodeC = createNode({ type: 'compute/service', displayName: 'Service C' });
    const edgeAB = createEdge({ fromNode: nodeA.id, toNode: nodeB.id, type: 'sync' });
    const edgeBC = createEdge({ fromNode: nodeB.id, toNode: nodeC.id, type: 'async' });
    const edgeAC = createEdge({ fromNode: nodeA.id, toNode: nodeC.id, type: 'data-flow' });

    let graph = createEmptyGraph('Test');
    graph = addNode(graph, nodeA);
    graph = addNode(graph, nodeB);
    graph = addNode(graph, nodeC);
    graph = addEdge(graph, edgeAB);
    graph = addEdge(graph, edgeBC);
    graph = addEdge(graph, edgeAC);

    // Remove node B - should remove edges AB and BC, keep AC
    graph = removeNode(graph, nodeB.id);
    expect(graph.nodes).toHaveLength(2);
    expect(graph.edges).toHaveLength(1);
    expect(graph.edges[0].id).toBe(edgeAC.id);
  });

  it('should remove child nodes recursively when parent is removed', () => {
    const parent = createNode({ type: 'compute/service', displayName: 'Parent' });
    const child = createNode({ type: 'compute/function', displayName: 'Child' });
    const grandchild = createNode({ type: 'compute/worker', displayName: 'Grandchild' });

    let graph = createEmptyGraph('Test');
    graph = addNode(graph, parent);
    graph = addChildNode(graph, parent.id, child);
    graph = addChildNode(graph, child.id, grandchild);

    graph = removeNode(graph, parent.id);
    expect(graph.nodes).toHaveLength(0);
    expect(findNode(graph, child.id)).toBeUndefined();
    expect(findNode(graph, grandchild.id)).toBeUndefined();
  });

  it('should remove edges connected to child nodes when parent is removed', () => {
    const parent = createNode({ type: 'compute/service', displayName: 'Parent' });
    const child = createNode({ type: 'compute/function', displayName: 'Child' });
    const external = createNode({ type: 'data/database', displayName: 'External DB' });

    let graph = createEmptyGraph('Test');
    graph = addNode(graph, parent);
    graph = addNode(graph, external);
    graph = addChildNode(graph, parent.id, child);

    // Edge from child to external node
    const edge = createEdge({ fromNode: child.id, toNode: external.id, type: 'sync' });
    graph = addEdge(graph, edge);

    // Removing parent should also remove the edge connected to the child
    graph = removeNode(graph, parent.id);
    expect(graph.nodes).toHaveLength(1); // Only external remains
    expect(graph.edges).toHaveLength(0); // Edge was cleaned up
  });

  it('should remove only a child node (not the parent)', () => {
    const parent = createNode({ type: 'compute/service', displayName: 'Parent' });
    const child1 = createNode({ type: 'compute/function', displayName: 'Child 1' });
    const child2 = createNode({ type: 'compute/function', displayName: 'Child 2' });

    let graph = createEmptyGraph('Test');
    graph = addNode(graph, parent);
    graph = addChildNode(graph, parent.id, child1);
    graph = addChildNode(graph, parent.id, child2);

    // Remove only child1
    graph = removeNode(graph, child1.id);

    const updatedParent = findNode(graph, parent.id);
    expect(updatedParent).toBeDefined();
    expect(updatedParent!.children).toHaveLength(1);
    expect(updatedParent!.children[0].displayName).toBe('Child 2');
  });

  it('should not affect unrelated nodes and edges', () => {
    const nodeA = createNode({ type: 'compute/service', displayName: 'A' });
    const nodeB = createNode({ type: 'compute/service', displayName: 'B' });
    const nodeC = createNode({ type: 'compute/service', displayName: 'C' });
    const edgeBC = createEdge({ fromNode: nodeB.id, toNode: nodeC.id, type: 'sync' });

    let graph = createEmptyGraph('Test');
    graph = addNode(graph, nodeA);
    graph = addNode(graph, nodeB);
    graph = addNode(graph, nodeC);
    graph = addEdge(graph, edgeBC);

    // Removing A should not affect B, C, or edge BC
    graph = removeNode(graph, nodeA.id);
    expect(graph.nodes).toHaveLength(2);
    expect(graph.edges).toHaveLength(1);
    expect(findNode(graph, nodeB.id)).toBeDefined();
    expect(findNode(graph, nodeC.id)).toBeDefined();
  });

  it('should handle removing non-existent node gracefully', () => {
    const node = createNode({ type: 'compute/service', displayName: 'Existing' });
    let graph = createEmptyGraph('Test');
    graph = addNode(graph, node);

    // Should not crash or modify graph
    const newGraph = removeNode(graph, 'non-existent-id');
    expect(newGraph.nodes).toHaveLength(1);
  });
});
