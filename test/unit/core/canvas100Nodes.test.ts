/**
 * Tests: Canvas renders 100 nodes without lag (Feature #231)
 *
 * Verifies the graph engine, render API, and query functions
 * can handle 100 nodes efficiently. Tests creation, rendering,
 * querying, and manipulation of large graphs.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  createEmptyGraph,
  createNode,
  createEdge,
  addNode,
  addEdge,
  findNode,
  removeNode,
  updateNode,
  moveNode,
} from '@/core/graph/graphEngine';
import {
  countAllNodes,
  flattenNodes,
  getNodesAtLevel,
  getEdgesAtLevel,
  searchGraph,
} from '@/core/graph/graphQuery';
import { RegistryManager } from '@/core/registry/registryManager';
import { RenderApi } from '@/api/renderApi';
import type { ArchGraph, ArchNode } from '@/types/graph';

// Node types for variety
const NODE_TYPES = [
  'compute/service',
  'data/database',
  'data/cache',
  'messaging/event-bus',
  'messaging/message-queue',
  'compute/api-gateway',
  'network/load-balancer',
  'observability/logging',
  'observability/monitoring',
  'data/object-storage',
];

/**
 * Helper: create a graph with N nodes, arranged in a grid with edges.
 */
function createLargeGraph(nodeCount: number): { graph: ArchGraph; nodeIds: string[] } {
  let graph = createEmptyGraph(`${nodeCount}-Node Test`);
  const nodeIds: string[] = [];

  for (let i = 0; i < nodeCount; i++) {
    const type = NODE_TYPES[i % NODE_TYPES.length];
    const col = i % 10;
    const row = Math.floor(i / 10);

    const node = createNode({
      type,
      displayName: `Node ${i}`,
      position: { x: col * 350, y: row * 180, width: 280, height: 80 },
    });
    nodeIds.push(node.id);
    graph = addNode(graph, node);
  }

  // Add edges between consecutive services and databases
  for (let i = 0; i < nodeCount - 1; i += 2) {
    const edge = createEdge({
      fromNode: nodeIds[i],
      toNode: nodeIds[i + 1],
      type: 'sync',
      label: `edge-${i}`,
    });
    graph = addEdge(graph, edge);
  }

  return { graph, nodeIds };
}

