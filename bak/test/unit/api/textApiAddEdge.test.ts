/**
 * Feature #44: Text API addEdge() creates edge in graph
 *
 * TextAPI.addEdge() creates an edge through the API layer.
 *
 * Steps verified:
 * 1. Create 2 nodes via Text API
 * 2. Call textApi.addEdge({fromNode: id1, toNode: id2, type: 'async'})
 * 3. Verify operation succeeds
 * 4. Call textApi.getEdges() and verify new edge appears
 * 5. Verify edge type is 'async'
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { TextApi } from '@/api/textApi';
import { RegistryManager } from '@/core/registry/registryManager';
import type { ArchGraph } from '@/types/graph';

describe('Feature #44: TextApi.addEdge() creates edge in graph', () => {
  let registry: RegistryManager;

  beforeEach(() => {
    registry = new RegistryManager();
    registry.initialize();
  });

  function createEmptyGraph(): ArchGraph {
    return {
      name: 'Test Architecture',
      description: '',
      owners: [],
      nodes: [],
      edges: [],
    };
  }

  function createGraphWithTwoNodes() {
    const textApi = new TextApi(createEmptyGraph(), registry);
    const node1 = textApi.addNode({
      type: 'compute/service',
      displayName: 'Auth Service',
    });
    const node2 = textApi.addNode({
      type: 'data/database',
      displayName: 'Users DB',
    });
    return { textApi, node1, node2 };
  }

  it('should create an async edge between two nodes', () => {
    const { textApi, node1, node2 } = createGraphWithTwoNodes();

    // Step 2: Call textApi.addEdge({fromNode: id1, toNode: id2, type: 'async'})
    const edge = textApi.addEdge({
      fromNode: node1.id,
      toNode: node2.id,
      type: 'async',
    });

    // Step 3: Verify operation succeeds
    expect(edge).toBeDefined();
    expect(edge.id).toBeDefined();
    expect(edge.id.length).toBeGreaterThan(0);
    expect(edge.fromNode).toBe(node1.id);
    expect(edge.toNode).toBe(node2.id);

    // Step 5: Verify edge type is 'async'
    expect(edge.type).toBe('async');
  });

  it('should make the new edge appear in getEdges()', () => {
    const { textApi, node1, node2 } = createGraphWithTwoNodes();

    const edge = textApi.addEdge({
      fromNode: node1.id,
      toNode: node2.id,
      type: 'async',
    });

    // Step 4: Call textApi.getEdges() and verify new edge appears
    const edges = textApi.getEdges();
    expect(edges).toHaveLength(1);
    expect(edges[0].id).toBe(edge.id);
    expect(edges[0].fromNode).toBe(node1.id);
    expect(edges[0].toNode).toBe(node2.id);
    expect(edges[0].type).toBe('async');
  });

  it('should create a sync edge', () => {
    const { textApi, node1, node2 } = createGraphWithTwoNodes();

    const edge = textApi.addEdge({
      fromNode: node1.id,
      toNode: node2.id,
      type: 'sync',
    });

    expect(edge.type).toBe('sync');
    expect(textApi.getEdges()[0].type).toBe('sync');
  });

  it('should create a data-flow edge', () => {
    const { textApi, node1, node2 } = createGraphWithTwoNodes();

    const edge = textApi.addEdge({
      fromNode: node1.id,
      toNode: node2.id,
      type: 'data-flow',
    });

    expect(edge.type).toBe('data-flow');
    expect(textApi.getEdges()[0].type).toBe('data-flow');
  });

  it('should create edge with label', () => {
    const { textApi, node1, node2 } = createGraphWithTwoNodes();

    const edge = textApi.addEdge({
      fromNode: node1.id,
      toNode: node2.id,
      type: 'sync',
      label: 'queries',
    });

    expect(edge.label).toBe('queries');
    const edges = textApi.getEdges();
    expect(edges[0].label).toBe('queries');
  });

  it('should create edge with port specifications', () => {
    const { textApi, node1, node2 } = createGraphWithTwoNodes();

    const edge = textApi.addEdge({
      fromNode: node1.id,
      toNode: node2.id,
      type: 'sync',
      fromPort: 'http-out',
      toPort: 'query-in',
    });

    expect(edge.fromPort).toBe('http-out');
    expect(edge.toPort).toBe('query-in');
  });

  it('should support multiple edges between different nodes', () => {
    const textApi = new TextApi(createEmptyGraph(), registry);
    const nodeA = textApi.addNode({ type: 'compute/service', displayName: 'Service A' });
    const nodeB = textApi.addNode({ type: 'compute/service', displayName: 'Service B' });
    const nodeC = textApi.addNode({ type: 'data/database', displayName: 'DB' });

    textApi.addEdge({ fromNode: nodeA.id, toNode: nodeB.id, type: 'sync' });
    textApi.addEdge({ fromNode: nodeB.id, toNode: nodeC.id, type: 'async' });
    textApi.addEdge({ fromNode: nodeA.id, toNode: nodeC.id, type: 'data-flow' });

    const edges = textApi.getEdges();
    expect(edges).toHaveLength(3);
    expect(edges.map((e) => e.type).sort()).toEqual(['async', 'data-flow', 'sync']);
  });

  it('should generate unique IDs for each edge', () => {
    const { textApi, node1, node2 } = createGraphWithTwoNodes();

    const edge1 = textApi.addEdge({
      fromNode: node1.id,
      toNode: node2.id,
      type: 'sync',
      label: 'edge1',
    });
    const edge2 = textApi.addEdge({
      fromNode: node2.id,
      toNode: node1.id,
      type: 'async',
      label: 'edge2',
    });

    expect(edge1.id).not.toBe(edge2.id);
  });

  it('should update the underlying graph state', () => {
    const { textApi, node1, node2 } = createGraphWithTwoNodes();

    textApi.addEdge({
      fromNode: node1.id,
      toNode: node2.id,
      type: 'async',
    });

    const graph = textApi.getGraph();
    expect(graph.edges).toHaveLength(1);
    expect(graph.edges[0].fromNode).toBe(node1.id);
    expect(graph.edges[0].toNode).toBe(node2.id);
    expect(graph.edges[0].type).toBe('async');
  });

  it('should initialize edge with empty notes array', () => {
    const { textApi, node1, node2 } = createGraphWithTwoNodes();

    const edge = textApi.addEdge({
      fromNode: node1.id,
      toNode: node2.id,
      type: 'async',
    });

    expect(edge.notes).toEqual([]);
  });

  it('should update node connection counts after adding edge', () => {
    const { textApi, node1, node2 } = createGraphWithTwoNodes();

    textApi.addEdge({
      fromNode: node1.id,
      toNode: node2.id,
      type: 'async',
    });

    const summaries = textApi.listNodes();
    const node1Summary = summaries.find((n) => n.id === node1.id);
    const node2Summary = summaries.find((n) => n.id === node2.id);

    expect(node1Summary!.connectionCount).toBe(1);
    expect(node2Summary!.connectionCount).toBe(1);
  });

  it('should show edge in node detail inbound/outbound edges', () => {
    const { textApi, node1, node2 } = createGraphWithTwoNodes();

    const edge = textApi.addEdge({
      fromNode: node1.id,
      toNode: node2.id,
      type: 'async',
      label: 'publishes',
    });

    // Node1 should have outbound edge
    const node1Detail = textApi.getNode(node1.id)!;
    expect(node1Detail.outboundEdges).toHaveLength(1);
    expect(node1Detail.outboundEdges[0].id).toBe(edge.id);
    expect(node1Detail.inboundEdges).toHaveLength(0);

    // Node2 should have inbound edge
    const node2Detail = textApi.getNode(node2.id)!;
    expect(node2Detail.inboundEdges).toHaveLength(1);
    expect(node2Detail.inboundEdges[0].id).toBe(edge.id);
    expect(node2Detail.outboundEdges).toHaveLength(0);
  });

  it('should support end-to-end flow: create nodes → addEdge → getEdges → verify', () => {
    const textApi = new TextApi(createEmptyGraph(), registry);

    // Step 1: Create 2 nodes via Text API
    const node1 = textApi.addNode({
      type: 'compute/service',
      displayName: 'Auth Service',
    });
    const node2 = textApi.addNode({
      type: 'data/database',
      displayName: 'Users DB',
    });

    // Step 2: Call textApi.addEdge({fromNode: id1, toNode: id2, type: 'async'})
    const edge = textApi.addEdge({
      fromNode: node1.id,
      toNode: node2.id,
      type: 'async',
    });

    // Step 3: Verify operation succeeds
    expect(edge).toBeDefined();
    expect(edge.id).toBeTruthy();

    // Step 4: Call textApi.getEdges() and verify new edge appears
    const edges = textApi.getEdges();
    expect(edges.some((e) => e.id === edge.id)).toBe(true);

    // Step 5: Verify edge type is 'async'
    const found = edges.find((e) => e.id === edge.id)!;
    expect(found.type).toBe('async');
    expect(found.fromNode).toBe(node1.id);
    expect(found.toNode).toBe(node2.id);
  });
});
