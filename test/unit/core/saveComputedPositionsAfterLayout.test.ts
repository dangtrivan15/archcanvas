/**
 * Feature #509: Save computed positions after auto-layout.
 *
 * After auto-layout runs (whether manually triggered or automatic), the computed
 * positions must be saved back to the graph data so they persist in the .archc
 * file on save. This test verifies the complete chain:
 *   1. Nodes start at (0,0) — auto-layout triggers
 *   2. ELK computes new positions
 *   3. Positions are stored in the ArchGraph
 *   4. Save → reload roundtrip preserves these positions
 *   5. On reload, auto-layout does NOT re-trigger (positions are non-zero)
 */

import { describe, it, expect } from 'vitest';
import type { ArchGraph, ArchNode, ArchEdge } from '@/types/graph';
import { applyElkLayout } from '@/core/layout/elkLayout';
import { needsAutoLayout } from '@/core/layout/positionDetection';
import { graphToProto, protoToGraphFull } from '@/core/storage/fileIO';
import { encode, decode } from '@/core/storage/codec';

// ─── Helpers ────────────────────────────────────────────────────

function makeNode(
  id: string,
  x: number = 0,
  y: number = 0,
  children: ArchNode[] = [],
): ArchNode {
  return {
    id,
    type: 'compute/service',
    displayName: `Node ${id}`,
    args: {},
    codeRefs: [],
    notes: [],
    properties: {},
    position: { x, y, width: 240, height: 100 },
    children,
  };
}

function makeEdge(id: string, from: string, to: string): ArchEdge {
  return {
    id,
    fromNode: from,
    toNode: to,
    type: 'SYNC',
    label: '',
    notes: [],
    properties: {},
  };
}

function makeGraph(nodes: ArchNode[], edges: ArchEdge[] = []): ArchGraph {
  return {
    name: 'Auto-Layout Save Test',
    description: 'Tests that auto-layout positions are saved',
    owners: ['tester'],
    nodes,
    edges,
  };
}

/** Full save/reload roundtrip: graph → proto → encode → decode → graph */
async function roundtrip(graph: ArchGraph): Promise<ArchGraph> {
  const protoFile = graphToProto(graph);
  const binary = await encode(protoFile);
  const decoded = await decode(binary);
  const result = protoToGraphFull(decoded);
  return result.graph;
}

// ─── Tests ──────────────────────────────────────────────────────

