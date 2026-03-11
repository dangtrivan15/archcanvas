/**
 * Feature #48: Text API removeEdge() deletes edge from graph
 *
 * TextAPI.removeEdge() removes an edge through the API layer.
 *
 * Steps verified:
 * 1. Create 2 nodes and 1 edge
 * 2. Call textApi.removeEdge(edgeId)
 * 3. Call textApi.getEdges() and verify empty
 * 4. Verify both nodes still exist
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { TextApi } from '@/api/textApi';
import { RegistryManager } from '@/core/registry/registryManager';
import { createEmptyGraph } from '@/core/graph/graphEngine';

describe('Feature #48: Text API removeEdge() deletes edge from graph', () => {
  let registry: RegistryManager;

  beforeAll(() => {
    registry = new RegistryManager();
    registry.initialize();
  });

  describe('Basic removal: 2 nodes, 1 edge', () => {
    let textApi: TextApi;
    let nodeAId: string;
    let nodeBId: string;
    let edgeId: string;

    beforeAll(() => {
      // Step 1: Create 2 nodes and 1 edge
      const graph = createEmptyGraph('Remove Edge Test');
      textApi = new TextApi(graph, registry);

      const nodeA = textApi.addNode({
        type: 'compute/service',
        displayName: 'API Gateway',
        position: { x: 0, y: 0 },
      });
      nodeAId = nodeA.id;

      const nodeB = textApi.addNode({
        type: 'data/database',
        displayName: 'Users DB',
        position: { x: 200, y: 0 },
      });
      nodeBId = nodeB.id;

      const edge = textApi.addEdge({
        fromNode: nodeAId,
        toNode: nodeBId,
        type: 'sync',
        label: 'SQL queries',
      });
      edgeId = edge.id;

      // Verify edge exists before removal
      expect(textApi.getEdges()).toHaveLength(1);

      // Step 2: Call textApi.removeEdge(edgeId)
      textApi.removeEdge(edgeId);
    });

    // Step 3: Call textApi.getEdges() and verify empty
    it('getEdges() returns empty array after removal', () => {
      const edges = textApi.getEdges();
      expect(edges).toHaveLength(0);
      expect(edges).toEqual([]);
    });

    // Step 4: Verify both nodes still exist
    it('node A still exists after edge removal', () => {
      const nodeA = textApi.getNode(nodeAId);
      expect(nodeA).toBeDefined();
      expect(nodeA!.displayName).toBe('API Gateway');
    });

    it('node B still exists after edge removal', () => {
      const nodeB = textApi.getNode(nodeBId);
      expect(nodeB).toBeDefined();
      expect(nodeB!.displayName).toBe('Users DB');
    });

    it('listNodes() still returns both nodes', () => {
      const nodes = textApi.listNodes();
      expect(nodes).toHaveLength(2);
      const names = nodes.map((n) => n.displayName);
      expect(names).toContain('API Gateway');
      expect(names).toContain('Users DB');
    });
  });

  describe('Remove one edge from multiple edges', () => {
    it('removes only the targeted edge, preserving others', () => {
      const graph = createEmptyGraph('Multi-Edge Test');
      const textApi = new TextApi(graph, registry);

      const n1 = textApi.addNode({
        type: 'compute/service',
        displayName: 'Service A',
      });
      const n2 = textApi.addNode({
        type: 'compute/service',
        displayName: 'Service B',
      });
      const n3 = textApi.addNode({
        type: 'data/database',
        displayName: 'Database',
      });

      const edge1 = textApi.addEdge({
        fromNode: n1.id,
        toNode: n2.id,
        type: 'sync',
        label: 'calls',
      });
      const edge2 = textApi.addEdge({
        fromNode: n2.id,
        toNode: n3.id,
        type: 'async',
        label: 'persists',
      });
      const edge3 = textApi.addEdge({
        fromNode: n1.id,
        toNode: n3.id,
        type: 'data-flow',
        label: 'reads',
      });

      expect(textApi.getEdges()).toHaveLength(3);

      // Remove the middle edge
      textApi.removeEdge(edge2.id);

      const remaining = textApi.getEdges();
      expect(remaining).toHaveLength(2);

      const remainingIds = remaining.map((e) => e.id);
      expect(remainingIds).toContain(edge1.id);
      expect(remainingIds).toContain(edge3.id);
      expect(remainingIds).not.toContain(edge2.id);
    });
  });

  describe('Remove edge preserves node connection counts', () => {
    it('listNodes() connectionCount updates after edge removal', () => {
      const graph = createEmptyGraph('Connection Count Test');
      const textApi = new TextApi(graph, registry);

      const hub = textApi.addNode({
        type: 'compute/service',
        displayName: 'Hub',
      });
      const leaf1 = textApi.addNode({
        type: 'compute/service',
        displayName: 'Leaf 1',
      });
      const leaf2 = textApi.addNode({
        type: 'compute/service',
        displayName: 'Leaf 2',
      });

      const e1 = textApi.addEdge({
        fromNode: hub.id,
        toNode: leaf1.id,
        type: 'sync',
      });
      textApi.addEdge({
        fromNode: hub.id,
        toNode: leaf2.id,
        type: 'sync',
      });

      // Hub should have 2 connections
      let nodes = textApi.listNodes();
      const hubBefore = nodes.find((n) => n.displayName === 'Hub');
      expect(hubBefore!.connectionCount).toBe(2);

      // Remove one edge
      textApi.removeEdge(e1.id);

      // Hub should now have 1 connection
      nodes = textApi.listNodes();
      const hubAfter = nodes.find((n) => n.displayName === 'Hub');
      expect(hubAfter!.connectionCount).toBe(1);

      // Leaf 1 should have 0 connections
      const leaf1After = nodes.find((n) => n.displayName === 'Leaf 1');
      expect(leaf1After!.connectionCount).toBe(0);
    });
  });

  describe('Remove non-existent edge', () => {
    it('does not throw when removing edge that does not exist', () => {
      const graph = createEmptyGraph('No-Op Test');
      const textApi = new TextApi(graph, registry);

      const n1 = textApi.addNode({
        type: 'compute/service',
        displayName: 'A',
      });
      const n2 = textApi.addNode({
        type: 'compute/service',
        displayName: 'B',
      });

      textApi.addEdge({
        fromNode: n1.id,
        toNode: n2.id,
        type: 'sync',
      });

      // Should not throw
      expect(() => textApi.removeEdge('nonexistent-id')).not.toThrow();

      // Existing edge should still be there
      expect(textApi.getEdges()).toHaveLength(1);
    });
  });

  describe('Remove edge from empty graph', () => {
    it('does not throw when graph has no edges', () => {
      const graph = createEmptyGraph('Empty Graph');
      const textApi = new TextApi(graph, registry);

      expect(() => textApi.removeEdge('any-id')).not.toThrow();
      expect(textApi.getEdges()).toEqual([]);
    });
  });

  describe('Remove edge preserves edge notes', () => {
    it('edge with notes is fully removed (notes do not leak)', () => {
      const graph = createEmptyGraph('Notes Test');
      const textApi = new TextApi(graph, registry);

      const n1 = textApi.addNode({
        type: 'compute/service',
        displayName: 'Frontend',
      });
      const n2 = textApi.addNode({
        type: 'compute/service',
        displayName: 'Backend',
      });

      const edge = textApi.addEdge({
        fromNode: n1.id,
        toNode: n2.id,
        type: 'sync',
        label: 'API calls',
      });

      // Add notes to the edge
      textApi.addNote({
        edgeId: edge.id,
        author: 'dev',
        content: 'Consider rate limiting',
      });
      textApi.addNote({
        edgeId: edge.id,
        author: 'ai',
        content: 'Add retry logic',
      });

      // Verify notes exist
      const edgesBefore = textApi.getEdges();
      expect(edgesBefore[0].noteCount).toBe(2);

      // Remove the edge
      textApi.removeEdge(edge.id);

      // No edges remain
      expect(textApi.getEdges()).toHaveLength(0);
    });
  });

  describe('Immutability', () => {
    it('removeEdge does not mutate the original graph reference', () => {
      const graph = createEmptyGraph('Immutability Test');
      const textApi = new TextApi(graph, registry);

      const n1 = textApi.addNode({
        type: 'compute/service',
        displayName: 'A',
      });
      const n2 = textApi.addNode({
        type: 'compute/service',
        displayName: 'B',
      });

      const edge = textApi.addEdge({
        fromNode: n1.id,
        toNode: n2.id,
        type: 'sync',
      });

      const graphBefore = textApi.getGraph();
      const edgeCountBefore = graphBefore.edges.length;

      textApi.removeEdge(edge.id);

      // Original graph snapshot should be unchanged
      expect(graphBefore.edges.length).toBe(edgeCountBefore);
      // Updated graph should have no edges
      expect(textApi.getGraph().edges.length).toBe(0);
    });
  });

  describe('Sequential removal of all edges', () => {
    it('removing all edges one by one leaves graph with only nodes', () => {
      const graph = createEmptyGraph('Sequential Removal');
      const textApi = new TextApi(graph, registry);

      const n1 = textApi.addNode({
        type: 'compute/service',
        displayName: 'Service 1',
      });
      const n2 = textApi.addNode({
        type: 'compute/service',
        displayName: 'Service 2',
      });
      const n3 = textApi.addNode({
        type: 'compute/service',
        displayName: 'Service 3',
      });

      const e1 = textApi.addEdge({
        fromNode: n1.id,
        toNode: n2.id,
        type: 'sync',
      });
      const e2 = textApi.addEdge({
        fromNode: n2.id,
        toNode: n3.id,
        type: 'async',
      });

      // Remove first edge
      textApi.removeEdge(e1.id);
      expect(textApi.getEdges()).toHaveLength(1);
      expect(textApi.getEdges()[0].id).toBe(e2.id);

      // Remove second edge
      textApi.removeEdge(e2.id);
      expect(textApi.getEdges()).toHaveLength(0);

      // All 3 nodes still exist
      expect(textApi.listNodes()).toHaveLength(3);
    });
  });

  describe('Remove same edge twice', () => {
    it('second removal is a no-op', () => {
      const graph = createEmptyGraph('Double Remove');
      const textApi = new TextApi(graph, registry);

      const n1 = textApi.addNode({
        type: 'compute/service',
        displayName: 'A',
      });
      const n2 = textApi.addNode({
        type: 'compute/service',
        displayName: 'B',
      });

      const edge = textApi.addEdge({
        fromNode: n1.id,
        toNode: n2.id,
        type: 'sync',
      });

      textApi.removeEdge(edge.id);
      expect(textApi.getEdges()).toHaveLength(0);

      // Second removal should not throw
      expect(() => textApi.removeEdge(edge.id)).not.toThrow();
      expect(textApi.getEdges()).toHaveLength(0);
    });
  });

  describe('Remove edge preserves graph metadata', () => {
    it('graph name is preserved after edge removal', () => {
      const graph = createEmptyGraph('My Architecture');
      const textApi = new TextApi(graph, registry);

      const n1 = textApi.addNode({
        type: 'compute/service',
        displayName: 'A',
      });
      const n2 = textApi.addNode({
        type: 'compute/service',
        displayName: 'B',
      });

      const edge = textApi.addEdge({
        fromNode: n1.id,
        toNode: n2.id,
        type: 'sync',
      });

      textApi.removeEdge(edge.id);

      const updatedGraph = textApi.getGraph();
      expect(updatedGraph.name).toBe('My Architecture');
    });
  });
});
