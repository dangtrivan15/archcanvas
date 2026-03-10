/**
 * Tests for P05-T1: Unified NavigationStore.
 *
 * Verifies the unified navigation store manages both fractal zoom (within-file)
 * and cross-file navigation in a single store:
 * - Fractal zoom via path/zoomIn/zoomOut/zoomToRoot/zoomToLevel (backward compat)
 * - Cross-file via fileStack/pushFile/popFile/popToRoot (backward compat)
 * - New unified actions: diveIntoNode, diveIntoFile, goUp, goToRoot, goToDepth
 * - Derived state: breadcrumb, currentDepth, currentNodePath, isAtRoot, fileDepth, nodeDepth
 * - Backward-compatible aliases work correctly
 * - nestedCanvasStore facade re-exports work
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useNavigationStore } from '@/store/navigationStore';
import { useNestedCanvasStore } from '@/store/nestedCanvasStore';
import { useCanvasStore } from '@/store/canvasStore';
import { useGraphStore } from '@/store/graphStore';
import type { ArchGraph } from '@/types/graph';
import type {
  BreadcrumbEntry,
  FileStackEntry,
  ParentEdgeIndicator,
} from '@/store/navigationStore';

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

/** Helper to create a graph with edges (for parent edge indicator tests). */
function makeGraphWithEdges(name: string): ArchGraph {
  return {
    name,
    description: `Graph with edges: ${name}`,
    owners: [],
    nodes: [
      {
        id: 'container',
        type: 'compute/service',
        displayName: 'Container',
        args: {},
        properties: {},
        children: [],
        codeRefs: [],
        notes: [],
        position: { x: 0, y: 0, width: 200, height: 100 },
      },
      {
        id: 'upstream',
        type: 'compute/service',
        displayName: 'Upstream',
        args: {},
        properties: {},
        children: [],
        codeRefs: [],
        notes: [],
        position: { x: -300, y: 0, width: 200, height: 100 },
      },
      {
        id: 'downstream',
        type: 'compute/service',
        displayName: 'Downstream',
        args: {},
        properties: {},
        children: [],
        codeRefs: [],
        notes: [],
        position: { x: 300, y: 0, width: 200, height: 100 },
      },
    ],
    edges: [
      {
        id: 'edge-in',
        fromNode: 'upstream',
        toNode: 'container',
        type: 'sync',
        label: 'calls',
        properties: {},
        notes: [],
      },
      {
        id: 'edge-out',
        fromNode: 'container',
        toNode: 'downstream',
        type: 'async',
        label: 'emits',
        properties: {},
        notes: [],
      },
    ],
    annotations: [],
  };
}

