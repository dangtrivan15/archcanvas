/**
 * Feature #46: Text API updateNode() modifies node properties
 *
 * TextAPI.updateNode() updates a node's fields through the API layer.
 *
 * Steps verified:
 * 1. Create node with displayName 'Old'
 * 2. Call textApi.updateNode(id, {displayName: 'New'})
 * 3. Call textApi.getNode(id) and verify displayName is 'New'
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { TextApi } from '@/api/textApi';
import { RegistryManager } from '@/core/registry/registryManager';
import type { ArchGraph } from '@/types/graph';

describe('Feature #46: TextApi.updateNode() modifies node properties', () => {
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

  it('should update displayName from Old to New', () => {
    const textApi = new TextApi(createEmptyGraph(), registry);

    // Step 1: Create node with displayName 'Old'
    const node = textApi.addNode({
      type: 'compute/service',
      displayName: 'Old',
    });

    // Step 2: Call updateNode to change displayName
    textApi.updateNode(node.id, { displayName: 'New' });

    // Step 3: Verify displayName is 'New'
    const detail = textApi.getNode(node.id);
    expect(detail).toBeDefined();
    expect(detail!.displayName).toBe('New');
  });

  it('should preserve other fields when updating displayName', () => {
    const textApi = new TextApi(createEmptyGraph(), registry);

    const node = textApi.addNode({
      type: 'data/database',
      displayName: 'Users DB',
      args: { engine: 'PostgreSQL', version: '15' },
    });

    textApi.updateNode(node.id, { displayName: 'Accounts DB' });

    const detail = textApi.getNode(node.id);
    expect(detail!.displayName).toBe('Accounts DB');
    expect(detail!.type).toBe('data/database');
    expect(detail!.args.engine).toBe('PostgreSQL');
    expect(detail!.args.version).toBe('15');
  });

  it('should update args on a node', () => {
    const textApi = new TextApi(createEmptyGraph(), registry);

    const node = textApi.addNode({
      type: 'data/database',
      displayName: 'DB',
      args: { engine: 'MySQL' },
    });

    textApi.updateNode(node.id, { args: { engine: 'PostgreSQL', version: '16' } });

    const detail = textApi.getNode(node.id);
    expect(detail!.args.engine).toBe('PostgreSQL');
    expect(detail!.args.version).toBe('16');
  });

  it('should update properties on a node', () => {
    const textApi = new TextApi(createEmptyGraph(), registry);

    const node = textApi.addNode({
      type: 'compute/service',
      displayName: 'API Service',
    });

    textApi.updateNode(node.id, { properties: { port: 8080, debug: true } });

    const detail = textApi.getNode(node.id);
    expect(detail!.properties.port).toBe(8080);
    expect(detail!.properties.debug).toBe(true);
  });

  it('should update multiple fields at once', () => {
    const textApi = new TextApi(createEmptyGraph(), registry);

    const node = textApi.addNode({
      type: 'compute/service',
      displayName: 'Old Service',
      args: { replicas: 1 },
    });

    textApi.updateNode(node.id, {
      displayName: 'New Service',
      args: { replicas: 3, region: 'us-east-1' },
      properties: { team: 'platform' },
    });

    const detail = textApi.getNode(node.id);
    expect(detail!.displayName).toBe('New Service');
    expect(detail!.args.replicas).toBe(3);
    expect(detail!.args.region).toBe('us-east-1');
    expect(detail!.properties.team).toBe('platform');
  });

  it('should reflect updated displayName in listNodes', () => {
    const textApi = new TextApi(createEmptyGraph(), registry);

    const node = textApi.addNode({
      type: 'compute/service',
      displayName: 'Original',
    });

    textApi.updateNode(node.id, { displayName: 'Updated' });

    const nodes = textApi.listNodes();
    const updated = nodes.find((n) => n.id === node.id);
    expect(updated).toBeDefined();
    expect(updated!.displayName).toBe('Updated');
  });

  it('should not affect other nodes when updating one', () => {
    const textApi = new TextApi(createEmptyGraph(), registry);

    const nodeA = textApi.addNode({ type: 'compute/service', displayName: 'Service A' });
    const nodeB = textApi.addNode({ type: 'data/database', displayName: 'Database B' });

    textApi.updateNode(nodeA.id, { displayName: 'Service A Updated' });

    const detailA = textApi.getNode(nodeA.id);
    const detailB = textApi.getNode(nodeB.id);
    expect(detailA!.displayName).toBe('Service A Updated');
    expect(detailB!.displayName).toBe('Database B');
  });

  it('should preserve notes after updating node', () => {
    const textApi = new TextApi(createEmptyGraph(), registry);

    const node = textApi.addNode({
      type: 'compute/service',
      displayName: 'Service',
    });

    textApi.addNote({ nodeId: node.id, author: 'dev', content: 'Important note' });
    textApi.updateNode(node.id, { displayName: 'Updated Service' });

    const detail = textApi.getNode(node.id);
    expect(detail!.displayName).toBe('Updated Service');
    expect(detail!.notes).toHaveLength(1);
    expect(detail!.notes[0].content).toBe('Important note');
  });

  it('should preserve codeRefs after updating node', () => {
    const textApi = new TextApi(createEmptyGraph(), registry);

    const node = textApi.addNode({
      type: 'compute/service',
      displayName: 'Service',
    });

    textApi.addCodeRef({ nodeId: node.id, path: 'src/service.ts', role: 'source' });
    textApi.updateNode(node.id, { displayName: 'Renamed Service' });

    const detail = textApi.getNode(node.id);
    expect(detail!.displayName).toBe('Renamed Service');
    expect(detail!.codeRefs).toHaveLength(1);
    expect(detail!.codeRefs[0].path).toBe('src/service.ts');
  });

  it('should preserve edges after updating node', () => {
    const textApi = new TextApi(createEmptyGraph(), registry);

    const nodeA = textApi.addNode({ type: 'compute/service', displayName: 'A' });
    const nodeB = textApi.addNode({ type: 'data/database', displayName: 'B' });
    textApi.addEdge({ fromNode: nodeA.id, toNode: nodeB.id, type: 'sync' });

    textApi.updateNode(nodeA.id, { displayName: 'A Updated' });

    const detailA = textApi.getNode(nodeA.id);
    expect(detailA!.displayName).toBe('A Updated');
    expect(detailA!.outboundEdges).toHaveLength(1);
    expect(detailA!.outboundEdges[0].toNode).toBe(nodeB.id);
  });

  it('should preserve node ID after update', () => {
    const textApi = new TextApi(createEmptyGraph(), registry);

    const node = textApi.addNode({
      type: 'compute/service',
      displayName: 'Service',
    });

    const originalId = node.id;
    textApi.updateNode(node.id, { displayName: 'Updated' });

    const detail = textApi.getNode(originalId);
    expect(detail).toBeDefined();
    expect(detail!.id).toBe(originalId);
  });

  it('should preserve node type after update', () => {
    const textApi = new TextApi(createEmptyGraph(), registry);

    const node = textApi.addNode({
      type: 'data/database',
      displayName: 'DB',
    });

    textApi.updateNode(node.id, { displayName: 'Updated DB' });

    const detail = textApi.getNode(node.id);
    expect(detail!.type).toBe('data/database');
  });

  it('should handle updating with empty args object', () => {
    const textApi = new TextApi(createEmptyGraph(), registry);

    const node = textApi.addNode({
      type: 'compute/service',
      displayName: 'Service',
      args: { key: 'value' },
    });

    textApi.updateNode(node.id, { args: {} });

    const detail = textApi.getNode(node.id);
    expect(detail!.args).toEqual({});
  });
});
