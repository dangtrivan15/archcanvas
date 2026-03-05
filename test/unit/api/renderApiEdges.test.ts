/**
 * Feature #63: Render API transforms graph to React Flow edges
 *
 * RenderAPI converts internal ArchEdge objects to React Flow CanvasEdge format.
 *
 * Steps verified:
 * 1. Create architecture with 3 nodes and 2 edges of different types
 * 2. Call renderApi.getEdges(navigationPath) [via render()]
 * 3. Verify 2 CanvasEdge objects returned
 * 4. Verify each has source and target matching node IDs
 * 5. Verify each has data with edgeType, label, noteCount
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { RenderApi } from '@/api/renderApi';
import { RegistryManager } from '@/core/registry/registryManager';
import {
  createEmptyGraph,
  createNode,
  createEdge,
  addNode,
  addEdge,
} from '@/core/graph/graphEngine';
import type { ArchGraph } from '@/types/graph';
import type { CanvasEdge } from '@/types/canvas';

describe('Feature #63: Render API transforms graph to React Flow edges', () => {
  let renderApi: RenderApi;
  let graph: ArchGraph;
  let canvasEdges: CanvasEdge[];
  let serviceNodeId: string;
  let dbNodeId: string;
  let queueNodeId: string;

  beforeAll(() => {
    const registry = new RegistryManager();
    registry.initialize();
    renderApi = new RenderApi(registry);

    // Step 1: Create architecture with 3 nodes and 2 edges of different types
    let g = createEmptyGraph('Test Architecture');

    const serviceNode = createNode({
      type: 'compute/service',
      displayName: 'Order Service',
      position: { x: 100, y: 200 },
    });

    const dbNode = createNode({
      type: 'data/database',
      displayName: 'Orders DB',
      position: { x: 400, y: 200 },
    });

    const queueNode = createNode({
      type: 'messaging/message-queue',
      displayName: 'Order Events',
      position: { x: 250, y: 400 },
    });

    g = addNode(g, serviceNode);
    g = addNode(g, dbNode);
    g = addNode(g, queueNode);

    serviceNodeId = serviceNode.id;
    dbNodeId = dbNode.id;
    queueNodeId = queueNode.id;

    // Add 2 edges of different types
    const syncEdge = createEdge({
      fromNode: serviceNode.id,
      toNode: dbNode.id,
      type: 'sync',
      label: 'queries',
    });

    const asyncEdge = createEdge({
      fromNode: serviceNode.id,
      toNode: queueNode.id,
      type: 'async',
      label: 'publishes events',
    });

    g = addEdge(g, syncEdge);
    g = addEdge(g, asyncEdge);

    graph = g;

    // Step 2: Call render to get edges at root navigation level
    const result = renderApi.render(graph, []);
    canvasEdges = result.edges;
  });

  // Step 3: Verify 2 CanvasEdge objects returned
  it('should return 2 CanvasEdge objects', () => {
    expect(canvasEdges).toHaveLength(2);
  });

  // Step 4: Verify each has source and target matching node IDs
  it('should have source matching fromNode for sync edge', () => {
    const syncEdge = canvasEdges.find((e) => e.data?.edgeType === 'sync');
    expect(syncEdge).toBeDefined();
    expect(syncEdge!.source).toBe(serviceNodeId);
    expect(syncEdge!.target).toBe(dbNodeId);
  });

  it('should have source matching fromNode for async edge', () => {
    const asyncEdge = canvasEdges.find((e) => e.data?.edgeType === 'async');
    expect(asyncEdge).toBeDefined();
    expect(asyncEdge!.source).toBe(serviceNodeId);
    expect(asyncEdge!.target).toBe(queueNodeId);
  });

  // Step 5: Verify each has data with edgeType, label, noteCount
  it('should include edgeType in data for sync edge', () => {
    const syncEdge = canvasEdges.find((e) => e.data?.edgeType === 'sync');
    expect(syncEdge!.data!.edgeType).toBe('sync');
  });

  it('should include edgeType in data for async edge', () => {
    const asyncEdge = canvasEdges.find((e) => e.data?.edgeType === 'async');
    expect(asyncEdge!.data!.edgeType).toBe('async');
  });

  it('should include label in data for sync edge', () => {
    const syncEdge = canvasEdges.find((e) => e.data?.edgeType === 'sync');
    expect(syncEdge!.data!.label).toBe('queries');
  });

  it('should include label in data for async edge', () => {
    const asyncEdge = canvasEdges.find((e) => e.data?.edgeType === 'async');
    expect(asyncEdge!.data!.label).toBe('publishes events');
  });

  it('should include noteCount of 0 for edges without notes', () => {
    for (const edge of canvasEdges) {
      expect(edge.data!.noteCount).toBe(0);
    }
  });

  it('should include archEdgeId in data', () => {
    for (const edge of canvasEdges) {
      expect(edge.data!.archEdgeId).toBeDefined();
      expect(edge.data!.archEdgeId.length).toBeGreaterThan(0);
    }
  });

  it('should set React Flow id matching the ArchEdge id', () => {
    for (const edge of canvasEdges) {
      expect(edge.id).toBe(edge.data!.archEdgeId);
    }
  });

  it('should set label at edge level for React Flow display', () => {
    const syncEdge = canvasEdges.find((e) => e.data?.edgeType === 'sync');
    expect(syncEdge!.label).toBe('queries');

    const asyncEdge = canvasEdges.find((e) => e.data?.edgeType === 'async');
    expect(asyncEdge!.label).toBe('publishes events');
  });

  it('should map sync type to "sync" React Flow edge component', () => {
    const syncEdge = canvasEdges.find((e) => e.data?.edgeType === 'sync');
    expect(syncEdge!.type).toBe('sync');
  });

  it('should map async type to "async" React Flow edge component', () => {
    const asyncEdge = canvasEdges.find((e) => e.data?.edgeType === 'async');
    expect(asyncEdge!.type).toBe('async');
  });
});

describe('Feature #63: Render API edge type mapping', () => {
  let renderApi: RenderApi;

  beforeAll(() => {
    const registry = new RegistryManager();
    registry.initialize();
    renderApi = new RenderApi(registry);
  });

  it('should map data-flow edge type to "dataFlow" component type', () => {
    let g = createEmptyGraph('Test');
    const node1 = createNode({
      type: 'compute/service',
      displayName: 'A',
      position: { x: 0, y: 0 },
    });
    const node2 = createNode({
      type: 'data/database',
      displayName: 'B',
      position: { x: 100, y: 0 },
    });
    g = addNode(g, node1);
    g = addNode(g, node2);

    const edge = createEdge({
      fromNode: node1.id,
      toNode: node2.id,
      type: 'data-flow',
      label: 'replicates',
    });
    g = addEdge(g, edge);

    const result = renderApi.render(g, []);
    expect(result.edges).toHaveLength(1);
    expect(result.edges[0].type).toBe('dataFlow');
    expect(result.edges[0].data!.edgeType).toBe('data-flow');
  });

  it('should handle edges with port handles', () => {
    let g = createEmptyGraph('Test');
    const node1 = createNode({
      type: 'compute/service',
      displayName: 'A',
      position: { x: 0, y: 0 },
    });
    const node2 = createNode({
      type: 'data/database',
      displayName: 'B',
      position: { x: 100, y: 0 },
    });
    g = addNode(g, node1);
    g = addNode(g, node2);

    const edge = createEdge({
      fromNode: node1.id,
      toNode: node2.id,
      type: 'sync',
      fromPort: 'http-out',
      toPort: 'query-in',
    });
    g = addEdge(g, edge);

    const result = renderApi.render(g, []);
    expect(result.edges[0].sourceHandle).toBe('http-out');
    expect(result.edges[0].targetHandle).toBe('query-in');
  });

  it('should handle edge without label', () => {
    let g = createEmptyGraph('Test');
    const node1 = createNode({
      type: 'compute/service',
      displayName: 'A',
      position: { x: 0, y: 0 },
    });
    const node2 = createNode({
      type: 'data/database',
      displayName: 'B',
      position: { x: 100, y: 0 },
    });
    g = addNode(g, node1);
    g = addNode(g, node2);

    const edge = createEdge({
      fromNode: node1.id,
      toNode: node2.id,
      type: 'async',
    });
    g = addEdge(g, edge);

    const result = renderApi.render(g, []);
    expect(result.edges[0].data!.label).toBeUndefined();
    expect(result.edges[0].label).toBeUndefined();
  });

  it('should return empty array for graph with no edges', () => {
    let g = createEmptyGraph('Test');
    const node1 = createNode({
      type: 'compute/service',
      displayName: 'A',
      position: { x: 0, y: 0 },
    });
    g = addNode(g, node1);

    const result = renderApi.render(g, []);
    expect(result.edges).toEqual([]);
  });
});
