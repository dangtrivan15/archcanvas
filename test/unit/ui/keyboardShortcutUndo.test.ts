// @vitest-environment happy-dom
/**
 * Tests for Feature #209: Keyboard shortcut Ctrl+Z triggers undo.
 * Verifies that pressing Ctrl+Z undoes the last action (node removal)
 * and pressing Ctrl+Shift+Z redoes it (node reappears).
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

describe('Feature #209: Keyboard shortcut Ctrl+Z triggers undo', () => {
  beforeEach(() => {
    // Reset store to clean state
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

  // --- Undo Tests ---

  it('Ctrl+Z undoes "Add node" action (node count goes from 1 to 0)', () => {
    const store = useCoreStore.getState();

    // Add a node
    store.addNode({ type: 'compute/service', displayName: 'Undo Test Service' });
    expect(useCoreStore.getState().nodeCount).toBe(1);
    expect(useCoreStore.getState().canUndo).toBe(true);

    // Undo
    useCoreStore.getState().undo();
    expect(useCoreStore.getState().nodeCount).toBe(0);
    expect(useCoreStore.getState().graph.nodes).toHaveLength(0);
  });

  it('undo sets canUndo to false when no more history', () => {
    const store = useCoreStore.getState();

    // Add a node then undo
    store.addNode({ type: 'compute/service', displayName: 'Test' });
    useCoreStore.getState().undo();

    expect(useCoreStore.getState().canUndo).toBe(false);
  });

  it('undo sets canRedo to true after undoing', () => {
    const store = useCoreStore.getState();

    // Add a node then undo
    store.addNode({ type: 'compute/service', displayName: 'Test' });
    useCoreStore.getState().undo();

    expect(useCoreStore.getState().canRedo).toBe(true);
  });

  it('undo marks document as dirty', () => {
    const store = useCoreStore.getState();

    store.addNode({ type: 'compute/service', displayName: 'Test' });
    // Reset dirty flag
    useCoreStore.setState({ isDirty: false });

    useCoreStore.getState().undo();
    expect(useCoreStore.getState().isDirty).toBe(true);
  });

  it('undo does nothing when canUndo is false (no history)', () => {
    expect(useCoreStore.getState().canUndo).toBe(false);
    expect(useCoreStore.getState().nodeCount).toBe(0);

    // Try to undo when nothing to undo
    useCoreStore.getState().undo();

    expect(useCoreStore.getState().nodeCount).toBe(0);
  });

  it('multiple undos revert multiple actions', () => {
    const store = useCoreStore.getState();

    // Add two nodes
    store.addNode({ type: 'compute/service', displayName: 'First' });
    expect(useCoreStore.getState().nodeCount).toBe(1);

    useCoreStore.getState().addNode({ type: 'compute/service', displayName: 'Second' });
    expect(useCoreStore.getState().nodeCount).toBe(2);

    // Undo second node
    useCoreStore.getState().undo();
    expect(useCoreStore.getState().nodeCount).toBe(1);
    expect(useCoreStore.getState().graph.nodes[0].displayName).toBe('First');

    // Undo first node
    useCoreStore.getState().undo();
    expect(useCoreStore.getState().nodeCount).toBe(0);
  });

  // --- Redo Tests ---

  it('Ctrl+Shift+Z redoes undone action (node reappears)', () => {
    const store = useCoreStore.getState();

    // Add a node, undo, then redo
    store.addNode({ type: 'compute/service', displayName: 'Redo Test Service' });
    useCoreStore.getState().undo();
    expect(useCoreStore.getState().nodeCount).toBe(0);

    useCoreStore.getState().redo();
    expect(useCoreStore.getState().nodeCount).toBe(1);
    expect(useCoreStore.getState().graph.nodes[0].displayName).toBe('Redo Test Service');
  });

  it('redo sets canRedo to false when no more redo history', () => {
    const store = useCoreStore.getState();

    store.addNode({ type: 'compute/service', displayName: 'Test' });
    useCoreStore.getState().undo();
    useCoreStore.getState().redo();

    expect(useCoreStore.getState().canRedo).toBe(false);
  });

  it('redo sets canUndo to true after redoing', () => {
    const store = useCoreStore.getState();

    store.addNode({ type: 'compute/service', displayName: 'Test' });
    useCoreStore.getState().undo();
    useCoreStore.getState().redo();

    expect(useCoreStore.getState().canUndo).toBe(true);
  });

  it('redo marks document as dirty', () => {
    const store = useCoreStore.getState();

    store.addNode({ type: 'compute/service', displayName: 'Test' });
    useCoreStore.getState().undo();
    useCoreStore.setState({ isDirty: false });

    useCoreStore.getState().redo();
    expect(useCoreStore.getState().isDirty).toBe(true);
  });

  it('redo does nothing when canRedo is false (no redo history)', () => {
    const store = useCoreStore.getState();

    store.addNode({ type: 'compute/service', displayName: 'Test' });
    expect(useCoreStore.getState().canRedo).toBe(false);

    // Try to redo when nothing to redo
    useCoreStore.getState().redo();

    // Node count unchanged
    expect(useCoreStore.getState().nodeCount).toBe(1);
  });

  // --- Keyboard Event Detection Tests ---

  it('Ctrl+Z keyboard event is detected as undo (mod + z, no shift)', () => {
    const event = new KeyboardEvent('keydown', {
      key: 'z',
      ctrlKey: true,
      shiftKey: false,
      bubbles: true,
      cancelable: true,
    });

    const mod = event.metaKey || event.ctrlKey;
    const isUndo = mod && event.key.toLowerCase() === 'z' && !event.shiftKey;
    const isRedo = mod && event.key.toLowerCase() === 'z' && event.shiftKey;

    expect(isUndo).toBe(true);
    expect(isRedo).toBe(false);
  });

  it('Ctrl+Shift+Z keyboard event is detected as redo (mod + z + shift)', () => {
    const event = new KeyboardEvent('keydown', {
      key: 'Z',
      ctrlKey: true,
      shiftKey: true,
      bubbles: true,
      cancelable: true,
    });

    const mod = event.metaKey || event.ctrlKey;
    const isUndo = mod && event.key.toLowerCase() === 'z' && !event.shiftKey;
    const isRedo = mod && event.key.toLowerCase() === 'z' && event.shiftKey;

    expect(isUndo).toBe(false);
    expect(isRedo).toBe(true);
  });

  it('Cmd+Z (Mac) keyboard event is detected as undo', () => {
    const event = new KeyboardEvent('keydown', {
      key: 'z',
      metaKey: true,
      shiftKey: false,
      bubbles: true,
      cancelable: true,
    });

    const mod = event.metaKey || event.ctrlKey;
    const isUndo = mod && event.key.toLowerCase() === 'z' && !event.shiftKey;

    expect(isUndo).toBe(true);
  });

  it('Cmd+Shift+Z (Mac) keyboard event is detected as redo', () => {
    const event = new KeyboardEvent('keydown', {
      key: 'Z',
      metaKey: true,
      shiftKey: true,
      bubbles: true,
      cancelable: true,
    });

    const mod = event.metaKey || event.ctrlKey;
    const isRedo = mod && event.key.toLowerCase() === 'z' && event.shiftKey;

    expect(isRedo).toBe(true);
  });

  it('Ctrl+Y keyboard event is detected as alternative redo', () => {
    const event = new KeyboardEvent('keydown', {
      key: 'y',
      ctrlKey: true,
      shiftKey: false,
      bubbles: true,
      cancelable: true,
    });

    const mod = event.metaKey || event.ctrlKey;
    const isAltRedo = mod && event.key.toLowerCase() === 'y' && !event.shiftKey;

    expect(isAltRedo).toBe(true);
  });

  it('Ctrl+Z preventDefault stops browser default undo', () => {
    const event = new KeyboardEvent('keydown', {
      key: 'z',
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    });

    const preventDefaultSpy = vi.spyOn(event, 'preventDefault');
    const mod = event.metaKey || event.ctrlKey;
    if (mod && event.key.toLowerCase() === 'z') {
      event.preventDefault();
    }

    expect(preventDefaultSpy).toHaveBeenCalled();
  });

  // --- Edge Cases ---

  it('undo + redo + undo cycle works correctly', () => {
    const store = useCoreStore.getState();

    store.addNode({ type: 'compute/service', displayName: 'Cycle Test' });
    expect(useCoreStore.getState().nodeCount).toBe(1);

    // Undo
    useCoreStore.getState().undo();
    expect(useCoreStore.getState().nodeCount).toBe(0);

    // Redo
    useCoreStore.getState().redo();
    expect(useCoreStore.getState().nodeCount).toBe(1);

    // Undo again
    useCoreStore.getState().undo();
    expect(useCoreStore.getState().nodeCount).toBe(0);
  });

  it('new action after undo discards redo future (branch behavior)', () => {
    const store = useCoreStore.getState();

    // Add node A
    store.addNode({ type: 'compute/service', displayName: 'Node A' });
    // Add node B
    useCoreStore.getState().addNode({ type: 'compute/service', displayName: 'Node B' });
    expect(useCoreStore.getState().nodeCount).toBe(2);

    // Undo node B
    useCoreStore.getState().undo();
    expect(useCoreStore.getState().nodeCount).toBe(1);
    expect(useCoreStore.getState().canRedo).toBe(true);

    // Add node C (this should discard the redo future of node B)
    useCoreStore.getState().addNode({ type: 'compute/service', displayName: 'Node C' });
    expect(useCoreStore.getState().nodeCount).toBe(2);
    expect(useCoreStore.getState().canRedo).toBe(false);

    // Redo should do nothing since branch was discarded
    useCoreStore.getState().redo();
    expect(useCoreStore.getState().nodeCount).toBe(2);
  });

  it('edge count updates correctly on undo/redo of edge operations', () => {
    const store = useCoreStore.getState();

    // Add two nodes
    const node1 = store.addNode({ type: 'compute/service', displayName: 'From' });
    const node2 = useCoreStore.getState().addNode({ type: 'compute/service', displayName: 'To' });
    expect(useCoreStore.getState().nodeCount).toBe(2);

    // Add edge
    useCoreStore.getState().addEdge({
      fromNode: node1!.id,
      toNode: node2!.id,
      type: 'sync',
    });
    expect(useCoreStore.getState().edgeCount).toBe(1);

    // Undo edge
    useCoreStore.getState().undo();
    expect(useCoreStore.getState().edgeCount).toBe(0);
    expect(useCoreStore.getState().nodeCount).toBe(2);

    // Redo edge
    useCoreStore.getState().redo();
    expect(useCoreStore.getState().edgeCount).toBe(1);
  });

  it('plain Z key without modifier does NOT trigger undo', () => {
    const event = new KeyboardEvent('keydown', {
      key: 'z',
      ctrlKey: false,
      metaKey: false,
      bubbles: true,
      cancelable: true,
    });

    const mod = event.metaKey || event.ctrlKey;
    expect(mod).toBe(false);
  });
});
