/**
 * Feature #16: Graph engine removes edge from architecture
 *
 * removeEdge() deletes an edge and returns the updated architecture.
 *
 * Steps verified:
 * 1. Create architecture with 2 nodes and 1 edge
 * 2. Call removeEdge with the edge ID
 * 3. Verify architecture has 0 edges
 * 4. Verify both nodes still exist
 */

import { describe, it, expect } from 'vitest';
import {
  createEmptyGraph,
  createNode,
  createEdge,
  addNode,
  addEdge,
  removeEdge,
  findNode,
  findEdge,
} from '@/core/graph/graphEngine';

describe('Feature #16: removeEdge() deletes an edge from architecture', () => {
  it('should remove the edge and leave 0 edges, both nodes intact', () => {
    // Step 1: Create architecture with 2 nodes and 1 edge
    const node1 = createNode({ type: 'compute/service', displayName: 'API Gateway' });
    const node2 = createNode({ type: 'data/database', displayName: 'Users DB' });
    const edge = createEdge({
      fromNode: node1.id,
      toNode: node2.id,
      type: 'sync',
      label: 'queries',
    });

    let graph = createEmptyGraph('Test Architecture');
    graph = addNode(graph, node1);
    graph = addNode(graph, node2);
    graph = addEdge(graph, edge);
    expect(graph.edges).toHaveLength(1);

    // Step 2: Call removeEdge with the edge ID
    const updatedGraph = removeEdge(graph, edge.id);

    // Step 3: Verify architecture has 0 edges
    expect(updatedGraph.edges).toHaveLength(0);

    // Step 4: Verify both nodes still exist
    expect(findNode(updatedGraph, node1.id)).toBeDefined();
    expect(findNode(updatedGraph, node2.id)).toBeDefined();
    expect(updatedGraph.nodes).toHaveLength(2);
  });

  it('should return immutable result (original graph unchanged)', () => {
    const node1 = createNode({ type: 'compute/service', displayName: 'Service A' });
    const node2 = createNode({ type: 'compute/service', displayName: 'Service B' });
    const edge = createEdge({
      fromNode: node1.id,
      toNode: node2.id,
      type: 'async',
    });

    let graph = createEmptyGraph('Test');
    graph = addNode(graph, node1);
    graph = addNode(graph, node2);
    graph = addEdge(graph, edge);

    const updatedGraph = removeEdge(graph, edge.id);

    // Original still has the edge
    expect(graph.edges).toHaveLength(1);
    expect(graph.edges[0].id).toBe(edge.id);

    // Updated graph has no edges
    expect(updatedGraph.edges).toHaveLength(0);
  });

  it('should remove only the targeted edge from multiple edges', () => {
    const node1 = createNode({ type: 'compute/service', displayName: 'Gateway' });
    const node2 = createNode({ type: 'data/database', displayName: 'DB' });
    const node3 = createNode({ type: 'messaging/message-queue', displayName: 'Queue' });
    const edge1 = createEdge({
      fromNode: node1.id,
      toNode: node2.id,
      type: 'sync',
      label: 'queries',
    });
    const edge2 = createEdge({
      fromNode: node1.id,
      toNode: node3.id,
      type: 'async',
      label: 'publishes',
    });

    let graph = createEmptyGraph('Test');
    graph = addNode(graph, node1);
    graph = addNode(graph, node2);
    graph = addNode(graph, node3);
    graph = addEdge(graph, edge1);
    graph = addEdge(graph, edge2);
    expect(graph.edges).toHaveLength(2);

    // Remove only edge1
    const updatedGraph = removeEdge(graph, edge1.id);

    expect(updatedGraph.edges).toHaveLength(1);
    expect(updatedGraph.edges[0].id).toBe(edge2.id);
    expect(updatedGraph.edges[0].label).toBe('publishes');
    expect(findEdge(updatedGraph, edge1.id)).toBeUndefined();
  });

  it('should preserve edge properties of remaining edges', () => {
    const node1 = createNode({ type: 'compute/service', displayName: 'A' });
    const node2 = createNode({ type: 'compute/service', displayName: 'B' });
    const node3 = createNode({ type: 'compute/service', displayName: 'C' });
    const edgeToRemove = createEdge({
      fromNode: node1.id,
      toNode: node2.id,
      type: 'sync',
    });
    const edgeToKeep = createEdge({
      fromNode: node2.id,
      toNode: node3.id,
      type: 'data-flow',
      label: 'streams data',
      fromPort: 'out-port',
      toPort: 'in-port',
    });

    let graph = createEmptyGraph('Test');
    graph = addNode(graph, node1);
    graph = addNode(graph, node2);
    graph = addNode(graph, node3);
    graph = addEdge(graph, edgeToRemove);
    graph = addEdge(graph, edgeToKeep);

    const updatedGraph = removeEdge(graph, edgeToRemove.id);

    const remaining = updatedGraph.edges[0];
    expect(remaining.id).toBe(edgeToKeep.id);
    expect(remaining.type).toBe('data-flow');
    expect(remaining.label).toBe('streams data');
    expect(remaining.fromPort).toBe('out-port');
    expect(remaining.toPort).toBe('in-port');
    expect(remaining.fromNode).toBe(node2.id);
    expect(remaining.toNode).toBe(node3.id);
  });

  it('should handle non-existent edge ID gracefully', () => {
    const node1 = createNode({ type: 'compute/service', displayName: 'Service' });
    const node2 = createNode({ type: 'data/database', displayName: 'DB' });
    const edge = createEdge({
      fromNode: node1.id,
      toNode: node2.id,
      type: 'sync',
    });

    let graph = createEmptyGraph('Test');
    graph = addNode(graph, node1);
    graph = addNode(graph, node2);
    graph = addEdge(graph, edge);

    // Remove with non-existent ID should leave graph unchanged
    const updatedGraph = removeEdge(graph, 'non-existent-edge-id');

    expect(updatedGraph.edges).toHaveLength(1);
    expect(updatedGraph.edges[0].id).toBe(edge.id);
    expect(updatedGraph.nodes).toHaveLength(2);
  });

  it('should preserve all nodes after edge removal', () => {
    const node1 = createNode({
      type: 'compute/service',
      displayName: 'API Gateway',
      args: { port: '443', protocol: 'https' },
      position: { x: 100, y: 200 },
    });
    const node2 = createNode({
      type: 'data/database',
      displayName: 'Users DB',
      args: { engine: 'PostgreSQL', version: '15' },
      position: { x: 400, y: 200 },
    });
    const edge = createEdge({
      fromNode: node1.id,
      toNode: node2.id,
      type: 'sync',
    });

    let graph = createEmptyGraph('Test');
    graph = addNode(graph, node1);
    graph = addNode(graph, node2);
    graph = addEdge(graph, edge);

    const updatedGraph = removeEdge(graph, edge.id);

    // Both nodes fully preserved with all properties
    const n1 = findNode(updatedGraph, node1.id)!;
    expect(n1.displayName).toBe('API Gateway');
    expect(n1.args).toEqual({ port: '443', protocol: 'https' });
    expect(n1.position.x).toBe(100);
    expect(n1.position.y).toBe(200);

    const n2 = findNode(updatedGraph, node2.id)!;
    expect(n2.displayName).toBe('Users DB');
    expect(n2.args).toEqual({ engine: 'PostgreSQL', version: '15' });
    expect(n2.position.x).toBe(400);
    expect(n2.position.y).toBe(200);
  });

  it('should remove all edges sequentially', () => {
    const node1 = createNode({ type: 'compute/service', displayName: 'A' });
    const node2 = createNode({ type: 'compute/service', displayName: 'B' });
    const edge1 = createEdge({ fromNode: node1.id, toNode: node2.id, type: 'sync' });
    const edge2 = createEdge({ fromNode: node2.id, toNode: node1.id, type: 'async' });
    const edge3 = createEdge({ fromNode: node1.id, toNode: node2.id, type: 'data-flow' });

    let graph = createEmptyGraph('Test');
    graph = addNode(graph, node1);
    graph = addNode(graph, node2);
    graph = addEdge(graph, edge1);
    graph = addEdge(graph, edge2);
    graph = addEdge(graph, edge3);
    expect(graph.edges).toHaveLength(3);

    graph = removeEdge(graph, edge1.id);
    expect(graph.edges).toHaveLength(2);
    expect(findEdge(graph, edge1.id)).toBeUndefined();

    graph = removeEdge(graph, edge2.id);
    expect(graph.edges).toHaveLength(1);
    expect(findEdge(graph, edge2.id)).toBeUndefined();

    graph = removeEdge(graph, edge3.id);
    expect(graph.edges).toHaveLength(0);
    expect(findEdge(graph, edge3.id)).toBeUndefined();

    // All nodes still exist
    expect(graph.nodes).toHaveLength(2);
  });

  it('should preserve graph metadata after edge removal', () => {
    const node1 = createNode({ type: 'compute/service', displayName: 'A' });
    const node2 = createNode({ type: 'compute/service', displayName: 'B' });
    const edge = createEdge({ fromNode: node1.id, toNode: node2.id, type: 'sync' });

    let graph = createEmptyGraph('My Architecture');
    graph = { ...graph, description: 'Production system', owners: ['alice', 'bob'] };
    graph = addNode(graph, node1);
    graph = addNode(graph, node2);
    graph = addEdge(graph, edge);

    const updatedGraph = removeEdge(graph, edge.id);

    expect(updatedGraph.name).toBe('My Architecture');
    expect(updatedGraph.description).toBe('Production system');
    expect(updatedGraph.owners).toEqual(['alice', 'bob']);
  });

  it('should handle removing edge from graph with no edges', () => {
    const node = createNode({ type: 'compute/service', displayName: 'Solo' });
    let graph = createEmptyGraph('Test');
    graph = addNode(graph, node);
    expect(graph.edges).toHaveLength(0);

    const updatedGraph = removeEdge(graph, 'any-edge-id');

    expect(updatedGraph.edges).toHaveLength(0);
    expect(updatedGraph.nodes).toHaveLength(1);
  });

  it('should handle removing edge of each type (sync, async, data-flow)', () => {
    const node1 = createNode({ type: 'compute/service', displayName: 'A' });
    const node2 = createNode({ type: 'compute/service', displayName: 'B' });

    // Test sync edge removal
    const syncEdge = createEdge({ fromNode: node1.id, toNode: node2.id, type: 'sync' });
    let graph = createEmptyGraph('Test');
    graph = addNode(graph, node1);
    graph = addNode(graph, node2);
    graph = addEdge(graph, syncEdge);
    let updated = removeEdge(graph, syncEdge.id);
    expect(updated.edges).toHaveLength(0);

    // Test async edge removal
    const asyncEdge = createEdge({ fromNode: node1.id, toNode: node2.id, type: 'async' });
    graph = addEdge(updated, asyncEdge);
    updated = removeEdge(graph, asyncEdge.id);
    expect(updated.edges).toHaveLength(0);

    // Test data-flow edge removal
    const dataFlowEdge = createEdge({ fromNode: node1.id, toNode: node2.id, type: 'data-flow' });
    graph = addEdge(updated, dataFlowEdge);
    updated = removeEdge(graph, dataFlowEdge.id);
    expect(updated.edges).toHaveLength(0);
  });
});
