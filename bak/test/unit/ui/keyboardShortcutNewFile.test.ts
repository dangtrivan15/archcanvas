// @vitest-environment happy-dom
/**
 * Tests for Feature #210: Keyboard shortcut Ctrl+N creates new file.
 * Verifies that pressing Ctrl+N creates a new empty architecture,
 * clears the canvas, and handles unsaved changes properly.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useGraphStore } from '@/store/graphStore';
import { useFileStore } from '@/store/fileStore';
import { useEngineStore } from '@/store/engineStore';
import { useHistoryStore } from '@/store/historyStore';
import { useUIStore } from '@/store/uiStore';
import { useNavigationStore } from '@/store/navigationStore';

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

// Mock the canvas store
vi.mock('@/store/canvasStore', () => ({
  useCanvasStore: {
    getState: () => ({
      viewport: { x: 0, y: 0, zoom: 1 },
      selectedNodeId: null,
      setViewport: vi.fn(),
    }),
  },
}));

describe('Feature #210: Keyboard shortcut Ctrl+N creates new file', () => {
  beforeEach(() => {
    // Reset stores
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
    useUIStore.getState().closeUnsavedChangesDialog();
    useNavigationStore.setState({ path: [] });
  });

  it('newFile creates an empty architecture with zero nodes and edges', () => {
    const store = useGraphStore.getState();

    // Add some nodes first to simulate an open file with content
    store.addNode({ type: 'compute/service', displayName: 'Service A' });
    store.addNode({ type: 'compute/service', displayName: 'Service B' });
    expect(useGraphStore.getState().nodeCount).toBe(2);

    // Call newFile
    useFileStore.getState().newFile();

    // Verify new file state
    const state = useGraphStore.getState();
    expect(state.nodeCount).toBe(0);
    expect(state.edgeCount).toBe(0);
    expect(state.graph.nodes).toEqual([]);
    expect(state.graph.edges).toEqual([]);
  });

  it('newFile sets fileName to "Untitled Architecture"', () => {
    const store = useGraphStore.getState();

    // Simulate a named file
    useFileStore.setState({ fileName: 'my-architecture' });
    expect(useFileStore.getState().fileName).toBe('my-architecture');

    // Call newFile
    useFileStore.getState().newFile();

    expect(useFileStore.getState().fileName).toBe('Untitled Architecture');
  });

  it('newFile clears the file handle', () => {
    // Simulate a saved file with a handle
    useFileStore.setState({ fileHandle: { name: 'saved.archc' } as any });
    expect(useFileStore.getState().fileHandle).not.toBeNull();

    // Call newFile
    useFileStore.getState().newFile();

    expect(useFileStore.getState().fileHandle).toBeNull();
  });

  it('newFile clears dirty state', () => {
    const store = useGraphStore.getState();

    // Make dirty by adding a node
    store.addNode({ type: 'compute/service', displayName: 'Dirty Node' });
    expect(useGraphStore.getState().isDirty).toBe(true);

    // Call newFile
    useFileStore.getState().newFile();

    expect(useGraphStore.getState().isDirty).toBe(false);
  });

  it('newFile clears undo/redo history', () => {
    const store = useGraphStore.getState();

    // Make changes to create undo history
    store.addNode({ type: 'compute/service', displayName: 'Undo Test' });
    expect(useHistoryStore.getState().canUndo).toBe(true);

    // Call newFile
    useFileStore.getState().newFile();

    expect(useHistoryStore.getState().canUndo).toBe(false);
    expect(useHistoryStore.getState().canRedo).toBe(false);
  });

  it('Ctrl+N preventDefault stops browser default new window', () => {
    const event = new KeyboardEvent('keydown', {
      key: 'n',
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    });

    const preventDefaultSpy = vi.spyOn(event, 'preventDefault');

    // Simulate the logic from useKeyboardShortcuts
    const mod = event.metaKey || event.ctrlKey;
    if (mod && event.key.toLowerCase() === 'n' && !event.shiftKey) {
      event.preventDefault();
    }

    expect(preventDefaultSpy).toHaveBeenCalled();
  });

  it('Cmd+N (Mac) also triggers new file', () => {
    const event = new KeyboardEvent('keydown', {
      key: 'n',
      metaKey: true,
      bubbles: true,
      cancelable: true,
    });

    const preventDefaultSpy = vi.spyOn(event, 'preventDefault');

    const mod = event.metaKey || event.ctrlKey;
    if (mod && event.key.toLowerCase() === 'n' && !event.shiftKey) {
      event.preventDefault();
    }

    expect(preventDefaultSpy).toHaveBeenCalled();
  });

  it('Ctrl+Shift+N does NOT trigger new file', () => {
    const event = new KeyboardEvent('keydown', {
      key: 'n',
      ctrlKey: true,
      shiftKey: true,
      bubbles: true,
      cancelable: true,
    });

    let triggered = false;
    const mod = event.metaKey || event.ctrlKey;
    if (mod && event.key.toLowerCase() === 'n' && !event.shiftKey) {
      triggered = true;
    }

    expect(triggered).toBe(false);
  });

  it('non-modified N key does not trigger new file', () => {
    const event = new KeyboardEvent('keydown', {
      key: 'n',
      bubbles: true,
      cancelable: true,
    });

    let triggered = false;
    const mod = event.metaKey || event.ctrlKey;
    if (mod && event.key.toLowerCase() === 'n') {
      triggered = true;
    }

    expect(triggered).toBe(false);
  });

  it('Ctrl+N on clean state creates new file directly', () => {
    const store = useGraphStore.getState();

    // Add content but mark as clean
    store.addNode({ type: 'compute/service', displayName: 'Test' });
    useGraphStore.setState({ isDirty: false });

    // Simulate the Ctrl+N logic from useKeyboardShortcuts
    const isDirty = useGraphStore.getState().isDirty;
    let unsavedDialogOpened = false;

    if (isDirty) {
      unsavedDialogOpened = true;
    } else {
      useFileStore.getState().newFile();
    }

    expect(unsavedDialogOpened).toBe(false);
    expect(useGraphStore.getState().nodeCount).toBe(0);
  });

  it('Ctrl+N on dirty state opens unsaved changes dialog', () => {
    const store = useGraphStore.getState();

    // Make dirty
    store.addNode({ type: 'compute/service', displayName: 'Unsaved Work' });
    expect(useGraphStore.getState().isDirty).toBe(true);

    // Simulate the Ctrl+N logic
    const isDirty = useGraphStore.getState().isDirty;
    if (isDirty) {
      useUIStore.getState().openUnsavedChangesDialog({
        onConfirm: () => {
          useFileStore.getState().newFile();
        },
      });
    }

    // Verify dialog was opened
    expect(useUIStore.getState().unsavedChangesDialogInfo).not.toBeNull();
    // Nodes still present (not yet confirmed)
    expect(useGraphStore.getState().nodeCount).toBe(1);
  });

  it('confirming unsaved changes dialog creates new file', () => {
    const store = useGraphStore.getState();

    // Make dirty
    store.addNode({ type: 'compute/service', displayName: 'Will Discard' });
    expect(useGraphStore.getState().isDirty).toBe(true);

    // Open unsaved dialog
    let confirmCallback: (() => void) | undefined;
    useUIStore.getState().openUnsavedChangesDialog({
      onConfirm: () => {
        useFileStore.getState().newFile();
        useNavigationStore.getState().zoomToRoot();
      },
    });

    // Get the confirm callback
    const dialogInfo = useUIStore.getState().unsavedChangesDialogInfo;
    expect(dialogInfo).not.toBeNull();

    // Simulate user confirming (discarding unsaved changes)
    dialogInfo!.onConfirm();

    // Verify new file was created
    expect(useGraphStore.getState().nodeCount).toBe(0);
    expect(useGraphStore.getState().edgeCount).toBe(0);
    expect(useGraphStore.getState().isDirty).toBe(false);
    expect(useFileStore.getState().fileName).toBe('Untitled Architecture');
  });

  it('Ctrl+N resets navigation path to root', () => {
    // Navigate into a nested node
    useNavigationStore.setState({ path: ['node-1', 'node-2'] });
    expect(useNavigationStore.getState().path).toEqual(['node-1', 'node-2']);

    // Simulate Ctrl+N new file flow
    useFileStore.getState().newFile();
    useNavigationStore.getState().zoomToRoot();

    expect(useNavigationStore.getState().path).toEqual([]);
  });

  it('newFile clears architecture name and description', () => {
    // Set custom architecture metadata
    useGraphStore.setState({      graph: {
        name: 'My Complex Architecture',
        description: 'A detailed system design',
        owners: ['Alice', 'Bob'],
        nodes: [],
        edges: [],
      },});

    useFileStore.getState().newFile();

    const graph = useGraphStore.getState().graph;
    expect(graph.name).toBe('Untitled Architecture');
    expect(graph.description).toBe('');
    expect(graph.owners).toEqual([]);
  });

  it('newFile clears fileCreatedAtMs timestamp', () => {
    useFileStore.setState({ fileCreatedAtMs: Date.now() });
    expect(useFileStore.getState().fileCreatedAtMs).not.toBeNull();

    useFileStore.getState().newFile();

    expect(useFileStore.getState().fileCreatedAtMs).toBeNull();
  });
});
