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
import { useNestedCanvasStore } from '@/store/nestedCanvasStore';
import { useNavigationStore } from '@/store/navigationStore';
import { useCanvasStore } from '@/store/canvasStore';
import { useCoreStore } from '@/store/coreStore';
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
    useNestedCanvasStore.setState({ fileStack: [], activeFilePath: null });
    useNavigationStore.setState({ path: [] });
    useCanvasStore.setState({ viewport: { x: 0, y: 0, zoom: 1 } });
    useCoreStore.setState({
      graph: makeGraph('root'),
      nodeCount: 1,
      edgeCount: 0,
    });
  });

  describe('initial state', () => {
    it('starts with empty file stack', () => {
      expect(useNestedCanvasStore.getState().fileStack).toEqual([]);
    });

    it('starts with null activeFilePath', () => {
      expect(useNestedCanvasStore.getState().activeFilePath).toBeNull();
    });

    it('starts at depth 0', () => {
      expect(useNestedCanvasStore.getState().getDepth()).toBe(0);
    });
  });

  describe('pushFile', () => {
    it('saves current state and switches to new graph', () => {
      const newGraph = makeGraph('child-a');

      useNestedCanvasStore.getState().pushFile('child-a.archc', newGraph);

      // Stack should have one entry (the saved root state)
      expect(useNestedCanvasStore.getState().fileStack).toHaveLength(1);
      expect(useNestedCanvasStore.getState().activeFilePath).toBe('child-a.archc');

      // coreStore should have the new graph
      expect(useCoreStore.getState().graph.name).toBe('child-a');
    });

    it('saves the current navigation path in the stack entry', () => {
      // Set up: user is zoomed into a node within the root file
      useNavigationStore.getState().zoomIn('parent-node');
      useNavigationStore.getState().zoomIn('child-node');

      const newGraph = makeGraph('nested');
      useNestedCanvasStore.getState().pushFile('nested.archc', newGraph);

      // The saved entry should have the navigation path
      const savedEntry = useNestedCanvasStore.getState().fileStack[0]!;
      expect(savedEntry.navigationPath).toEqual(['parent-node', 'child-node']);

      // Navigation should be reset for the new file
      expect(useNavigationStore.getState().path).toEqual([]);
    });

    it('saves the current viewport in the stack entry', () => {
      // Set up: user has panned and zoomed
      useCanvasStore.getState().setViewport({ x: 100, y: -50, zoom: 1.5 });

      const newGraph = makeGraph('nested');
      useNestedCanvasStore.getState().pushFile('nested.archc', newGraph);

      const savedEntry = useNestedCanvasStore.getState().fileStack[0]!;
      expect(savedEntry.viewport).toEqual({ x: 100, y: -50, zoom: 1.5 });
    });

    it('increments depth with each push', () => {
      useNestedCanvasStore.getState().pushFile('level1.archc', makeGraph('level1'));
      expect(useNestedCanvasStore.getState().getDepth()).toBe(1);

      useNestedCanvasStore.getState().pushFile('level2.archc', makeGraph('level2'));
      expect(useNestedCanvasStore.getState().getDepth()).toBe(2);

      useNestedCanvasStore.getState().pushFile('level3.archc', makeGraph('level3'));
      expect(useNestedCanvasStore.getState().getDepth()).toBe(3);
    });

    it('supports deep nesting (5 levels)', () => {
      for (let i = 1; i <= 5; i++) {
        useNestedCanvasStore.getState().pushFile(`level${i}.archc`, makeGraph(`level${i}`));
      }

      expect(useNestedCanvasStore.getState().getDepth()).toBe(5);
      expect(useNestedCanvasStore.getState().activeFilePath).toBe('level5.archc');
      expect(useCoreStore.getState().graph.name).toBe('level5');
    });

    it('preserves the graph snapshot in stack entry', () => {
      const rootGraph = useCoreStore.getState().graph;
      useNestedCanvasStore.getState().pushFile('child.archc', makeGraph('child'));

      const savedEntry = useNestedCanvasStore.getState().fileStack[0]!;
      expect(savedEntry.graph.name).toBe(rootGraph.name);
      expect(savedEntry.graph.nodes).toEqual(rootGraph.nodes);
    });
  });

  describe('popFile', () => {
    it('restores previous graph from stack', () => {
      const rootGraph = useCoreStore.getState().graph;
      useNestedCanvasStore.getState().pushFile('child.archc', makeGraph('child'));

      // Pop should restore the root graph
      const restored = useNestedCanvasStore.getState().popFile();

      expect(restored).not.toBeNull();
      expect(useCoreStore.getState().graph.name).toBe(rootGraph.name);
      expect(useNestedCanvasStore.getState().fileStack).toHaveLength(0);
    });

    it('restores previous navigation path', () => {
      useNavigationStore.getState().zoomIn('parent');
      useNavigationStore.getState().zoomIn('child');

      useNestedCanvasStore.getState().pushFile('nested.archc', makeGraph('nested'));

      // Navigate inside the nested file
      useNavigationStore.getState().zoomIn('inner-node');

      // Pop should restore the previous navigation path
      useNestedCanvasStore.getState().popFile();
      expect(useNavigationStore.getState().path).toEqual(['parent', 'child']);
    });

    it('restores previous viewport position', () => {
      useCanvasStore.getState().setViewport({ x: 200, y: -100, zoom: 0.8 });

      useNestedCanvasStore.getState().pushFile('nested.archc', makeGraph('nested'));

      // Change viewport in nested file
      useCanvasStore.getState().setViewport({ x: 50, y: 50, zoom: 2.0 });

      // Pop should restore previous viewport
      useNestedCanvasStore.getState().popFile();
      expect(useCanvasStore.getState().viewport).toEqual({ x: 200, y: -100, zoom: 0.8 });
    });

    it('returns null when stack is empty', () => {
      const result = useNestedCanvasStore.getState().popFile();
      expect(result).toBeNull();
    });

    it('decrements depth on each pop', () => {
      useNestedCanvasStore.getState().pushFile('a.archc', makeGraph('a'));
      useNestedCanvasStore.getState().pushFile('b.archc', makeGraph('b'));
      expect(useNestedCanvasStore.getState().getDepth()).toBe(2);

      useNestedCanvasStore.getState().popFile();
      expect(useNestedCanvasStore.getState().getDepth()).toBe(1);

      useNestedCanvasStore.getState().popFile();
      expect(useNestedCanvasStore.getState().getDepth()).toBe(0);
    });

    it('returns the restored entry', () => {
      useCanvasStore.getState().setViewport({ x: 10, y: 20, zoom: 1.2 });
      useNavigationStore.getState().zoomIn('node-x');

      useNestedCanvasStore.getState().pushFile('child.archc', makeGraph('child'));

      const restored = useNestedCanvasStore.getState().popFile();
      expect(restored).not.toBeNull();
      expect(restored!.navigationPath).toEqual(['node-x']);
      expect(restored!.viewport).toEqual({ x: 10, y: 20, zoom: 1.2 });
    });

    it('restores activeFilePath correctly through multiple levels', () => {
      useNestedCanvasStore.getState().pushFile('a.archc', makeGraph('a'));
      expect(useNestedCanvasStore.getState().activeFilePath).toBe('a.archc');

      useNestedCanvasStore.getState().pushFile('b.archc', makeGraph('b'));
      expect(useNestedCanvasStore.getState().activeFilePath).toBe('b.archc');

      useNestedCanvasStore.getState().popFile();
      expect(useNestedCanvasStore.getState().activeFilePath).toBe('a.archc');

      useNestedCanvasStore.getState().popFile();
      expect(useNestedCanvasStore.getState().activeFilePath).toBeNull();
    });
  });

  describe('getDepth', () => {
    it('returns 0 for root file', () => {
      expect(useNestedCanvasStore.getState().getDepth()).toBe(0);
    });

    it('returns 1 after one pushFile', () => {
      useNestedCanvasStore.getState().pushFile('child.archc', makeGraph('child'));
      expect(useNestedCanvasStore.getState().getDepth()).toBe(1);
    });

    it('returns correct depth after push/pop sequence', () => {
      useNestedCanvasStore.getState().pushFile('a.archc', makeGraph('a'));
      useNestedCanvasStore.getState().pushFile('b.archc', makeGraph('b'));
      useNestedCanvasStore.getState().pushFile('c.archc', makeGraph('c'));
      expect(useNestedCanvasStore.getState().getDepth()).toBe(3);

      useNestedCanvasStore.getState().popFile();
      expect(useNestedCanvasStore.getState().getDepth()).toBe(2);
    });
  });

  describe('getStackEntry', () => {
    it('returns entry at given index', () => {
      useNestedCanvasStore.getState().pushFile('a.archc', makeGraph('a'));
      useNestedCanvasStore.getState().pushFile('b.archc', makeGraph('b'));

      const entry0 = useNestedCanvasStore.getState().getStackEntry(0);
      expect(entry0).toBeDefined();
      expect(entry0!.filePath).toBe('__root__'); // root was saved first

      const entry1 = useNestedCanvasStore.getState().getStackEntry(1);
      expect(entry1).toBeDefined();
      expect(entry1!.filePath).toBe('a.archc');
    });

    it('returns undefined for out-of-bounds index', () => {
      expect(useNestedCanvasStore.getState().getStackEntry(0)).toBeUndefined();
      expect(useNestedCanvasStore.getState().getStackEntry(5)).toBeUndefined();
    });
  });

  describe('popToRoot', () => {
    it('restores root file state from any depth', () => {
      const rootGraph = useCoreStore.getState().graph;
      useCanvasStore.getState().setViewport({ x: 42, y: 84, zoom: 0.5 });
      useNavigationStore.getState().zoomIn('root-child');

      useNestedCanvasStore.getState().pushFile('a.archc', makeGraph('a'));
      useNestedCanvasStore.getState().pushFile('b.archc', makeGraph('b'));
      useNestedCanvasStore.getState().pushFile('c.archc', makeGraph('c'));

      expect(useNestedCanvasStore.getState().getDepth()).toBe(3);

      const restored = useNestedCanvasStore.getState().popToRoot();

      expect(restored).not.toBeNull();
      expect(useNestedCanvasStore.getState().getDepth()).toBe(0);
      expect(useNestedCanvasStore.getState().activeFilePath).toBeNull();
      expect(useCoreStore.getState().graph.name).toBe(rootGraph.name);
      expect(useNavigationStore.getState().path).toEqual(['root-child']);
      expect(useCanvasStore.getState().viewport).toEqual({ x: 42, y: 84, zoom: 0.5 });
    });

    it('returns null when already at root', () => {
      const result = useNestedCanvasStore.getState().popToRoot();
      expect(result).toBeNull();
    });

    it('clears entire stack', () => {
      useNestedCanvasStore.getState().pushFile('a.archc', makeGraph('a'));
      useNestedCanvasStore.getState().pushFile('b.archc', makeGraph('b'));

      useNestedCanvasStore.getState().popToRoot();
      expect(useNestedCanvasStore.getState().fileStack).toEqual([]);
    });
  });

  describe('reset', () => {
    it('clears the file stack and activeFilePath', () => {
      useNestedCanvasStore.getState().pushFile('a.archc', makeGraph('a'));
      useNestedCanvasStore.getState().pushFile('b.archc', makeGraph('b'));

      useNestedCanvasStore.getState().reset();

      expect(useNestedCanvasStore.getState().fileStack).toEqual([]);
      expect(useNestedCanvasStore.getState().activeFilePath).toBeNull();
      expect(useNestedCanvasStore.getState().getDepth()).toBe(0);
    });
  });

  describe('combined file stack + navigation path', () => {
    it('handles navigation within a nested file', () => {
      // Start at root, zoom into a node
      useNavigationStore.getState().zoomIn('root-parent');

      // Push into a nested file
      useNestedCanvasStore.getState().pushFile('child.archc', makeGraph('child'));
      expect(useNavigationStore.getState().path).toEqual([]);

      // Navigate within the nested file
      useNavigationStore.getState().zoomIn('child-node-a');
      useNavigationStore.getState().zoomIn('child-node-b');
      expect(useNavigationStore.getState().path).toEqual(['child-node-a', 'child-node-b']);

      // Pop back: should restore root's navigation path
      useNestedCanvasStore.getState().popFile();
      expect(useNavigationStore.getState().path).toEqual(['root-parent']);
    });

    it('handles multiple file pushes with different navigation depths', () => {
      // Root: navigate to ['a', 'b']
      useNavigationStore.getState().zoomIn('a');
      useNavigationStore.getState().zoomIn('b');

      // Push file 1
      useNestedCanvasStore.getState().pushFile('file1.archc', makeGraph('file1'));
      useNavigationStore.getState().zoomIn('f1-node');

      // Push file 2
      useNestedCanvasStore.getState().pushFile('file2.archc', makeGraph('file2'));
      expect(useNavigationStore.getState().path).toEqual([]);

      // Pop file 2 → file 1 restored
      useNestedCanvasStore.getState().popFile();
      expect(useNavigationStore.getState().path).toEqual(['f1-node']);

      // Pop file 1 → root restored
      useNestedCanvasStore.getState().popFile();
      expect(useNavigationStore.getState().path).toEqual(['a', 'b']);
    });
  });

  describe('viewport restoration', () => {
    it('preserves unique viewport at each stack level', () => {
      // Root viewport
      useCanvasStore.getState().setViewport({ x: 0, y: 0, zoom: 1 });

      // Push level 1 with different viewport
      useNestedCanvasStore.getState().pushFile('l1.archc', makeGraph('l1'));
      useCanvasStore.getState().setViewport({ x: 100, y: 200, zoom: 0.5 });

      // Push level 2 with different viewport
      useNestedCanvasStore.getState().pushFile('l2.archc', makeGraph('l2'));
      useCanvasStore.getState().setViewport({ x: -50, y: -50, zoom: 2.0 });

      // Pop level 2 → level 1 viewport restored
      useNestedCanvasStore.getState().popFile();
      expect(useCanvasStore.getState().viewport).toEqual({ x: 100, y: 200, zoom: 0.5 });

      // Pop level 1 → root viewport restored
      useNestedCanvasStore.getState().popFile();
      expect(useCanvasStore.getState().viewport).toEqual({ x: 0, y: 0, zoom: 1 });
    });
  });
});
