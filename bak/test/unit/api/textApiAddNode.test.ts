/**
 * Feature #43: Text API addNode() creates node in graph
 *
 * TextAPI.addNode() creates a node through the API layer, updating the underlying architecture.
 *
 * Steps verified:
 * 1. Call textApi.addNode({type: 'data/database', displayName: 'Users DB'})
 * 2. Verify operation succeeds
 * 3. Call textApi.listNodes() and verify new node appears
 * 4. Call textApi.getNode(newId) and verify displayName is 'Users DB'
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { TextApi } from '@/api/textApi';
import { RegistryManager } from '@/core/registry/registryManager';
import type { ArchGraph } from '@/types/graph';

describe('Feature #43: TextApi.addNode() creates node in graph', () => {
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

  it('should create a data/database node with displayName "Users DB"', () => {
    const textApi = new TextApi(createEmptyGraph(), registry);

    // Step 1: Call textApi.addNode({type: 'data/database', displayName: 'Users DB'})
    const newNode = textApi.addNode({
      type: 'data/database',
      displayName: 'Users DB',
    });

    // Step 2: Verify operation succeeds - node is returned with correct fields
    expect(newNode).toBeDefined();
    expect(newNode.id).toBeDefined();
    expect(newNode.id.length).toBeGreaterThan(0);
    expect(newNode.type).toBe('data/database');
    expect(newNode.displayName).toBe('Users DB');
  });

  it('should make the new node appear in listNodes()', () => {
    const textApi = new TextApi(createEmptyGraph(), registry);

    const newNode = textApi.addNode({
      type: 'data/database',
      displayName: 'Users DB',
    });

    // Step 3: Call textApi.listNodes() and verify new node appears
    const nodes = textApi.listNodes();
    expect(nodes).toHaveLength(1);
    expect(nodes[0].id).toBe(newNode.id);
    expect(nodes[0].type).toBe('data/database');
    expect(nodes[0].displayName).toBe('Users DB');
  });

  it('should return correct details via getNode()', () => {
    const textApi = new TextApi(createEmptyGraph(), registry);

    const newNode = textApi.addNode({
      type: 'data/database',
      displayName: 'Users DB',
    });

    // Step 4: Call textApi.getNode(newId) and verify displayName is 'Users DB'
    const detail = textApi.getNode(newNode.id);
    expect(detail).toBeDefined();
    expect(detail!.id).toBe(newNode.id);
    expect(detail!.type).toBe('data/database');
    expect(detail!.displayName).toBe('Users DB');
  });

  it('should create node with args and retrieve them', () => {
    const textApi = new TextApi(createEmptyGraph(), registry);

    const newNode = textApi.addNode({
      type: 'data/database',
      displayName: 'Users DB',
      args: { engine: 'PostgreSQL', port: 5432 },
    });

    const detail = textApi.getNode(newNode.id);
    expect(detail).toBeDefined();
    expect(detail!.args).toEqual({ engine: 'PostgreSQL', port: 5432 });
  });

  it('should create node with position', () => {
    const textApi = new TextApi(createEmptyGraph(), registry);

    const newNode = textApi.addNode({
      type: 'compute/service',
      displayName: 'API Gateway',
      position: { x: 100, y: 200 },
    });

    expect(newNode.position.x).toBe(100);
    expect(newNode.position.y).toBe(200);
  });

  it('should support multiple addNode calls', () => {
    const textApi = new TextApi(createEmptyGraph(), registry);

    const node1 = textApi.addNode({
      type: 'data/database',
      displayName: 'Users DB',
    });
    const node2 = textApi.addNode({
      type: 'compute/service',
      displayName: 'Auth Service',
    });
    const node3 = textApi.addNode({
      type: 'messaging/message-queue',
      displayName: 'Event Queue',
    });

    const nodes = textApi.listNodes();
    expect(nodes).toHaveLength(3);

    // Verify each node is retrievable
    expect(textApi.getNode(node1.id)!.displayName).toBe('Users DB');
    expect(textApi.getNode(node2.id)!.displayName).toBe('Auth Service');
    expect(textApi.getNode(node3.id)!.displayName).toBe('Event Queue');
  });

  it('should generate unique IDs for each node', () => {
    const textApi = new TextApi(createEmptyGraph(), registry);

    const node1 = textApi.addNode({
      type: 'data/database',
      displayName: 'DB 1',
    });
    const node2 = textApi.addNode({
      type: 'data/database',
      displayName: 'DB 2',
    });

    expect(node1.id).not.toBe(node2.id);
  });

  it('should update the underlying graph state', () => {
    const textApi = new TextApi(createEmptyGraph(), registry);

    textApi.addNode({
      type: 'data/database',
      displayName: 'Users DB',
    });

    const graph = textApi.getGraph();
    expect(graph.nodes).toHaveLength(1);
    expect(graph.nodes[0].displayName).toBe('Users DB');
    expect(graph.nodes[0].type).toBe('data/database');
  });

  it('should initialize node with empty arrays for notes, codeRefs, and children', () => {
    const textApi = new TextApi(createEmptyGraph(), registry);

    const newNode = textApi.addNode({
      type: 'data/database',
      displayName: 'Users DB',
    });

    expect(newNode.notes).toEqual([]);
    expect(newNode.codeRefs).toEqual([]);
    expect(newNode.children).toEqual([]);
  });

  it('should add child node when parentId is provided', () => {
    const textApi = new TextApi(createEmptyGraph(), registry);

    const parent = textApi.addNode({
      type: 'compute/service',
      displayName: 'Backend',
    });

    const child = textApi.addNode({
      type: 'data/database',
      displayName: 'Users DB',
      parentId: parent.id,
    });

    // Root level should still have only 1 node
    expect(textApi.listNodes()).toHaveLength(2); // flattenNodes returns all nodes

    // getNode on parent should show the child
    const parentDetail = textApi.getNode(parent.id);
    expect(parentDetail).toBeDefined();
    expect(parentDetail!.children).toHaveLength(1);
    expect(parentDetail!.children[0].id).toBe(child.id);
    expect(parentDetail!.children[0].displayName).toBe('Users DB');
  });

  it('should show zero connections for newly added node', () => {
    const textApi = new TextApi(createEmptyGraph(), registry);

    const newNode = textApi.addNode({
      type: 'data/database',
      displayName: 'Users DB',
    });

    const summary = textApi.listNodes().find((n) => n.id === newNode.id);
    expect(summary).toBeDefined();
    expect(summary!.connectionCount).toBe(0);
    expect(summary!.childCount).toBe(0);
    expect(summary!.noteCount).toBe(0);
  });

  it('should return full NodeDetail with empty inbound/outbound edges', () => {
    const textApi = new TextApi(createEmptyGraph(), registry);

    const newNode = textApi.addNode({
      type: 'data/database',
      displayName: 'Users DB',
    });

    const detail = textApi.getNode(newNode.id);
    expect(detail).toBeDefined();
    expect(detail!.inboundEdges).toEqual([]);
    expect(detail!.outboundEdges).toEqual([]);
  });

  it('should work with all node types from different namespaces', () => {
    const textApi = new TextApi(createEmptyGraph(), registry);

    const types = [
      'compute/service',
      'data/database',
      'data/cache',
      'messaging/message-queue',
      'network/load-balancer',
      'observability/monitoring',
    ];

    for (const type of types) {
      const node = textApi.addNode({ type, displayName: `Node ${type}` });
      expect(node.type).toBe(type);
      const detail = textApi.getNode(node.id);
      expect(detail).toBeDefined();
      expect(detail!.type).toBe(type);
    }

    expect(textApi.listNodes()).toHaveLength(types.length);
  });

  it('should support end-to-end flow: addNode → listNodes → getNode', () => {
    const textApi = new TextApi(createEmptyGraph(), registry);

    // Step 1: Call textApi.addNode({type: 'data/database', displayName: 'Users DB'})
    const newNode = textApi.addNode({
      type: 'data/database',
      displayName: 'Users DB',
    });

    // Step 2: Verify operation succeeds
    expect(newNode).toBeDefined();
    expect(newNode.id).toBeTruthy();

    // Step 3: Call textApi.listNodes() and verify new node appears
    const nodeList = textApi.listNodes();
    expect(nodeList.some((n) => n.id === newNode.id)).toBe(true);
    expect(nodeList.find((n) => n.id === newNode.id)!.displayName).toBe('Users DB');

    // Step 4: Call textApi.getNode(newId) and verify displayName is 'Users DB'
    const detail = textApi.getNode(newNode.id);
    expect(detail).toBeDefined();
    expect(detail!.displayName).toBe('Users DB');
    expect(detail!.type).toBe('data/database');
  });
});
