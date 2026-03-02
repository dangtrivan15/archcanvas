/**
 * Tests for Feature #154: Dirty state clears after save.
 * Verifies that isDirty becomes true after mutations and false after save operations.
 * Since browser File System Access API is not available in tests, we test the store
 * logic by mocking the file I/O functions.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useCoreStore } from '@/store/coreStore';

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
    }),
  },
}));

describe('Feature #154: Dirty state clears after save', () => {
  beforeEach(() => {
    // Reset the store to initial state
    const store = useCoreStore.getState();
    // Re-initialize if needed
    useCoreStore.setState({
      initialized: false,
      isDirty: false,
      graph: { name: 'Untitled Architecture', description: '', owners: [], nodes: [], edges: [] },
      fileHandle: null,
      fileName: 'Untitled Architecture',
      nodeCount: 0,
      edgeCount: 0,
      canUndo: false,
      canRedo: false,
    });
    useCoreStore.getState().initialize();
  });

  it('isDirty starts as false for a new file', () => {
    expect(useCoreStore.getState().isDirty).toBe(false);
  });

  it('isDirty becomes true after addNode', () => {
    const store = useCoreStore.getState();
    expect(store.isDirty).toBe(false);

    store.addNode({
      type: 'compute/service',
      displayName: 'Test Service',
    });

    expect(useCoreStore.getState().isDirty).toBe(true);
  });

  it('isDirty becomes true after removeNode', () => {
    const store = useCoreStore.getState();
    const node = store.addNode({
      type: 'compute/service',
      displayName: 'Test Service',
    });

    // Reset dirty after add
    useCoreStore.setState({ isDirty: false });
    expect(useCoreStore.getState().isDirty).toBe(false);

    store.removeNode(node!.id);
    expect(useCoreStore.getState().isDirty).toBe(true);
  });

  it('isDirty becomes true after updateNode', () => {
    const store = useCoreStore.getState();
    const node = store.addNode({
      type: 'compute/service',
      displayName: 'Test Service',
    });

    // Reset dirty after add
    useCoreStore.setState({ isDirty: false });

    useCoreStore.getState().updateNode(node!.id, { displayName: 'Updated Service' });
    expect(useCoreStore.getState().isDirty).toBe(true);
  });

  it('isDirty becomes true after addEdge', () => {
    const store = useCoreStore.getState();
    const node1 = store.addNode({ type: 'compute/service', displayName: 'A' });
    const node2 = store.addNode({ type: 'data/database', displayName: 'B' });

    useCoreStore.setState({ isDirty: false });

    useCoreStore.getState().addEdge({
      fromNode: node1!.id,
      toNode: node2!.id,
      type: 'sync',
    });
    expect(useCoreStore.getState().isDirty).toBe(true);
  });

  it('isDirty becomes true after removeEdge', () => {
    const store = useCoreStore.getState();
    const node1 = store.addNode({ type: 'compute/service', displayName: 'A' });
    const node2 = store.addNode({ type: 'data/database', displayName: 'B' });
    const edge = useCoreStore.getState().addEdge({
      fromNode: node1!.id,
      toNode: node2!.id,
      type: 'sync',
    });

    useCoreStore.setState({ isDirty: false });

    useCoreStore.getState().removeEdge(edge!.id);
    expect(useCoreStore.getState().isDirty).toBe(true);
  });

  it('isDirty becomes true after addNote', () => {
    const store = useCoreStore.getState();
    const node = store.addNode({ type: 'compute/service', displayName: 'A' });

    useCoreStore.setState({ isDirty: false });

    useCoreStore.getState().addNote({
      nodeId: node!.id,
      author: 'tester',
      content: 'Test note',
    });
    expect(useCoreStore.getState().isDirty).toBe(true);
  });

  it('isDirty becomes true after addCodeRef', () => {
    const store = useCoreStore.getState();
    const node = store.addNode({ type: 'compute/service', displayName: 'A' });

    useCoreStore.setState({ isDirty: false });

    useCoreStore.getState().addCodeRef({
      nodeId: node!.id,
      path: 'src/main.ts',
      role: 'source',
    });
    expect(useCoreStore.getState().isDirty).toBe(true);
  });

  it('isDirty becomes true after suggest', () => {
    const store = useCoreStore.getState();
    const node = store.addNode({ type: 'compute/service', displayName: 'A' });

    useCoreStore.setState({ isDirty: false });

    useCoreStore.getState().suggest({
      targetNodeId: node!.id,
      content: 'AI suggestion',
      suggestionType: 'add-note',
    });
    expect(useCoreStore.getState().isDirty).toBe(true);
  });

  it('isDirty becomes true after resolveSuggestion', () => {
    const store = useCoreStore.getState();
    const node = store.addNode({ type: 'compute/service', displayName: 'A' });
    const suggestion = useCoreStore.getState().suggest({
      targetNodeId: node!.id,
      content: 'AI suggestion',
      suggestionType: 'add-note',
    });

    useCoreStore.setState({ isDirty: false });

    useCoreStore.getState().resolveSuggestion(node!.id, suggestion!.id, 'accepted');
    expect(useCoreStore.getState().isDirty).toBe(true);
  });

  it('isDirty resets to false after saveFile with fileHandle', async () => {
    const store = useCoreStore.getState();
    store.addNode({ type: 'compute/service', displayName: 'Test' });
    expect(useCoreStore.getState().isDirty).toBe(true);

    // Set a mock file handle so saveFile doesn't fall back to saveFileAs
    useCoreStore.setState({ fileHandle: { name: 'test.archc' } as any });

    const result = await useCoreStore.getState().saveFile();
    expect(result).toBe(true);
    expect(useCoreStore.getState().isDirty).toBe(false);
  });

  it('isDirty resets to false after saveFileAs', async () => {
    const store = useCoreStore.getState();
    store.addNode({ type: 'compute/service', displayName: 'Test' });
    expect(useCoreStore.getState().isDirty).toBe(true);

    const result = await useCoreStore.getState().saveFileAs();
    expect(result).toBe(true);
    expect(useCoreStore.getState().isDirty).toBe(false);
  });

  it('isDirty resets to false after newFile', () => {
    const store = useCoreStore.getState();
    store.addNode({ type: 'compute/service', displayName: 'Test' });
    expect(useCoreStore.getState().isDirty).toBe(true);

    useCoreStore.getState().newFile();
    expect(useCoreStore.getState().isDirty).toBe(false);
  });

  it('save → mutate → isDirty transitions correctly', async () => {
    const store = useCoreStore.getState();

    // Start clean
    expect(useCoreStore.getState().isDirty).toBe(false);

    // Add node → dirty
    store.addNode({ type: 'compute/service', displayName: 'Test' });
    expect(useCoreStore.getState().isDirty).toBe(true);

    // Save → clean
    useCoreStore.setState({ fileHandle: { name: 'test.archc' } as any });
    await useCoreStore.getState().saveFile();
    expect(useCoreStore.getState().isDirty).toBe(false);

    // Update node → dirty again
    const nodes = useCoreStore.getState().graph.nodes;
    useCoreStore.getState().updateNode(nodes[0].id, { displayName: 'Updated' });
    expect(useCoreStore.getState().isDirty).toBe(true);

    // Save again → clean again
    await useCoreStore.getState().saveFile();
    expect(useCoreStore.getState().isDirty).toBe(false);
  });

  it('multiple mutations keep isDirty true until save', async () => {
    const store = useCoreStore.getState();

    // Add node → dirty
    const node = store.addNode({ type: 'compute/service', displayName: 'A' });
    expect(useCoreStore.getState().isDirty).toBe(true);

    // Add another node → still dirty
    useCoreStore.getState().addNode({ type: 'data/database', displayName: 'B' });
    expect(useCoreStore.getState().isDirty).toBe(true);

    // Update node args → still dirty
    useCoreStore.getState().updateNode(node!.id, { args: { language: 'Go' } });
    expect(useCoreStore.getState().isDirty).toBe(true);

    // Add a note → still dirty
    useCoreStore.getState().addNote({
      nodeId: node!.id,
      author: 'tester',
      content: 'Test note',
    });
    expect(useCoreStore.getState().isDirty).toBe(true);

    // Save → finally clean
    useCoreStore.setState({ fileHandle: { name: 'test.archc' } as any });
    await useCoreStore.getState().saveFile();
    expect(useCoreStore.getState().isDirty).toBe(false);
  });
});
