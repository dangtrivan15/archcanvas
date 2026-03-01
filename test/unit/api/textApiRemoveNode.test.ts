/**
 * Feature #47: Text API removeNode() deletes node from graph
 *
 * TextAPI.removeNode() removes a node through the API layer.
 *
 * Steps verified:
 * 1. Create 2 nodes, note the first ID
 * 2. Call textApi.removeNode(firstId)
 * 3. Call textApi.listNodes() and verify only 1 node remains
 * 4. Verify the removed node is not findable
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { TextApi } from '@/api/textApi';
import { RegistryManager } from '@/core/registry/registryManager';
import type { ArchGraph } from '@/types/graph';

describe('Feature #47: TextApi.removeNode() deletes node from graph', () => {
  let registry: RegistryManager;

  beforeEach(() => {
    registry = new RegistryManager();
    registry.initialize();
  });

  it('should remove the first node via TextApi and leave only 1 node', () => {
    const graph: ArchGraph = {
      name: 'Test',
      description: '',
      owners: [],
      nodes: [],
      edges: [],
    };
    const textApi = new TextApi(graph, registry);

    // Step 1: Create 2 nodes, note the first ID
    const node1 = textApi.addNode({
      type: 'compute/service',
      displayName: 'Auth Service',
    });
    const node2 = textApi.addNode({
      type: 'data/database',
      displayName: 'Auth DB',
    });
    const firstId = node1.id;

    // Verify 2 nodes exist
    expect(textApi.listNodes()).toHaveLength(2);

    // Step 2: Call textApi.removeNode(firstId)
    textApi.removeNode(firstId);

    // Step 3: Call textApi.listNodes() and verify only 1 node remains
    const nodes = textApi.listNodes();
    expect(nodes).toHaveLength(1);
    expect(nodes[0].id).toBe(node2.id);
    expect(nodes[0].displayName).toBe('Auth DB');

    // Step 4: Verify the removed node is not findable
    const removed = textApi.getNode(firstId);
    expect(removed).toBeUndefined();
  });

  it('should remove the second node and leave only the first', () => {
    const graph: ArchGraph = {
      name: 'Test',
      description: '',
      owners: [],
      nodes: [],
      edges: [],
    };
    const textApi = new TextApi(graph, registry);

    const node1 = textApi.addNode({
      type: 'compute/service',
      displayName: 'Payment Service',
    });
    const node2 = textApi.addNode({
      type: 'messaging/message-queue',
      displayName: 'Order Queue',
    });

    textApi.removeNode(node2.id);

    const nodes = textApi.listNodes();
    expect(nodes).toHaveLength(1);
    expect(nodes[0].id).toBe(node1.id);
    expect(nodes[0].displayName).toBe('Payment Service');
    expect(textApi.getNode(node2.id)).toBeUndefined();
  });

  it('should update the internal graph state after removeNode', () => {
    const graph: ArchGraph = {
      name: 'Test',
      description: '',
      owners: [],
      nodes: [],
      edges: [],
    };
    const textApi = new TextApi(graph, registry);

    const node1 = textApi.addNode({
      type: 'compute/service',
      displayName: 'Service A',
    });
    textApi.addNode({
      type: 'compute/service',
      displayName: 'Service B',
    });

    textApi.removeNode(node1.id);

    // Verify the underlying graph also reflects the change
    const updatedGraph = textApi.getGraph();
    expect(updatedGraph.nodes).toHaveLength(1);
  });

  it('should remove node and also clean up connected edges', () => {
    const graph: ArchGraph = {
      name: 'Test',
      description: '',
      owners: [],
      nodes: [],
      edges: [],
    };
    const textApi = new TextApi(graph, registry);

    const node1 = textApi.addNode({
      type: 'compute/service',
      displayName: 'API',
    });
    const node2 = textApi.addNode({
      type: 'data/database',
      displayName: 'DB',
    });

    textApi.addEdge({
      fromNode: node1.id,
      toNode: node2.id,
      type: 'sync',
      label: 'queries',
    });

    expect(textApi.getEdges()).toHaveLength(1);

    // Remove node1 → edge should also be removed
    textApi.removeNode(node1.id);

    expect(textApi.listNodes()).toHaveLength(1);
    expect(textApi.getEdges()).toHaveLength(0);
  });

  it('should handle removing non-existent node gracefully', () => {
    const graph: ArchGraph = {
      name: 'Test',
      description: '',
      owners: [],
      nodes: [],
      edges: [],
    };
    const textApi = new TextApi(graph, registry);

    textApi.addNode({
      type: 'compute/service',
      displayName: 'Service A',
    });

    // Removing a non-existent node should not throw
    expect(() => textApi.removeNode('non-existent')).not.toThrow();
    expect(textApi.listNodes()).toHaveLength(1);
  });

  it('should allow adding nodes after removal', () => {
    const graph: ArchGraph = {
      name: 'Test',
      description: '',
      owners: [],
      nodes: [],
      edges: [],
    };
    const textApi = new TextApi(graph, registry);

    const node1 = textApi.addNode({
      type: 'compute/service',
      displayName: 'Old Service',
    });

    textApi.removeNode(node1.id);
    expect(textApi.listNodes()).toHaveLength(0);

    const newNode = textApi.addNode({
      type: 'compute/service',
      displayName: 'New Service',
    });

    expect(textApi.listNodes()).toHaveLength(1);
    expect(textApi.listNodes()[0].displayName).toBe('New Service');
    expect(textApi.getNode(newNode.id)).toBeDefined();
  });

  it('should return correct node summaries after removal', () => {
    const graph: ArchGraph = {
      name: 'Test',
      description: '',
      owners: [],
      nodes: [],
      edges: [],
    };
    const textApi = new TextApi(graph, registry);

    const node1 = textApi.addNode({
      type: 'compute/service',
      displayName: 'Service A',
      args: { language: 'Go' },
    });
    const node2 = textApi.addNode({
      type: 'data/database',
      displayName: 'Users DB',
      args: { engine: 'PostgreSQL' },
    });

    textApi.removeNode(node1.id);

    const summaries = textApi.listNodes();
    expect(summaries).toHaveLength(1);
    expect(summaries[0].id).toBe(node2.id);
    expect(summaries[0].type).toBe('data/database');
    expect(summaries[0].displayName).toBe('Users DB');
  });
});
