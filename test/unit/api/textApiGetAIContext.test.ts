/**
 * Feature #53: Text API getAIContext() returns context with neighbors.
 * Verifies that TextAPI.getAIContext() builds AI context including
 * the selected node and N-hop neighbors.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { TextApi } from '@/api/textApi';
import { RegistryManager } from '@/core/registry/registryManager';
import type { ArchGraph, ArchNode, ArchEdge, Note, CodeRef } from '@/types/graph';
import { generateId } from '@/utils/idGenerator';

// ── helpers ──────────────────────────────────────────────────────────

function makeNote(overrides: Partial<Note> & { author: string; content: string }): Note {
  return {
    id: overrides.id ?? generateId(),
    author: overrides.author,
    timestampMs: overrides.timestampMs ?? Date.now(),
    content: overrides.content,
    tags: overrides.tags ?? [],
    status: overrides.status ?? 'none',
    suggestionType: overrides.suggestionType,
  };
}

function makeNode(overrides: Partial<ArchNode> & { type: string; displayName: string }): ArchNode {
  return {
    id: overrides.id ?? generateId(),
    type: overrides.type,
    displayName: overrides.displayName,
    args: overrides.args ?? {},
    codeRefs: overrides.codeRefs ?? [],
    notes: overrides.notes ?? [],
    properties: overrides.properties ?? {},
    position: overrides.position ?? { x: 0, y: 0, width: 200, height: 100 },
    children: overrides.children ?? [],
    refSource: overrides.refSource,
  };
}

function makeEdge(overrides: Partial<ArchEdge> & { fromNode: string; toNode: string }): ArchEdge {
  return {
    id: overrides.id ?? generateId(),
    fromNode: overrides.fromNode,
    toNode: overrides.toNode,
    type: overrides.type ?? 'sync',
    label: overrides.label,
    properties: overrides.properties ?? {},
    notes: overrides.notes ?? [],
  };
}

function makeGraph(
  nodes: ArchNode[],
  edges: ArchEdge[],
  name: string = 'Test Architecture',
): ArchGraph {
  return {
    name,
    description: '',
    owners: [],
    nodes,
    edges,
  };
}

// ── tests ────────────────────────────────────────────────────────────

describe('TextApi.getAIContext() - Feature #53', () => {
  let registry: RegistryManager;

  beforeAll(() => {
    registry = new RegistryManager();
    registry.initialize();
  });

  describe('linear chain A -> B -> C with notes', () => {
    let nodeA: ArchNode;
    let nodeB: ArchNode;
    let nodeC: ArchNode;
    let graph: ArchGraph;
    let api: TextApi;

    beforeAll(() => {
      const noteOnA = makeNote({ author: 'human', content: 'API gateway for traffic routing' });
      const noteOnB = makeNote({ author: 'ai', content: 'Handles order processing', status: 'pending' });

      nodeA = makeNode({
        type: 'compute/service',
        displayName: 'API Gateway',
        args: { port: '8080' },
        notes: [noteOnA],
        codeRefs: [{ path: 'src/gateway/index.ts', role: 'source' }],
      });
      nodeB = makeNode({
        type: 'compute/service',
        displayName: 'Order Service',
        args: { port: '3000' },
        notes: [noteOnB],
      });
      nodeC = makeNode({
        type: 'data/database',
        displayName: 'Order DB',
        args: { engine: 'postgres' },
      });

      const edgeAB = makeEdge({ fromNode: nodeA.id, toNode: nodeB.id, type: 'sync', label: 'REST' });
      const edgeBC = makeEdge({ fromNode: nodeB.id, toNode: nodeC.id, type: 'async', label: 'query' });

      graph = makeGraph([nodeA, nodeB, nodeC], [edgeAB, edgeBC]);
      api = new TextApi(graph, registry);
    });

    // Step 2: Call textApi.getAIContext(A.id, 1)
    it('should include A\'s full details as selectedNode with depth=1', () => {
      const ctx = api.getAIContext(nodeA.id, 1);

      expect(ctx.selectedNode).toBeDefined();
      expect(ctx.selectedNode!.id).toBe(nodeA.id);
      expect(ctx.selectedNode!.type).toBe('compute/service');
      expect(ctx.selectedNode!.displayName).toBe('API Gateway');
      expect(ctx.selectedNode!.args).toEqual({ port: '8080' });
    });

    it('should include A\'s notes in selectedNode', () => {
      const ctx = api.getAIContext(nodeA.id, 1);

      expect(ctx.selectedNode!.notes).toHaveLength(1);
      expect(ctx.selectedNode!.notes[0].author).toBe('human');
      expect(ctx.selectedNode!.notes[0].content).toBe('API gateway for traffic routing');
    });

    it('should include A\'s codeRefs in selectedNode', () => {
      const ctx = api.getAIContext(nodeA.id, 1);

      expect(ctx.selectedNode!.codeRefs).toHaveLength(1);
      expect(ctx.selectedNode!.codeRefs[0].path).toBe('src/gateway/index.ts');
      expect(ctx.selectedNode!.codeRefs[0].role).toBe('source');
    });

    // Step 4: Verify response includes B as a neighbor
    it('should include B as a neighbor with depth=1', () => {
      const ctx = api.getAIContext(nodeA.id, 1);

      expect(ctx.neighbors).toHaveLength(1);
      expect(ctx.neighbors[0].id).toBe(nodeB.id);
      expect(ctx.neighbors[0].type).toBe('compute/service');
      expect(ctx.neighbors[0].displayName).toBe('Order Service');
    });

    it('should include the connection type between A and B', () => {
      const ctx = api.getAIContext(nodeA.id, 1);

      expect(ctx.neighbors[0].connectionType).toBe('sync');
    });

    // Step 5: Verify response does NOT include C (beyond 1 hop)
    it('should NOT include C (beyond 1 hop) with depth=1', () => {
      const ctx = api.getAIContext(nodeA.id, 1);

      const neighborIds = ctx.neighbors.map((n) => n.id);
      expect(neighborIds).not.toContain(nodeC.id);
    });

    // Step 6: Call textApi.getAIContext(A.id, 2)
    it('should include both B and C with depth=2', () => {
      const ctx = api.getAIContext(nodeA.id, 2);

      expect(ctx.neighbors).toHaveLength(2);
      const neighborIds = ctx.neighbors.map((n) => n.id);
      expect(neighborIds).toContain(nodeB.id);
      expect(neighborIds).toContain(nodeC.id);
    });

    it('should include correct types for all neighbors with depth=2', () => {
      const ctx = api.getAIContext(nodeA.id, 2);

      const neighborB = ctx.neighbors.find((n) => n.id === nodeB.id);
      const neighborC = ctx.neighbors.find((n) => n.id === nodeC.id);

      expect(neighborB!.type).toBe('compute/service');
      expect(neighborB!.displayName).toBe('Order Service');
      expect(neighborC!.type).toBe('data/database');
      expect(neighborC!.displayName).toBe('Order DB');
    });

    it('should include architecture metadata in context', () => {
      const ctx = api.getAIContext(nodeA.id, 1);

      expect(ctx.architectureName).toBe('Test Architecture');
      expect(ctx.totalNodeCount).toBe(3);
      expect(ctx.totalEdgeCount).toBe(2);
    });
  });

  describe('no nodeId provided (global context)', () => {
    it('should return context without selectedNode or neighbors', () => {
      const nodeA = makeNode({ type: 'compute/service', displayName: 'Svc A' });
      const nodeB = makeNode({ type: 'data/database', displayName: 'DB B' });
      const edge = makeEdge({ fromNode: nodeA.id, toNode: nodeB.id });
      const graph = makeGraph([nodeA, nodeB], [edge], 'Global Arch');

      const api = new TextApi(graph, registry);
      const ctx = api.getAIContext();

      expect(ctx.selectedNode).toBeUndefined();
      expect(ctx.neighbors).toEqual([]);
      expect(ctx.architectureName).toBe('Global Arch');
      expect(ctx.totalNodeCount).toBe(2);
      expect(ctx.totalEdgeCount).toBe(1);
    });
  });

  describe('non-existent nodeId', () => {
    it('should return context without selectedNode for unknown node', () => {
      const nodeA = makeNode({ type: 'compute/service', displayName: 'Svc A' });
      const graph = makeGraph([nodeA], []);

      const api = new TextApi(graph, registry);
      const ctx = api.getAIContext('non-existent-id', 1);

      expect(ctx.selectedNode).toBeUndefined();
      expect(ctx.neighbors).toEqual([]);
      expect(ctx.totalNodeCount).toBe(1);
    });
  });

  describe('isolated node (no edges)', () => {
    it('should return selectedNode but no neighbors', () => {
      const nodeA = makeNode({ type: 'compute/service', displayName: 'Isolated Service' });
      const graph = makeGraph([nodeA], []);

      const api = new TextApi(graph, registry);
      const ctx = api.getAIContext(nodeA.id, 1);

      expect(ctx.selectedNode).toBeDefined();
      expect(ctx.selectedNode!.displayName).toBe('Isolated Service');
      expect(ctx.neighbors).toEqual([]);
    });
  });

  describe('bidirectional connectivity', () => {
    it('should find neighbors when node is a toNode (reverse direction)', () => {
      const nodeA = makeNode({ type: 'compute/service', displayName: 'Producer' });
      const nodeB = makeNode({ type: 'messaging/message-queue', displayName: 'Queue' });
      const edge = makeEdge({ fromNode: nodeA.id, toNode: nodeB.id, type: 'async' });
      const graph = makeGraph([nodeA, nodeB], [edge]);

      const api = new TextApi(graph, registry);
      // Query from B (which is a toNode), should still find A
      const ctx = api.getAIContext(nodeB.id, 1);

      expect(ctx.neighbors).toHaveLength(1);
      expect(ctx.neighbors[0].id).toBe(nodeA.id);
      expect(ctx.neighbors[0].connectionType).toBe('async');
    });
  });

  describe('star topology', () => {
    it('should return all direct connections from center node', () => {
      const center = makeNode({ type: 'network/load-balancer', displayName: 'LB' });
      const svc1 = makeNode({ type: 'compute/service', displayName: 'Svc 1' });
      const svc2 = makeNode({ type: 'compute/service', displayName: 'Svc 2' });
      const svc3 = makeNode({ type: 'compute/service', displayName: 'Svc 3' });

      const edges = [
        makeEdge({ fromNode: center.id, toNode: svc1.id, type: 'sync' }),
        makeEdge({ fromNode: center.id, toNode: svc2.id, type: 'sync' }),
        makeEdge({ fromNode: center.id, toNode: svc3.id, type: 'sync' }),
      ];

      const graph = makeGraph([center, svc1, svc2, svc3], edges);
      const api = new TextApi(graph, registry);
      const ctx = api.getAIContext(center.id, 1);

      expect(ctx.neighbors).toHaveLength(3);
      const names = ctx.neighbors.map((n) => n.displayName).sort();
      expect(names).toEqual(['Svc 1', 'Svc 2', 'Svc 3']);
    });
  });

  describe('mixed edge types', () => {
    it('should correctly map connection types for different edge types', () => {
      const svc = makeNode({ type: 'compute/service', displayName: 'Service' });
      const db = makeNode({ type: 'data/database', displayName: 'Database' });
      const queue = makeNode({ type: 'messaging/message-queue', displayName: 'Queue' });
      const cache = makeNode({ type: 'data/cache', displayName: 'Cache' });

      const edges = [
        makeEdge({ fromNode: svc.id, toNode: db.id, type: 'sync' }),
        makeEdge({ fromNode: svc.id, toNode: queue.id, type: 'async' }),
        makeEdge({ fromNode: svc.id, toNode: cache.id, type: 'data-flow' }),
      ];

      const graph = makeGraph([svc, db, queue, cache], edges);
      const api = new TextApi(graph, registry);
      const ctx = api.getAIContext(svc.id, 1);

      expect(ctx.neighbors).toHaveLength(3);

      const dbNeighbor = ctx.neighbors.find((n) => n.displayName === 'Database');
      const queueNeighbor = ctx.neighbors.find((n) => n.displayName === 'Queue');
      const cacheNeighbor = ctx.neighbors.find((n) => n.displayName === 'Cache');

      expect(dbNeighbor!.connectionType).toBe('sync');
      expect(queueNeighbor!.connectionType).toBe('async');
      expect(cacheNeighbor!.connectionType).toBe('data-flow');
    });
  });

  describe('args and notes mapping', () => {
    it('should map args as key-value pairs from selected node', () => {
      const node = makeNode({
        type: 'compute/service',
        displayName: 'Multi-Arg Service',
        args: { port: '3000', host: 'localhost', replicas: '3' },
      });
      const graph = makeGraph([node], []);

      const api = new TextApi(graph, registry);
      const ctx = api.getAIContext(node.id, 1);

      expect(ctx.selectedNode!.args).toEqual({
        port: '3000',
        host: 'localhost',
        replicas: '3',
      });
    });

    it('should map multiple notes from selected node', () => {
      const notes = [
        makeNote({ author: 'human', content: 'Note 1' }),
        makeNote({ author: 'ai', content: 'Suggestion 1', status: 'pending' }),
        makeNote({ author: 'human', content: 'Note 2' }),
      ];
      const node = makeNode({
        type: 'compute/service',
        displayName: 'Annotated Service',
        notes,
      });
      const graph = makeGraph([node], []);

      const api = new TextApi(graph, registry);
      const ctx = api.getAIContext(node.id, 1);

      expect(ctx.selectedNode!.notes).toHaveLength(3);
      expect(ctx.selectedNode!.notes[0]).toEqual({ author: 'human', content: 'Note 1' });
      expect(ctx.selectedNode!.notes[1]).toEqual({ author: 'ai', content: 'Suggestion 1' });
      expect(ctx.selectedNode!.notes[2]).toEqual({ author: 'human', content: 'Note 2' });
    });
  });

  describe('empty graph', () => {
    it('should return metadata for empty architecture', () => {
      const graph = makeGraph([], [], 'Empty Architecture');

      const api = new TextApi(graph, registry);
      const ctx = api.getAIContext();

      expect(ctx.architectureName).toBe('Empty Architecture');
      expect(ctx.totalNodeCount).toBe(0);
      expect(ctx.totalEdgeCount).toBe(0);
      expect(ctx.selectedNode).toBeUndefined();
      expect(ctx.neighbors).toEqual([]);
    });
  });

  describe('default hops parameter', () => {
    it('should default to 1 hop when hops not specified', () => {
      const nodeA = makeNode({ type: 'compute/service', displayName: 'A' });
      const nodeB = makeNode({ type: 'compute/service', displayName: 'B' });
      const nodeC = makeNode({ type: 'data/database', displayName: 'C' });

      const edges = [
        makeEdge({ fromNode: nodeA.id, toNode: nodeB.id }),
        makeEdge({ fromNode: nodeB.id, toNode: nodeC.id }),
      ];

      const graph = makeGraph([nodeA, nodeB, nodeC], edges);
      const api = new TextApi(graph, registry);

      // Call without specifying hops — should default to 1
      const ctx = api.getAIContext(nodeA.id);

      expect(ctx.neighbors).toHaveLength(1);
      expect(ctx.neighbors[0].id).toBe(nodeB.id);
    });
  });
});
