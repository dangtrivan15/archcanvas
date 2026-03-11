/**
 * Tests for Feature #450: Cross-File Navigation Stack.
 *
 * Verifies the nestedCanvasStore manages a file stack for cross-file drill-down:
 * - pushFile() saves current state and switches to new file's graph
 * - popFile() restores previous file's graph, navigation path, and viewport
 * - getDepth() returns correct stack depth
 * - popToRoot() returns to the original root file
 * - Viewport restoration preserves x, y, zoom at each level
 * - Navigation within nested files combines file stack + navigation path
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useNavigationStore } from '@/store/navigationStore';
import { useCanvasStore } from '@/store/canvasStore';
import { useGraphStore } from '@/store/graphStore';
import { useFileStore } from '@/store/fileStore';
import { useEngineStore } from '@/store/engineStore';
import { useHistoryStore } from '@/store/historyStore';
import type { ArchGraph } from '@/types/graph';

/** Helper to create a simple test graph. */
function makeGraph(name: string): ArchGraph {
  return {
    name,
    description: `Test graph: ${name}`,
    owners: [],
    nodes: [
      {
        id: `node-${name}`,
        type: 'compute/service',
        displayName: `${name} Service`,
        args: {},
        properties: {},
        children: [],
        codeRefs: [],
        notes: [],
        position: { x: 0, y: 0, width: 200, height: 100 },
      },
    ],
    edges: [],
    annotations: [],
  };
}

