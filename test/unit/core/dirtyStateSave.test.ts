// @vitest-environment happy-dom
/**
 * Tests for Feature #154: Dirty state clears after save.
 * Verifies that isDirty becomes true after mutations and false after save operations.
 * Since browser File System Access API is not available in tests, we test the store
 * logic by mocking the file I/O functions.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useGraphStore } from '@/store/graphStore';
import { useFileStore } from '@/store/fileStore';
import { useEngineStore } from '@/store/engineStore';
import { useHistoryStore } from '@/store/historyStore';

// Mock the file I/O module
vi.mock('@/core/storage/fileIO', async () => {
  const actual = await vi.importActual('@/core/storage/fileIO');
  return {
    ...actual,
    saveArchcFile: vi.fn().mockResolvedValue(true),
    saveArchcFileAs: vi.fn().mockResolvedValue({
      fileHandle: { name: 'test.archc' } as any,
      fileName: 'test',
    }),
    openArchcFile: vi.fn().mockResolvedValue(null),
  };
});

// Mock the canvas and UI stores
vi.mock('@/store/canvasStore', () => ({
  useCanvasStore: {
    getState: () => ({
      viewport: { x: 0, y: 0, zoom: 1 },
      selectedNodeId: null,
      setViewport: vi.fn(),
    }),
  },
}));

vi.mock('@/store/uiStore', () => ({
  useUIStore: {
    getState: () => ({
      rightPanelOpen: false,
      rightPanelTab: 'properties',
      openRightPanel: vi.fn(),
      closeRightPanel: vi.fn(),
      setFileOperationLoading: vi.fn(),
      clearFileOperationLoading: vi.fn(),
      showToast: vi.fn(),
      openErrorDialog: vi.fn(),
      rightPanelWidth: 320,
    }),
  },
}));

describe('Feature #154: Dirty state clears after save', () => {
  beforeEach(() => {
    // Reset the store to initial state
    const store = useGraphStore.getState();
    // Re-initialize if needed
    useGraphStore.setState({
      isDirty: false,
      graph: { name: 'Untitled Architecture', description: '', owners: [], nodes: [], edges: [] },
      nodeCount: 0,
      edgeCount: 0
    });
    useFileStore.setState({
      fileHandle: null,
      fileName: 'Untitled Architecture'
    });
    useEngineStore.setState({
      initialized: false
    });
    useHistoryStore.setState({
      canUndo: false,
      canRedo: false
    });
    useEngineStore.getState().initialize();
  });

  it('isDirty starts as false for a new file', () => {
    expect(useGraphStore.getState().isDirty).toBe(false);
  });

  it('isDirty becomes true after addNode', () => {
    const store = useGraphStore.getState();
    expect(store.isDirty).toBe(false);

    store.addNode({
      type: 'compute/service',
      displayName: 'Test Service',
    });

    expect(useGraphStore.getState().isDirty).toBe(true);
  });

  it('isDirty becomes true after removeNode', () => {
    const store = useGraphStore.getState();
    const node = store.addNode({
      type: 'compute/service',
      displayName: 'Test Service',
    });

    // Reset dirty after add
    useGraphStore.setState({ isDirty: false });
    expect(useGraphStore.getState().isDirty).toBe(false);

    store.removeNode(node!.id);
    expect(useGraphStore.getState().isDirty).toBe(true);
  });

  it('isDirty becomes true after updateNode', () => {
    const store = useGraphStore.getState();
    const node = store.addNode({
      type: 'compute/service',
      displayName: 'Test Service',
    });

    // Reset dirty after add
    useGraphStore.setState({ isDirty: false });

    useGraphStore.getState().updateNode(node!.id, { displayName: 'Updated Service' });
    expect(useGraphStore.getState().isDirty).toBe(true);
  });

  it('isDirty becomes true after addEdge', () => {
    const store = useGraphStore.getState();
    const node1 = store.addNode({ type: 'compute/service', displayName: 'A' });
    const node2 = store.addNode({ type: 'data/database', displayName: 'B' });

    useGraphStore.setState({ isDirty: false });

    useGraphStore.getState().addEdge({
      fromNode: node1!.id,
      toNode: node2!.id,
      type: 'sync',
    });
    expect(useGraphStore.getState().isDirty).toBe(true);
  });

  it('isDirty becomes true after removeEdge', () => {
    const store = useGraphStore.getState();
    const node1 = store.addNode({ type: 'compute/service', displayName: 'A' });
    const node2 = store.addNode({ type: 'data/database', displayName: 'B' });
    const edge = useGraphStore.getState().addEdge({
      fromNode: node1!.id,
      toNode: node2!.id,
      type: 'sync',
    });

    useGraphStore.setState({ isDirty: false });

    useGraphStore.getState().removeEdge(edge!.id);
    expect(useGraphStore.getState().isDirty).toBe(true);
  });

  it('isDirty becomes true after addNote', () => {
    const store = useGraphStore.getState();
    const node = store.addNode({ type: 'compute/service', displayName: 'A' });

    useGraphStore.setState({ isDirty: false });

    useGraphStore.getState().addNote({
      nodeId: node!.id,
      author: 'tester',
      content: 'Test note',
    });
    expect(useGraphStore.getState().isDirty).toBe(true);
  });

  it('isDirty becomes true after addCodeRef', () => {
    const store = useGraphStore.getState();
    const node = store.addNode({ type: 'compute/service', displayName: 'A' });

    useGraphStore.setState({ isDirty: false });

    useGraphStore.getState().addCodeRef({
      nodeId: node!.id,
      path: 'src/main.ts',
      role: 'source',
    });
    expect(useGraphStore.getState().isDirty).toBe(true);
  });

  it('isDirty resets to false after saveFile with fileHandle', async () => {
    const store = useGraphStore.getState();
    store.addNode({ type: 'compute/service', displayName: 'Test' });
    expect(useGraphStore.getState().isDirty).toBe(true);

    // Set a mock file handle so saveFile doesn't fall back to saveFileAs
    useFileStore.setState({ fileHandle: { name: 'test.archc' } as any });

    const result = await useFileStore.getState().saveFile();
    expect(result).toBe(true);
    expect(useGraphStore.getState().isDirty).toBe(false);
  });

  it('isDirty resets to false after saveFileAs', async () => {
    const store = useGraphStore.getState();
    store.addNode({ type: 'compute/service', displayName: 'Test' });
    expect(useGraphStore.getState().isDirty).toBe(true);

    const result = await useFileStore.getState().saveFileAs();
    expect(result).toBe(true);
    expect(useGraphStore.getState().isDirty).toBe(false);
  });

  it('isDirty resets to false after newFile', () => {
    const store = useGraphStore.getState();
    store.addNode({ type: 'compute/service', displayName: 'Test' });
    expect(useGraphStore.getState().isDirty).toBe(true);

    useFileStore.getState().newFile();
    expect(useGraphStore.getState().isDirty).toBe(false);
  });

  it('save → mutate → isDirty transitions correctly', async () => {
    const store = useGraphStore.getState();

    // Start clean
    expect(useGraphStore.getState().isDirty).toBe(false);

    // Add node → dirty
    store.addNode({ type: 'compute/service', displayName: 'Test' });
    expect(useGraphStore.getState().isDirty).toBe(true);

    // Save → clean
    useFileStore.setState({ fileHandle: { name: 'test.archc' } as any });
    await useFileStore.getState().saveFile();
    expect(useGraphStore.getState().isDirty).toBe(false);

    // Update node → dirty again
    const nodes = useGraphStore.getState().graph.nodes;
    useGraphStore.getState().updateNode(nodes[0].id, { displayName: 'Updated' });
    expect(useGraphStore.getState().isDirty).toBe(true);

    // Save again → clean again
    await useFileStore.getState().saveFile();
    expect(useGraphStore.getState().isDirty).toBe(false);
  });

  it('multiple mutations keep isDirty true until save', async () => {
    const store = useGraphStore.getState();

    // Add node → dirty
    const node = store.addNode({ type: 'compute/service', displayName: 'A' });
    expect(useGraphStore.getState().isDirty).toBe(true);

    // Add another node → still dirty
    useGraphStore.getState().addNode({ type: 'data/database', displayName: 'B' });
    expect(useGraphStore.getState().isDirty).toBe(true);

    // Update node args → still dirty
    useGraphStore.getState().updateNode(node!.id, { args: { language: 'Go' } });
    expect(useGraphStore.getState().isDirty).toBe(true);

    // Add a note → still dirty
    useGraphStore.getState().addNote({
      nodeId: node!.id,
      author: 'tester',
      content: 'Test note',
    });
    expect(useGraphStore.getState().isDirty).toBe(true);

    // Save → finally clean
    useFileStore.setState({ fileHandle: { name: 'test.archc' } as any });
    await useFileStore.getState().saveFile();
    expect(useGraphStore.getState().isDirty).toBe(false);
  });
});
