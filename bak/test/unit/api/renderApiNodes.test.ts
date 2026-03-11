/**
 * Feature #62: Render API transforms graph to React Flow nodes.
 * Verifies that RenderApi converts internal ArchNode objects to
 * React Flow CanvasNode format with correct position, data, and ports.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { RenderApi } from '@/api/renderApi';
import { RegistryManager } from '@/core/registry/registryManager';
import { createEmptyGraph, createNode, addNode } from '@/core/graph/graphEngine';
import type { ArchGraph } from '@/types/graph';
import type { CanvasNode } from '@/types/canvas';

describe('RenderApi transforms graph to React Flow nodes', () => {
  let renderApi: RenderApi;
  let graph: ArchGraph;
  let canvasNodes: CanvasNode[];

  beforeAll(() => {
    // Initialize registry with built-in nodedefs
    const registry = new RegistryManager();
    registry.initialize();

    renderApi = new RenderApi(registry);

    // Step 1: Create architecture with 3 nodes of different types
    let g = createEmptyGraph('Test Architecture');

    const serviceNode = createNode({
      type: 'compute/service',
      displayName: 'Order Service',
      position: { x: 100, y: 200 },
      args: { language: 'TypeScript', framework: 'Express' },
    });

    const dbNode = createNode({
      type: 'data/database',
      displayName: 'Orders DB',
      position: { x: 400, y: 200 },
      args: { engine: 'PostgreSQL', version: '15' },
    });

    const queueNode = createNode({
      type: 'messaging/message-queue',
      displayName: 'Order Events',
      position: { x: 250, y: 400 },
      args: { broker: 'RabbitMQ' },
    });

    g = addNode(g, serviceNode);
    g = addNode(g, dbNode);
    g = addNode(g, queueNode);

    graph = g;

    // Step 2: Call renderApi.render(graph, []) to get nodes at root level
    const result = renderApi.render(graph, []);
    canvasNodes = result.nodes;
  });

  // Step 3: Verify 3 CanvasNode objects returned
  it('returns 3 CanvasNode objects for 3 ArchNodes', () => {
    expect(canvasNodes).toHaveLength(3);
  });

  // Step 4: Verify each has position (x, y)
  it('each CanvasNode has position with x and y coordinates', () => {
    for (const node of canvasNodes) {
      expect(node.position).toBeDefined();
      expect(typeof node.position.x).toBe('number');
      expect(typeof node.position.y).toBe('number');
    }
  });

  it('positions match the original ArchNode positions', () => {
    // Service node at (100, 200)
    const serviceCanvas = canvasNodes.find((n) => n.data.displayName === 'Order Service');
    expect(serviceCanvas).toBeDefined();
    expect(serviceCanvas!.position.x).toBe(100);
    expect(serviceCanvas!.position.y).toBe(200);

    // Database node at (400, 200)
    const dbCanvas = canvasNodes.find((n) => n.data.displayName === 'Orders DB');
    expect(dbCanvas).toBeDefined();
    expect(dbCanvas!.position.x).toBe(400);
    expect(dbCanvas!.position.y).toBe(200);

    // Queue node at (250, 400)
    const queueCanvas = canvasNodes.find((n) => n.data.displayName === 'Order Events');
    expect(queueCanvas).toBeDefined();
    expect(queueCanvas!.position.x).toBe(250);
    expect(queueCanvas!.position.y).toBe(400);
  });

  // Step 5: Verify each has data with archNodeId, displayName, nodedefType
  it('each CanvasNode data has archNodeId referencing the original ArchNode', () => {
    const archNodeIds = graph.nodes.map((n) => n.id);
    for (const node of canvasNodes) {
      expect(node.data.archNodeId).toBeDefined();
      expect(typeof node.data.archNodeId).toBe('string');
      expect(archNodeIds).toContain(node.data.archNodeId);
    }
  });

  it('each CanvasNode data has displayName', () => {
    const expectedNames = ['Order Service', 'Orders DB', 'Order Events'];
    const actualNames = canvasNodes.map((n) => n.data.displayName);
    for (const name of expectedNames) {
      expect(actualNames).toContain(name);
    }
  });

  it('each CanvasNode data has nodedefType matching the original type', () => {
    const serviceCanvas = canvasNodes.find((n) => n.data.displayName === 'Order Service');
    expect(serviceCanvas!.data.nodedefType).toBe('compute/service');

    const dbCanvas = canvasNodes.find((n) => n.data.displayName === 'Orders DB');
    expect(dbCanvas!.data.nodedefType).toBe('data/database');

    const queueCanvas = canvasNodes.find((n) => n.data.displayName === 'Order Events');
    expect(queueCanvas!.data.nodedefType).toBe('messaging/message-queue');
  });

  // Step 6: Verify data includes ports (inbound/outbound arrays)
  it('each CanvasNode data has ports with inbound and outbound arrays', () => {
    for (const node of canvasNodes) {
      expect(node.data.ports).toBeDefined();
      expect(Array.isArray(node.data.ports.inbound)).toBe(true);
      expect(Array.isArray(node.data.ports.outbound)).toBe(true);
    }
  });

  it('compute/service node has inbound and outbound ports from nodedef', () => {
    const serviceCanvas = canvasNodes.find((n) => n.data.nodedefType === 'compute/service');
    expect(serviceCanvas).toBeDefined();

    // Service nodedef should have ports defined
    const { inbound, outbound } = serviceCanvas!.data.ports;

    // Each port should have name and protocol array
    for (const port of [...inbound, ...outbound]) {
      expect(port.name).toBeTruthy();
      expect(Array.isArray(port.protocol)).toBe(true);
    }
  });

  it('data/database node has ports from nodedef', () => {
    const dbCanvas = canvasNodes.find((n) => n.data.nodedefType === 'data/database');
    expect(dbCanvas).toBeDefined();

    const { inbound, outbound } = dbCanvas!.data.ports;

    for (const port of [...inbound, ...outbound]) {
      expect(port.name).toBeTruthy();
      expect(Array.isArray(port.protocol)).toBe(true);
    }
  });

  it('messaging/message-queue node has ports from nodedef', () => {
    const queueCanvas = canvasNodes.find((n) => n.data.nodedefType === 'messaging/message-queue');
    expect(queueCanvas).toBeDefined();

    const { inbound, outbound } = queueCanvas!.data.ports;

    for (const port of [...inbound, ...outbound]) {
      expect(port.name).toBeTruthy();
      expect(Array.isArray(port.protocol)).toBe(true);
    }
  });

  // Additional coverage: verify correct React Flow type mapping
  it('maps node types to correct React Flow component types', () => {
    const serviceCanvas = canvasNodes.find((n) => n.data.nodedefType === 'compute/service');
    // compute/service has shape: rectangle → maps to 'generic' component
    expect(serviceCanvas!.type).toBe('generic');

    const dbCanvas = canvasNodes.find((n) => n.data.nodedefType === 'data/database');
    expect(dbCanvas!.type).toBe('database');

    const queueCanvas = canvasNodes.find((n) => n.data.nodedefType === 'messaging/message-queue');
    expect(queueCanvas!.type).toBe('queue');
  });

  // Additional coverage: verify other data fields are populated correctly
  it('CanvasNode data includes icon from nodedef', () => {
    for (const node of canvasNodes) {
      expect(node.data.icon).toBeDefined();
      expect(typeof node.data.icon).toBe('string');
      expect(node.data.icon.length).toBeGreaterThan(0);
    }
  });

  it('CanvasNode data includes args from original ArchNode', () => {
    const serviceCanvas = canvasNodes.find((n) => n.data.displayName === 'Order Service');
    expect(serviceCanvas!.data.args).toEqual({
      language: 'TypeScript',
      framework: 'Express',
    });

    const dbCanvas = canvasNodes.find((n) => n.data.displayName === 'Orders DB');
    expect(dbCanvas!.data.args).toEqual({
      engine: 'PostgreSQL',
      version: '15',
    });
  });

  it('CanvasNode data has hasChildren=false for root nodes without children', () => {
    for (const node of canvasNodes) {
      expect(node.data.hasChildren).toBe(false);
    }
  });

  it('CanvasNode data has zero counts for notes and codeRefs', () => {
    for (const node of canvasNodes) {
      expect(node.data.noteCount).toBe(0);
      expect(node.data.codeRefCount).toBe(0);
    }
  });

  it('each CanvasNode has a unique id matching its ArchNode id', () => {
    const ids = canvasNodes.map((n) => n.id);
    const archIds = graph.nodes.map((n) => n.id);

    // All unique
    expect(new Set(ids).size).toBe(3);

    // Match arch node ids
    for (const id of ids) {
      expect(archIds).toContain(id);
    }
  });
});
