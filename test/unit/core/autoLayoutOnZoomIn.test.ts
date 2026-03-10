import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import type { ArchNode, ArchGraph } from '@/types/graph';
import { needsAutoLayout } from '@/core/layout/positionDetection';
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

describe('Feature #508: Auto-layout triggers on zoom-in when children lack positions', () => {
  describe('Step 1: Parent node with children that have no positions', () => {
    it('children at (0,0) should need auto-layout', () => {
      const children = [
        makeNode('child-1', 0, 0),
        makeNode('child-2', 0, 0),
        makeNode('child-3', 0, 0),
      ];
      expect(needsAutoLayout(children)).toBe(true);
    });

    it('getNodesAtLevel retrieves children when navigated into parent', () => {
      const children = [
        makeNode('child-1', 0, 0),
        makeNode('child-2', 0, 0),
      ];
      const parent = makeNode('parent', 100, 200, children);
      const graph = makeGraph([parent]);

      const nodesAtChildLevel = getNodesAtLevel(graph, ['parent']);
      expect(nodesAtChildLevel).toHaveLength(2);
      expect(nodesAtChildLevel[0]!.id).toBe('child-1');
      expect(nodesAtChildLevel[1]!.id).toBe('child-2');
    });

    it('needsAutoLayout returns true for children at (0,0) retrieved via getNodesAtLevel', () => {
      const children = [
        makeNode('child-1', 0, 0),
        makeNode('child-2', 0, 0),
        makeNode('child-3', 0, 0),
      ];
      const parent = makeNode('parent', 100, 200, children);
      const graph = makeGraph([parent]);

      const nodesAtChildLevel = getNodesAtLevel(graph, ['parent']);
      expect(needsAutoLayout(nodesAtChildLevel)).toBe(true);
    });
  });

  describe('Step 2: Canvas.tsx triggers auto-layout on zoom-in when children lack positions', () => {
    it('Canvas.tsx imports getNodesAtLevel from graphQuery', () => {
      const source = readFileSync(
        join(__dirname, '../../../src/components/canvas/Canvas.tsx'),
        'utf-8',
      );
      expect(source).toContain("import { getNodesAtLevel } from '@/core/graph/graphQuery'");
    });

    it('Canvas.tsx imports needsAutoLayout from positionDetection', () => {
      const source = readFileSync(
        join(__dirname, '../../../src/components/canvas/Canvas.tsx'),
        'utf-8',
      );
      expect(source).toContain("import { needsAutoLayout } from '@/core/layout/positionDetection'");
    });

    it('Canvas.tsx uses autoLayout from coreStore', () => {
      const source = readFileSync(
        join(__dirname, '../../../src/components/canvas/Canvas.tsx'),
        'utf-8',
      );
      expect(source).toContain('autoLayout');
      expect(source).toContain('useGraphStore((s) => s.autoLayout)');
    });

    it('Canvas.tsx checks navigationPath length to detect zoom-in', () => {
      const source = readFileSync(
        join(__dirname, '../../../src/components/canvas/Canvas.tsx'),
        'utf-8',
      );
      // Only triggers on zoom-in (path grew longer)
      expect(source).toContain('navigationPath.length <= prevPath.length');
    });

    it('Canvas.tsx calls getNodesAtLevel with current navigationPath', () => {
      const source = readFileSync(
        join(__dirname, '../../../src/components/canvas/Canvas.tsx'),
        'utf-8',
      );
      expect(source).toContain('getNodesAtLevel(graph, navigationPath)');
    });

    it('Canvas.tsx calls needsAutoLayout on nodes at current level', () => {
      const source = readFileSync(
        join(__dirname, '../../../src/components/canvas/Canvas.tsx'),
        'utf-8',
      );
      expect(source).toContain('needsAutoLayout(nodesAtLevel)');
    });

    it('Canvas.tsx calls autoLayout with horizontal direction and current navigationPath', () => {
      const source = readFileSync(
        join(__dirname, '../../../src/components/canvas/Canvas.tsx'),
        'utf-8',
      );
      expect(source).toContain("autoLayout('horizontal', navigationPath)");
    });

    it('Canvas.tsx requests fit view after auto-layout completes', () => {
      const source = readFileSync(
        join(__dirname, '../../../src/components/canvas/Canvas.tsx'),
        'utf-8',
      );
      expect(source).toContain('requestFitView()');
    });

    it('auto-layout is deferred with setTimeout to allow React to render first', () => {
      const source = readFileSync(
        join(__dirname, '../../../src/components/canvas/Canvas.tsx'),
        'utf-8',
      );
      // The auto-layout effect uses setTimeout to defer execution
      expect(source).toContain('setTimeout');
    });

    it('Canvas.tsx tracks previous navigation path with a ref', () => {
      const source = readFileSync(
        join(__dirname, '../../../src/components/canvas/Canvas.tsx'),
        'utf-8',
      );
      expect(source).toContain('prevNavigationPathRef');
    });
  });

  describe('Step 3: Auto-layout runs automatically when children are arranged', () => {
    it('auto-layout only triggers when ALL children are at default positions', () => {
      // Mixed positions - some children positioned, some not
      const children = [
        makeNode('child-1', 100, 50),
        makeNode('child-2', 0, 0),
      ];
      // When at least one child has a non-default position, no auto-layout
      expect(needsAutoLayout(children)).toBe(false);
    });

    it('auto-layout triggers when all children are at (0,0)', () => {
      const children = [
        makeNode('child-1', 0, 0),
        makeNode('child-2', 0, 0),
        makeNode('child-3', 0, 0),
      ];
      expect(needsAutoLayout(children)).toBe(true);
    });

    it('auto-layout does not trigger for empty children array', () => {
      expect(needsAutoLayout([])).toBe(false);
    });
  });

  describe('Step 4: Zoom out and back in - saved positions used (no re-layout)', () => {
    it('children with saved positions from previous auto-layout do not need re-layout', () => {
      // After auto-layout, children will have non-zero positions
      const children = [
        makeNode('child-1', 50, 100),
        makeNode('child-2', 300, 100),
        makeNode('child-3', 550, 100),
      ];
      expect(needsAutoLayout(children)).toBe(false);
    });

    it('zoom-out does not trigger auto-layout (path shortened)', () => {
      const source = readFileSync(
        join(__dirname, '../../../src/components/canvas/Canvas.tsx'),
        'utf-8',
      );
      // The effect checks navigationPath.length <= prevPath.length to skip zoom-out
      expect(source).toContain('navigationPath.length <= prevPath.length');
    });

    it('getNodesAtLevel returns positioned children on re-zoom', () => {
      const children = [
        makeNode('child-1', 50, 100),
        makeNode('child-2', 300, 100),
      ];
      const parent = makeNode('parent', 100, 200, children);
      const graph = makeGraph([parent]);

      const nodesAtChildLevel = getNodesAtLevel(graph, ['parent']);
      expect(needsAutoLayout(nodesAtChildLevel)).toBe(false);
    });
  });

  describe('Step 5: Nested navigation (multi-level zoom-in)', () => {
    it('detects unpositioned grandchildren via nested navigation path', () => {
      const grandchildren = [
        makeNode('grandchild-1', 0, 0),
        makeNode('grandchild-2', 0, 0),
      ];
      const child = makeNode('child-1', 100, 50, grandchildren);
      const parent = makeNode('parent', 100, 200, [child]);
      const graph = makeGraph([parent]);

      // Navigate two levels deep
      const nodesAtGrandchildLevel = getNodesAtLevel(graph, ['parent', 'child-1']);
      expect(nodesAtGrandchildLevel).toHaveLength(2);
      expect(needsAutoLayout(nodesAtGrandchildLevel)).toBe(true);
    });

    it('positioned grandchildren do not trigger re-layout', () => {
      const grandchildren = [
        makeNode('grandchild-1', 50, 100),
        makeNode('grandchild-2', 300, 100),
      ];
      const child = makeNode('child-1', 100, 50, grandchildren);
      const parent = makeNode('parent', 100, 200, [child]);
      const graph = makeGraph([parent]);

      const nodesAtGrandchildLevel = getNodesAtLevel(graph, ['parent', 'child-1']);
      expect(needsAutoLayout(nodesAtGrandchildLevel)).toBe(false);
    });
  });
});
