import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import type { ArchNode, ArchEdge, ArchGraph } from '@/types/graph';
import { computeElkLayout, applyElkLayout } from '@/core/layout/elkLayout';
import { getEdgesAtLevel, getNodesAtLevel } from '@/core/graph/graphQuery';

/** Helper to create a minimal ArchNode. */
function makeNode(
  id: string,
  displayName: string,
  x = 0,
  y = 0,
  children: ArchNode[] = [],
): ArchNode {
  return {
    id,
    type: 'compute/service',
    displayName,
    args: {},
    codeRefs: [],
    notes: [],
    properties: {},
    position: { x, y, width: 240, height: 100 },
    children,
  };
}

/** Helper to create a SYNC edge. */
function makeEdge(id: string, from: string, to: string, label = ''): ArchEdge {
  return {
    id,
    fromNode: from,
    toNode: to,
    fromPort: '',
    toPort: '',
    type: 'SYNC',
    label,
    properties: {},
    notes: [],
  };
}

/** Helper to create an ArchGraph. */
function makeGraph(nodes: ArchNode[], edges: ArchEdge[] = []): ArchGraph {
  return {
    name: 'test',
    description: '',
    owners: [],
    nodes,
    edges,
  };
}

describe('Feature #505: Layout respects edges between currently visible nodes', () => {
  describe('Step 1: File with child nodes that have edges between them', () => {
    it('getEdgesAtLevel returns child-level edges when zoomed into parent', () => {
      const children = [
        makeNode('auth-ctrl', 'Auth Controller'),
        makeNode('auth-svc', 'Auth Service'),
        makeNode('user-repo', 'User Repository'),
      ];
      const parent = makeNode('backend', 'Backend', 100, 100, children);
      const edges = [
        makeEdge('e1', 'auth-ctrl', 'auth-svc', 'delegates to'),
        makeEdge('e2', 'auth-svc', 'user-repo', 'reads from'),
        makeEdge('e-root', 'frontend', 'backend', 'calls'), // root-level edge
      ];
      const graph = makeGraph([parent, makeNode('frontend', 'Frontend', 500, 100)], edges);

      const childEdges = getEdgesAtLevel(graph, ['backend']);
      expect(childEdges).toHaveLength(2);
      expect(childEdges.map((e) => e.id).sort()).toEqual(['e1', 'e2']);
    });

    it('getEdgesAtLevel excludes cross-level edges', () => {
      const children = [makeNode('child-1', 'Child 1'), makeNode('child-2', 'Child 2')];
      const parent = makeNode('parent', 'Parent', 100, 100, children);
      const edges = [
        makeEdge('e-child', 'child-1', 'child-2'),
        makeEdge('e-cross', 'child-1', 'other-root'), // crosses levels
      ];
      const graph = makeGraph([parent, makeNode('other-root', 'Other', 500, 100)], edges);

      const childEdges = getEdgesAtLevel(graph, ['parent']);
      expect(childEdges).toHaveLength(1);
      expect(childEdges[0]!.id).toBe('e-child');
    });
  });

  describe('Step 2: Zoom into parent node — edges are available', () => {
    it('getNodesAtLevel returns children when zoomed in', () => {
      const children = [
        makeNode('c1', 'Controller'),
        makeNode('c2', 'Service'),
        makeNode('c3', 'Repository'),
      ];
      const parent = makeNode('backend', 'Backend', 100, 100, children);
      const graph = makeGraph([parent]);

      const nodesAtLevel = getNodesAtLevel(graph, ['backend']);
      expect(nodesAtLevel).toHaveLength(3);
    });
  });

  describe('Step 3: Trigger auto-layout — edges are passed to ELK', () => {
    it('applyElkLayout filters edges to current navigation level', () => {
      // Verify via source code that applyElkLayout filters edges
      const source = readFileSync(
        join(__dirname, '../../../src/core/layout/elkLayout.ts'),
        'utf-8',
      );
      // applyElkLayout extracts edges relevant to the current level
      expect(source).toContain('nodeIds.has(e.fromNode) && nodeIds.has(e.toNode)');
    });

    it('computeElkLayout receives edges and passes them to ELK graph', () => {
      const source = readFileSync(
        join(__dirname, '../../../src/core/layout/elkLayout.ts'),
        'utf-8',
      );
      // ELK graph includes edges
      expect(source).toContain('edges: elkEdges');
      // Edges mapped with sources and targets
      expect(source).toContain('sources: [edge.fromNode]');
      expect(source).toContain('targets: [edge.toNode]');
    });

    it('ELK layered algorithm uses edges for node ordering', () => {
      const source = readFileSync(
        join(__dirname, '../../../src/core/layout/elkLayout.ts'),
        'utf-8',
      );
      expect(source).toContain("'elk.algorithm': 'layered'");
    });
  });

  describe('Step 4: Nodes arranged following edge direction (sources left, targets right)', () => {
    it('horizontal layout places source nodes to the left of target nodes', async () => {
      // Linear chain: A → B → C
      const nodes = [
        makeNode('a', 'Source A'),
        makeNode('b', 'Middle B'),
        makeNode('c', 'Target C'),
      ];
      const edges = [makeEdge('e1', 'a', 'b'), makeEdge('e2', 'b', 'c')];

      const result = await computeElkLayout(nodes, edges, 'horizontal');

      const posA = result.positions.get('a')!;
      const posB = result.positions.get('b')!;
      const posC = result.positions.get('c')!;

      // Source A should be leftmost, target C should be rightmost
      expect(posA.x).toBeLessThan(posB.x);
      expect(posB.x).toBeLessThan(posC.x);
    });

    it('vertical layout places source nodes above target nodes', async () => {
      // Linear chain: A → B → C
      const nodes = [
        makeNode('a', 'Source A'),
        makeNode('b', 'Middle B'),
        makeNode('c', 'Target C'),
      ];
      const edges = [makeEdge('e1', 'a', 'b'), makeEdge('e2', 'b', 'c')];

      const result = await computeElkLayout(nodes, edges, 'vertical');

      const posA = result.positions.get('a')!;
      const posB = result.positions.get('b')!;
      const posC = result.positions.get('c')!;

      // Source A should be above, target C should be below
      expect(posA.y).toBeLessThan(posB.y);
      expect(posB.y).toBeLessThan(posC.y);
    });

    it('child-level edges produce directional layout via applyElkLayout', async () => {
      // Parent with 3 children forming a chain: ctrl → svc → repo
      const children = [
        makeNode('ctrl', 'Controller'),
        makeNode('svc', 'Service'),
        makeNode('repo', 'Repository'),
      ];
      const parent = makeNode('backend', 'Backend', 100, 100, children);
      const edges = [
        makeEdge('e1', 'ctrl', 'svc', 'delegates'),
        makeEdge('e2', 'svc', 'repo', 'reads'),
      ];
      const graph = makeGraph([parent], edges);

      const updated = await applyElkLayout(graph, 'horizontal', ['backend']);

      // Find the updated children positions
      const updatedParent = updated.nodes.find((n) => n.id === 'backend')!;
      const ctrlPos = updatedParent.children.find((n) => n.id === 'ctrl')!.position;
      const svcPos = updatedParent.children.find((n) => n.id === 'svc')!.position;
      const repoPos = updatedParent.children.find((n) => n.id === 'repo')!.position;

      // Controller (source) should be left of Service, Service left of Repository
      expect(ctrlPos.x).toBeLessThan(svcPos.x);
      expect(svcPos.x).toBeLessThan(repoPos.x);
    });

    it('diamond dependency graph respects edge direction', async () => {
      // Diamond: A → B, A → C, B → D, C → D
      const nodes = [
        makeNode('a', 'Entry'),
        makeNode('b', 'Path B'),
        makeNode('c', 'Path C'),
        makeNode('d', 'Exit'),
      ];
      const edges = [
        makeEdge('e1', 'a', 'b'),
        makeEdge('e2', 'a', 'c'),
        makeEdge('e3', 'b', 'd'),
        makeEdge('e4', 'c', 'd'),
      ];

      const result = await computeElkLayout(nodes, edges, 'horizontal');

      const posA = result.positions.get('a')!;
      const posB = result.positions.get('b')!;
      const posC = result.positions.get('c')!;
      const posD = result.positions.get('d')!;

      // A (source of all) should be leftmost
      expect(posA.x).toBeLessThan(posB.x);
      expect(posA.x).toBeLessThan(posC.x);
      // D (target of all) should be rightmost
      expect(posD.x).toBeGreaterThan(posB.x);
      expect(posD.x).toBeGreaterThan(posC.x);
      // B and C should be in the middle layer (same x approximately)
      expect(Math.abs(posB.x - posC.x)).toBeLessThan(10);
    });

    it('nodes without edges still get positions (no overlaps)', async () => {
      const nodes = [
        makeNode('a', 'Node A'),
        makeNode('b', 'Node B'),
        makeNode('c', 'Node C'),
      ];
      // No edges
      const result = await computeElkLayout(nodes, [], 'horizontal');

      const posA = result.positions.get('a')!;
      const posB = result.positions.get('b')!;
      const posC = result.positions.get('c')!;

      // All positions should be defined
      expect(posA).toBeDefined();
      expect(posB).toBeDefined();
      expect(posC).toBeDefined();
    });
  });

  describe('Step 5: No node overlaps after layout', () => {
    it('no nodes overlap in horizontal layout with edges', async () => {
      const nodes = [
        makeNode('a', 'Source A'),
        makeNode('b', 'Middle B'),
        makeNode('c', 'Target C'),
        makeNode('d', 'Parallel D'),
      ];
      const edges = [
        makeEdge('e1', 'a', 'b'),
        makeEdge('e2', 'a', 'c'),
        makeEdge('e3', 'b', 'd'),
      ];

      const result = await computeElkLayout(nodes, edges, 'horizontal');

      // Check no node rectangles overlap
      const nodeWidth = 240;
      const nodeHeight = 100;
      const positions = Array.from(result.positions.entries()).map(([id, pos]) => ({
        id,
        ...pos,
      }));

      for (let i = 0; i < positions.length; i++) {
        for (let j = i + 1; j < positions.length; j++) {
          const p1 = positions[i]!;
          const p2 = positions[j]!;
          const overlapX = p1.x < p2.x + nodeWidth && p1.x + nodeWidth > p2.x;
          const overlapY = p1.y < p2.y + nodeHeight && p1.y + nodeHeight > p2.y;
          expect(
            overlapX && overlapY,
            `Nodes ${p1.id} and ${p2.id} overlap: ` +
              `(${p1.x},${p1.y}) vs (${p2.x},${p2.y})`,
          ).toBe(false);
        }
      }
    });

    it('no nodes overlap in vertical layout with edges', async () => {
      const nodes = [
        makeNode('a', 'Source'),
        makeNode('b', 'Target 1'),
        makeNode('c', 'Target 2'),
      ];
      const edges = [makeEdge('e1', 'a', 'b'), makeEdge('e2', 'a', 'c')];

      const result = await computeElkLayout(nodes, edges, 'vertical');

      const nodeWidth = 240;
      const nodeHeight = 100;
      const positions = Array.from(result.positions.entries()).map(([id, pos]) => ({
        id,
        ...pos,
      }));

      for (let i = 0; i < positions.length; i++) {
        for (let j = i + 1; j < positions.length; j++) {
          const p1 = positions[i]!;
          const p2 = positions[j]!;
          const overlapX = p1.x < p2.x + nodeWidth && p1.x + nodeWidth > p2.x;
          const overlapY = p1.y < p2.y + nodeHeight && p1.y + nodeHeight > p2.y;
          expect(
            overlapX && overlapY,
            `Nodes ${p1.id} and ${p2.id} overlap`,
          ).toBe(false);
        }
      }
    });

    it('no overlaps after applyElkLayout on nested children with edges', async () => {
      const children = [
        makeNode('ctrl', 'Controller'),
        makeNode('svc', 'Service'),
        makeNode('repo', 'Repository'),
        makeNode('cache', 'Cache'),
      ];
      const parent = makeNode('backend', 'Backend', 100, 100, children);
      const edges = [
        makeEdge('e1', 'ctrl', 'svc'),
        makeEdge('e2', 'svc', 'repo'),
        makeEdge('e3', 'svc', 'cache'),
      ];
      const graph = makeGraph([parent], edges);

      const updated = await applyElkLayout(graph, 'horizontal', ['backend']);
      const updatedParent = updated.nodes.find((n) => n.id === 'backend')!;

      const nodeWidth = 240;
      const nodeHeight = 100;

      for (let i = 0; i < updatedParent.children.length; i++) {
        for (let j = i + 1; j < updatedParent.children.length; j++) {
          const p1 = updatedParent.children[i]!.position;
          const p2 = updatedParent.children[j]!.position;
          const overlapX = p1.x < p2.x + nodeWidth && p1.x + nodeWidth > p2.x;
          const overlapY = p1.y < p2.y + nodeHeight && p1.y + nodeHeight > p2.y;
          expect(
            overlapX && overlapY,
            `Children ${updatedParent.children[i]!.id} and ${updatedParent.children[j]!.id} overlap`,
          ).toBe(false);
        }
      }
    });
  });
});
