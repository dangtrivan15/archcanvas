import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import type { ArchNode, ArchGraph } from '@/types/graph';
import { needsAutoLayout, classifyNodePositions } from '@/core/layout/positionDetection';
import { getNodesAtLevel } from '@/core/graph/graphQuery';

/** Helper to create a minimal ArchNode with a given position. */
function makeNode(id: string, x: number, y: number, children: ArchNode[] = []): ArchNode {
  return {
    id,
    type: 'compute/server',
    displayName: `Node ${id}`,
    args: {},
    codeRefs: [],
    notes: [],
    properties: {},
    position: { x, y, width: 240, height: 100 },
    children,
  };
}

/** Helper to create a minimal ArchGraph. */
function makeGraph(nodes: ArchNode[]): ArchGraph {
  return {
    name: 'test',
    description: '',
    owners: [],
    nodes,
    edges: [],
  };
}

describe('Feature #510: Skip auto-layout when nodes have user-set positions', () => {
  describe('Step 1: Open a file where nodes have been manually arranged and saved', () => {
    it('nodes with user-set positions (non-zero) are not flagged for auto-layout', () => {
      // Simulates nodes that were manually arranged and saved
      const nodes = [
        makeNode('gateway', 100, 50),
        makeNode('service', 400, 50),
        makeNode('database', 700, 50),
      ];
      expect(needsAutoLayout(nodes)).toBe(false);
    });

    it('nodes with scattered user positions are not flagged for auto-layout', () => {
      // Positions are scattered but intentional (user manually arranged)
      const nodes = [
        makeNode('node-a', 500, 400),
        makeNode('node-b', 100, 50),
        makeNode('node-c', 600, 100),
        makeNode('node-d', 50, 300),
      ];
      expect(needsAutoLayout(nodes)).toBe(false);
    });

    it('coreStore skips auto-layout when needsAutoLayout returns false', () => {
      const source = readFileSync(join(__dirname, '../../../src/store/coreStore.ts'), 'utf-8');
      // The guard condition: only triggers when needsAutoLayout returns true
      expect(source).toContain('needsAutoLayout(graph.nodes)');
      // This means if it returns false (nodes have positions), the auto-layout block is skipped
    });
  });

  describe('Step 2: Verify nodes render at their saved positions', () => {
    it('classifyNodePositions correctly identifies all nodes as positioned', () => {
      const nodes = [
        makeNode('a', 100, 200),
        makeNode('b', 300, 400),
        makeNode('c', 500, 100),
      ];
      const { positioned, unpositioned } = classifyNodePositions(nodes);
      expect(positioned).toHaveLength(3);
      expect(unpositioned).toHaveLength(0);
    });

    it('nodes with negative positions are considered user-positioned', () => {
      const nodes = [makeNode('a', -50, -30), makeNode('b', 200, 100)];
      expect(needsAutoLayout(nodes)).toBe(false);
    });

    it('nodes with very small but non-zero positions are considered positioned', () => {
      const nodes = [makeNode('a', 0.5, 0), makeNode('b', 0, 1.2)];
      expect(needsAutoLayout(nodes)).toBe(false);
    });
  });

  describe('Step 3: Zoom into a parent whose children were previously arranged', () => {
    it('children with user-set positions do not trigger auto-layout on zoom-in', () => {
      const children = [
        makeNode('auth-controller', 500, 400),
        makeNode('user-controller', 50, 50),
        makeNode('auth-service', 600, 100),
        makeNode('user-repo', 100, 500),
      ];
      const parent = makeNode('backend', 100, 100, children);
      const graph = makeGraph([parent]);

      const nodesAtChildLevel = getNodesAtLevel(graph, ['backend']);
      expect(nodesAtChildLevel).toHaveLength(4);
      expect(needsAutoLayout(nodesAtChildLevel)).toBe(false);
    });

    it('Canvas.tsx checks needsAutoLayout before triggering zoom-in auto-layout', () => {
      const source = readFileSync(
        join(__dirname, '../../../src/components/canvas/hooks/useCanvasNavigation.ts'),
        'utf-8',
      );
      // Guard condition ensures auto-layout only triggers when children lack positions
      expect(source).toContain('needsAutoLayout(nodesAtLevel)');
    });
  });

  describe('Step 4: Verify children render at saved positions without re-layout', () => {
    it('deeply nested children with positions are not re-laid-out', () => {
      const grandchildren = [
        makeNode('gc-1', 50, 100),
        makeNode('gc-2', 300, 100),
      ];
      const child = makeNode('child', 100, 50, grandchildren);
      const parent = makeNode('parent', 100, 200, [child]);
      const graph = makeGraph([parent]);

      // Navigate two levels deep
      const nodesAtGrandchildLevel = getNodesAtLevel(graph, ['parent', 'child']);
      expect(needsAutoLayout(nodesAtGrandchildLevel)).toBe(false);
    });

    it('mix of positioned parents does not trigger layout for positioned children', () => {
      // Parent has children that were arranged — even if parent itself is at an odd spot
      const children = [
        makeNode('c1', 200, 100),
        makeNode('c2', 450, 100),
      ];
      const parent = makeNode('p', 0, 0, children); // parent at (0,0) but children positioned
      const graph = makeGraph([parent]);

      const nodesAtChildLevel = getNodesAtLevel(graph, ['p']);
      expect(needsAutoLayout(nodesAtChildLevel)).toBe(false);
    });

    it('zoom-out does not trigger auto-layout (only zoom-in triggers)', () => {
      const source = readFileSync(
        join(__dirname, '../../../src/components/canvas/hooks/useCanvasNavigation.ts'),
        'utf-8',
      );
      // Guard: only triggers when path grows (zoom-in), not when it shrinks (zoom-out)
      expect(source).toContain('navigationPath.length <= prevPath.length');
    });
  });

  describe('Step 5: Verify user can still manually trigger layout via menu/shortcut', () => {
    it('autoLayout action exists in coreStore for manual triggering', () => {
      const source = readFileSync(join(__dirname, '../../../src/store/coreStore.ts'), 'utf-8');
      // The autoLayout action is always available regardless of needsAutoLayout
      expect(source).toContain('autoLayout:');
      expect(source).toContain('applyElkLayout(graph, direction, navigationPath, spacing)');
    });

    it('context menu provides manual layout trigger without position check', () => {
      // The context menu calls autoLayout directly without checking needsAutoLayout
      const source = readFileSync(
        join(__dirname, '../../../src/components/canvas/CanvasContextMenu.tsx'),
        'utf-8',
      );
      expect(source).toContain('autoLayout');
      expect(source).toContain('Auto-Layout');
    });

    it('Ctrl+Shift+L keyboard shortcut triggers layout without position check', () => {
      const source = readFileSync(
        join(__dirname, '../../../src/hooks/useKeyboardShortcuts.ts'),
        'utf-8',
      );
      // Keyboard shortcut calls autoLayout directly, no needsAutoLayout guard
      expect(source).toContain('autoLayout');
    });
  });
});