describe('Canvas renders 100 nodes without lag', () => {
  let graph100: ArchGraph;
  let nodeIds: string[];

  beforeEach(() => {
    const result = createLargeGraph(100);
    graph100 = result.graph;
    nodeIds = result.nodeIds;
  });

  // ========================================================
  // 1. Graph creation with 100 nodes
  // ========================================================

  describe('Graph creation with 100 nodes', () => {
    it('creates a graph with exactly 100 nodes', () => {
      expect(graph100.nodes).toHaveLength(100);
    });

    it('countAllNodes returns 100', () => {
      expect(countAllNodes(graph100)).toBe(100);
    });

    it('flattenNodes returns 100 nodes', () => {
      const flat = flattenNodes(graph100.nodes);
      expect(flat).toHaveLength(100);
    });

    it('creates 50 edges for 100 nodes', () => {
      expect(graph100.edges).toHaveLength(50);
    });

    it('each node has unique id', () => {
      const ids = new Set(graph100.nodes.map((n) => n.id));
      expect(ids.size).toBe(100);
    });

    it('each node has correct position in grid layout', () => {
      for (let i = 0; i < 100; i++) {
        const node = graph100.nodes[i];
        const col = i % 10;
        const row = Math.floor(i / 10);
        expect(node.position.x).toBe(col * 350);
        expect(node.position.y).toBe(row * 180);
      }
    });

    it('each node has a valid type from the rotation list', () => {
      for (let i = 0; i < 100; i++) {
        expect(NODE_TYPES).toContain(graph100.nodes[i].type);
      }
    });

    it('all 10 node types are represented', () => {
      const types = new Set(graph100.nodes.map((n) => n.type));
      expect(types.size).toBe(NODE_TYPES.length);
    });
  });

  // ========================================================
  // 2. RenderApi transforms 100 nodes
  // ========================================================

  describe('RenderApi transforms 100 nodes to canvas elements', () => {
    let renderApi: RenderApi;

    beforeEach(() => {
      const registry = new RegistryManager();
      registry.initialize();
      renderApi = new RenderApi(registry);
    });

    it('renders all 100 nodes to CanvasNodes', () => {
      const { nodes } = renderApi.render(graph100, []);
      expect(nodes).toHaveLength(100);
    });

    it('renders all 50 edges to CanvasEdges', () => {
      const { edges } = renderApi.render(graph100, []);
      expect(edges).toHaveLength(50);
    });

    it('each CanvasNode has valid id and position', () => {
      const { nodes } = renderApi.render(graph100, []);
      for (const node of nodes) {
        expect(node.id).toBeTruthy();
        expect(typeof node.position.x).toBe('number');
        expect(typeof node.position.y).toBe('number');
      }
    });

    it('each CanvasNode has data with displayName', () => {
      const { nodes } = renderApi.render(graph100, []);
      for (const node of nodes) {
        expect(node.data.displayName).toBeTruthy();
      }
    });

    it('each CanvasNode has a recognized node type', () => {
      const validTypes = ['service', 'database', 'cache', 'generic', 'queue', 'gateway'];
      const { nodes } = renderApi.render(graph100, []);
      for (const node of nodes) {
        expect(validTypes).toContain(node.type);
      }
    });

    it('render completes within 100ms for 100 nodes', () => {
      const start = performance.now();
      renderApi.render(graph100, []);
      const elapsed = performance.now() - start;
      expect(elapsed).toBeLessThan(100);
    });
  });

  // ========================================================
  // 3. Graph queries remain performant
  // ========================================================

  describe('Graph queries with 100 nodes', () => {
    it('getNodesAtLevel returns all 100 root nodes', () => {
      const nodes = getNodesAtLevel(graph100, []);
      expect(nodes).toHaveLength(100);
    });

    it('getEdgesAtLevel returns all 50 edges at root level', () => {
      const edges = getEdgesAtLevel(graph100, []);
      expect(edges).toHaveLength(50);
    });

    it('findNode locates any node by id', () => {
      // Find first, middle, and last node
      const first = findNode(graph100, nodeIds[0]);
      const middle = findNode(graph100, nodeIds[49]);
      const last = findNode(graph100, nodeIds[99]);

      expect(first).toBeDefined();
      expect(first!.displayName).toBe('Node 0');
      expect(middle).toBeDefined();
      expect(middle!.displayName).toBe('Node 49');
      expect(last).toBeDefined();
      expect(last!.displayName).toBe('Node 99');
    });

    it('searchGraph finds matching nodes across 100 nodes', () => {
      const results = searchGraph(graph100, 'Node 5');
      // Should match "Node 5", "Node 50"-"Node 59"
      expect(results.length).toBeGreaterThan(0);
      expect(results.some((r) => r.displayName === 'Node 5')).toBe(true);
    });

    it('searchGraph completes within 50ms for 100 nodes', () => {
      const start = performance.now();
      searchGraph(graph100, 'Node');
      const elapsed = performance.now() - start;
      expect(elapsed).toBeLessThan(50);
    });

    it('flattenNodes completes within 10ms for 100 nodes', () => {
      const start = performance.now();
      flattenNodes(graph100.nodes);
      const elapsed = performance.now() - start;
      expect(elapsed).toBeLessThan(10);
    });
  });

  // ========================================================
  // 4. Graph mutations on 100-node graph
  // ========================================================

  describe('Graph mutations with 100 nodes', () => {
    it('adds a 101st node to the graph', () => {
      const newNode = createNode({
        type: 'compute/service',
        displayName: 'Node 100',
        position: { x: 0, y: 1800 },
      });
      const updated = addNode(graph100, newNode);
      expect(updated.nodes).toHaveLength(101);
      expect(countAllNodes(updated)).toBe(101);
    });

    it('removes a node from 100-node graph', () => {
      const updated = removeNode(graph100, nodeIds[50]);
      expect(updated.nodes).toHaveLength(99);
      expect(countAllNodes(updated)).toBe(99);
    });

    it('updates a node in 100-node graph', () => {
      const updated = updateNode(graph100, nodeIds[75], {
        displayName: 'Updated Node 75',
      });
      const node = findNode(updated, nodeIds[75]);
      expect(node!.displayName).toBe('Updated Node 75');
    });

    it('moves a node in 100-node graph', () => {
      const updated = moveNode(graph100, nodeIds[25], 999, 888);
      const node = findNode(updated, nodeIds[25]);
      expect(node!.position.x).toBe(999);
      expect(node!.position.y).toBe(888);
    });

    it('removing a node also removes its connected edges', () => {
      // Node at index 0 has an edge to node at index 1
      const edgesBefore = graph100.edges.length;
      const updated = removeNode(graph100, nodeIds[0]);
      expect(updated.edges.length).toBeLessThan(edgesBefore);
    });

    it('add node completes within 10ms on 100-node graph', () => {
      const newNode = createNode({
        type: 'compute/service',
        displayName: 'Perf Test Node',
      });
      const start = performance.now();
      addNode(graph100, newNode);
      const elapsed = performance.now() - start;
      expect(elapsed).toBeLessThan(10);
    });

    it('remove node completes within 50ms on 100-node graph', () => {
      const start = performance.now();
      removeNode(graph100, nodeIds[50]);
      const elapsed = performance.now() - start;
      expect(elapsed).toBeLessThan(50);
    });

    it('find node completes within 10ms on 100-node graph', () => {
      const start = performance.now();
      findNode(graph100, nodeIds[99]);
      const elapsed = performance.now() - start;
      expect(elapsed).toBeLessThan(10);
    });
  });

  // ========================================================
  // 5. Scaling to larger numbers (200, 500)
  // ========================================================

  describe('Scaling beyond 100 nodes', () => {
    it('creates and counts 200 nodes', () => {
      const { graph } = createLargeGraph(200);
      expect(countAllNodes(graph)).toBe(200);
    });

    it('RenderApi handles 200 nodes', () => {
      const registry = new RegistryManager();
      registry.initialize();
      const renderApi = new RenderApi(registry);

      const { graph } = createLargeGraph(200);
      const { nodes } = renderApi.render(graph, []);
      expect(nodes).toHaveLength(200);
    });

    it('creates and counts 500 nodes', () => {
      const { graph } = createLargeGraph(500);
      expect(countAllNodes(graph)).toBe(500);
    });

    it('render 500 nodes completes within 200ms', () => {
      const registry = new RegistryManager();
      registry.initialize();
      const renderApi = new RenderApi(registry);

      const { graph } = createLargeGraph(500);
      const start = performance.now();
      renderApi.render(graph, []);
      const elapsed = performance.now() - start;
      expect(elapsed).toBeLessThan(200);
    });
  });

  // ========================================================
  // 6. Concurrent operations on large graph
  // ========================================================

  describe('Concurrent-style operations on 100 nodes', () => {
    it('multiple sequential mutations maintain consistency', () => {
      let graph = graph100;

      // Add 5 nodes
      for (let i = 0; i < 5; i++) {
        const node = createNode({
          type: 'compute/service',
          displayName: `New Node ${i}`,
        });
        graph = addNode(graph, node);
      }

      expect(countAllNodes(graph)).toBe(105);

      // Remove 3 nodes
      graph = removeNode(graph, nodeIds[0]);
      graph = removeNode(graph, nodeIds[10]);
      graph = removeNode(graph, nodeIds[20]);

      expect(countAllNodes(graph)).toBe(102);
    });

    it('render after mutations produces correct count', () => {
      const registry = new RegistryManager();
      registry.initialize();
      const renderApi = new RenderApi(registry);

      let graph = graph100;
      // Remove 10 nodes
      for (let i = 0; i < 10; i++) {
        graph = removeNode(graph, nodeIds[i * 10]);
      }

      const { nodes } = renderApi.render(graph, []);
      expect(nodes).toHaveLength(90);
    });
  });
});
