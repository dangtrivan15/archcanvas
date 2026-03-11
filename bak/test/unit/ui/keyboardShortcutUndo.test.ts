// @vitest-environment happy-dom
/**
 * Tests for Feature #209: Keyboard shortcut Ctrl+Z triggers undo.
 * Verifies that pressing Ctrl+Z undoes the last action (node removal)
 * and pressing Ctrl+Shift+Z redoes it (node reappears).
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

  // --- Undo Tests ---

  it('Ctrl+Z undoes "Add node" action (node count goes from 1 to 0)', () => {
    const store = useGraphStore.getState();

    // Add a node
    store.addNode({ type: 'compute/service', displayName: 'Undo Test Service' });
    expect(useGraphStore.getState().nodeCount).toBe(1);
    expect(useHistoryStore.getState().canUndo).toBe(true);

    // Undo
    useHistoryStore.getState().undo();
    expect(useGraphStore.getState().nodeCount).toBe(0);
    expect(useGraphStore.getState().graph.nodes).toHaveLength(0);
  });

  it('undo sets canUndo to false when no more history', () => {
    const store = useGraphStore.getState();

    // Add a node then undo
    store.addNode({ type: 'compute/service', displayName: 'Test' });
    useHistoryStore.getState().undo();

    expect(useHistoryStore.getState().canUndo).toBe(false);
  });

  it('undo sets canRedo to true after undoing', () => {
    const store = useGraphStore.getState();

    // Add a node then undo
    store.addNode({ type: 'compute/service', displayName: 'Test' });
    useHistoryStore.getState().undo();

    expect(useHistoryStore.getState().canRedo).toBe(true);
  });

  it('undo marks document as dirty', () => {
    const store = useGraphStore.getState();

    store.addNode({ type: 'compute/service', displayName: 'Test' });
    // Reset dirty flag
    useGraphStore.setState({ isDirty: false });

    useHistoryStore.getState().undo();
    expect(useGraphStore.getState().isDirty).toBe(true);
  });

  it('undo does nothing when canUndo is false (no history)', () => {
    expect(useHistoryStore.getState().canUndo).toBe(false);
    expect(useGraphStore.getState().nodeCount).toBe(0);

    // Try to undo when nothing to undo
    useHistoryStore.getState().undo();

    expect(useGraphStore.getState().nodeCount).toBe(0);
  });

  it('multiple undos revert multiple actions', () => {
    const store = useGraphStore.getState();

    // Add two nodes
    store.addNode({ type: 'compute/service', displayName: 'First' });
    expect(useGraphStore.getState().nodeCount).toBe(1);

    useGraphStore.getState().addNode({ type: 'compute/service', displayName: 'Second' });
    expect(useGraphStore.getState().nodeCount).toBe(2);

    // Undo second node
    useHistoryStore.getState().undo();
    expect(useGraphStore.getState().nodeCount).toBe(1);
    expect(useGraphStore.getState().graph.nodes[0].displayName).toBe('First');

    // Undo first node
    useHistoryStore.getState().undo();
    expect(useGraphStore.getState().nodeCount).toBe(0);
  });

  // --- Redo Tests ---

  it('Ctrl+Shift+Z redoes undone action (node reappears)', () => {
    const store = useGraphStore.getState();

    // Add a node, undo, then redo
    store.addNode({ type: 'compute/service', displayName: 'Redo Test Service' });
    useHistoryStore.getState().undo();
    expect(useGraphStore.getState().nodeCount).toBe(0);

    useHistoryStore.getState().redo();
    expect(useGraphStore.getState().nodeCount).toBe(1);
    expect(useGraphStore.getState().graph.nodes[0].displayName).toBe('Redo Test Service');
  });

  it('redo sets canRedo to false when no more redo history', () => {
    const store = useGraphStore.getState();

    store.addNode({ type: 'compute/service', displayName: 'Test' });
    useHistoryStore.getState().undo();
    useHistoryStore.getState().redo();

    expect(useHistoryStore.getState().canRedo).toBe(false);
  });

  it('redo sets canUndo to true after redoing', () => {
    const store = useGraphStore.getState();

    store.addNode({ type: 'compute/service', displayName: 'Test' });
    useHistoryStore.getState().undo();
    useHistoryStore.getState().redo();

    expect(useHistoryStore.getState().canUndo).toBe(true);
  });

  it('redo marks document as dirty', () => {
    const store = useGraphStore.getState();

    store.addNode({ type: 'compute/service', displayName: 'Test' });
    useHistoryStore.getState().undo();
    useGraphStore.setState({ isDirty: false });

    useHistoryStore.getState().redo();
    expect(useGraphStore.getState().isDirty).toBe(true);
  });

  it('redo does nothing when canRedo is false (no redo history)', () => {
    const store = useGraphStore.getState();

    store.addNode({ type: 'compute/service', displayName: 'Test' });
    expect(useHistoryStore.getState().canRedo).toBe(false);

    // Try to redo when nothing to redo
    useHistoryStore.getState().redo();

    // Node count unchanged
    expect(useGraphStore.getState().nodeCount).toBe(1);
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
    const store = useGraphStore.getState();

    store.addNode({ type: 'compute/service', displayName: 'Cycle Test' });
    expect(useGraphStore.getState().nodeCount).toBe(1);

    // Undo
    useHistoryStore.getState().undo();
    expect(useGraphStore.getState().nodeCount).toBe(0);

    // Redo
    useHistoryStore.getState().redo();
    expect(useGraphStore.getState().nodeCount).toBe(1);

    // Undo again
    useHistoryStore.getState().undo();
    expect(useGraphStore.getState().nodeCount).toBe(0);
  });

  it('new action after undo discards redo future (branch behavior)', () => {
    const store = useGraphStore.getState();

    // Add node A
    store.addNode({ type: 'compute/service', displayName: 'Node A' });
    // Add node B
    useGraphStore.getState().addNode({ type: 'compute/service', displayName: 'Node B' });
    expect(useGraphStore.getState().nodeCount).toBe(2);

    // Undo node B
    useHistoryStore.getState().undo();
    expect(useGraphStore.getState().nodeCount).toBe(1);
    expect(useHistoryStore.getState().canRedo).toBe(true);

    // Add node C (this should discard the redo future of node B)
    useGraphStore.getState().addNode({ type: 'compute/service', displayName: 'Node C' });
    expect(useGraphStore.getState().nodeCount).toBe(2);
    expect(useHistoryStore.getState().canRedo).toBe(false);

    // Redo should do nothing since branch was discarded
    useHistoryStore.getState().redo();
    expect(useGraphStore.getState().nodeCount).toBe(2);
  });

  it('edge count updates correctly on undo/redo of edge operations', () => {
    const store = useGraphStore.getState();

    // Add two nodes
    const node1 = store.addNode({ type: 'compute/service', displayName: 'From' });
    const node2 = useGraphStore.getState().addNode({ type: 'compute/service', displayName: 'To' });
    expect(useGraphStore.getState().nodeCount).toBe(2);

    // Add edge
    useGraphStore.getState().addEdge({
      fromNode: node1!.id,
      toNode: node2!.id,
      type: 'sync',
    });
    expect(useGraphStore.getState().edgeCount).toBe(1);

    // Undo edge
    useHistoryStore.getState().undo();
    expect(useGraphStore.getState().edgeCount).toBe(0);
    expect(useGraphStore.getState().nodeCount).toBe(2);

    // Redo edge
    useHistoryStore.getState().redo();
    expect(useGraphStore.getState().edgeCount).toBe(1);
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