describe('P05-T1: Unified NavigationStore', () => {
  beforeEach(() => {
    // Reset all stores to initial state
    useNavigationStore.setState({
      path: [],
      fileStack: [],
      activeFilePath: null,
      parentEdgeIndicators: [],
      breadcrumb: [],
      currentDepth: 0,
      currentNodePath: [],
      isAtRoot: true,
      fileDepth: 0,
      nodeDepth: 0,
    });
    useCanvasStore.setState({ viewport: { x: 0, y: 0, zoom: 1 } });
    useGraphStore.setState({
      graph: makeGraph('root'),
      nodeCount: 1,
      edgeCount: 0,
    });
  });

  // ── Unified Store Identity ──────────────────────────────────

  describe('nestedCanvasStore facade', () => {
    it('useNestedCanvasStore is the same store as useNavigationStore', () => {
      expect(useNestedCanvasStore).toBe(useNavigationStore);
    });

    it('facade exports FileStackEntry and ParentEdgeIndicator types', () => {
      // TypeScript compile-time check — these types should be re-exportable
      const entry: FileStackEntry = {
        filePath: 'test.archc',
        graph: makeGraph('test'),
        navigationPath: [],
        viewport: { x: 0, y: 0, zoom: 1 },
      };
      expect(entry.filePath).toBe('test.archc');

      const indicator: ParentEdgeIndicator = {
        edge: {
          id: 'e1',
          fromNode: 'a',
          toNode: 'b',
          type: 'sync',
          properties: {},
          notes: [],
        },
        connectedNodeName: 'NodeA',
        connectedNodeId: 'a',
        direction: 'incoming',
      };
      expect(indicator.direction).toBe('incoming');
    });
  });

  // ── Initial State ──────────────────────────────────────────

  describe('initial state', () => {
    it('starts with empty path', () => {
      expect(useNavigationStore.getState().path).toEqual([]);
    });

    it('starts with empty fileStack', () => {
      expect(useNavigationStore.getState().fileStack).toEqual([]);
    });

    it('starts with null activeFilePath', () => {
      expect(useNavigationStore.getState().activeFilePath).toBeNull();
    });

    it('starts with empty parentEdgeIndicators', () => {
      expect(useNavigationStore.getState().parentEdgeIndicators).toEqual([]);
    });

    it('starts with empty breadcrumb', () => {
      expect(useNavigationStore.getState().breadcrumb).toEqual([]);
    });

    it('starts at depth 0', () => {
      expect(useNavigationStore.getState().currentDepth).toBe(0);
    });

    it('starts at root', () => {
      expect(useNavigationStore.getState().isAtRoot).toBe(true);
    });

    it('starts with 0 fileDepth and nodeDepth', () => {
      expect(useNavigationStore.getState().fileDepth).toBe(0);
      expect(useNavigationStore.getState().nodeDepth).toBe(0);
    });
  });

  // ── Derived State ──────────────────────────────────────────

  describe('derived state', () => {
    it('currentNodePath is the same as path', () => {
      useNavigationStore.getState().zoomIn('a');
      useNavigationStore.getState().zoomIn('b');
      const state = useNavigationStore.getState();
      expect(state.currentNodePath).toEqual(state.path);
      expect(state.currentNodePath).toEqual(['a', 'b']);
    });

    it('currentDepth reflects path.length + fileStack.length', () => {
      useNavigationStore.getState().zoomIn('a');
      expect(useNavigationStore.getState().currentDepth).toBe(1);

      useNavigationStore.getState().pushFile('child.archc', makeGraph('child'));
      // fileStack has 1 entry, path is reset to []
      expect(useNavigationStore.getState().currentDepth).toBe(1);

      useNavigationStore.getState().zoomIn('b');
      expect(useNavigationStore.getState().currentDepth).toBe(2);
    });

    it('isAtRoot is true only when path and fileStack are both empty', () => {
      expect(useNavigationStore.getState().isAtRoot).toBe(true);

      useNavigationStore.getState().zoomIn('a');
      expect(useNavigationStore.getState().isAtRoot).toBe(false);

      useNavigationStore.getState().zoomOut();
      expect(useNavigationStore.getState().isAtRoot).toBe(true);
    });

    it('fileDepth tracks number of file entries', () => {
      expect(useNavigationStore.getState().fileDepth).toBe(0);

      useNavigationStore.getState().pushFile('a.archc', makeGraph('a'));
      expect(useNavigationStore.getState().fileDepth).toBe(1);

      useNavigationStore.getState().pushFile('b.archc', makeGraph('b'));
      expect(useNavigationStore.getState().fileDepth).toBe(2);
    });

    it('nodeDepth tracks path length within current file', () => {
      useNavigationStore.getState().zoomIn('a');
      useNavigationStore.getState().zoomIn('b');
      expect(useNavigationStore.getState().nodeDepth).toBe(2);

      // Push file resets path, so nodeDepth goes to 0
      useNavigationStore.getState().pushFile('child.archc', makeGraph('child'));
      expect(useNavigationStore.getState().nodeDepth).toBe(0);

      useNavigationStore.getState().zoomIn('c');
      expect(useNavigationStore.getState().nodeDepth).toBe(1);
    });
  });

  // ── Breadcrumb ──────────────────────────────────────────────

  describe('breadcrumb', () => {
    it('builds breadcrumb from node path only', () => {
      useNavigationStore.getState().zoomIn('a');
      useNavigationStore.getState().zoomIn('b');

      const crumbs = useNavigationStore.getState().breadcrumb;
      expect(crumbs).toHaveLength(2);
      expect(crumbs[0]!.type).toBe('node');
      expect(crumbs[0]!.id).toBe('a');
      expect(crumbs[1]!.type).toBe('node');
      expect(crumbs[1]!.id).toBe('b');
    });

    it('builds breadcrumb with file entries interleaved', () => {
      useNavigationStore.getState().zoomIn('a');
      useNavigationStore.getState().pushFile('child.archc', makeGraph('child'));
      useNavigationStore.getState().zoomIn('b');

      const crumbs = useNavigationStore.getState().breadcrumb;
      // Should have: node 'a' from saved path, file entry, node 'b' from current path
      expect(crumbs.length).toBeGreaterThanOrEqual(3);

      const fileEntries = crumbs.filter((c: BreadcrumbEntry) => c.type === 'file');
      expect(fileEntries).toHaveLength(1);

      const nodeEntries = crumbs.filter((c: BreadcrumbEntry) => c.type === 'node');
      expect(nodeEntries.length).toBeGreaterThanOrEqual(2);
    });

    it('breadcrumb is empty at root', () => {
      expect(useNavigationStore.getState().breadcrumb).toEqual([]);
    });
  });

  // ── Unified Actions ─────────────────────────────────────────

  describe('diveIntoNode', () => {
    it('appends to path (same as zoomIn)', () => {
      useNavigationStore.getState().diveIntoNode('a');
      expect(useNavigationStore.getState().path).toEqual(['a']);

      useNavigationStore.getState().diveIntoNode('b');
      expect(useNavigationStore.getState().path).toEqual(['a', 'b']);
    });
  });

  describe('diveIntoFile', () => {
    it('pushes current state and switches graph', () => {
      const childGraph = makeGraph('child');
      useNavigationStore.getState().diveIntoFile('child.archc', childGraph);

      expect(useNavigationStore.getState().fileStack).toHaveLength(1);
      expect(useNavigationStore.getState().activeFilePath).toBe('child.archc');
      expect(useNavigationStore.getState().path).toEqual([]);
      expect(useGraphStore.getState().graph.name).toBe('child');
    });

    it('captures parent edge indicators when containerNodeId is provided', () => {
      // Set up a graph with edges
      const graphWithEdges = makeGraphWithEdges('root');
      useGraphStore.setState({ graph: graphWithEdges });

      const childGraph = makeGraph('child');
      useNavigationStore.getState().diveIntoFile(
        'child.archc',
        childGraph,
        'container',
        '#ff0000',
      );

      const indicators = useNavigationStore.getState().parentEdgeIndicators;
      expect(indicators).toHaveLength(2);

      const incoming = indicators.find((i: ParentEdgeIndicator) => i.direction === 'incoming');
      expect(incoming).toBeDefined();
      expect(incoming!.connectedNodeName).toBe('Upstream');

      const outgoing = indicators.find((i: ParentEdgeIndicator) => i.direction === 'outgoing');
      expect(outgoing).toBeDefined();
      expect(outgoing!.connectedNodeName).toBe('Downstream');
    });
  });

  describe('goUp', () => {
    it('pops node level when path is non-empty', () => {
      useNavigationStore.getState().zoomIn('a');
      useNavigationStore.getState().zoomIn('b');

      useNavigationStore.getState().goUp();
      expect(useNavigationStore.getState().path).toEqual(['a']);
    });

    it('pops file level when path is empty', () => {
      useNavigationStore.getState().pushFile('child.archc', makeGraph('child'));

      useNavigationStore.getState().goUp();
      expect(useNavigationStore.getState().fileStack).toHaveLength(0);
      expect(useNavigationStore.getState().activeFilePath).toBeNull();
    });

    it('no-op when at root', () => {
      useNavigationStore.getState().goUp();
      expect(useNavigationStore.getState().path).toEqual([]);
      expect(useNavigationStore.getState().fileStack).toHaveLength(0);
    });
  });

  describe('goToRoot', () => {
    it('clears path when no files are stacked', () => {
      useNavigationStore.getState().zoomIn('a');
      useNavigationStore.getState().zoomIn('b');

      useNavigationStore.getState().goToRoot();
      expect(useNavigationStore.getState().path).toEqual([]);
      expect(useNavigationStore.getState().isAtRoot).toBe(true);
    });

    it('pops all files and clears path', () => {
      useNavigationStore.getState().zoomIn('a');
      useNavigationStore.getState().pushFile('child.archc', makeGraph('child'));
      useNavigationStore.getState().zoomIn('b');

      useNavigationStore.getState().goToRoot();
      expect(useNavigationStore.getState().path).toEqual([]);
      expect(useNavigationStore.getState().fileStack).toHaveLength(0);
      expect(useNavigationStore.getState().isAtRoot).toBe(true);
    });
  });

  describe('goToDepth', () => {
    it('truncates path to the specified node depth', () => {
      useNavigationStore.getState().zoomIn('a');
      useNavigationStore.getState().zoomIn('b');
      useNavigationStore.getState().zoomIn('c');

      useNavigationStore.getState().goToDepth(1); // keep a and b (indices 0 and 1)
      expect(useNavigationStore.getState().path).toEqual(['a', 'b']);
    });

    it('no-op for out-of-bounds index', () => {
      useNavigationStore.getState().zoomIn('a');

      useNavigationStore.getState().goToDepth(10);
      expect(useNavigationStore.getState().path).toEqual(['a']);

      useNavigationStore.getState().goToDepth(-1);
      expect(useNavigationStore.getState().path).toEqual(['a']);
    });
  });

  describe('reset', () => {
    it('clears all navigation state', () => {
      useNavigationStore.getState().zoomIn('a');
      useNavigationStore.getState().pushFile('child.archc', makeGraph('child'));
      useNavigationStore.getState().zoomIn('b');

      useNavigationStore.getState().reset();

      const state = useNavigationStore.getState();
      expect(state.path).toEqual([]);
      expect(state.fileStack).toEqual([]);
      expect(state.activeFilePath).toBeNull();
      expect(state.parentEdgeIndicators).toEqual([]);
      expect(state.breadcrumb).toEqual([]);
      expect(state.currentDepth).toBe(0);
      expect(state.isAtRoot).toBe(true);
    });
  });

  // ── Backward Compatibility: zoomIn/zoomOut/zoomToRoot/zoomToLevel ──

  describe('backward-compatible fractal zoom', () => {
    it('zoomIn appends to path', () => {
      useNavigationStore.getState().zoomIn('node-a');
      expect(useNavigationStore.getState().path).toEqual(['node-a']);
    });

    it('zoomOut removes last from path', () => {
      useNavigationStore.getState().zoomIn('a');
      useNavigationStore.getState().zoomIn('b');
      useNavigationStore.getState().zoomOut();
      expect(useNavigationStore.getState().path).toEqual(['a']);
    });

    it('zoomOut from empty path is a no-op', () => {
      useNavigationStore.getState().zoomOut();
      expect(useNavigationStore.getState().path).toEqual([]);
    });

    it('zoomToRoot clears path', () => {
      useNavigationStore.getState().zoomIn('a');
      useNavigationStore.getState().zoomIn('b');
      useNavigationStore.getState().zoomToRoot();
      expect(useNavigationStore.getState().path).toEqual([]);
    });

    it('zoomToLevel sets path directly', () => {
      useNavigationStore.getState().zoomToLevel(['x', 'y', 'z']);
      expect(useNavigationStore.getState().path).toEqual(['x', 'y', 'z']);
    });

    it('zoomToLevel replaces existing path', () => {
      useNavigationStore.getState().zoomIn('old');
      useNavigationStore.getState().zoomToLevel(['new-a', 'new-b']);
      expect(useNavigationStore.getState().path).toEqual(['new-a', 'new-b']);
    });
  });

  // ── Backward Compatibility: fileStack facade ────────────────

  describe('backward-compatible file stack', () => {
    it('pushFile saves current state and switches graph', () => {
      useNavigationStore.getState().pushFile('child.archc', makeGraph('child'));

      expect(useNavigationStore.getState().fileStack).toHaveLength(1);
      expect(useNavigationStore.getState().activeFilePath).toBe('child.archc');
      expect(useGraphStore.getState().graph.name).toBe('child');
    });

    it('popFile restores parent state', () => {
      const rootGraph = useGraphStore.getState().graph;
      useNavigationStore.getState().pushFile('child.archc', makeGraph('child'));

      const restored = useNavigationStore.getState().popFile();
      expect(restored).not.toBeNull();
      expect(useGraphStore.getState().graph.name).toBe(rootGraph.name);
    });

    it('popFile returns null when empty', () => {
      expect(useNavigationStore.getState().popFile()).toBeNull();
    });

    it('popToRoot restores root state from any depth', () => {
      const rootGraph = useGraphStore.getState().graph;
      useCanvasStore.getState().setViewport({ x: 42, y: 84, zoom: 0.5 });
      useNavigationStore.getState().zoomIn('root-child');

      useNavigationStore.getState().pushFile('a.archc', makeGraph('a'));
      useNavigationStore.getState().pushFile('b.archc', makeGraph('b'));

      const restored = useNavigationStore.getState().popToRoot();
      expect(restored).not.toBeNull();
      expect(useNavigationStore.getState().fileStack).toEqual([]);
      expect(useGraphStore.getState().graph.name).toBe(rootGraph.name);
      expect(useNavigationStore.getState().path).toEqual(['root-child']);
      expect(useCanvasStore.getState().viewport).toEqual({ x: 42, y: 84, zoom: 0.5 });
    });

    it('popToRoot returns null when already at root', () => {
      expect(useNavigationStore.getState().popToRoot()).toBeNull();
    });

    it('getDepth returns file stack length', () => {
      expect(useNavigationStore.getState().getDepth()).toBe(0);
      useNavigationStore.getState().pushFile('a.archc', makeGraph('a'));
      expect(useNavigationStore.getState().getDepth()).toBe(1);
      useNavigationStore.getState().pushFile('b.archc', makeGraph('b'));
      expect(useNavigationStore.getState().getDepth()).toBe(2);
    });

    it('getStackEntry returns entry at index', () => {
      useNavigationStore.getState().pushFile('a.archc', makeGraph('a'));
      useNavigationStore.getState().pushFile('b.archc', makeGraph('b'));

      const entry0 = useNavigationStore.getState().getStackEntry(0);
      expect(entry0).toBeDefined();
      expect(entry0!.filePath).toBe('__root__');

      const entry1 = useNavigationStore.getState().getStackEntry(1);
      expect(entry1).toBeDefined();
      expect(entry1!.filePath).toBe('a.archc');
    });

    it('getStackEntry returns undefined for out-of-bounds', () => {
      expect(useNavigationStore.getState().getStackEntry(0)).toBeUndefined();
    });
  });

  // ── Combined Navigation ────────────────────────────────────

  describe('combined fractal zoom + cross-file navigation', () => {
    it('path is preserved per-file level', () => {
      useNavigationStore.getState().zoomIn('root-a');
      useNavigationStore.getState().zoomIn('root-b');

      useNavigationStore.getState().pushFile('child.archc', makeGraph('child'));
      expect(useNavigationStore.getState().path).toEqual([]);

      useNavigationStore.getState().zoomIn('child-x');
      expect(useNavigationStore.getState().path).toEqual(['child-x']);

      useNavigationStore.getState().popFile();
      expect(useNavigationStore.getState().path).toEqual(['root-a', 'root-b']);
    });

    it('viewport is preserved per-file level', () => {
      useCanvasStore.getState().setViewport({ x: 100, y: 200, zoom: 0.5 });

      useNavigationStore.getState().pushFile('child.archc', makeGraph('child'));
      useCanvasStore.getState().setViewport({ x: -50, y: -50, zoom: 2.0 });

      useNavigationStore.getState().popFile();
      expect(useCanvasStore.getState().viewport).toEqual({ x: 100, y: 200, zoom: 0.5 });
    });

    it('zoomToRoot only clears node path, not file stack', () => {
      useNavigationStore.getState().pushFile('child.archc', makeGraph('child'));
      useNavigationStore.getState().zoomIn('a');
      useNavigationStore.getState().zoomIn('b');

      useNavigationStore.getState().zoomToRoot();
      expect(useNavigationStore.getState().path).toEqual([]);
      expect(useNavigationStore.getState().fileStack).toHaveLength(1);
    });

    it('zoomToLevel only affects node path, not file stack', () => {
      useNavigationStore.getState().pushFile('child.archc', makeGraph('child'));

      useNavigationStore.getState().zoomToLevel(['x', 'y']);
      expect(useNavigationStore.getState().path).toEqual(['x', 'y']);
      expect(useNavigationStore.getState().fileStack).toHaveLength(1);
    });

    it('deep nesting: 3 files + node paths at each level', () => {
      useNavigationStore.getState().zoomIn('root-node');
      useNavigationStore.getState().pushFile('a.archc', makeGraph('a'));
      useNavigationStore.getState().zoomIn('a-node');
      useNavigationStore.getState().pushFile('b.archc', makeGraph('b'));
      useNavigationStore.getState().zoomIn('b-node');
      useNavigationStore.getState().pushFile('c.archc', makeGraph('c'));

      expect(useNavigationStore.getState().fileDepth).toBe(3);
      expect(useNavigationStore.getState().path).toEqual([]);

      // Pop c -> b
      useNavigationStore.getState().popFile();
      expect(useNavigationStore.getState().path).toEqual(['b-node']);
      expect(useNavigationStore.getState().fileDepth).toBe(2);

      // Pop b -> a
      useNavigationStore.getState().popFile();
      expect(useNavigationStore.getState().path).toEqual(['a-node']);
      expect(useNavigationStore.getState().fileDepth).toBe(1);

      // Pop a -> root
      useNavigationStore.getState().popFile();
      expect(useNavigationStore.getState().path).toEqual(['root-node']);
      expect(useNavigationStore.getState().fileDepth).toBe(0);
    });
  });

  // ── Parent Edge Indicators ──────────────────────────────────

  describe('parent edge indicators', () => {
    it('captures incoming and outgoing edges on diveIntoFile', () => {
      const graphWithEdges = makeGraphWithEdges('root');
      useGraphStore.setState({ graph: graphWithEdges });

      useNavigationStore.getState().diveIntoFile(
        'child.archc',
        makeGraph('child'),
        'container',
      );

      const indicators = useNavigationStore.getState().parentEdgeIndicators;
      expect(indicators).toHaveLength(2);

      const incoming = indicators.find((i: ParentEdgeIndicator) => i.direction === 'incoming');
      expect(incoming).toBeDefined();
      expect(incoming!.connectedNodeId).toBe('upstream');

      const outgoing = indicators.find((i: ParentEdgeIndicator) => i.direction === 'outgoing');
      expect(outgoing).toBeDefined();
      expect(outgoing!.connectedNodeId).toBe('downstream');
    });

    it('clears indicators on popFile', () => {
      const graphWithEdges = makeGraphWithEdges('root');
      useGraphStore.setState({ graph: graphWithEdges });

      useNavigationStore.getState().diveIntoFile(
        'child.archc',
        makeGraph('child'),
        'container',
      );
      expect(useNavigationStore.getState().parentEdgeIndicators).toHaveLength(2);

      useNavigationStore.getState().popFile();
      expect(useNavigationStore.getState().parentEdgeIndicators).toEqual([]);
    });

    it('empty when no containerNodeId is provided', () => {
      useNavigationStore.getState().diveIntoFile('child.archc', makeGraph('child'));
      expect(useNavigationStore.getState().parentEdgeIndicators).toEqual([]);
    });
  });
});