describe('Feature #509: Save computed positions after auto-layout', () => {
  describe('Step 1: Unpositioned nodes trigger auto-layout', () => {
    it('nodes at (0,0) are detected as needing auto-layout', () => {
      const nodes = [makeNode('a'), makeNode('b'), makeNode('c')];
      expect(needsAutoLayout(nodes)).toBe(true);
    });

    it('nodes with non-zero positions do NOT need auto-layout', () => {
      const nodes = [makeNode('a', 100, 50), makeNode('b', 300, 150)];
      expect(needsAutoLayout(nodes)).toBe(false);
    });
  });

  describe('Step 2: Auto-layout updates positions in graph data (no longer 0,0)', () => {
    it('applyElkLayout assigns non-zero positions to previously unpositioned nodes', async () => {
      const graph = makeGraph(
        [makeNode('a'), makeNode('b'), makeNode('c')],
        [makeEdge('e1', 'a', 'b'), makeEdge('e2', 'b', 'c')],
      );

      // Before: all at (0,0)
      expect(graph.nodes.every((n) => n.position.x === 0 && n.position.y === 0)).toBe(true);

      const laid = await applyElkLayout(graph, 'horizontal');

      // After: positions should be updated — not all at (0,0) anymore
      const allAtOrigin = laid.nodes.every((n) => n.position.x === 0 && n.position.y === 0);
      expect(allAtOrigin).toBe(false);
    });

    it('each node gets a distinct position from ELK layout', async () => {
      const graph = makeGraph(
        [makeNode('a'), makeNode('b'), makeNode('c')],
        [makeEdge('e1', 'a', 'b'), makeEdge('e2', 'b', 'c')],
      );

      const laid = await applyElkLayout(graph, 'horizontal');
      const positions = laid.nodes.map((n) => `${n.position.x},${n.position.y}`);
      const uniquePositions = new Set(positions);

      // All 3 nodes should have distinct positions
      expect(uniquePositions.size).toBe(3);
    });

    it('horizontal layout arranges nodes left-to-right (increasing x)', async () => {
      const graph = makeGraph(
        [makeNode('a'), makeNode('b'), makeNode('c')],
        [makeEdge('e1', 'a', 'b'), makeEdge('e2', 'b', 'c')],
      );

      const laid = await applyElkLayout(graph, 'horizontal');

      // Find nodes by id in the result
      const nodeA = laid.nodes.find((n) => n.id === 'a')!;
      const nodeB = laid.nodes.find((n) => n.id === 'b')!;
      const nodeC = laid.nodes.find((n) => n.id === 'c')!;

      expect(nodeA.position.x).toBeLessThan(nodeB.position.x);
      expect(nodeB.position.x).toBeLessThan(nodeC.position.x);
    });

    it('vertical layout arranges nodes top-to-bottom (increasing y)', async () => {
      const graph = makeGraph(
        [makeNode('a'), makeNode('b'), makeNode('c')],
        [makeEdge('e1', 'a', 'b'), makeEdge('e2', 'b', 'c')],
      );

      const laid = await applyElkLayout(graph, 'vertical');

      const nodeA = laid.nodes.find((n) => n.id === 'a')!;
      const nodeB = laid.nodes.find((n) => n.id === 'b')!;
      const nodeC = laid.nodes.find((n) => n.id === 'c')!;

      expect(nodeA.position.y).toBeLessThan(nodeB.position.y);
      expect(nodeB.position.y).toBeLessThan(nodeC.position.y);
    });

    it('laid-out nodes are no longer detected as needing auto-layout', async () => {
      const graph = makeGraph(
        [makeNode('a'), makeNode('b'), makeNode('c')],
        [makeEdge('e1', 'a', 'b'), makeEdge('e2', 'b', 'c')],
      );

      const laid = await applyElkLayout(graph, 'horizontal');
      expect(needsAutoLayout(laid.nodes)).toBe(false);
    });
  });

  describe('Step 3-4: Positions persist through save and reload', () => {
    it('auto-layout positions survive a full save/reload roundtrip', async () => {
      const graph = makeGraph(
        [makeNode('a'), makeNode('b'), makeNode('c')],
        [makeEdge('e1', 'a', 'b'), makeEdge('e2', 'b', 'c')],
      );

      // Apply auto-layout
      const laid = await applyElkLayout(graph, 'horizontal');

      // Record computed positions
      const positionsBefore = laid.nodes.map((n) => ({
        id: n.id,
        x: n.position.x,
        y: n.position.y,
      }));

      // Save and reload
      const reloaded = await roundtrip(laid);

      // Verify positions are identical after roundtrip
      for (const before of positionsBefore) {
        const after = reloaded.nodes.find((n) => n.id === before.id)!;
        expect(after).toBeDefined();
        expect(after.position.x).toBe(before.x);
        expect(after.position.y).toBe(before.y);
      }
    });

    it('edges also survive the roundtrip alongside positions', async () => {
      const graph = makeGraph(
        [makeNode('a'), makeNode('b')],
        [makeEdge('e1', 'a', 'b')],
      );

      const laid = await applyElkLayout(graph, 'horizontal');
      const reloaded = await roundtrip(laid);

      expect(reloaded.edges).toHaveLength(1);
      expect(reloaded.edges[0]!.fromNode).toBe('a');
      expect(reloaded.edges[0]!.toNode).toBe('b');
    });
  });

  describe('Step 5: Reopened file does not re-trigger auto-layout', () => {
    it('reloaded positions are non-zero so needsAutoLayout returns false', async () => {
      const graph = makeGraph(
        [makeNode('a'), makeNode('b'), makeNode('c')],
        [makeEdge('e1', 'a', 'b'), makeEdge('e2', 'b', 'c')],
      );

      // Simulate: auto-layout → save → reload
      const laid = await applyElkLayout(graph, 'horizontal');
      const reloaded = await roundtrip(laid);

      // On reopen, auto-layout should NOT re-trigger
      expect(needsAutoLayout(reloaded.nodes)).toBe(false);
    });

    it('double roundtrip preserves positions identically', async () => {
      const graph = makeGraph(
        [makeNode('a'), makeNode('b')],
        [makeEdge('e1', 'a', 'b')],
      );

      const laid = await applyElkLayout(graph, 'horizontal');
      const round1 = await roundtrip(laid);
      const round2 = await roundtrip(round1);

      for (const n1 of round1.nodes) {
        const n2 = round2.nodes.find((n) => n.id === n1.id)!;
        expect(n2.position.x).toBe(n1.position.x);
        expect(n2.position.y).toBe(n1.position.y);
      }
    });
  });

  describe('Child-level auto-layout positions also persist', () => {
    it('child nodes get distinct positions from parent-level layout', async () => {
      const children = [makeNode('c1'), makeNode('c2'), makeNode('c3')];
      const parent = makeNode('parent', 0, 0, children);
      const graph = makeGraph(
        [parent],
        [makeEdge('ce1', 'c1', 'c2'), makeEdge('ce2', 'c2', 'c3')],
      );

      // Layout children by navigating into parent
      const laid = await applyElkLayout(graph, 'horizontal', ['parent']);

      const laidParent = laid.nodes.find((n) => n.id === 'parent')!;
      const positions = laidParent.children.map((c) => `${c.position.x},${c.position.y}`);
      expect(new Set(positions).size).toBe(3);
    });

    it('child positions survive save/reload roundtrip', async () => {
      const children = [makeNode('c1'), makeNode('c2')];
      const parent = makeNode('parent', 100, 50, children);
      const graph = makeGraph(
        [parent],
        [makeEdge('ce1', 'c1', 'c2')],
      );

      // Layout children
      const laid = await applyElkLayout(graph, 'horizontal', ['parent']);
      const laidChildren = laid.nodes.find((n) => n.id === 'parent')!.children;
      const posBefore = laidChildren.map((c) => ({ id: c.id, x: c.position.x, y: c.position.y }));

      // Roundtrip
      const reloaded = await roundtrip(laid);
      const reloadedChildren = reloaded.nodes.find((n) => n.id === 'parent')!.children;

      for (const before of posBefore) {
        const after = reloadedChildren.find((c) => c.id === before.id)!;
        expect(after.position.x).toBe(before.x);
        expect(after.position.y).toBe(before.y);
      }
    });

    it('child positions prevent auto-layout on zoom-in after reload', async () => {
      const children = [makeNode('c1'), makeNode('c2')];
      const parent = makeNode('parent', 100, 50, children);
      const graph = makeGraph(
        [parent],
        [makeEdge('ce1', 'c1', 'c2')],
      );

      // Layout children → save → reload
      const laid = await applyElkLayout(graph, 'horizontal', ['parent']);
      const reloaded = await roundtrip(laid);
      const reloadedChildren = reloaded.nodes.find((n) => n.id === 'parent')!.children;

      // Children should NOT need auto-layout
      expect(needsAutoLayout(reloadedChildren)).toBe(false);
    });
  });

  describe('Source code verification', () => {
    it('applyElkLayout returns updated graph with new positions (immutable)', async () => {
      const graph = makeGraph(
        [makeNode('a'), makeNode('b')],
        [makeEdge('e1', 'a', 'b')],
      );

      const result = await applyElkLayout(graph, 'horizontal');

      // Original graph is not mutated
      expect(graph.nodes[0]!.position.x).toBe(0);
      expect(graph.nodes[0]!.position.y).toBe(0);

      // New graph has updated positions
      expect(result).not.toBe(graph);
      expect(result.nodes).not.toBe(graph.nodes);
    });

    it('coreStore.autoLayout sets isDirty=true after layout', async () => {
      const fs = await import('fs');
      const source = fs.readFileSync('src/store/coreStore.ts', 'utf-8');

      // After applyElkLayout, the store sets isDirty: true
      expect(source).toContain('isDirty: true');

      // The updated graph is set in the store
      expect(source).toContain('graph: updatedGraph');

      // textApi is updated with the new graph
      expect(source).toContain('textApi.setGraph(updatedGraph)');
    });

    it('file open triggers auto-layout for unpositioned nodes', async () => {
      const fs = await import('fs');
      const source = fs.readFileSync('src/store/coreStore.ts', 'utf-8');

      // needsAutoLayout check on file open
      expect(source).toContain('needsAutoLayout(graph.nodes)');

      // Triggers autoLayout
      expect(source).toContain('.autoLayout(');
    });
  });
});
