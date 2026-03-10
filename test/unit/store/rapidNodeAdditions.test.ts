/**
 * Tests for Feature #229: Rapid node additions don't lose data.
 * Verifies that adding multiple nodes in quick succession preserves all of them.
 * Each node must exist in the architecture with correct type and display name.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock the fileIO module before importing coreStore
vi.mock('@/core/storage/fileIO', async () => {
  const actual =
    await vi.importActual<typeof import('@/core/storage/fileIO')>('@/core/storage/fileIO');
  return {
    ...actual,
    saveArchcFile: vi.fn(),
    saveArchcFileAs: vi.fn(),
    openArchcFile: vi.fn(),
    pickArchcFile: vi.fn(),
    deriveSummaryFileName: actual.deriveSummaryFileName,
    saveSummaryMarkdown: vi.fn(),
    decodeArchcData: vi.fn(),
    protoToGraphFull: actual.protoToGraphFull,
    graphToProto: actual.graphToProto,
  };
});

// Mock canvasStore to avoid ReactFlow dependency
vi.mock('@/store/canvasStore', () => ({
  useCanvasStore: {
    getState: () => ({
      viewport: { x: 0, y: 0, zoom: 1 },
      selectedNodeId: null,
      setViewport: vi.fn(),
      requestFitView: vi.fn(),
    }),
  },
}));

// Mock navigationStore
vi.mock('@/store/navigationStore', () => ({
  useNavigationStore: {
    getState: () => ({
      navigationPath: [],
    }),
  },
}));

// Mock layout
vi.mock('@/core/layout/elkLayout', () => ({
  applyElkLayout: vi.fn(),
}));

import { useGraphStore } from '@/store/graphStore';
import { useFileStore } from '@/store/fileStore';
import { useEngineStore } from '@/store/engineStore';
import { useHistoryStore } from '@/store/historyStore';
import type { ArchNode } from '@/types/graph';

describe("Feature #229: Rapid node additions don't lose data", () => {
  beforeEach(() => {
    useGraphStore.setState({ isDirty: false, nodeCount: 0, edgeCount: 0 }); useFileStore.setState({ isSaving: false }); useEngineStore.setState({ initialized: false }); useHistoryStore.setState({ canUndo: false, canRedo: false });
    useEngineStore.getState().initialize();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('adding 5 nodes in quick succession', () => {
    it('all 5 nodes exist in the graph after rapid addition', () => {
      const nodes: (ArchNode | undefined)[] = [];
      for (let i = 0; i < 5; i++) {
        const node = useGraphStore.getState().addNode({
          type: 'compute/service',
          displayName: `RapidNode-${i}`,
          position: { x: i * 150, y: 0 },
        });
        nodes.push(node);
      }

      const graph = useGraphStore.getState().graph;
      expect(graph.nodes).toHaveLength(5);
    });

    it('each node has a unique ID', () => {
      const nodeIds: string[] = [];
      for (let i = 0; i < 5; i++) {
        const node = useGraphStore.getState().addNode({
          type: 'compute/service',
          displayName: `RapidNode-${i}`,
          position: { x: i * 150, y: 0 },
        });
        expect(node).toBeDefined();
        nodeIds.push(node!.id);
      }

      // All IDs should be unique
      const uniqueIds = new Set(nodeIds);
      expect(uniqueIds.size).toBe(5);
    });

    it('each node has the correct type', () => {
      for (let i = 0; i < 5; i++) {
        useGraphStore.getState().addNode({
          type: 'compute/service',
          displayName: `RapidNode-${i}`,
          position: { x: i * 150, y: 0 },
        });
      }

      const graph = useGraphStore.getState().graph;
      for (const node of graph.nodes) {
        expect(node.type).toBe('compute/service');
      }
    });

    it('each node has the correct display name', () => {
      for (let i = 0; i < 5; i++) {
        useGraphStore.getState().addNode({
          type: 'compute/service',
          displayName: `RapidNode-${i}`,
          position: { x: i * 150, y: 0 },
        });
      }

      const graph = useGraphStore.getState().graph;
      const displayNames = graph.nodes.map((n) => n.displayName).sort();
      expect(displayNames).toEqual([
        'RapidNode-0',
        'RapidNode-1',
        'RapidNode-2',
        'RapidNode-3',
        'RapidNode-4',
      ]);
    });

    it('nodeCount is consistent after rapid additions', () => {
      for (let i = 0; i < 5; i++) {
        useGraphStore.getState().addNode({
          type: 'compute/service',
          displayName: `RapidNode-${i}`,
          position: { x: i * 150, y: 0 },
        });
      }

      expect(useGraphStore.getState().nodeCount).toBe(5);
      expect(useGraphStore.getState().graph.nodes).toHaveLength(5);
    });
  });

  describe('mixed types in rapid succession', () => {
    it('rapid additions with different types preserve all nodes', () => {
      const types = [
        'compute/service',
        'data/database',
        'messaging/queue',
        'network/loadbalancer',
        'observability/logger',
      ];

      for (let i = 0; i < 5; i++) {
        useGraphStore.getState().addNode({
          type: types[i],
          displayName: `MixedNode-${i}`,
          position: { x: i * 150, y: 0 },
        });
      }

      const graph = useGraphStore.getState().graph;
      expect(graph.nodes).toHaveLength(5);

      const nodeTypes = graph.nodes.map((n) => n.type).sort();
      expect(nodeTypes).toEqual([...types].sort());
    });

    it('each mixed-type node has correct display name', () => {
      const types = [
        'compute/service',
        'data/database',
        'messaging/queue',
        'network/loadbalancer',
        'observability/logger',
      ];

      const createdNodes: ArchNode[] = [];
      for (let i = 0; i < 5; i++) {
        const node = useGraphStore.getState().addNode({
          type: types[i],
          displayName: `MixedNode-${i}`,
          position: { x: i * 150, y: 0 },
        });
        expect(node).toBeDefined();
        createdNodes.push(node!);
      }

      // Each returned node has the correct display name
      for (let i = 0; i < 5; i++) {
        expect(createdNodes[i].displayName).toBe(`MixedNode-${i}`);
      }
    });
  });

  describe('state consistency during rapid additions', () => {
    it('isDirty is set after first addition', () => {
      expect(useGraphStore.getState().isDirty).toBe(false);

      useGraphStore.getState().addNode({
        type: 'compute/service',
        displayName: 'First',
        position: { x: 0, y: 0 },
      });

      expect(useGraphStore.getState().isDirty).toBe(true);
    });

    it('nodeCount increments correctly for each addition', () => {
      for (let i = 0; i < 5; i++) {
        useGraphStore.getState().addNode({
          type: 'compute/service',
          displayName: `Node-${i}`,
          position: { x: i * 150, y: 0 },
        });
        expect(useGraphStore.getState().nodeCount).toBe(i + 1);
      }
    });

    it('canUndo is true after additions', () => {
      expect(useHistoryStore.getState().canUndo).toBe(false);

      useGraphStore.getState().addNode({
        type: 'compute/service',
        displayName: 'First',
        position: { x: 0, y: 0 },
      });

      expect(useHistoryStore.getState().canUndo).toBe(true);
    });

    it('undo history has entry for each addition', () => {
      for (let i = 0; i < 5; i++) {
        useGraphStore.getState().addNode({
          type: 'compute/service',
          displayName: `Node-${i}`,
          position: { x: i * 150, y: 0 },
        });
      }

      // 1 initial + 5 additions = 6 total snapshots
      const undoManager = useEngineStore.getState().undoManager!;
      expect(undoManager.historyLength).toBe(6);
    });
  });

  describe('rapid additions + undo/redo', () => {
    it('undo after rapid additions removes the last node', () => {
      for (let i = 0; i < 5; i++) {
        useGraphStore.getState().addNode({
          type: 'compute/service',
          displayName: `Node-${i}`,
          position: { x: i * 150, y: 0 },
        });
      }

      useHistoryStore.getState().undo();
      expect(useGraphStore.getState().graph.nodes).toHaveLength(4);
      expect(useGraphStore.getState().nodeCount).toBe(4);
    });

    it('redo restores the last node after undo', () => {
      for (let i = 0; i < 5; i++) {
        useGraphStore.getState().addNode({
          type: 'compute/service',
          displayName: `Node-${i}`,
          position: { x: i * 150, y: 0 },
        });
      }

      useHistoryStore.getState().undo();
      expect(useGraphStore.getState().graph.nodes).toHaveLength(4);

      useHistoryStore.getState().redo();
      expect(useGraphStore.getState().graph.nodes).toHaveLength(5);
      expect(useGraphStore.getState().nodeCount).toBe(5);
    });

    it('multiple undos after rapid additions work correctly', () => {
      for (let i = 0; i < 5; i++) {
        useGraphStore.getState().addNode({
          type: 'compute/service',
          displayName: `Node-${i}`,
          position: { x: i * 150, y: 0 },
        });
      }

      // Undo all 5 additions
      for (let i = 5; i > 0; i--) {
        useHistoryStore.getState().undo();
        expect(useGraphStore.getState().graph.nodes).toHaveLength(i - 1);
        expect(useGraphStore.getState().nodeCount).toBe(i - 1);
      }

      // All nodes gone
      expect(useGraphStore.getState().graph.nodes).toHaveLength(0);
    });
  });

  describe('rapid additions at scale', () => {
    it('adding 20 nodes preserves all of them', () => {
      for (let i = 0; i < 20; i++) {
        useGraphStore.getState().addNode({
          type: 'compute/service',
          displayName: `BulkNode-${i}`,
          position: { x: (i % 5) * 150, y: Math.floor(i / 5) * 150 },
        });
      }

      expect(useGraphStore.getState().graph.nodes).toHaveLength(20);
      expect(useGraphStore.getState().nodeCount).toBe(20);

      // Verify each display name
      const names = useGraphStore
        .getState()
        .graph.nodes.map((n) => n.displayName)
        .sort();
      for (let i = 0; i < 20; i++) {
        expect(names).toContain(`BulkNode-${i}`);
      }
    });

    it('each of 20 nodes has correct position', () => {
      for (let i = 0; i < 20; i++) {
        useGraphStore.getState().addNode({
          type: 'compute/service',
          displayName: `BulkNode-${i}`,
          position: { x: i * 100, y: 50 },
        });
      }

      const graph = useGraphStore.getState().graph;
      expect(graph.nodes).toHaveLength(20);

      // Each node should have the position we assigned
      for (let i = 0; i < 20; i++) {
        const node = graph.nodes.find((n) => n.displayName === `BulkNode-${i}`);
        expect(node).toBeDefined();
        expect(node!.position.x).toBe(i * 100);
        expect(node!.position.y).toBe(50);
      }
    });
  });

  describe('edge count unchanged during node-only additions', () => {
    it('edge count stays at 0 when only adding nodes', () => {
      for (let i = 0; i < 5; i++) {
        useGraphStore.getState().addNode({
          type: 'compute/service',
          displayName: `Node-${i}`,
          position: { x: i * 150, y: 0 },
        });
        expect(useGraphStore.getState().edgeCount).toBe(0);
      }
    });
  });
});
