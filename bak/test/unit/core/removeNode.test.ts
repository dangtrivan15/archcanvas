/**
 * Feature #12: Graph engine removes node from architecture
 *
 * removeNode() deletes a node and returns the updated architecture without it.
 *
 * Steps verified:
 * 1. Create architecture with 2 nodes
 * 2. Call removeNode with the first node's ID
 * 3. Verify architecture now has 1 node
 * 4. Verify remaining node is the second one
 * 5. Verify removed node ID no longer findable
 */

import { describe, it, expect } from 'vitest';
import {
  createEmptyGraph,
  createNode,
  addNode,
  removeNode,
  findNode,
} from '@/core/graph/graphEngine';

describe('Feature #12: removeNode deletes a node from architecture', () => {
  it('should remove the first node from a 2-node architecture', () => {
    // Step 1: Create architecture with 2 nodes
    const node1 = createNode({ type: 'compute/service', displayName: 'API Gateway' });
    const node2 = createNode({ type: 'data/database', displayName: 'Users DB' });
    let graph = createEmptyGraph('Test Architecture');
    graph = addNode(graph, node1);
    graph = addNode(graph, node2);
    expect(graph.nodes).toHaveLength(2);

    // Step 2: Call removeNode with the first node's ID
    const updatedGraph = removeNode(graph, node1.id);

    // Step 3: Verify architecture now has 1 node
    expect(updatedGraph.nodes).toHaveLength(1);

    // Step 4: Verify remaining node is the second one
    expect(updatedGraph.nodes[0].id).toBe(node2.id);
    expect(updatedGraph.nodes[0].displayName).toBe('Users DB');
    expect(updatedGraph.nodes[0].type).toBe('data/database');

    // Step 5: Verify removed node ID no longer findable
    expect(findNode(updatedGraph, node1.id)).toBeUndefined();
  });

  it('should remove the second node from a 2-node architecture', () => {
    // Create 2 nodes
    const node1 = createNode({ type: 'compute/service', displayName: 'Order Service' });
    const node2 = createNode({ type: 'messaging/message-queue', displayName: 'Event Queue' });
    let graph = createEmptyGraph('Test');
    graph = addNode(graph, node1);
    graph = addNode(graph, node2);

    // Remove the second node
    const updatedGraph = removeNode(graph, node2.id);

    // Verify only node1 remains
    expect(updatedGraph.nodes).toHaveLength(1);
    expect(updatedGraph.nodes[0].id).toBe(node1.id);
    expect(updatedGraph.nodes[0].displayName).toBe('Order Service');
    expect(findNode(updatedGraph, node2.id)).toBeUndefined();
  });

  it('should return immutable result (original graph unchanged)', () => {
    const node1 = createNode({ type: 'compute/service', displayName: 'Service A' });
    const node2 = createNode({ type: 'compute/service', displayName: 'Service B' });
    let graph = createEmptyGraph('Test');
    graph = addNode(graph, node1);
    graph = addNode(graph, node2);

    const updatedGraph = removeNode(graph, node1.id);

    // Original graph still has 2 nodes
    expect(graph.nodes).toHaveLength(2);
    // Updated graph has 1 node
    expect(updatedGraph.nodes).toHaveLength(1);
  });

  it('should preserve all properties of the remaining node', () => {
    const node1 = createNode({
      type: 'compute/service',
      displayName: 'To Remove',
      args: { runtime: 'node' },
      position: { x: 100, y: 200 },
    });
    const node2 = createNode({
      type: 'data/database',
      displayName: 'Keeper',
      args: { engine: 'PostgreSQL', version: 15 },
      position: { x: 300, y: 400 },
    });
    let graph = createEmptyGraph('Property Preservation Test');
    graph = addNode(graph, node1);
    graph = addNode(graph, node2);

    const updatedGraph = removeNode(graph, node1.id);

    const remaining = updatedGraph.nodes[0];
    expect(remaining.id).toBe(node2.id);
    expect(remaining.type).toBe('data/database');
    expect(remaining.displayName).toBe('Keeper');
    expect(remaining.args).toEqual({ engine: 'PostgreSQL', version: 15 });
    expect(remaining.position.x).toBe(300);
    expect(remaining.position.y).toBe(400);
  });

  it('should handle removing from single-node architecture', () => {
    const node = createNode({ type: 'compute/service', displayName: 'Solo' });
    let graph = createEmptyGraph('Test');
    graph = addNode(graph, node);

    const updatedGraph = removeNode(graph, node.id);

    expect(updatedGraph.nodes).toHaveLength(0);
    expect(findNode(updatedGraph, node.id)).toBeUndefined();
  });

  it('should handle non-existent node ID gracefully', () => {
    const node1 = createNode({ type: 'compute/service', displayName: 'Existing' });
    const node2 = createNode({ type: 'data/database', displayName: 'Also Existing' });
    let graph = createEmptyGraph('Test');
    graph = addNode(graph, node1);
    graph = addNode(graph, node2);

    // Removing a non-existent ID should not modify the graph
    const updatedGraph = removeNode(graph, 'non-existent-id');
    expect(updatedGraph.nodes).toHaveLength(2);
    expect(findNode(updatedGraph, node1.id)).toBeDefined();
    expect(findNode(updatedGraph, node2.id)).toBeDefined();
  });

  it('should be able to remove all nodes sequentially', () => {
    const node1 = createNode({ type: 'compute/service', displayName: 'Service 1' });
    const node2 = createNode({ type: 'compute/service', displayName: 'Service 2' });
    const node3 = createNode({ type: 'data/database', displayName: 'DB' });
    let graph = createEmptyGraph('Test');
    graph = addNode(graph, node1);
    graph = addNode(graph, node2);
    graph = addNode(graph, node3);
    expect(graph.nodes).toHaveLength(3);

    graph = removeNode(graph, node1.id);
    expect(graph.nodes).toHaveLength(2);
    expect(findNode(graph, node1.id)).toBeUndefined();

    graph = removeNode(graph, node2.id);
    expect(graph.nodes).toHaveLength(1);
    expect(findNode(graph, node2.id)).toBeUndefined();

    graph = removeNode(graph, node3.id);
    expect(graph.nodes).toHaveLength(0);
    expect(findNode(graph, node3.id)).toBeUndefined();
  });

  it('should preserve architecture metadata after removal', () => {
    const node1 = createNode({ type: 'compute/service', displayName: 'Node 1' });
    const node2 = createNode({ type: 'data/database', displayName: 'Node 2' });
    let graph = createEmptyGraph('My Architecture');
    graph = { ...graph, description: 'Test description', owners: ['alice', 'bob'] };
    graph = addNode(graph, node1);
    graph = addNode(graph, node2);

    const updatedGraph = removeNode(graph, node1.id);

    expect(updatedGraph.name).toBe('My Architecture');
    expect(updatedGraph.description).toBe('Test description');
    expect(updatedGraph.owners).toEqual(['alice', 'bob']);
    expect(updatedGraph.nodes).toHaveLength(1);
  });
});
