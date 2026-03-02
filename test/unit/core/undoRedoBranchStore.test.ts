/**
 * Tests for Feature #37 through the core store: New action after undo discards redo future.
 * Verifies branch behavior at the Zustand store level (same as UI would trigger).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useCoreStore } from '@/store/coreStore';

// Mock file I/O
vi.mock('@/core/storage/fileIO', async () => {
  const actual = await vi.importActual('@/core/storage/fileIO');
  return {
    ...actual,
    saveArchcFile: vi.fn().mockResolvedValue(true),
    saveArchcFileAs: vi.fn().mockResolvedValue({ fileHandle: null, fileName: 'test' }),
    openArchcFile: vi.fn().mockResolvedValue(null),
  };
});

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

describe('Feature #37: Store-level undo branch behavior', () => {
  beforeEach(() => {
    useCoreStore.setState({
      initialized: false,
      isDirty: false,
      graph: { name: 'Untitled', description: '', owners: [], nodes: [], edges: [] },
      fileHandle: null,
      fileName: 'Untitled',
      nodeCount: 0,
      edgeCount: 0,
      canUndo: false,
      canRedo: false,
    });
    useCoreStore.getState().initialize();
  });

  it('add A, add B, undo → canRedo true; add C → canRedo false; graph has A and C', () => {
    const store = useCoreStore.getState;

    // Step 1a: Add node A
    const nodeA = store().addNode({ type: 'compute/service', displayName: 'A' });
    expect(store().nodeCount).toBe(1);
    expect(store().graph.nodes[0].displayName).toBe('A');

    // Step 1b: Add node B
    const nodeB = store().addNode({ type: 'data/database', displayName: 'B' });
    expect(store().nodeCount).toBe(2);
    expect(store().graph.nodes[1].displayName).toBe('B');

    // Step 1c: Undo (B removed)
    store().undo();
    expect(store().nodeCount).toBe(1);
    expect(store().graph.nodes[0].displayName).toBe('A');

    // Step 2: Verify redo is available
    expect(store().canRedo).toBe(true);

    // Step 3: Add node C (new action while redo available)
    const nodeC = store().addNode({ type: 'data/cache', displayName: 'C' });
    expect(store().nodeCount).toBe(2);

    // Step 4: Verify canRedo is now false
    expect(store().canRedo).toBe(false);

    // Step 5: Verify architecture has nodes A and C (not B)
    const nodeNames = store().graph.nodes.map((n) => n.displayName);
    expect(nodeNames).toContain('A');
    expect(nodeNames).toContain('C');
    expect(nodeNames).not.toContain('B');
  });

  it('undo+redo+undo+branch works correctly', () => {
    const store = useCoreStore.getState;

    // Add A, B, C
    store().addNode({ type: 'compute/service', displayName: 'A' });
    store().addNode({ type: 'data/database', displayName: 'B' });
    store().addNode({ type: 'data/cache', displayName: 'C' });
    expect(store().nodeCount).toBe(3);

    // Undo C
    store().undo();
    expect(store().nodeCount).toBe(2);
    expect(store().canRedo).toBe(true);

    // Redo C
    store().redo();
    expect(store().nodeCount).toBe(3);
    expect(store().canRedo).toBe(false);

    // Undo C again
    store().undo();
    expect(store().nodeCount).toBe(2);
    expect(store().canRedo).toBe(true);

    // Branch: add D instead of redoing C
    store().addNode({ type: 'messaging/message-queue', displayName: 'D' });

    // C is gone from redo stack
    expect(store().canRedo).toBe(false);
    expect(store().nodeCount).toBe(3);
    const names = store().graph.nodes.map((n) => n.displayName);
    expect(names).toContain('A');
    expect(names).toContain('B');
    expect(names).toContain('D');
    expect(names).not.toContain('C');
  });

  it('updateNode after undo discards redo future', () => {
    const store = useCoreStore.getState;

    const nodeA = store().addNode({ type: 'compute/service', displayName: 'A' });
    store().updateNode(nodeA!.id, { displayName: 'A-v2' });
    expect(store().graph.nodes[0].displayName).toBe('A-v2');

    // Undo update
    store().undo();
    expect(store().graph.nodes[0].displayName).toBe('A');
    expect(store().canRedo).toBe(true);

    // Branch: update to A-v3 instead of redoing to A-v2
    store().updateNode(nodeA!.id, { displayName: 'A-v3' });
    expect(store().canRedo).toBe(false);
    expect(store().graph.nodes[0].displayName).toBe('A-v3');
  });

  it('addEdge after undo discards redo future', () => {
    const store = useCoreStore.getState;

    const nodeA = store().addNode({ type: 'compute/service', displayName: 'A' });
    const nodeB = store().addNode({ type: 'data/database', displayName: 'B' });

    const edge = store().addEdge({ fromNode: nodeA!.id, toNode: nodeB!.id, type: 'sync' });
    expect(store().edgeCount).toBe(1);

    // Undo edge
    store().undo();
    expect(store().edgeCount).toBe(0);
    expect(store().canRedo).toBe(true);

    // Branch: add different edge
    store().addEdge({ fromNode: nodeB!.id, toNode: nodeA!.id, type: 'async', label: 'branched' });
    expect(store().canRedo).toBe(false);
    expect(store().edgeCount).toBe(1);
    expect(store().graph.edges[0].type).toBe('async');
    expect(store().graph.edges[0].label).toBe('branched');
  });

  it('removeNode after undo discards redo future', () => {
    const store = useCoreStore.getState;

    const nodeA = store().addNode({ type: 'compute/service', displayName: 'A' });
    const nodeB = store().addNode({ type: 'data/database', displayName: 'B' });
    expect(store().nodeCount).toBe(2);

    // Undo add B
    store().undo();
    expect(store().nodeCount).toBe(1);
    expect(store().canRedo).toBe(true);

    // Branch: remove A instead of redoing B
    store().removeNode(nodeA!.id);
    expect(store().canRedo).toBe(false);
    expect(store().nodeCount).toBe(0);
  });

  it('addNote after undo discards redo future', () => {
    const store = useCoreStore.getState;

    const nodeA = store().addNode({ type: 'compute/service', displayName: 'A' });
    store().addNote({ nodeId: nodeA!.id, author: 'test', content: 'Note 1' });

    // Undo note
    store().undo();
    expect(store().graph.nodes[0].notes).toHaveLength(0);
    expect(store().canRedo).toBe(true);

    // Branch: add different note
    store().addNote({ nodeId: nodeA!.id, author: 'test', content: 'Note Branch' });
    expect(store().canRedo).toBe(false);
    expect(store().graph.nodes[0].notes).toHaveLength(1);
    expect(store().graph.nodes[0].notes[0].content).toBe('Note Branch');
  });
});
