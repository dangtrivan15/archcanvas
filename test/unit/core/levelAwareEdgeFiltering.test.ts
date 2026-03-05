/**
 * Feature #99: Level-aware filtering shows correct edges at each level
 *
 * Only edges between nodes at the current level are shown.
 *
 * Steps verified:
 * 1. Create root A, B with edge A->B. A has children C, D with edge C->D
 * 2. At root level, verify A->B visible, C->D not visible
 * 3. Drill into A, verify C->D visible, A->B not visible
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { RenderApi } from '@/api/renderApi';
import { RegistryManager } from '@/core/registry/registryManager';
import {
  createEmptyGraph,
  createNode,
  createEdge,
  addNode,
  addEdge,
  addChildNode,
} from '@/core/graph/graphEngine';
import { getEdgesAtLevel } from '@/core/graph/graphQuery';
import type { ArchGraph } from '@/types/graph';

describe('Feature #99: Level-aware filtering shows correct edges at each level', () => {
  let graph: ArchGraph;
  let renderApi: RenderApi;
  let nodeAId: string;
  let nodeBId: string;
  let nodeCId: string;
  let nodeDId: string;

  beforeAll(() => {
    const registry = new RegistryManager();
    registry.initialize();
    renderApi = new RenderApi(registry);

    // Step 1: Create root A, B with edge A->B. A has children C, D with edge C->D
    graph = createEmptyGraph('Level Edge Filter Test');

    const nodeA = createNode({
      type: 'compute/service',
      displayName: 'Node A',
      position: { x: 100, y: 200 },
    });
    const nodeB = createNode({
      type: 'compute/service',
      displayName: 'Node B',
      position: { x: 400, y: 200 },
    });

    nodeAId = nodeA.id;
    nodeBId = nodeB.id;

    graph = addNode(graph, nodeA);
    graph = addNode(graph, nodeB);

    // Root-level edge: A -> B
    const edgeAB = createEdge({
      fromNode: nodeA.id,
      toNode: nodeB.id,
      type: 'sync',
      label: 'REST',
    });
    graph = addEdge(graph, edgeAB);

    // A has children C and D
    const nodeC = createNode({
      type: 'compute/service',
      displayName: 'Node C',
      position: { x: 50, y: 50 },
    });
    const nodeD = createNode({
      type: 'data/database',
      displayName: 'Node D',
      position: { x: 300, y: 50 },
    });

    nodeCId = nodeC.id;
    nodeDId = nodeD.id;

    graph = addChildNode(graph, nodeA.id, nodeC);
    graph = addChildNode(graph, nodeA.id, nodeD);

    // Child-level edge: C -> D (both children of A)
    const edgeCD = createEdge({
      fromNode: nodeC.id,
      toNode: nodeD.id,
      type: 'async',
      label: 'Events',
    });
    graph = addEdge(graph, edgeCD);
  });

  describe('Total edges in graph', () => {
    it('has 2 edges total in the graph', () => {
      expect(graph.edges).toHaveLength(2);
    });

    it('has edge A->B', () => {
      const abEdge = graph.edges.find((e) => e.fromNode === nodeAId && e.toNode === nodeBId);
      expect(abEdge).toBeDefined();
      expect(abEdge!.label).toBe('REST');
    });

    it('has edge C->D', () => {
      const cdEdge = graph.edges.find((e) => e.fromNode === nodeCId && e.toNode === nodeDId);
      expect(cdEdge).toBeDefined();
      expect(cdEdge!.label).toBe('Events');
    });
  });

  describe('At root level (empty path)', () => {
    it('returns exactly 1 edge at root level', () => {
      const edges = getEdgesAtLevel(graph, []);
      expect(edges).toHaveLength(1);
    });

    it('root edge is A->B', () => {
      const edges = getEdgesAtLevel(graph, []);
      expect(edges[0].fromNode).toBe(nodeAId);
      expect(edges[0].toNode).toBe(nodeBId);
    });

    it('root edge has label REST', () => {
      const edges = getEdgesAtLevel(graph, []);
      expect(edges[0].label).toBe('REST');
    });

    it('C->D edge is NOT visible at root level', () => {
      const edges = getEdgesAtLevel(graph, []);
      const cdEdge = edges.find((e) => e.fromNode === nodeCId && e.toNode === nodeDId);
      expect(cdEdge).toBeUndefined();
    });

    it('RenderApi returns 1 edge at root level', () => {
      const result = renderApi.render(graph, []);
      expect(result.edges).toHaveLength(1);
      expect(result.edges[0].source).toBe(nodeAId);
      expect(result.edges[0].target).toBe(nodeBId);
    });
  });

  describe('Drilled into A (path = [A.id])', () => {
    it('returns exactly 1 edge when drilled into A', () => {
      const edges = getEdgesAtLevel(graph, [nodeAId]);
      expect(edges).toHaveLength(1);
    });

    it('child edge is C->D', () => {
      const edges = getEdgesAtLevel(graph, [nodeAId]);
      expect(edges[0].fromNode).toBe(nodeCId);
      expect(edges[0].toNode).toBe(nodeDId);
    });

    it('child edge has label Events', () => {
      const edges = getEdgesAtLevel(graph, [nodeAId]);
      expect(edges[0].label).toBe('Events');
    });

    it('A->B edge is NOT visible when drilled into A', () => {
      const edges = getEdgesAtLevel(graph, [nodeAId]);
      const abEdge = edges.find((e) => e.fromNode === nodeAId && e.toNode === nodeBId);
      expect(abEdge).toBeUndefined();
    });

    it('RenderApi returns 1 edge when drilled into A', () => {
      const result = renderApi.render(graph, [nodeAId]);
      expect(result.edges).toHaveLength(1);
      expect(result.edges[0].source).toBe(nodeCId);
      expect(result.edges[0].target).toBe(nodeDId);
    });
  });

  describe('Edge cases', () => {
    it('returns empty edges for invalid path', () => {
      const edges = getEdgesAtLevel(graph, ['nonexistent']);
      expect(edges).toHaveLength(0);
    });

    it('returns empty edges for level with no edges (if C has children)', () => {
      // C has no children, so drilling into C gives empty nodes and edges
      const edges = getEdgesAtLevel(graph, [nodeAId, nodeCId]);
      expect(edges).toHaveLength(0);
    });

    it('edge data includes archEdgeId in canvas edge', () => {
      const result = renderApi.render(graph, []);
      const edge = result.edges[0];
      expect(edge.data).toBeDefined();
      expect(edge.data!.archEdgeId).toBe(edge.id);
    });

    it('edge data includes edgeType in canvas edge', () => {
      const result = renderApi.render(graph, []);
      const edge = result.edges[0];
      expect(edge.data!.edgeType).toBe('sync');
    });

    it('edge label is rendered on canvas edge', () => {
      const result = renderApi.render(graph, []);
      const edge = result.edges[0];
      expect(edge.label).toBe('REST');
    });
  });
});
