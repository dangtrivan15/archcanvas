// @vitest-environment happy-dom
/**
 * Tests for Feature #228: Undo during save doesn't corrupt state.
 * Verifies that performing undo/redo while a save operation is in progress
 * doesn't corrupt data. The save should complete with the original graph,
 * and undo should apply correctly to in-memory state. The isDirty flag
 * must remain true if the graph changed during save.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useUIStore } from '@/store/uiStore';
import type { StorageHandle } from '@/core/storage/types';

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

// Now import the modules
import { useGraphStore } from '@/store/graphStore';
import { useFileStore } from '@/store/fileStore';
import { useEngineStore } from '@/store/engineStore';
import { useHistoryStore } from '@/store/historyStore';
import type { ArchGraph } from '@/types/graph';

// Create mock StorageManager functions
const mockSaveArchitecture = vi.fn();
const mockSaveArchitectureAs = vi.fn();

const mockStorageManager = {
  saveArchitecture: mockSaveArchitecture,
  saveArchitectureAs: mockSaveArchitectureAs,
  openArchitecture: vi.fn(),
  backendType: 'test',
  capabilities: { supportsDirectWrite: true, supportsLastModified: false },
};

const fakeStorageHandle: StorageHandle = {
  backend: 'test',
  name: 'test.archc',
  _internal: { name: 'test.archc' },
};

// Helper: create a graph with N nodes
function createGraphWithNodes(count: number, baseName = 'Node'): ArchGraph {
  const nodes = [];
  for (let i = 0; i < count; i++) {
    nodes.push({
      id: `node-${i}`,
      type: 'service',
      displayName: `${baseName} ${i}`,
      args: {},
      codeRefs: [],
      notes: [],
      properties: {},
      position: { x: i * 100, y: 0 },
      children: [],
    });
  }
  return {
    name: `Test Architecture (${count} nodes)`,
    description: '',
    owners: [],
    nodes,
    edges: [],
  };
}

describe('Feature #228: Undo during save does not corrupt state', () => {
  beforeEach(() => {
    // Reset UI store
    useUIStore.setState({
      errorDialogOpen: false,
      errorDialogInfo: null,
      fileOperationLoading: false,
      fileOperationMessage: null,
    });

    // Reset mocks
    mockSaveArchitecture.mockReset();
    mockSaveArchitectureAs.mockReset();

    // Reset core store
    useGraphStore.setState({ isDirty: false, graph: createGraphWithNodes(0), nodeCount: 0, edgeCount: 0 }); useFileStore.setState({ isSaving: false, fileHandle: null, fileName: 'Untitled Architecture', fileCreatedAtMs: null }); useEngineStore.setState({ initialized: false }); useHistoryStore.setState({ canUndo: false, canRedo: false });
    useEngineStore.getState().initialize();
    // Inject mock storageManager
    useEngineStore.setState({ storageManager: mockStorageManager as any });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('save captures graph at start, undo changes in-memory state', () => {
    it('save operation uses the graph captured at save start', async () => {
      const graph3Nodes = createGraphWithNodes(3);
      useGraphStore.setState({ graph: graph3Nodes, isDirty: true, nodeCount: 3 }); useFileStore.setState({ fileHandle: fakeStorageHandle });

      // Save resolves immediately
      mockSaveArchitecture.mockResolvedValue(fakeStorageHandle);

      await useFileStore.getState().saveFile();

      // storageManager.saveArchitecture should have been called with the 3-node graph
      expect(mockSaveArchitecture).toHaveBeenCalledTimes(1);
      const savedGraph = mockSaveArchitecture.mock.calls[0][0];
      expect(savedGraph.nodes).toHaveLength(3);
    });

    it('undo during save changes in-memory graph while save writes original', async () => {
      // Setup: add 3 nodes with undo history so we can undo
      const store = useEngineStore.getState();
      const graph1 = createGraphWithNodes(1);
      const graph2 = createGraphWithNodes(2);
      const graph3 = createGraphWithNodes(3);

      // Set up undo history: graph1 -> graph2 -> graph3 (current)
      store.undoManager!.snapshot('Initial', graph1);
      store.undoManager!.snapshot('Add node 2', graph2);
      store.undoManager!.snapshot('Add node 3', graph3);

      // TextApi needs the current graph
      store.textApi!.setGraph(graph3);

      useGraphStore.setState({ graph: graph3, isDirty: true, nodeCount: 3 }); useFileStore.setState({ fileHandle: fakeStorageHandle }); useHistoryStore.setState({ canUndo: true, canRedo: false });

      // Make save hang until we resolve it
      let resolveSave!: (value: StorageHandle) => void;
      const savePromise = new Promise<StorageHandle>((resolve) => {
        resolveSave = resolve;
      });
      mockSaveArchitecture.mockReturnValue(savePromise);

      // Start save (captures graph3)
      const saveResult = useFileStore.getState().saveFile();

      // Verify save is in progress
      expect(useFileStore.getState().isSaving).toBe(true);

      // Now perform undo while save is in progress
      useHistoryStore.getState().undo();

      // In-memory graph should now be graph2 (2 nodes)
      expect(useGraphStore.getState().graph.nodes).toHaveLength(2);
      expect(useGraphStore.getState().nodeCount).toBe(2);

      // But saveArchitecture was called with graph3 (3 nodes) - the original
      const savedGraph = mockSaveArchitecture.mock.calls[0][0];
      expect(savedGraph.nodes).toHaveLength(3);

      // Complete the save
      resolveSave(fakeStorageHandle);
      await saveResult;

      // After save completes, in-memory graph should still be graph2 (undo result)
      expect(useGraphStore.getState().graph.nodes).toHaveLength(2);
    });

    it('isDirty remains true when undo happens during save', async () => {
      const store = useEngineStore.getState();
      const graph1 = createGraphWithNodes(1);
      const graph2 = createGraphWithNodes(2);

      store.undoManager!.snapshot('Initial', graph1);
      store.undoManager!.snapshot('Add node 2', graph2);
      store.textApi!.setGraph(graph2);

      useGraphStore.setState({ graph: graph2, isDirty: true, nodeCount: 2 }); useFileStore.setState({ fileHandle: fakeStorageHandle }); useHistoryStore.setState({ canUndo: true });

      // Slow save
      let resolveSave!: (value: StorageHandle) => void;
      mockSaveArchitecture.mockReturnValue(
        new Promise<StorageHandle>((r) => {
          resolveSave = r;
        }),
      );

      // Start save (captures graph2)
      const saveResult = useFileStore.getState().saveFile();

      // Undo during save -> in-memory changes to graph1
      useHistoryStore.getState().undo();
      expect(useGraphStore.getState().isDirty).toBe(true);

      // Complete save
      resolveSave(fakeStorageHandle);
      await saveResult;

      // isDirty must remain true because in-memory (graph1) differs from saved file (graph2)
      expect(useGraphStore.getState().isDirty).toBe(true);
    });

    it('isDirty is false when no mutation happens during save', async () => {
      const graph2 = createGraphWithNodes(2);
      useGraphStore.setState({ graph: graph2, isDirty: true, nodeCount: 2 }); useFileStore.setState({ fileHandle: fakeStorageHandle });

      mockSaveArchitecture.mockResolvedValue(fakeStorageHandle);
      await useFileStore.getState().saveFile();

      // No undo during save -> isDirty should be false
      expect(useGraphStore.getState().isDirty).toBe(false);
    });
  });

  describe('architecture state consistency after undo during save', () => {
    it('node count is consistent with graph after undo during save', async () => {
      const store = useEngineStore.getState();
      const graph2 = createGraphWithNodes(2);
      const graph3 = createGraphWithNodes(3);

      store.undoManager!.snapshot('2 nodes', graph2);
      store.undoManager!.snapshot('3 nodes', graph3);
      store.textApi!.setGraph(graph3);

      useGraphStore.setState({ graph: graph3, isDirty: true, nodeCount: 3 }); useFileStore.setState({ fileHandle: fakeStorageHandle }); useHistoryStore.setState({ canUndo: true });

      let resolveSave!: (value: StorageHandle) => void;
      mockSaveArchitecture.mockReturnValue(
        new Promise<StorageHandle>((r) => {
          resolveSave = r;
        }),
      );

      const saveResult = useFileStore.getState().saveFile();
      useHistoryStore.getState().undo();

      // nodeCount should match in-memory graph
      expect(useGraphStore.getState().nodeCount).toBe(2);
      expect(useGraphStore.getState().graph.nodes).toHaveLength(2);

      resolveSave(fakeStorageHandle);
      await saveResult;

      // Still consistent after save completes
      expect(useGraphStore.getState().nodeCount).toBe(2);
      expect(useGraphStore.getState().graph.nodes).toHaveLength(2);
    });

    it('edge count is consistent with graph after undo during save', async () => {
      const store = useEngineStore.getState();

      // Create graphs with different edge counts
      const graphNoEdges = createGraphWithNodes(2);
      const graphWithEdge: ArchGraph = {
        ...createGraphWithNodes(2),
        edges: [
          {
            id: 'edge-1',
            fromNode: 'node-0',
            toNode: 'node-1',
            type: 'SYNC' as any,
            label: 'calls',
            properties: {},
            notes: [],
          },
        ],
      };

      store.undoManager!.snapshot('No edges', graphNoEdges);
      store.undoManager!.snapshot('With edge', graphWithEdge);
      store.textApi!.setGraph(graphWithEdge);

      useGraphStore.setState({ graph: graphWithEdge, isDirty: true, nodeCount: 2, edgeCount: 1 }); useFileStore.setState({ fileHandle: fakeStorageHandle }); useHistoryStore.setState({ canUndo: true });

      let resolveSave!: (value: StorageHandle) => void;
      mockSaveArchitecture.mockReturnValue(
        new Promise<StorageHandle>((r) => {
          resolveSave = r;
        }),
      );

      const saveResult = useFileStore.getState().saveFile();
      useHistoryStore.getState().undo();

      // Edge count should reflect undone state
      expect(useGraphStore.getState().edgeCount).toBe(0);
      expect(useGraphStore.getState().graph.edges).toHaveLength(0);

      resolveSave(fakeStorageHandle);
      await saveResult;

      // Still consistent
      expect(useGraphStore.getState().edgeCount).toBe(0);
    });

    it('undo/redo flags are correct after undo during save', async () => {
      const store = useEngineStore.getState();
      const graph1 = createGraphWithNodes(1);
      const graph2 = createGraphWithNodes(2);
      const graph3 = createGraphWithNodes(3);

      store.undoManager!.snapshot('1 node', graph1);
      store.undoManager!.snapshot('2 nodes', graph2);
      store.undoManager!.snapshot('3 nodes', graph3);
      store.textApi!.setGraph(graph3);

      useGraphStore.setState({ graph: graph3, isDirty: true, nodeCount: 3 }); useFileStore.setState({ fileHandle: fakeStorageHandle }); useHistoryStore.setState({ canUndo: true, canRedo: false });

      let resolveSave!: (value: StorageHandle) => void;
      mockSaveArchitecture.mockReturnValue(
        new Promise<StorageHandle>((r) => {
          resolveSave = r;
        }),
      );

      const saveResult = useFileStore.getState().saveFile();
      useHistoryStore.getState().undo();

      // After undo, canRedo should be true (can redo back to graph3)
      expect(useHistoryStore.getState().canUndo).toBe(true);
      expect(useHistoryStore.getState().canRedo).toBe(true);

      resolveSave(fakeStorageHandle);
      await saveResult;

      // Undo/redo flags unchanged by save completion
      expect(useHistoryStore.getState().canUndo).toBe(true);
      expect(useHistoryStore.getState().canRedo).toBe(true);
    });
  });

  describe('redo during save', () => {
    it('redo during save keeps isDirty true', async () => {
      const store = useEngineStore.getState();
      const graph1 = createGraphWithNodes(1);
      const graph2 = createGraphWithNodes(2);

      store.undoManager!.snapshot('1 node', graph1);
      store.undoManager!.snapshot('2 nodes', graph2);
      store.textApi!.setGraph(graph2);

      useGraphStore.setState({ graph: graph2, isDirty: true, nodeCount: 2 }); useFileStore.setState({ fileHandle: fakeStorageHandle }); useHistoryStore.setState({ canUndo: true });

      // Undo first (before save) -> graph1
      useHistoryStore.getState().undo();
      expect(useGraphStore.getState().graph.nodes).toHaveLength(1);

      // Now start save with graph1
      let resolveSave!: (value: StorageHandle) => void;
      mockSaveArchitecture.mockReturnValue(
        new Promise<StorageHandle>((r) => {
          resolveSave = r;
        }),
      );

      const saveResult = useFileStore.getState().saveFile();

      // Redo during save -> graph2
      useHistoryStore.getState().redo();
      expect(useGraphStore.getState().graph.nodes).toHaveLength(2);

      // Complete save (saved graph1)
      resolveSave(fakeStorageHandle);
      await saveResult;

      // isDirty should be true because in-memory (graph2) != saved (graph1)
      expect(useGraphStore.getState().isDirty).toBe(true);
    });
  });

  describe('multiple undos during save', () => {
    it('multiple undos during save all apply correctly', async () => {
      const store = useEngineStore.getState();
      const graph1 = createGraphWithNodes(1);
      const graph2 = createGraphWithNodes(2);
      const graph3 = createGraphWithNodes(3);
      const graph4 = createGraphWithNodes(4);

      store.undoManager!.snapshot('1 node', graph1);
      store.undoManager!.snapshot('2 nodes', graph2);
      store.undoManager!.snapshot('3 nodes', graph3);
      store.undoManager!.snapshot('4 nodes', graph4);
      store.textApi!.setGraph(graph4);

      useGraphStore.setState({ graph: graph4, isDirty: true, nodeCount: 4 }); useFileStore.setState({ fileHandle: fakeStorageHandle }); useHistoryStore.setState({ canUndo: true });

      let resolveSave!: (value: StorageHandle) => void;
      mockSaveArchitecture.mockReturnValue(
        new Promise<StorageHandle>((r) => {
          resolveSave = r;
        }),
      );

      const saveResult = useFileStore.getState().saveFile();

      // Two undos during save: 4->3->2
      useHistoryStore.getState().undo();
      expect(useGraphStore.getState().graph.nodes).toHaveLength(3);
      useHistoryStore.getState().undo();
      expect(useGraphStore.getState().graph.nodes).toHaveLength(2);

      // Save was called with original 4-node graph
      expect(mockSaveArchitecture.mock.calls[0][0].nodes).toHaveLength(4);

      // Complete save
      resolveSave(fakeStorageHandle);
      await saveResult;

      // In-memory is graph2 (2 nodes), isDirty remains true
      expect(useGraphStore.getState().graph.nodes).toHaveLength(2);
      expect(useGraphStore.getState().isDirty).toBe(true);
    });
  });

  describe('saveFileAs with undo during save', () => {
    it('isDirty remains true when undo happens during saveFileAs', async () => {
      const store = useEngineStore.getState();
      const graph1 = createGraphWithNodes(1);
      const graph2 = createGraphWithNodes(2);

      store.undoManager!.snapshot('1 node', graph1);
      store.undoManager!.snapshot('2 nodes', graph2);
      store.textApi!.setGraph(graph2);

      useGraphStore.setState({ graph: graph2, isDirty: true, nodeCount: 2 }); useHistoryStore.setState({ canUndo: true });

      let resolveSave!: (value: any) => void;
      mockSaveArchitectureAs.mockReturnValue(
        new Promise((r) => {
          resolveSave = r;
        }),
      );

      const saveResult = useFileStore.getState().saveFileAs();

      // Undo during save
      useHistoryStore.getState().undo();
      expect(useGraphStore.getState().graph.nodes).toHaveLength(1);

      // Complete save with file picker result
      resolveSave({ handle: fakeStorageHandle });
      await saveResult;

      // isDirty true because in-memory (graph1) != saved (graph2)
      expect(useGraphStore.getState().isDirty).toBe(true);
    });

    it('saveFileAs saves the original graph, not the undone graph', async () => {
      const store = useEngineStore.getState();
      const graph1 = createGraphWithNodes(1);
      const graph2 = createGraphWithNodes(2);

      store.undoManager!.snapshot('1 node', graph1);
      store.undoManager!.snapshot('2 nodes', graph2);
      store.textApi!.setGraph(graph2);

      useGraphStore.setState({ graph: graph2, isDirty: true, nodeCount: 2 }); useHistoryStore.setState({ canUndo: true });

      let resolveSave!: (value: any) => void;
      mockSaveArchitectureAs.mockReturnValue(
        new Promise((r) => {
          resolveSave = r;
        }),
      );

      const saveResult = useFileStore.getState().saveFileAs();

      // saveArchitectureAs was called with graph2 (2 nodes)
      expect(mockSaveArchitectureAs.mock.calls[0][0].nodes).toHaveLength(2);

      // Undo during save -> graph1
      useHistoryStore.getState().undo();

      // The save still uses the original graph2
      // (graph was captured before undo)

      resolveSave({ handle: fakeStorageHandle });
      await saveResult;

      // In-memory state is graph1 (undone)
      expect(useGraphStore.getState().graph.nodes).toHaveLength(1);
    });
  });

  describe('save completion does not interfere with undo manager', () => {
    it('undo manager history is preserved after save completes', async () => {
      const store = useEngineStore.getState();
      const graph1 = createGraphWithNodes(1);
      const graph2 = createGraphWithNodes(2);
      const graph3 = createGraphWithNodes(3);

      store.undoManager!.snapshot('1 node', graph1);
      store.undoManager!.snapshot('2 nodes', graph2);
      store.undoManager!.snapshot('3 nodes', graph3);
      store.textApi!.setGraph(graph3);

      useGraphStore.setState({ graph: graph3, isDirty: true, nodeCount: 3 }); useFileStore.setState({ fileHandle: fakeStorageHandle }); useHistoryStore.setState({ canUndo: true });

      mockSaveArchitecture.mockResolvedValue(fakeStorageHandle);
      await useFileStore.getState().saveFile();

      // Undo history should be intact after save
      // 4 = 1 (initial from initialize()) + 3 explicit snapshots
      expect(store.undoManager!.historyLength).toBe(4);
      expect(store.undoManager!.canUndo).toBe(true);
    });

    it('undo after save completes works correctly', async () => {
      const store = useEngineStore.getState();
      const graph1 = createGraphWithNodes(1);
      const graph2 = createGraphWithNodes(2);

      store.undoManager!.snapshot('1 node', graph1);
      store.undoManager!.snapshot('2 nodes', graph2);
      store.textApi!.setGraph(graph2);

      useGraphStore.setState({ graph: graph2, isDirty: true, nodeCount: 2 }); useFileStore.setState({ fileHandle: fakeStorageHandle }); useHistoryStore.setState({ canUndo: true });

      mockSaveArchitecture.mockResolvedValue(fakeStorageHandle);
      await useFileStore.getState().saveFile();

      // isDirty is false after clean save
      expect(useGraphStore.getState().isDirty).toBe(false);

      // Now undo
      useHistoryStore.getState().undo();

      // In-memory is graph1, isDirty is true
      expect(useGraphStore.getState().graph.nodes).toHaveLength(1);
      expect(useGraphStore.getState().isDirty).toBe(true);
    });
  });

  describe('save failure with concurrent undo', () => {
    it('save failure during undo keeps isDirty true', async () => {
      const store = useEngineStore.getState();
      const graph1 = createGraphWithNodes(1);
      const graph2 = createGraphWithNodes(2);

      store.undoManager!.snapshot('1 node', graph1);
      store.undoManager!.snapshot('2 nodes', graph2);
      store.textApi!.setGraph(graph2);

      useGraphStore.setState({ graph: graph2, isDirty: true, nodeCount: 2 }); useFileStore.setState({ fileHandle: fakeStorageHandle }); useHistoryStore.setState({ canUndo: true });

      let rejectSave!: (err: Error) => void;
      mockSaveArchitecture.mockReturnValue(
        new Promise<StorageHandle>((_, reject) => {
          rejectSave = reject;
        }),
      );

      const saveResult = useFileStore.getState().saveFile();

      // Undo during save
      useHistoryStore.getState().undo();

      // Fail the save
      rejectSave(new Error('Disk full'));
      await saveResult;

      // isDirty must be true (save failed + undo happened)
      expect(useGraphStore.getState().isDirty).toBe(true);
      // Graph is the undone version
      expect(useGraphStore.getState().graph.nodes).toHaveLength(1);
      // isSaving reset
      expect(useFileStore.getState().isSaving).toBe(false);
    });

    it('save failure without undo keeps isDirty true', async () => {
      useGraphStore.setState({ graph: createGraphWithNodes(2), isDirty: true, nodeCount: 2 }); useFileStore.setState({ fileHandle: fakeStorageHandle });

      mockSaveArchitecture.mockRejectedValue(new Error('Permission denied'));
      await useFileStore.getState().saveFile();

      // isDirty remains true (save failed, changes not persisted)
      expect(useGraphStore.getState().isDirty).toBe(true);
    });
  });

  describe('graph reference integrity', () => {
    it('save captures graph reference, not a live pointer', async () => {
      const originalGraph = createGraphWithNodes(3);
      useGraphStore.setState({ graph: originalGraph, isDirty: true, nodeCount: 3 }); useFileStore.setState({ fileHandle: fakeStorageHandle });

      let capturedGraph: ArchGraph | null = null;
      mockSaveArchitecture.mockImplementation(async (graph: ArchGraph) => {
        capturedGraph = graph;
        return fakeStorageHandle;
      });

      // Start save
      const savePromise = useFileStore.getState().saveFile();

      await savePromise;

      // The captured graph should be the original 3-node graph
      expect(capturedGraph).not.toBeNull();
      expect(capturedGraph!.nodes).toHaveLength(3);
      expect(capturedGraph).toBe(originalGraph);
    });

    it('in-memory graph after undo is a different object from saved graph', async () => {
      const store = useEngineStore.getState();
      const graph1 = createGraphWithNodes(1);
      const graph2 = createGraphWithNodes(2);

      store.undoManager!.snapshot('1 node', graph1);
      store.undoManager!.snapshot('2 nodes', graph2);
      store.textApi!.setGraph(graph2);

      useGraphStore.setState({ graph: graph2, isDirty: true, nodeCount: 2 }); useFileStore.setState({ fileHandle: fakeStorageHandle }); useHistoryStore.setState({ canUndo: true });

      let capturedGraph: ArchGraph | null = null;
      let resolveSave!: (value: StorageHandle) => void;
      mockSaveArchitecture.mockImplementation((graph: ArchGraph) => {
        capturedGraph = graph;
        return new Promise<StorageHandle>((r) => {
          resolveSave = r;
        });
      });

      const saveResult = useFileStore.getState().saveFile();
      useHistoryStore.getState().undo();

      resolveSave(fakeStorageHandle);
      await saveResult;

      // Captured graph (saved) and current graph (after undo) are different objects
      const currentGraph = useGraphStore.getState().graph;
      expect(capturedGraph).not.toBe(currentGraph);
      expect(capturedGraph!.nodes).toHaveLength(2);
      expect(currentGraph.nodes).toHaveLength(1);
    });
  });
});
