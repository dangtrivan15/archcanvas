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

// Mock the fileIO module before importing coreStore
vi.mock('@/core/storage/fileIO', async () => {
  const actual = await vi.importActual<typeof import('@/core/storage/fileIO')>('@/core/storage/fileIO');
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

// Mock aiStore
vi.mock('@/store/aiStore', () => ({
  useAIStore: {
    getState: () => ({
      conversations: [],
      clearConversations: vi.fn(),
      setConversations: vi.fn(),
    }),
  },
}));

// Mock layout
vi.mock('@/core/layout/elkLayout', () => ({
  applyElkLayout: vi.fn(),
}));

// Now import the modules
import { useCoreStore } from '@/store/coreStore';
import { saveArchcFile, saveArchcFileAs } from '@/core/storage/fileIO';
import type { ArchGraph } from '@/types/graph';

const mockSaveArchcFile = vi.mocked(saveArchcFile);
const mockSaveArchcFileAs = vi.mocked(saveArchcFileAs);

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
  const fakeFileHandle = { name: 'test.archc' } as any as FileSystemFileHandle;

  beforeEach(() => {
    // Reset UI store
    useUIStore.setState({
      errorDialogOpen: false,
      errorDialogInfo: null,
      fileOperationLoading: false,
      fileOperationMessage: null,
    });

    // Reset mocks
    mockSaveArchcFile.mockReset();
    mockSaveArchcFileAs.mockReset();

    // Reset core store
    useCoreStore.setState({
      initialized: false,
      isDirty: false,
      isSaving: false,
      graph: createGraphWithNodes(0),
      fileHandle: null,
      fileName: 'Untitled Architecture',
      fileCreatedAtMs: null,
      nodeCount: 0,
      edgeCount: 0,
      canUndo: false,
      canRedo: false,
    });
    useCoreStore.getState().initialize();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('save captures graph at start, undo changes in-memory state', () => {
    it('save operation uses the graph captured at save start', async () => {
      const graph3Nodes = createGraphWithNodes(3);
      useCoreStore.setState({
        graph: graph3Nodes,
        fileHandle: fakeFileHandle,
        isDirty: true,
        nodeCount: 3,
      });

      // Save resolves immediately
      mockSaveArchcFile.mockResolvedValue(true);

      await useCoreStore.getState().saveFile();

      // saveArchcFile should have been called with the 3-node graph
      expect(mockSaveArchcFile).toHaveBeenCalledTimes(1);
      const savedGraph = mockSaveArchcFile.mock.calls[0][0];
      expect(savedGraph.nodes).toHaveLength(3);
    });

    it('undo during save changes in-memory graph while save writes original', async () => {
      // Setup: add 3 nodes with undo history so we can undo
      const store = useCoreStore.getState();
      const graph1 = createGraphWithNodes(1);
      const graph2 = createGraphWithNodes(2);
      const graph3 = createGraphWithNodes(3);

      // Set up undo history: graph1 → graph2 → graph3 (current)
      store.undoManager!.snapshot('Initial', graph1);
      store.undoManager!.snapshot('Add node 2', graph2);
      store.undoManager!.snapshot('Add node 3', graph3);

      // TextApi needs the current graph
      store.textApi!.setGraph(graph3);

      useCoreStore.setState({
        graph: graph3,
        fileHandle: fakeFileHandle,
        isDirty: true,
        nodeCount: 3,
        canUndo: true,
        canRedo: false,
      });

      // Make save hang until we resolve it
      let resolveSave!: (value: boolean) => void;
      const savePromise = new Promise<boolean>((resolve) => {
        resolveSave = resolve;
      });
      mockSaveArchcFile.mockReturnValue(savePromise);

      // Start save (captures graph3)
      const saveResult = useCoreStore.getState().saveFile();

      // Verify save is in progress
      expect(useCoreStore.getState().isSaving).toBe(true);

      // Now perform undo while save is in progress
      useCoreStore.getState().undo();

      // In-memory graph should now be graph2 (2 nodes)
      expect(useCoreStore.getState().graph.nodes).toHaveLength(2);
      expect(useCoreStore.getState().nodeCount).toBe(2);

      // But saveArchcFile was called with graph3 (3 nodes) - the original
      const savedGraph = mockSaveArchcFile.mock.calls[0][0];
      expect(savedGraph.nodes).toHaveLength(3);

      // Complete the save
      resolveSave(true);
      await saveResult;

      // After save completes, in-memory graph should still be graph2 (undo result)
      expect(useCoreStore.getState().graph.nodes).toHaveLength(2);
    });

    it('isDirty remains true when undo happens during save', async () => {
      const store = useCoreStore.getState();
      const graph1 = createGraphWithNodes(1);
      const graph2 = createGraphWithNodes(2);

      store.undoManager!.snapshot('Initial', graph1);
      store.undoManager!.snapshot('Add node 2', graph2);
      store.textApi!.setGraph(graph2);

      useCoreStore.setState({
        graph: graph2,
        fileHandle: fakeFileHandle,
        isDirty: true,
        nodeCount: 2,
        canUndo: true,
      });

      // Slow save
      let resolveSave!: (value: boolean) => void;
      mockSaveArchcFile.mockReturnValue(new Promise<boolean>((r) => { resolveSave = r; }));

      // Start save (captures graph2)
      const saveResult = useCoreStore.getState().saveFile();

      // Undo during save → in-memory changes to graph1
      useCoreStore.getState().undo();
      expect(useCoreStore.getState().isDirty).toBe(true);

      // Complete save
      resolveSave(true);
      await saveResult;

      // isDirty must remain true because in-memory (graph1) differs from saved file (graph2)
      expect(useCoreStore.getState().isDirty).toBe(true);
    });

    it('isDirty is false when no mutation happens during save', async () => {
      const graph2 = createGraphWithNodes(2);
      useCoreStore.setState({
        graph: graph2,
        fileHandle: fakeFileHandle,
        isDirty: true,
        nodeCount: 2,
      });

      mockSaveArchcFile.mockResolvedValue(true);
      await useCoreStore.getState().saveFile();

      // No undo during save → isDirty should be false
      expect(useCoreStore.getState().isDirty).toBe(false);
    });
  });

  describe('architecture state consistency after undo during save', () => {
    it('node count is consistent with graph after undo during save', async () => {
      const store = useCoreStore.getState();
      const graph2 = createGraphWithNodes(2);
      const graph3 = createGraphWithNodes(3);

      store.undoManager!.snapshot('2 nodes', graph2);
      store.undoManager!.snapshot('3 nodes', graph3);
      store.textApi!.setGraph(graph3);

      useCoreStore.setState({
        graph: graph3,
        fileHandle: fakeFileHandle,
        isDirty: true,
        nodeCount: 3,
        canUndo: true,
      });

      let resolveSave!: (value: boolean) => void;
      mockSaveArchcFile.mockReturnValue(new Promise<boolean>((r) => { resolveSave = r; }));

      const saveResult = useCoreStore.getState().saveFile();
      useCoreStore.getState().undo();

      // nodeCount should match in-memory graph
      expect(useCoreStore.getState().nodeCount).toBe(2);
      expect(useCoreStore.getState().graph.nodes).toHaveLength(2);

      resolveSave(true);
      await saveResult;

      // Still consistent after save completes
      expect(useCoreStore.getState().nodeCount).toBe(2);
      expect(useCoreStore.getState().graph.nodes).toHaveLength(2);
    });

    it('edge count is consistent with graph after undo during save', async () => {
      const store = useCoreStore.getState();

      // Create graphs with different edge counts
      const graphNoEdges = createGraphWithNodes(2);
      const graphWithEdge: ArchGraph = {
        ...createGraphWithNodes(2),
        edges: [{
          id: 'edge-1',
          fromNode: 'node-0',
          toNode: 'node-1',
          type: 'SYNC' as any,
          label: 'calls',
          properties: {},
          notes: [],
        }],
      };

      store.undoManager!.snapshot('No edges', graphNoEdges);
      store.undoManager!.snapshot('With edge', graphWithEdge);
      store.textApi!.setGraph(graphWithEdge);

      useCoreStore.setState({
        graph: graphWithEdge,
        fileHandle: fakeFileHandle,
        isDirty: true,
        nodeCount: 2,
        edgeCount: 1,
        canUndo: true,
      });

      let resolveSave!: (value: boolean) => void;
      mockSaveArchcFile.mockReturnValue(new Promise<boolean>((r) => { resolveSave = r; }));

      const saveResult = useCoreStore.getState().saveFile();
      useCoreStore.getState().undo();

      // Edge count should reflect undone state
      expect(useCoreStore.getState().edgeCount).toBe(0);
      expect(useCoreStore.getState().graph.edges).toHaveLength(0);

      resolveSave(true);
      await saveResult;

      // Still consistent
      expect(useCoreStore.getState().edgeCount).toBe(0);
    });

    it('undo/redo flags are correct after undo during save', async () => {
      const store = useCoreStore.getState();
      const graph1 = createGraphWithNodes(1);
      const graph2 = createGraphWithNodes(2);
      const graph3 = createGraphWithNodes(3);

      store.undoManager!.snapshot('1 node', graph1);
      store.undoManager!.snapshot('2 nodes', graph2);
      store.undoManager!.snapshot('3 nodes', graph3);
      store.textApi!.setGraph(graph3);

      useCoreStore.setState({
        graph: graph3,
        fileHandle: fakeFileHandle,
        isDirty: true,
        nodeCount: 3,
        canUndo: true,
        canRedo: false,
      });

      let resolveSave!: (value: boolean) => void;
      mockSaveArchcFile.mockReturnValue(new Promise<boolean>((r) => { resolveSave = r; }));

      const saveResult = useCoreStore.getState().saveFile();
      useCoreStore.getState().undo();

      // After undo, canRedo should be true (can redo back to graph3)
      expect(useCoreStore.getState().canUndo).toBe(true);
      expect(useCoreStore.getState().canRedo).toBe(true);

      resolveSave(true);
      await saveResult;

      // Undo/redo flags unchanged by save completion
      expect(useCoreStore.getState().canUndo).toBe(true);
      expect(useCoreStore.getState().canRedo).toBe(true);
    });
  });

  describe('redo during save', () => {
    it('redo during save keeps isDirty true', async () => {
      const store = useCoreStore.getState();
      const graph1 = createGraphWithNodes(1);
      const graph2 = createGraphWithNodes(2);

      store.undoManager!.snapshot('1 node', graph1);
      store.undoManager!.snapshot('2 nodes', graph2);
      store.textApi!.setGraph(graph2);

      useCoreStore.setState({
        graph: graph2,
        fileHandle: fakeFileHandle,
        isDirty: true,
        nodeCount: 2,
        canUndo: true,
      });

      // Undo first (before save) → graph1
      useCoreStore.getState().undo();
      expect(useCoreStore.getState().graph.nodes).toHaveLength(1);

      // Now start save with graph1
      let resolveSave!: (value: boolean) => void;
      mockSaveArchcFile.mockReturnValue(new Promise<boolean>((r) => { resolveSave = r; }));

      const saveResult = useCoreStore.getState().saveFile();

      // Redo during save → graph2
      useCoreStore.getState().redo();
      expect(useCoreStore.getState().graph.nodes).toHaveLength(2);

      // Complete save (saved graph1)
      resolveSave(true);
      await saveResult;

      // isDirty should be true because in-memory (graph2) != saved (graph1)
      expect(useCoreStore.getState().isDirty).toBe(true);
    });
  });

  describe('multiple undos during save', () => {
    it('multiple undos during save all apply correctly', async () => {
      const store = useCoreStore.getState();
      const graph1 = createGraphWithNodes(1);
      const graph2 = createGraphWithNodes(2);
      const graph3 = createGraphWithNodes(3);
      const graph4 = createGraphWithNodes(4);

      store.undoManager!.snapshot('1 node', graph1);
      store.undoManager!.snapshot('2 nodes', graph2);
      store.undoManager!.snapshot('3 nodes', graph3);
      store.undoManager!.snapshot('4 nodes', graph4);
      store.textApi!.setGraph(graph4);

      useCoreStore.setState({
        graph: graph4,
        fileHandle: fakeFileHandle,
        isDirty: true,
        nodeCount: 4,
        canUndo: true,
      });

      let resolveSave!: (value: boolean) => void;
      mockSaveArchcFile.mockReturnValue(new Promise<boolean>((r) => { resolveSave = r; }));

      const saveResult = useCoreStore.getState().saveFile();

      // Two undos during save: 4→3→2
      useCoreStore.getState().undo();
      expect(useCoreStore.getState().graph.nodes).toHaveLength(3);
      useCoreStore.getState().undo();
      expect(useCoreStore.getState().graph.nodes).toHaveLength(2);

      // Save was called with original 4-node graph
      expect(mockSaveArchcFile.mock.calls[0][0].nodes).toHaveLength(4);

      // Complete save
      resolveSave(true);
      await saveResult;

      // In-memory is graph2 (2 nodes), isDirty remains true
      expect(useCoreStore.getState().graph.nodes).toHaveLength(2);
      expect(useCoreStore.getState().isDirty).toBe(true);
    });
  });

  describe('saveFileAs with undo during save', () => {
    it('isDirty remains true when undo happens during saveFileAs', async () => {
      const store = useCoreStore.getState();
      const graph1 = createGraphWithNodes(1);
      const graph2 = createGraphWithNodes(2);

      store.undoManager!.snapshot('1 node', graph1);
      store.undoManager!.snapshot('2 nodes', graph2);
      store.textApi!.setGraph(graph2);

      useCoreStore.setState({
        graph: graph2,
        isDirty: true,
        nodeCount: 2,
        canUndo: true,
      });

      let resolveSave!: (value: any) => void;
      mockSaveArchcFileAs.mockReturnValue(new Promise((r) => { resolveSave = r; }));

      const saveResult = useCoreStore.getState().saveFileAs();

      // Undo during save
      useCoreStore.getState().undo();
      expect(useCoreStore.getState().graph.nodes).toHaveLength(1);

      // Complete save with file picker result
      resolveSave({ fileHandle: fakeFileHandle, fileName: 'saved.archc' });
      await saveResult;

      // isDirty true because in-memory (graph1) != saved (graph2)
      expect(useCoreStore.getState().isDirty).toBe(true);
    });

    it('saveFileAs saves the original graph, not the undone graph', async () => {
      const store = useCoreStore.getState();
      const graph1 = createGraphWithNodes(1);
      const graph2 = createGraphWithNodes(2);

      store.undoManager!.snapshot('1 node', graph1);
      store.undoManager!.snapshot('2 nodes', graph2);
      store.textApi!.setGraph(graph2);

      useCoreStore.setState({
        graph: graph2,
        isDirty: true,
        nodeCount: 2,
        canUndo: true,
      });

      let resolveSave!: (value: any) => void;
      mockSaveArchcFileAs.mockReturnValue(new Promise((r) => { resolveSave = r; }));

      const saveResult = useCoreStore.getState().saveFileAs();

      // saveArchcFileAs was called with graph2 (2 nodes)
      expect(mockSaveArchcFileAs.mock.calls[0][0].nodes).toHaveLength(2);

      // Undo during save → graph1
      useCoreStore.getState().undo();

      // The save still uses the original graph2
      // (graph was captured before undo)

      resolveSave({ fileHandle: fakeFileHandle, fileName: 'saved.archc' });
      await saveResult;

      // In-memory state is graph1 (undone)
      expect(useCoreStore.getState().graph.nodes).toHaveLength(1);
    });
  });

  describe('save completion does not interfere with undo manager', () => {
    it('undo manager history is preserved after save completes', async () => {
      const store = useCoreStore.getState();
      const graph1 = createGraphWithNodes(1);
      const graph2 = createGraphWithNodes(2);
      const graph3 = createGraphWithNodes(3);

      store.undoManager!.snapshot('1 node', graph1);
      store.undoManager!.snapshot('2 nodes', graph2);
      store.undoManager!.snapshot('3 nodes', graph3);
      store.textApi!.setGraph(graph3);

      useCoreStore.setState({
        graph: graph3,
        fileHandle: fakeFileHandle,
        isDirty: true,
        nodeCount: 3,
        canUndo: true,
      });

      mockSaveArchcFile.mockResolvedValue(true);
      await useCoreStore.getState().saveFile();

      // Undo history should be intact after save
      // 4 = 1 (initial from initialize()) + 3 explicit snapshots
      expect(store.undoManager!.historyLength).toBe(4);
      expect(store.undoManager!.canUndo).toBe(true);
    });

    it('undo after save completes works correctly', async () => {
      const store = useCoreStore.getState();
      const graph1 = createGraphWithNodes(1);
      const graph2 = createGraphWithNodes(2);

      store.undoManager!.snapshot('1 node', graph1);
      store.undoManager!.snapshot('2 nodes', graph2);
      store.textApi!.setGraph(graph2);

      useCoreStore.setState({
        graph: graph2,
        fileHandle: fakeFileHandle,
        isDirty: true,
        nodeCount: 2,
        canUndo: true,
      });

      mockSaveArchcFile.mockResolvedValue(true);
      await useCoreStore.getState().saveFile();

      // isDirty is false after clean save
      expect(useCoreStore.getState().isDirty).toBe(false);

      // Now undo
      useCoreStore.getState().undo();

      // In-memory is graph1, isDirty is true
      expect(useCoreStore.getState().graph.nodes).toHaveLength(1);
      expect(useCoreStore.getState().isDirty).toBe(true);
    });
  });

  describe('save failure with concurrent undo', () => {
    it('save failure during undo keeps isDirty true', async () => {
      const store = useCoreStore.getState();
      const graph1 = createGraphWithNodes(1);
      const graph2 = createGraphWithNodes(2);

      store.undoManager!.snapshot('1 node', graph1);
      store.undoManager!.snapshot('2 nodes', graph2);
      store.textApi!.setGraph(graph2);

      useCoreStore.setState({
        graph: graph2,
        fileHandle: fakeFileHandle,
        isDirty: true,
        nodeCount: 2,
        canUndo: true,
      });

      let rejectSave!: (err: Error) => void;
      mockSaveArchcFile.mockReturnValue(new Promise<boolean>((_, reject) => { rejectSave = reject; }));

      const saveResult = useCoreStore.getState().saveFile();

      // Undo during save
      useCoreStore.getState().undo();

      // Fail the save
      rejectSave(new Error('Disk full'));
      await saveResult;

      // isDirty must be true (save failed + undo happened)
      expect(useCoreStore.getState().isDirty).toBe(true);
      // Graph is the undone version
      expect(useCoreStore.getState().graph.nodes).toHaveLength(1);
      // isSaving reset
      expect(useCoreStore.getState().isSaving).toBe(false);
    });

    it('save failure without undo keeps isDirty true', async () => {
      useCoreStore.setState({
        graph: createGraphWithNodes(2),
        fileHandle: fakeFileHandle,
        isDirty: true,
        nodeCount: 2,
      });

      mockSaveArchcFile.mockRejectedValue(new Error('Permission denied'));
      await useCoreStore.getState().saveFile();

      // isDirty remains true (save failed, changes not persisted)
      expect(useCoreStore.getState().isDirty).toBe(true);
    });
  });

  describe('graph reference integrity', () => {
    it('save captures graph reference, not a live pointer', async () => {
      const originalGraph = createGraphWithNodes(3);
      useCoreStore.setState({
        graph: originalGraph,
        fileHandle: fakeFileHandle,
        isDirty: true,
        nodeCount: 3,
      });

      let capturedGraph: ArchGraph | null = null;
      mockSaveArchcFile.mockImplementation(async (graph) => {
        capturedGraph = graph;
        return true;
      });

      // Start save
      const savePromise = useCoreStore.getState().saveFile();

      await savePromise;

      // The captured graph should be the original 3-node graph
      expect(capturedGraph).not.toBeNull();
      expect(capturedGraph!.nodes).toHaveLength(3);
      expect(capturedGraph).toBe(originalGraph);
    });

    it('in-memory graph after undo is a different object from saved graph', async () => {
      const store = useCoreStore.getState();
      const graph1 = createGraphWithNodes(1);
      const graph2 = createGraphWithNodes(2);

      store.undoManager!.snapshot('1 node', graph1);
      store.undoManager!.snapshot('2 nodes', graph2);
      store.textApi!.setGraph(graph2);

      useCoreStore.setState({
        graph: graph2,
        fileHandle: fakeFileHandle,
        isDirty: true,
        nodeCount: 2,
        canUndo: true,
      });

      let capturedGraph: ArchGraph | null = null;
      let resolveSave!: (value: boolean) => void;
      mockSaveArchcFile.mockImplementation((graph) => {
        capturedGraph = graph;
        return new Promise<boolean>((r) => { resolveSave = r; });
      });

      const saveResult = useCoreStore.getState().saveFile();
      useCoreStore.getState().undo();

      resolveSave(true);
      await saveResult;

      // Captured graph (saved) and current graph (after undo) are different objects
      const currentGraph = useCoreStore.getState().graph;
      expect(capturedGraph).not.toBe(currentGraph);
      expect(capturedGraph!.nodes).toHaveLength(2);
      expect(currentGraph.nodes).toHaveLength(1);
    });
  });
});
