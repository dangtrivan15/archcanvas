/**
 * Feature #168: AI context builder includes N-hop neighbor context.
 * Verifies that AI context includes nodes within N hops of the selected node
 * and correctly excludes nodes beyond the specified depth.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { TextApi } from '@/api/textApi';
import { RegistryManager } from '@/core/registry/registryManager';
import type { ArchGraph, ArchNode, ArchEdge } from '@/types/graph';
import { generateId } from '@/utils/idGenerator';

// ── helpers ──────────────────────────────────────────────────────────

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

describe('AI context builder N-hop context - Feature #168', () => {
  let registry: RegistryManager;

  beforeAll(() => {
    registry = new RegistryManager();
    registry.initialize();
  });

  describe('chain A -> B -> C -> D with depth=2', () => {
    let nodeA: ArchNode;
    let nodeB: ArchNode;
    let nodeC: ArchNode;
    let nodeD: ArchNode;
    let edgeAB: ArchEdge;
    let edgeBC: ArchEdge;
    let edgeCD: ArchEdge;
    let graph: ArchGraph;
    let api: TextApi;

    beforeAll(() => {
      nodeA = makeNode({
        type: 'compute/api-gateway',
        displayName: 'Gateway',
        args: { port: '443', protocol: 'https' },
        codeRefs: [{ path: 'src/gateway.ts', role: 'source' }],
      });
      nodeB = makeNode({
        type: 'compute/service',
        displayName: 'Auth Service',
        args: { port: '3001' },
      });
      nodeC = makeNode({
        type: 'data/database',
        displayName: 'User DB',
        args: { engine: 'postgres', version: '15' },
      });
      nodeD = makeNode({
        type: 'data/cache',
        displayName: 'Session Cache',
        args: { engine: 'redis' },
      });

      edgeAB = makeEdge({
        fromNode: nodeA.id,
        toNode: nodeB.id,
        type: 'sync',
        label: 'authenticate',
      });
      edgeBC = makeEdge({
        fromNode: nodeB.id,
        toNode: nodeC.id,
        type: 'sync',
        label: 'query-user',
      });
      edgeCD = makeEdge({
        fromNode: nodeC.id,
        toNode: nodeD.id,
        type: 'data-flow',
        label: 'cache-sync',
      });

      graph = makeGraph([nodeA, nodeB, nodeC, nodeD], [edgeAB, edgeBC, edgeCD]);
      api = new TextApi(graph, registry);
    });

    // Step 3: Verify A's details are included
    it('should include A (Gateway) as the selected node with full details', () => {
      const ctx = api.getAIContext(nodeA.id, 2);

      expect(ctx.selectedNode).toBeDefined();
      expect(ctx.selectedNode!.id).toBe(nodeA.id);
      expect(ctx.selectedNode!.type).toBe('compute/api-gateway');
      expect(ctx.selectedNode!.displayName).toBe('Gateway');
      expect(ctx.selectedNode!.args).toEqual({ port: '443', protocol: 'https' });
      expect(ctx.selectedNode!.codeRefs).toHaveLength(1);
      expect(ctx.selectedNode!.codeRefs[0].path).toBe('src/gateway.ts');
    });

    // Step 4: Verify B and C are included
    it('should include B (Auth Service) within 2 hops', () => {
      const ctx = api.getAIContext(nodeA.id, 2);

      const hop1 = ctx.neighbors.find((n) => n.id === nodeB.id);
      expect(hop1).toBeDefined();
      expect(hop1!.type).toBe('compute/service');
      expect(hop1!.displayName).toBe('Auth Service');
    });

    it('should include C (User DB) within 2 hops', () => {
      const ctx = api.getAIContext(nodeA.id, 2);

      const hop2 = ctx.neighbors.find((n) => n.id === nodeC.id);
      expect(hop2).toBeDefined();
      expect(hop2!.type).toBe('data/database');
      expect(hop2!.displayName).toBe('User DB');
    });

    it('should have exactly 2 nodes in the result for depth=2', () => {
      const ctx = api.getAIContext(nodeA.id, 2);
      expect(ctx.neighbors).toHaveLength(2);
    });

    // Step 5: Verify D is NOT included (beyond depth 2)
    it('should NOT include D (Session Cache) which is 3 hops away', () => {
      const ctx = api.getAIContext(nodeA.id, 2);

      const neighborIds = ctx.neighbors.map((n) => n.id);
      expect(neighborIds).not.toContain(nodeD.id);
    });

    // Step 6: Verify edge information between nodes is included
    it('should include edge type for hop-1 node (A->B sync)', () => {
      const ctx = api.getAIContext(nodeA.id, 2);

      const bNeighbor = ctx.neighbors.find((n) => n.id === nodeB.id);
      expect(bNeighbor!.connectionType).toBe('sync');
    });

    it('should include edge type for hop-2 node', () => {
      const ctx = api.getAIContext(nodeA.id, 2);

      // C is at hop 2 - the connectionType should reflect the edge between A and C
      // Since there is no direct edge, it comes from B->C edge path
      // The implementation finds the edge connecting the selected node to the neighbor,
      // or falls back to 'unknown' if no direct edge
      const cNeighbor = ctx.neighbors.find((n) => n.id === nodeC.id);
      expect(cNeighbor).toBeDefined();
      // C has no direct edge to A, so connectionType depends on implementation
      expect(typeof cNeighbor!.connectionType).toBe('string');
    });

    it('should include architecture metadata', () => {
      const ctx = api.getAIContext(nodeA.id, 2);

      expect(ctx.architectureName).toBe('Test Architecture');
      expect(ctx.totalNodeCount).toBe(4);
      expect(ctx.totalEdgeCount).toBe(3);
    });
  });

  describe('depth=3 includes all 4 nodes in chain', () => {
    it('should include B, C, and D when querying A with depth=3', () => {
      const nodeA = makeNode({ type: 'compute/service', displayName: 'A' });
      const nodeB = makeNode({ type: 'compute/service', displayName: 'B' });
      const nodeC = makeNode({ type: 'data/database', displayName: 'C' });
      const nodeD = makeNode({ type: 'data/cache', displayName: 'D' });

      const edges = [
        makeEdge({ fromNode: nodeA.id, toNode: nodeB.id }),
        makeEdge({ fromNode: nodeB.id, toNode: nodeC.id }),
        makeEdge({ fromNode: nodeC.id, toNode: nodeD.id }),
      ];

      const graph = makeGraph([nodeA, nodeB, nodeC, nodeD], edges);
      const api = new TextApi(graph, registry);
      const ctx = api.getAIContext(nodeA.id, 3);

      expect(ctx.neighbors).toHaveLength(3);
      const ids = ctx.neighbors.map((n) => n.id);
      expect(ids).toContain(nodeB.id);
      expect(ids).toContain(nodeC.id);
      expect(ids).toContain(nodeD.id);
    });
  });

  describe('depth=1 only includes direct links', () => {
    it('should only include B when querying A with depth=1 in 4-node chain', () => {
      const nodeA = makeNode({ type: 'compute/service', displayName: 'A' });
      const nodeB = makeNode({ type: 'compute/service', displayName: 'B' });
      const nodeC = makeNode({ type: 'data/database', displayName: 'C' });
      const nodeD = makeNode({ type: 'data/cache', displayName: 'D' });

      const edges = [
        makeEdge({ fromNode: nodeA.id, toNode: nodeB.id }),
        makeEdge({ fromNode: nodeB.id, toNode: nodeC.id }),
        makeEdge({ fromNode: nodeC.id, toNode: nodeD.id }),
      ];

      const graph = makeGraph([nodeA, nodeB, nodeC, nodeD], edges);
      const api = new TextApi(graph, registry);
      const ctx = api.getAIContext(nodeA.id, 1);

      expect(ctx.neighbors).toHaveLength(1);
      expect(ctx.neighbors[0].id).toBe(nodeB.id);
    });
  });

  describe('querying from middle of chain', () => {
    it('should find nodes in both directions from B with depth=1', () => {
      const nodeA = makeNode({ type: 'compute/service', displayName: 'A' });
      const nodeB = makeNode({ type: 'compute/service', displayName: 'B' });
      const nodeC = makeNode({ type: 'data/database', displayName: 'C' });
      const nodeD = makeNode({ type: 'data/cache', displayName: 'D' });

      const edges = [
        makeEdge({ fromNode: nodeA.id, toNode: nodeB.id }),
        makeEdge({ fromNode: nodeB.id, toNode: nodeC.id }),
        makeEdge({ fromNode: nodeC.id, toNode: nodeD.id }),
      ];

      const graph = makeGraph([nodeA, nodeB, nodeC, nodeD], edges);
      const api = new TextApi(graph, registry);
      const ctx = api.getAIContext(nodeB.id, 1);

      // B has edges to A and C
      expect(ctx.neighbors).toHaveLength(2);
      const ids = ctx.neighbors.map((n) => n.id);
      expect(ids).toContain(nodeA.id);
      expect(ids).toContain(nodeC.id);
    });

    it('should find all other nodes from B with depth=2', () => {
      const nodeA = makeNode({ type: 'compute/service', displayName: 'A' });
      const nodeB = makeNode({ type: 'compute/service', displayName: 'B' });
      const nodeC = makeNode({ type: 'data/database', displayName: 'C' });
      const nodeD = makeNode({ type: 'data/cache', displayName: 'D' });

      const edges = [
        makeEdge({ fromNode: nodeA.id, toNode: nodeB.id }),
        makeEdge({ fromNode: nodeB.id, toNode: nodeC.id }),
        makeEdge({ fromNode: nodeC.id, toNode: nodeD.id }),
      ];

      const graph = makeGraph([nodeA, nodeB, nodeC, nodeD], edges);
      const api = new TextApi(graph, registry);
      const ctx = api.getAIContext(nodeB.id, 2);

      // B: 1-hop = A, C; 2-hop adds D
      expect(ctx.neighbors).toHaveLength(3);
      const ids = ctx.neighbors.map((n) => n.id);
      expect(ids).toContain(nodeA.id);
      expect(ids).toContain(nodeC.id);
      expect(ids).toContain(nodeD.id);
    });
  });

  describe('branching graph topology', () => {
    it('should handle branching paths within depth correctly', () => {
      // A -> B -> C
      // A -> D -> E
      const nodeA = makeNode({ type: 'compute/service', displayName: 'Hub' });
      const nodeB = makeNode({ type: 'compute/service', displayName: 'Branch1-1' });
      const nodeC = makeNode({ type: 'data/database', displayName: 'Branch1-2' });
      const nodeD = makeNode({ type: 'compute/service', displayName: 'Branch2-1' });
      const nodeE = makeNode({ type: 'data/cache', displayName: 'Branch2-2' });

      const edges = [
        makeEdge({ fromNode: nodeA.id, toNode: nodeB.id }),
        makeEdge({ fromNode: nodeB.id, toNode: nodeC.id }),
        makeEdge({ fromNode: nodeA.id, toNode: nodeD.id }),
        makeEdge({ fromNode: nodeD.id, toNode: nodeE.id }),
      ];

      const graph = makeGraph([nodeA, nodeB, nodeC, nodeD, nodeE], edges);
      const api = new TextApi(graph, registry);

      // depth=1: only B and D (direct)
      const ctx1 = api.getAIContext(nodeA.id, 1);
      expect(ctx1.neighbors).toHaveLength(2);

      // depth=2: B, C, D, E (all reachable within 2 hops)
      const ctx2 = api.getAIContext(nodeA.id, 2);
      expect(ctx2.neighbors).toHaveLength(4);
      const ids = ctx2.neighbors.map((n) => n.id);
      expect(ids).toContain(nodeB.id);
      expect(ids).toContain(nodeC.id);
      expect(ids).toContain(nodeD.id);
      expect(ids).toContain(nodeE.id);
    });
  });
});
