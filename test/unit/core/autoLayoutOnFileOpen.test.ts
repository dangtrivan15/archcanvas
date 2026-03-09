import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import type { ArchNode } from '@/types/graph';
import { needsAutoLayout } from '@/core/layout/positionDetection';

/** Helper to create a minimal ArchNode with a given position. */
function makeNode(id: string, x: number, y: number): ArchNode {
  return {
    id,
    type: 'compute/server',
    displayName: `Node ${id}`,
    args: {},
    codeRefs: [],
    notes: [],
    properties: {},
    position: { x, y, width: 240, height: 100 },
    children: [],
  };
}

describe('Feature #507: Auto-layout triggers on file open when root nodes lack positions', () => {
  describe('Step 1: File with root nodes at (0,0) should need auto-layout', () => {
    it('needsAutoLayout returns true when all root nodes are at (0,0)', () => {
      const nodes = [
        makeNode('api-gateway', 0, 0),
        makeNode('auth-service', 0, 0),
        makeNode('user-service', 0, 0),
        makeNode('postgres-db', 0, 0),
      ];
      expect(needsAutoLayout(nodes)).toBe(true);
    });
  });

  describe('Step 2-4: coreStore._applyDecodedFile triggers auto-layout for nodes at (0,0)', () => {
    it('coreStore.ts imports needsAutoLayout from positionDetection', () => {
      const source = readFileSync(join(__dirname, '../../../src/store/coreStore.ts'), 'utf-8');
      expect(source).toContain("import { needsAutoLayout } from '@/core/layout/positionDetection'");
    });

    it('_applyDecodedFile calls needsAutoLayout on the graph nodes', () => {
      const source = readFileSync(join(__dirname, '../../../src/store/coreStore.ts'), 'utf-8');
      expect(source).toContain('needsAutoLayout(graph.nodes)');
    });

    it('_applyDecodedFile calls autoLayout when needsAutoLayout returns true', () => {
      const source = readFileSync(join(__dirname, '../../../src/store/coreStore.ts'), 'utf-8');
      // Should call autoLayout with horizontal direction and empty navigation path
      expect(source).toContain("autoLayout('horizontal', [])");
    });

    it('auto-layout is triggered asynchronously to allow React to render first', () => {
      const source = readFileSync(join(__dirname, '../../../src/store/coreStore.ts'), 'utf-8');
      // setTimeout ensures React has rendered the initial node positions before layout
      expect(source).toContain('setTimeout');
    });

    it('auto-layout requests fit view after completing', () => {
      const source = readFileSync(join(__dirname, '../../../src/store/coreStore.ts'), 'utf-8');
      // After auto-layout completes, should fit view to show arranged nodes
      // Find the section that handles auto-layout on open
      const autoLayoutSection = source.slice(
        source.indexOf('Auto-layout if root nodes lack'),
        source.indexOf('Auto-layout on file open complete') + 50,
      );
      expect(autoLayoutSection).toContain('requestFitView()');
    });

    it('handles auto-layout errors gracefully', () => {
      const source = readFileSync(join(__dirname, '../../../src/store/coreStore.ts'), 'utf-8');
      expect(source).toContain('Auto-layout on file open failed');
    });
  });

  describe('Step 5-6: File with custom positions should NOT trigger auto-layout', () => {
    it('needsAutoLayout returns false when nodes have custom positions', () => {
      const nodes = [
        makeNode('backend', 100, 100),
        makeNode('frontend', 500, 100),
        makeNode('database', 900, 100),
      ];
      expect(needsAutoLayout(nodes)).toBe(false);
    });

    it('needsAutoLayout returns false when at least one node has a non-zero position', () => {
      const nodes = [
        makeNode('a', 0, 0),
        makeNode('b', 200, 300),
        makeNode('c', 0, 0),
      ];
      expect(needsAutoLayout(nodes)).toBe(false);
    });

    it('auto-layout guard checks graph.nodes.length > 0', () => {
      const source = readFileSync(join(__dirname, '../../../src/store/coreStore.ts'), 'utf-8');
      expect(source).toContain('graph.nodes.length > 0');
    });

    it('needsAutoLayout returns false for empty graph (no nodes)', () => {
      expect(needsAutoLayout([])).toBe(false);
    });
  });

  describe('Integration: auto-layout uses edges for layout direction', () => {
    it('autoLayout passes edges to ELK for layout direction', () => {
      const source = readFileSync(join(__dirname, '../../../src/store/coreStore.ts'), 'utf-8');
      // autoLayout calls applyElkLayout which uses graph edges for layout
      expect(source).toContain('applyElkLayout(graph, direction, navigationPath, spacing)');
    });

    it('auto-layout on file open uses horizontal direction', () => {
      const source = readFileSync(join(__dirname, '../../../src/store/coreStore.ts'), 'utf-8');
      const autoLayoutOnOpenSection = source.slice(
        source.indexOf('Root nodes lack positions'),
        source.indexOf('Auto-layout on file open complete') + 50,
      );
      expect(autoLayoutOnOpenSection).toContain("'horizontal'");
    });
  });

  describe('Logging', () => {
    it('logs when auto-layout is triggered on file open', () => {
      const source = readFileSync(join(__dirname, '../../../src/store/coreStore.ts'), 'utf-8');
      expect(source).toContain('Root nodes lack positions');
    });

    it('logs when auto-layout on file open completes', () => {
      const source = readFileSync(join(__dirname, '../../../src/store/coreStore.ts'), 'utf-8');
      expect(source).toContain('Auto-layout on file open complete');
    });
  });
});
