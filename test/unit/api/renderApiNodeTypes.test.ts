/**
 * Feature #64: Render API maps nodedef types to React components.
 * Verifies that RenderApi correctly maps each nodedef type to its
 * specialized React component type string.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { RenderApi } from '@/api/renderApi';
import { RegistryManager } from '@/core/registry/registryManager';
import { createEmptyGraph, createNode, addNode } from '@/core/graph/graphEngine';
import type { ArchGraph } from '@/types/graph';
import type { CanvasNode } from '@/types/canvas';

describe('RenderApi maps nodedef types to React components', () => {
  let renderApi: RenderApi;
  let registry: RegistryManager;

  beforeAll(() => {
    registry = new RegistryManager();
    registry.initialize();
    renderApi = new RenderApi(registry);
  });

  /**
   * Helper: create a graph with a single node of the given type,
   * render it, and return the CanvasNode.
   */
  function renderSingleNode(type: string, displayName: string): CanvasNode {
    let graph = createEmptyGraph('Type Mapping Test');
    const node = createNode({ type, displayName });
    graph = addNode(graph, node);
    const result = renderApi.render(graph, []);
    expect(result.nodes).toHaveLength(1);
    return result.nodes[0];
  }

  // Step 1: Verify 'compute/service' maps via shape metadata
  // Shape 'rectangle' maps to 'generic' via SHAPE_TO_COMPONENT
  it("maps 'compute/service' to 'generic' via rectangle shape", () => {
    const canvasNode = renderSingleNode('compute/service', 'My Service');
    expect(canvasNode.type).toBe('generic');
  });

  // Step 2: Verify 'data/database' maps to CylinderNode via shape
  it("maps 'data/database' to 'database' component type", () => {
    const canvasNode = renderSingleNode('data/database', 'My Database');
    expect(canvasNode.type).toBe('database');
  });

  // Step 3: Verify 'messaging/message-queue' maps via parallelogram shape
  it("maps 'messaging/message-queue' to 'queue' component type", () => {
    const canvasNode = renderSingleNode('messaging/message-queue', 'My Queue');
    expect(canvasNode.type).toBe('queue');
  });

  // Step 4: Verify 'data/cache' maps to CylinderNode via shape
  it("maps 'data/cache' to 'database' via cylinder shape", () => {
    const canvasNode = renderSingleNode('data/cache', 'My Cache');
    expect(canvasNode.type).toBe('database');
  });

  // Step 5: Verify 'compute/api-gateway' maps to HexagonNode via shape
  it("maps 'compute/api-gateway' to 'gateway' component type", () => {
    const canvasNode = renderSingleNode('compute/api-gateway', 'My Gateway');
    expect(canvasNode.type).toBe('gateway');
  });

  // Step 6: Verify unknown types map to GenericNode component
  it("maps unknown types to 'generic' component type", () => {
    const canvasNode = renderSingleNode('unknown/widget', 'Unknown Widget');
    expect(canvasNode.type).toBe('generic');
  });

  // Additional coverage: other compute types with rectangle shape map to generic
  it("maps 'compute/function' to 'generic' via rectangle shape", () => {
    const canvasNode = renderSingleNode('compute/function', 'My Function');
    expect(canvasNode.type).toBe('generic');
  });

  it("maps 'compute/worker' to 'generic' via rectangle shape", () => {
    const canvasNode = renderSingleNode('compute/worker', 'My Worker');
    expect(canvasNode.type).toBe('generic');
  });

  // Data types with cylinder shape all map to 'database' (CylinderNode)
  it("maps 'data/object-storage' to 'database' via cylinder shape", () => {
    const canvasNode = renderSingleNode('data/object-storage', 'My Storage');
    expect(canvasNode.type).toBe('database');
  });

  it("maps 'data/repository' to 'database' via cylinder shape", () => {
    const canvasNode = renderSingleNode('data/repository', 'My Repo');
    expect(canvasNode.type).toBe('database');
  });

  // Messaging types
  it("maps 'messaging/event-bus' to 'generic' via rectangle shape", () => {
    const canvasNode = renderSingleNode('messaging/event-bus', 'My Bus');
    expect(canvasNode.type).toBe('generic');
  });

  it("maps 'messaging/stream-processor' to 'queue' via parallelogram shape", () => {
    const canvasNode = renderSingleNode('messaging/stream-processor', 'My Stream');
    expect(canvasNode.type).toBe('queue');
  });

  // Network types: load-balancer has hexagon shape
  it("maps 'network/load-balancer' to 'gateway' via hexagon shape", () => {
    const canvasNode = renderSingleNode('network/load-balancer', 'My LB');
    expect(canvasNode.type).toBe('gateway');
  });

  it("maps 'observability/logging' to 'generic' via rectangle shape", () => {
    const canvasNode = renderSingleNode('observability/logging', 'My Logger');
    expect(canvasNode.type).toBe('generic');
  });

  // Verify multiple different types render correctly in the same graph
  it('renders multiple node types correctly in one graph', () => {
    let graph = createEmptyGraph('Multi-Type Test');

    graph = addNode(graph, createNode({ type: 'compute/service', displayName: 'Svc' }));
    graph = addNode(graph, createNode({ type: 'data/database', displayName: 'DB' }));
    graph = addNode(graph, createNode({ type: 'messaging/message-queue', displayName: 'Q' }));
    graph = addNode(graph, createNode({ type: 'data/cache', displayName: 'Cache' }));
    graph = addNode(graph, createNode({ type: 'compute/api-gateway', displayName: 'GW' }));

    const result = renderApi.render(graph, []);
    expect(result.nodes).toHaveLength(5);

    const typeMap = new Map(result.nodes.map((n) => [n.data.displayName, n.type]));

    // Shape-based routing: rectangle→generic, cylinder→database, parallelogram→queue, hexagon→gateway
    expect(typeMap.get('Svc')).toBe('generic');
    expect(typeMap.get('DB')).toBe('database');
    expect(typeMap.get('Q')).toBe('queue');
    expect(typeMap.get('Cache')).toBe('database');
    expect(typeMap.get('GW')).toBe('gateway');
  });
});
