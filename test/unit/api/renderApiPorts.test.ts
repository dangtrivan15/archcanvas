/**
 * Feature #65: Render API generates port handles from nodedef spec.
 * Verifies that RenderApi creates inbound and outbound port handle
 * definitions from nodedef port specs.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { RenderApi } from '@/api/renderApi';
import { RegistryManager } from '@/core/registry/registryManager';
import { createEmptyGraph, createNode, addNode } from '@/core/graph/graphEngine';
import type { CanvasNode } from '@/types/canvas';

describe('RenderApi generates port handles from nodedef spec', () => {
  let renderApi: RenderApi;

  beforeAll(() => {
    const registry = new RegistryManager();
    registry.initialize();
    renderApi = new RenderApi(registry);
  });

  /**
   * Helper: render a single node and return its CanvasNode.
   */
  function renderSingleNode(type: string, displayName: string): CanvasNode {
    let graph = createEmptyGraph('Port Test');
    const node = createNode({ type, displayName });
    graph = addNode(graph, node);
    const result = renderApi.render(graph, []);
    return result.nodes[0];
  }

  // === Step 1: Create node of type 'compute/service' which has defined ports ===
  // === Step 2: Call renderApi.render() (equivalent of getNodes) ===
  // These are done in the helper above.

  // === Step 3: Verify CanvasNode data includes inbound ports array ===
  it("compute/service has inbound ports array", () => {
    const canvasNode = renderSingleNode('compute/service', 'Test Service');
    const { inbound } = canvasNode.data.ports;
    expect(Array.isArray(inbound)).toBe(true);
    expect(inbound.length).toBeGreaterThan(0);
  });

  // === Step 4: Verify CanvasNode data includes outbound ports array ===
  it("compute/service has outbound ports array", () => {
    const canvasNode = renderSingleNode('compute/service', 'Test Service');
    const { outbound } = canvasNode.data.ports;
    expect(Array.isArray(outbound)).toBe(true);
    expect(outbound.length).toBeGreaterThan(0);
  });

  // === Step 5: Verify port names match nodedef spec ===
  it("compute/service inbound port names match nodedef spec", () => {
    const canvasNode = renderSingleNode('compute/service', 'Test Service');
    const inboundNames = canvasNode.data.ports.inbound.map((p) => p.name);

    // From service.yaml: http-in (HTTP, HTTPS) and grpc-in (gRPC)
    expect(inboundNames).toContain('http-in');
    expect(inboundNames).toContain('grpc-in');
  });

  it("compute/service outbound port names match nodedef spec", () => {
    const canvasNode = renderSingleNode('compute/service', 'Test Service');
    const outboundNames = canvasNode.data.ports.outbound.map((p) => p.name);

    // From service.yaml: http-out (HTTP, HTTPS) and grpc-out (gRPC)
    expect(outboundNames).toContain('http-out');
    expect(outboundNames).toContain('grpc-out');
  });

  it("compute/service port protocols match nodedef spec", () => {
    const canvasNode = renderSingleNode('compute/service', 'Test Service');

    const httpIn = canvasNode.data.ports.inbound.find(
      (p) => p.name === 'http-in',
    );
    expect(httpIn).toBeDefined();
    expect(httpIn!.protocol).toEqual(['HTTP', 'HTTPS']);

    const grpcIn = canvasNode.data.ports.inbound.find(
      (p) => p.name === 'grpc-in',
    );
    expect(grpcIn).toBeDefined();
    expect(grpcIn!.protocol).toEqual(['gRPC']);

    const httpOut = canvasNode.data.ports.outbound.find(
      (p) => p.name === 'http-out',
    );
    expect(httpOut).toBeDefined();
    expect(httpOut!.protocol).toEqual(['HTTP', 'HTTPS']);

    const grpcOut = canvasNode.data.ports.outbound.find(
      (p) => p.name === 'grpc-out',
    );
    expect(grpcOut).toBeDefined();
    expect(grpcOut!.protocol).toEqual(['gRPC']);
  });

  // Additional coverage: data/database ports
  it("data/database has inbound query-in port", () => {
    const canvasNode = renderSingleNode('data/database', 'Test DB');
    const inboundNames = canvasNode.data.ports.inbound.map((p) => p.name);
    expect(inboundNames).toContain('query-in');

    const queryIn = canvasNode.data.ports.inbound.find(
      (p) => p.name === 'query-in',
    );
    expect(queryIn!.protocol).toEqual(['SQL', 'MongoDB Wire', 'HTTP']);
  });

  it("data/database has outbound replication-out port", () => {
    const canvasNode = renderSingleNode('data/database', 'Test DB');
    const outboundNames = canvasNode.data.ports.outbound.map((p) => p.name);
    expect(outboundNames).toContain('replication-out');

    const replOut = canvasNode.data.ports.outbound.find(
      (p) => p.name === 'replication-out',
    );
    expect(replOut!.protocol).toEqual(['WAL', 'Oplog']);
  });

  // Additional coverage: messaging/message-queue ports
  it("messaging/message-queue has inbound publish-in port", () => {
    const canvasNode = renderSingleNode('messaging/message-queue', 'Test Queue');
    const inboundNames = canvasNode.data.ports.inbound.map((p) => p.name);
    expect(inboundNames).toContain('publish-in');

    const publishIn = canvasNode.data.ports.inbound.find(
      (p) => p.name === 'publish-in',
    );
    expect(publishIn!.protocol).toEqual(['AMQP', 'HTTP']);
  });

  it("messaging/message-queue has outbound consume-out port", () => {
    const canvasNode = renderSingleNode('messaging/message-queue', 'Test Queue');
    const outboundNames = canvasNode.data.ports.outbound.map((p) => p.name);
    expect(outboundNames).toContain('consume-out');

    const consumeOut = canvasNode.data.ports.outbound.find(
      (p) => p.name === 'consume-out',
    );
    expect(consumeOut!.protocol).toEqual(['AMQP']);
  });

  // Edge case: unknown nodedef type has empty ports
  it("unknown nodedef type has empty inbound and outbound ports", () => {
    const canvasNode = renderSingleNode('unknown/widget', 'Unknown');
    expect(canvasNode.data.ports.inbound).toEqual([]);
    expect(canvasNode.data.ports.outbound).toEqual([]);
  });

  // Verify port counts for compute/service (2 inbound, 2 outbound)
  it("compute/service has exactly 2 inbound and 2 outbound ports", () => {
    const canvasNode = renderSingleNode('compute/service', 'Test Service');
    expect(canvasNode.data.ports.inbound).toHaveLength(2);
    expect(canvasNode.data.ports.outbound).toHaveLength(2);
  });

  // Verify port counts for data/database (1 inbound, 1 outbound)
  it("data/database has exactly 1 inbound and 1 outbound port", () => {
    const canvasNode = renderSingleNode('data/database', 'Test DB');
    expect(canvasNode.data.ports.inbound).toHaveLength(1);
    expect(canvasNode.data.ports.outbound).toHaveLength(1);
  });

  // Verify port counts for messaging/message-queue (1 inbound, 1 outbound)
  it("messaging/message-queue has exactly 1 inbound and 1 outbound port", () => {
    const canvasNode = renderSingleNode('messaging/message-queue', 'Test Queue');
    expect(canvasNode.data.ports.inbound).toHaveLength(1);
    expect(canvasNode.data.ports.outbound).toHaveLength(1);
  });
});
