/**
 * Feature #98: Level-aware filtering shows correct nodes at each level
 *
 * Only nodes at the current navigation level are visible.
 *
 * Steps verified:
 * 1. Create root nodes A, B, C. A has children D, E. D has child F
 * 2. At root level, verify A, B, C visible. D, E, F not visible
 * 3. Zoom into A, verify D, E visible. A, B, C, F not visible
 * 4. Zoom into D, verify F visible. D, E not visible
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { RenderApi } from '@/api/renderApi';
import { RegistryManager } from '@/core/registry/registryManager';
import { createEmptyGraph, createNode, addNode, addChildNode } from '@/core/graph/graphEngine';
import { getNodesAtLevel } from '@/core/graph/graphQuery';
import type { ArchGraph } from '@/types/graph';

describe('Feature #98: Level-aware filtering shows correct nodes at each level', () => {
  let graph: ArchGraph;
  let renderApi: RenderApi;

  beforeAll(() => {
    const registry = new RegistryManager();
    registry.initialize();
    renderApi = new RenderApi(registry);

    // Step 1: Create root nodes A, B, C. A has children D, E. D has child F
    graph = createEmptyGraph('Level Filter Test');

    const nodeA = createNode({
      type: 'compute/service',
      displayName: 'Node A',
      position: { x: 100, y: 200 },
    });
    const nodeB = createNode({
      type: 'compute/service',
      displayName: 'Node B',
      position: { x: 400, y: 100 },
    });
    const nodeC = createNode({
      type: 'data/database',
      displayName: 'Node C',
      position: { x: 400, y: 300 },
    });

    graph = addNode(graph, nodeA);
    graph = addNode(graph, nodeB);
    graph = addNode(graph, nodeC);

    // A has children D and E
    const nodeD = createNode({
      type: 'compute/service',
      displayName: 'Node D',
      position: { x: 50, y: 50 },
    });
    const nodeE = createNode({
      type: 'data/database',
      displayName: 'Node E',
      position: { x: 300, y: 50 },
    });

    graph = addChildNode(graph, nodeA.id, nodeD);
    graph = addChildNode(graph, nodeA.id, nodeE);

    // D has child F
    const nodeF = createNode({
      type: 'compute/function',
      displayName: 'Node F',
      position: { x: 50, y: 50 },
    });

    graph = addChildNode(graph, nodeD.id, nodeF);
  });

  describe('At root level (empty navigation path)', () => {
    it('returns exactly 3 nodes at root level', () => {
      const nodes = getNodesAtLevel(graph, []);
      expect(nodes).toHaveLength(3);
    });

    it('includes Node A at root level', () => {
      const nodes = getNodesAtLevel(graph, []);
      const names = nodes.map((n) => n.displayName);
      expect(names).toContain('Node A');
    });

    it('includes Node B at root level', () => {
      const nodes = getNodesAtLevel(graph, []);
      const names = nodes.map((n) => n.displayName);
      expect(names).toContain('Node B');
    });

    it('includes Node C at root level', () => {
      const nodes = getNodesAtLevel(graph, []);
      const names = nodes.map((n) => n.displayName);
      expect(names).toContain('Node C');
    });

    it('does NOT include child nodes D, E, F at root level', () => {
      const nodes = getNodesAtLevel(graph, []);
      const names = nodes.map((n) => n.displayName);
      expect(names).not.toContain('Node D');
      expect(names).not.toContain('Node E');
      expect(names).not.toContain('Node F');
    });

    it('renders correct canvas nodes via RenderApi', () => {
      const result = renderApi.render(graph, []);
      expect(result.nodes).toHaveLength(3);
      const names = result.nodes.map((n) => n.data.displayName);
      expect(names).toContain('Node A');
      expect(names).toContain('Node B');
      expect(names).toContain('Node C');
    });
  });

  describe('Zoomed into A (navigation path = [A.id])', () => {
    it('returns exactly 2 nodes inside A', () => {
      const nodeA = graph.nodes.find((n) => n.displayName === 'Node A')!;
      const nodes = getNodesAtLevel(graph, [nodeA.id]);
      expect(nodes).toHaveLength(2);
    });

    it('includes Node D inside A', () => {
      const nodeA = graph.nodes.find((n) => n.displayName === 'Node A')!;
      const nodes = getNodesAtLevel(graph, [nodeA.id]);
      const names = nodes.map((n) => n.displayName);
      expect(names).toContain('Node D');
    });

    it('includes Node E inside A', () => {
      const nodeA = graph.nodes.find((n) => n.displayName === 'Node A')!;
      const nodes = getNodesAtLevel(graph, [nodeA.id]);
      const names = nodes.map((n) => n.displayName);
      expect(names).toContain('Node E');
    });

    it('does NOT include root nodes A, B, C when zoomed into A', () => {
      const nodeA = graph.nodes.find((n) => n.displayName === 'Node A')!;
      const nodes = getNodesAtLevel(graph, [nodeA.id]);
      const names = nodes.map((n) => n.displayName);
      expect(names).not.toContain('Node A');
      expect(names).not.toContain('Node B');
      expect(names).not.toContain('Node C');
    });

    it('does NOT include grandchild node F when zoomed into A', () => {
      const nodeA = graph.nodes.find((n) => n.displayName === 'Node A')!;
      const nodes = getNodesAtLevel(graph, [nodeA.id]);
      const names = nodes.map((n) => n.displayName);
      expect(names).not.toContain('Node F');
    });

    it('renders correct canvas nodes via RenderApi when zoomed into A', () => {
      const nodeA = graph.nodes.find((n) => n.displayName === 'Node A')!;
      const result = renderApi.render(graph, [nodeA.id]);
      expect(result.nodes).toHaveLength(2);
      const names = result.nodes.map((n) => n.data.displayName);
      expect(names).toContain('Node D');
      expect(names).toContain('Node E');
    });
  });

  describe('Zoomed into D (navigation path = [A.id, D.id])', () => {
    it('returns exactly 1 node inside D', () => {
      const nodeA = graph.nodes.find((n) => n.displayName === 'Node A')!;
      const nodeD = nodeA.children.find((n) => n.displayName === 'Node D')!;
      const nodes = getNodesAtLevel(graph, [nodeA.id, nodeD.id]);
      expect(nodes).toHaveLength(1);
    });

    it('includes Node F inside D', () => {
      const nodeA = graph.nodes.find((n) => n.displayName === 'Node A')!;
      const nodeD = nodeA.children.find((n) => n.displayName === 'Node D')!;
      const nodes = getNodesAtLevel(graph, [nodeA.id, nodeD.id]);
      expect(nodes[0].displayName).toBe('Node F');
    });

    it('does NOT include parent nodes D, E when zoomed into D', () => {
      const nodeA = graph.nodes.find((n) => n.displayName === 'Node A')!;
      const nodeD = nodeA.children.find((n) => n.displayName === 'Node D')!;
      const nodes = getNodesAtLevel(graph, [nodeA.id, nodeD.id]);
      const names = nodes.map((n) => n.displayName);
      expect(names).not.toContain('Node D');
      expect(names).not.toContain('Node E');
    });

    it('renders correct canvas nodes via RenderApi when zoomed into D', () => {
      const nodeA = graph.nodes.find((n) => n.displayName === 'Node A')!;
      const nodeD = nodeA.children.find((n) => n.displayName === 'Node D')!;
      const result = renderApi.render(graph, [nodeA.id, nodeD.id]);
      expect(result.nodes).toHaveLength(1);
      expect(result.nodes[0].data.displayName).toBe('Node F');
    });
  });

  describe('Edge cases', () => {
    it('returns empty array for invalid navigation path', () => {
      const nodes = getNodesAtLevel(graph, ['nonexistent-id']);
      expect(nodes).toHaveLength(0);
    });

    it('Node A has hasChildren=true in canvas data', () => {
      const result = renderApi.render(graph, []);
      const nodeA = result.nodes.find((n) => n.data.displayName === 'Node A')!;
      expect(nodeA.data.hasChildren).toBe(true);
    });

    it('Node B has hasChildren=false in canvas data', () => {
      const result = renderApi.render(graph, []);
      const nodeB = result.nodes.find((n) => n.data.displayName === 'Node B')!;
      expect(nodeB.data.hasChildren).toBe(false);
    });
  });
});