describe('Feature #450: Cross-File Navigation Stack', () => {
  beforeEach(() => {
    // Reset all stores to initial state
    useNavigationStore.setState({ fileStack: [], activeFilePath: null });
    useNavigationStore.setState({ path: [] });
    useCanvasStore.setState({ viewport: { x: 0, y: 0, zoom: 1 } });
    useGraphStore.setState({ graph: makeGraph('root'), nodeCount: 1, edgeCount: 0 });
  });

  describe('initial state', () => {
    it('starts with empty file stack', () => {
      expect(useNavigationStore.getState().fileStack).toEqual([]);
    });

    it('starts with null activeFilePath', () => {
      expect(useNavigationStore.getState().activeFilePath).toBeNull();
    });

    it('starts at depth 0', () => {
      expect(useNavigationStore.getState().getDepth()).toBe(0);
    });
  });

  describe('pushFile', () => {
    it('saves current state and switches to new graph', () => {
      const newGraph = makeGraph('child-a');

      useNavigationStore.getState().pushFile('child-a.archc', newGraph);

      // Stack should have one entry (the saved root state)
      expect(useNavigationStore.getState().fileStack).toHaveLength(1);
      expect(useNavigationStore.getState().activeFilePath).toBe('child-a.archc');

      // coreStore should have the new graph
      expect(useGraphStore.getState().graph.name).toBe('child-a');
    });

    it('saves the current navigation path in the stack entry', () => {
      // Set up: user is zoomed into a node within the root file
      useNavigationStore.getState().zoomIn('parent-node');
      useNavigationStore.getState().zoomIn('child-node');

      const newGraph = makeGraph('nested');
      useNavigationStore.getState().pushFile('nested.archc', newGraph);

      // The saved entry should have the navigation path
      const savedEntry = useNavigationStore.getState().fileStack[0]!;
      expect(savedEntry.navigationPath).toEqual(['parent-node', 'child-node']);

      // Navigation should be reset for the new file
      expect(useNavigationStore.getState().path).toEqual([]);
    });

    it('saves the current viewport in the stack entry', () => {
      // Set up: user has panned and zoomed
      useCanvasStore.getState().setViewport({ x: 100, y: -50, zoom: 1.5 });

      const newGraph = makeGraph('nested');
      useNavigationStore.getState().pushFile('nested.archc', newGraph);

      const savedEntry = useNavigationStore.getState().fileStack[0]!;
      expect(savedEntry.viewport).toEqual({ x: 100, y: -50, zoom: 1.5 });
    });

    it('increments depth with each push', () => {
      useNavigationStore.getState().pushFile('level1.archc', makeGraph('level1'));
      expect(useNavigationStore.getState().getDepth()).toBe(1);

      useNavigationStore.getState().pushFile('level2.archc', makeGraph('level2'));
      expect(useNavigationStore.getState().getDepth()).toBe(2);

      useNavigationStore.getState().pushFile('level3.archc', makeGraph('level3'));
      expect(useNavigationStore.getState().getDepth()).toBe(3);
    });

    it('supports deep nesting (5 levels)', () => {
      for (let i = 1; i <= 5; i++) {
        useNavigationStore.getState().pushFile(`level${i}.archc`, makeGraph(`level${i}`));
      }

      expect(useNavigationStore.getState().getDepth()).toBe(5);
      expect(useNavigationStore.getState().activeFilePath).toBe('level5.archc');
      expect(useGraphStore.getState().graph.name).toBe('level5');
    });

    it('preserves the graph snapshot in stack entry', () => {
      const rootGraph = useGraphStore.getState().graph;
      useNavigationStore.getState().pushFile('child.archc', makeGraph('child'));

      const savedEntry = useNavigationStore.getState().fileStack[0]!;
      expect(savedEntry.graph.name).toBe(rootGraph.name);
      expect(savedEntry.graph.nodes).toEqual(rootGraph.nodes);
    });
  });

  describe('popFile', () => {
    it('restores previous graph from stack', () => {
      const rootGraph = useGraphStore.getState().graph;
      useNavigationStore.getState().pushFile('child.archc', makeGraph('child'));

      // Pop should restore the root graph
      const restored = useNavigationStore.getState().popFile();

      expect(restored).not.toBeNull();
      expect(useGraphStore.getState().graph.name).toBe(rootGraph.name);
      expect(useNavigationStore.getState().fileStack).toHaveLength(0);
    });

    it('restores previous navigation path', () => {
      useNavigationStore.getState().zoomIn('parent');
      useNavigationStore.getState().zoomIn('child');

      useNavigationStore.getState().pushFile('nested.archc', makeGraph('nested'));

      // Navigate inside the nested file
      useNavigationStore.getState().zoomIn('inner-node');

      // Pop should restore the previous navigation path
      useNavigationStore.getState().popFile();
      expect(useNavigationStore.getState().path).toEqual(['parent', 'child']);
    });

    it('restores previous viewport position', () => {
      useCanvasStore.getState().setViewport({ x: 200, y: -100, zoom: 0.8 });

      useNavigationStore.getState().pushFile('nested.archc', makeGraph('nested'));

      // Change viewport in nested file
      useCanvasStore.getState().setViewport({ x: 50, y: 50, zoom: 2.0 });

      // Pop should restore previous viewport
      useNavigationStore.getState().popFile();
      expect(useCanvasStore.getState().viewport).toEqual({ x: 200, y: -100, zoom: 0.8 });
    });

    it('returns null when stack is empty', () => {
      const result = useNavigationStore.getState().popFile();
      expect(result).toBeNull();
    });

    it('decrements depth on each pop', () => {
      useNavigationStore.getState().pushFile('a.archc', makeGraph('a'));
      useNavigationStore.getState().pushFile('b.archc', makeGraph('b'));
      expect(useNavigationStore.getState().getDepth()).toBe(2);

      useNavigationStore.getState().popFile();
      expect(useNavigationStore.getState().getDepth()).toBe(1);

      useNavigationStore.getState().popFile();
      expect(useNavigationStore.getState().getDepth()).toBe(0);
    });

    it('returns the restored entry', () => {
      useCanvasStore.getState().setViewport({ x: 10, y: 20, zoom: 1.2 });
      useNavigationStore.getState().zoomIn('node-x');

      useNavigationStore.getState().pushFile('child.archc', makeGraph('child'));

      const restored = useNavigationStore.getState().popFile();
      expect(restored).not.toBeNull();
      expect(restored!.navigationPath).toEqual(['node-x']);
      expect(restored!.viewport).toEqual({ x: 10, y: 20, zoom: 1.2 });
    });

    it('restores activeFilePath correctly through multiple levels', () => {
      useNavigationStore.getState().pushFile('a.archc', makeGraph('a'));
      expect(useNavigationStore.getState().activeFilePath).toBe('a.archc');

      useNavigationStore.getState().pushFile('b.archc', makeGraph('b'));
      expect(useNavigationStore.getState().activeFilePath).toBe('b.archc');

      useNavigationStore.getState().popFile();
      expect(useNavigationStore.getState().activeFilePath).toBe('a.archc');

      useNavigationStore.getState().popFile();
      expect(useNavigationStore.getState().activeFilePath).toBeNull();
    });
  });

  describe('getDepth', () => {
    it('returns 0 for root file', () => {
      expect(useNavigationStore.getState().getDepth()).toBe(0);
    });

    it('returns 1 after one pushFile', () => {
      useNavigationStore.getState().pushFile('child.archc', makeGraph('child'));
      expect(useNavigationStore.getState().getDepth()).toBe(1);
    });

    it('returns correct depth after push/pop sequence', () => {
      useNavigationStore.getState().pushFile('a.archc', makeGraph('a'));
      useNavigationStore.getState().pushFile('b.archc', makeGraph('b'));
      useNavigationStore.getState().pushFile('c.archc', makeGraph('c'));
      expect(useNavigationStore.getState().getDepth()).toBe(3);

      useNavigationStore.getState().popFile();
      expect(useNavigationStore.getState().getDepth()).toBe(2);
    });
  });

  describe('getStackEntry', () => {
    it('returns entry at given index', () => {
      useNavigationStore.getState().pushFile('a.archc', makeGraph('a'));
      useNavigationStore.getState().pushFile('b.archc', makeGraph('b'));

      const entry0 = useNavigationStore.getState().getStackEntry(0);
      expect(entry0).toBeDefined();
      expect(entry0!.filePath).toBe('__root__'); // root was saved first

      const entry1 = useNavigationStore.getState().getStackEntry(1);
      expect(entry1).toBeDefined();
      expect(entry1!.filePath).toBe('a.archc');
    });

    it('returns undefined for out-of-bounds index', () => {
      expect(useNavigationStore.getState().getStackEntry(0)).toBeUndefined();
      expect(useNavigationStore.getState().getStackEntry(5)).toBeUndefined();
    });
  });

  describe('popToRoot', () => {
    it('restores root file state from any depth', () => {
      const rootGraph = useGraphStore.getState().graph;
      useCanvasStore.getState().setViewport({ x: 42, y: 84, zoom: 0.5 });
      useNavigationStore.getState().zoomIn('root-child');

      useNavigationStore.getState().pushFile('a.archc', makeGraph('a'));
      useNavigationStore.getState().pushFile('b.archc', makeGraph('b'));
      useNavigationStore.getState().pushFile('c.archc', makeGraph('c'));

      expect(useNavigationStore.getState().getDepth()).toBe(3);

      const restored = useNavigationStore.getState().popToRoot();

      expect(restored).not.toBeNull();
      expect(useNavigationStore.getState().getDepth()).toBe(0);
      expect(useNavigationStore.getState().activeFilePath).toBeNull();
      expect(useGraphStore.getState().graph.name).toBe(rootGraph.name);
      expect(useNavigationStore.getState().path).toEqual(['root-child']);
      expect(useCanvasStore.getState().viewport).toEqual({ x: 42, y: 84, zoom: 0.5 });
    });

    it('returns null when already at root', () => {
      const result = useNavigationStore.getState().popToRoot();
      expect(result).toBeNull();
    });

    it('clears entire stack', () => {
      useNavigationStore.getState().pushFile('a.archc', makeGraph('a'));
      useNavigationStore.getState().pushFile('b.archc', makeGraph('b'));

      useNavigationStore.getState().popToRoot();
      expect(useNavigationStore.getState().fileStack).toEqual([]);
    });
  });

  describe('reset', () => {
    it('clears the file stack and activeFilePath', () => {
      useNavigationStore.getState().pushFile('a.archc', makeGraph('a'));
      useNavigationStore.getState().pushFile('b.archc', makeGraph('b'));

      useNavigationStore.getState().reset();

      expect(useNavigationStore.getState().fileStack).toEqual([]);
      expect(useNavigationStore.getState().activeFilePath).toBeNull();
      expect(useNavigationStore.getState().getDepth()).toBe(0);
    });
  });

  describe('combined file stack + navigation path', () => {
    it('handles navigation within a nested file', () => {
      // Start at root, zoom into a node
      useNavigationStore.getState().zoomIn('root-parent');

      // Push into a nested file
      useNavigationStore.getState().pushFile('child.archc', makeGraph('child'));
      expect(useNavigationStore.getState().path).toEqual([]);

      // Navigate within the nested file
      useNavigationStore.getState().zoomIn('child-node-a');
      useNavigationStore.getState().zoomIn('child-node-b');
      expect(useNavigationStore.getState().path).toEqual(['child-node-a', 'child-node-b']);

      // Pop back: should restore root's navigation path
      useNavigationStore.getState().popFile();
      expect(useNavigationStore.getState().path).toEqual(['root-parent']);
    });

    it('handles multiple file pushes with different navigation depths', () => {
      // Root: navigate to ['a', 'b']
      useNavigationStore.getState().zoomIn('a');
      useNavigationStore.getState().zoomIn('b');

      // Push file 1
      useNavigationStore.getState().pushFile('file1.archc', makeGraph('file1'));
      useNavigationStore.getState().zoomIn('f1-node');

      // Push file 2
      useNavigationStore.getState().pushFile('file2.archc', makeGraph('file2'));
      expect(useNavigationStore.getState().path).toEqual([]);

      // Pop file 2 → file 1 restored
      useNavigationStore.getState().popFile();
      expect(useNavigationStore.getState().path).toEqual(['f1-node']);

      // Pop file 1 → root restored
      useNavigationStore.getState().popFile();
      expect(useNavigationStore.getState().path).toEqual(['a', 'b']);
    });
  });

  describe('viewport restoration', () => {
    it('preserves unique viewport at each stack level', () => {
      // Root viewport
      useCanvasStore.getState().setViewport({ x: 0, y: 0, zoom: 1 });

      // Push level 1 with different viewport
      useNavigationStore.getState().pushFile('l1.archc', makeGraph('l1'));
      useCanvasStore.getState().setViewport({ x: 100, y: 200, zoom: 0.5 });

      // Push level 2 with different viewport
      useNavigationStore.getState().pushFile('l2.archc', makeGraph('l2'));
      useCanvasStore.getState().setViewport({ x: -50, y: -50, zoom: 2.0 });

      // Pop level 2 → level 1 viewport restored
      useNavigationStore.getState().popFile();
      expect(useCanvasStore.getState().viewport).toEqual({ x: 100, y: 200, zoom: 0.5 });

      // Pop level 1 → root viewport restored
      useNavigationStore.getState().popFile();
      expect(useCanvasStore.getState().viewport).toEqual({ x: 0, y: 0, zoom: 1 });
    });
  });
});
