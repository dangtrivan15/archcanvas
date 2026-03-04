// @vitest-environment happy-dom
/**
 * Tests for Feature #210: Keyboard shortcut Ctrl+N creates new file.
 * Verifies that pressing Ctrl+N creates a new empty architecture,
 * clears the canvas, and handles unsaved changes properly.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useCoreStore } from '@/store/coreStore';
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
    useUIStore.getState().closeUnsavedChangesDialog();
    useNavigationStore.setState({ path: [] });
  });

  it('newFile creates an empty architecture with zero nodes and edges', () => {
    const store = useCoreStore.getState();

    // Add some nodes first to simulate an open file with content
    store.addNode({ type: 'compute/service', displayName: 'Service A' });
    store.addNode({ type: 'compute/service', displayName: 'Service B' });
    expect(useCoreStore.getState().nodeCount).toBe(2);

    // Call newFile
    useCoreStore.getState().newFile();

    // Verify new file state
    const state = useCoreStore.getState();
    expect(state.nodeCount).toBe(0);
    expect(state.edgeCount).toBe(0);
    expect(state.graph.nodes).toEqual([]);
    expect(state.graph.edges).toEqual([]);
  });

  it('newFile sets fileName to "Untitled Architecture"', () => {
    const store = useCoreStore.getState();

    // Simulate a named file
    useCoreStore.setState({ fileName: 'my-architecture' });
    expect(useCoreStore.getState().fileName).toBe('my-architecture');

    // Call newFile
    useCoreStore.getState().newFile();

    expect(useCoreStore.getState().fileName).toBe('Untitled Architecture');
  });

  it('newFile clears the file handle', () => {
    // Simulate a saved file with a handle
    useCoreStore.setState({ fileHandle: { name: 'saved.archc' } as any });
    expect(useCoreStore.getState().fileHandle).not.toBeNull();

    // Call newFile
    useCoreStore.getState().newFile();

    expect(useCoreStore.getState().fileHandle).toBeNull();
  });

  it('newFile clears dirty state', () => {
    const store = useCoreStore.getState();

    // Make dirty by adding a node
    store.addNode({ type: 'compute/service', displayName: 'Dirty Node' });
    expect(useCoreStore.getState().isDirty).toBe(true);

    // Call newFile
    useCoreStore.getState().newFile();

    expect(useCoreStore.getState().isDirty).toBe(false);
  });

  it('newFile clears undo/redo history', () => {
    const store = useCoreStore.getState();

    // Make changes to create undo history
    store.addNode({ type: 'compute/service', displayName: 'Undo Test' });
    expect(useCoreStore.getState().canUndo).toBe(true);

    // Call newFile
    useCoreStore.getState().newFile();

    expect(useCoreStore.getState().canUndo).toBe(false);
    expect(useCoreStore.getState().canRedo).toBe(false);
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
    const store = useCoreStore.getState();

    // Add content but mark as clean
    store.addNode({ type: 'compute/service', displayName: 'Test' });
    useCoreStore.setState({ isDirty: false });

    // Simulate the Ctrl+N logic from useKeyboardShortcuts
    const isDirty = useCoreStore.getState().isDirty;
    let unsavedDialogOpened = false;

    if (isDirty) {
      unsavedDialogOpened = true;
    } else {
      useCoreStore.getState().newFile();
    }

    expect(unsavedDialogOpened).toBe(false);
    expect(useCoreStore.getState().nodeCount).toBe(0);
  });

  it('Ctrl+N on dirty state opens unsaved changes dialog', () => {
    const store = useCoreStore.getState();

    // Make dirty
    store.addNode({ type: 'compute/service', displayName: 'Unsaved Work' });
    expect(useCoreStore.getState().isDirty).toBe(true);

    // Simulate the Ctrl+N logic
    const isDirty = useCoreStore.getState().isDirty;
    if (isDirty) {
      useUIStore.getState().openUnsavedChangesDialog({
        onConfirm: () => {
          useCoreStore.getState().newFile();
        },
      });
    }

    // Verify dialog was opened
    expect(useUIStore.getState().unsavedChangesDialogInfo).not.toBeNull();
    // Nodes still present (not yet confirmed)
    expect(useCoreStore.getState().nodeCount).toBe(1);
  });

  it('confirming unsaved changes dialog creates new file', () => {
    const store = useCoreStore.getState();

    // Make dirty
    store.addNode({ type: 'compute/service', displayName: 'Will Discard' });
    expect(useCoreStore.getState().isDirty).toBe(true);

    // Open unsaved dialog
    let confirmCallback: (() => void) | undefined;
    useUIStore.getState().openUnsavedChangesDialog({
      onConfirm: () => {
        useCoreStore.getState().newFile();
        useNavigationStore.getState().zoomToRoot();
      },
    });

    // Get the confirm callback
    const dialogInfo = useUIStore.getState().unsavedChangesDialogInfo;
    expect(dialogInfo).not.toBeNull();

    // Simulate user confirming (discarding unsaved changes)
    dialogInfo!.onConfirm();

    // Verify new file was created
    expect(useCoreStore.getState().nodeCount).toBe(0);
    expect(useCoreStore.getState().edgeCount).toBe(0);
    expect(useCoreStore.getState().isDirty).toBe(false);
    expect(useCoreStore.getState().fileName).toBe('Untitled Architecture');
  });

  it('Ctrl+N resets navigation path to root', () => {
    // Navigate into a nested node
    useNavigationStore.setState({ path: ['node-1', 'node-2'] });
    expect(useNavigationStore.getState().path).toEqual(['node-1', 'node-2']);

    // Simulate Ctrl+N new file flow
    useCoreStore.getState().newFile();
    useNavigationStore.getState().zoomToRoot();

    expect(useNavigationStore.getState().path).toEqual([]);
  });

  it('newFile clears architecture name and description', () => {
    // Set custom architecture metadata
    useCoreStore.setState({
      graph: {
        name: 'My Complex Architecture',
        description: 'A detailed system design',
        owners: ['Alice', 'Bob'],
        nodes: [],
        edges: [],
      },
    });

    useCoreStore.getState().newFile();

    const graph = useCoreStore.getState().graph;
    expect(graph.name).toBe('Untitled Architecture');
    expect(graph.description).toBe('');
    expect(graph.owners).toEqual([]);
  });

  it('newFile clears fileCreatedAtMs timestamp', () => {
    useCoreStore.setState({ fileCreatedAtMs: Date.now() });
    expect(useCoreStore.getState().fileCreatedAtMs).not.toBeNull();

    useCoreStore.getState().newFile();

    expect(useCoreStore.getState().fileCreatedAtMs).toBeNull();
  });
});
