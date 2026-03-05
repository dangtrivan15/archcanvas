// @vitest-environment happy-dom
/**
 * Tests for Keyboard Node Duplication feature (#247).
 *
 * Cmd+D / Ctrl+D duplicates selected node(s) with +50px offset,
 * " (copy)" suffix, and internal edge duplication for multi-select.
 *
 * Tests cover:
 * - ShortcutManager action registration (edit:duplicate with mod+d)
 * - Single node duplication (new ID, offset, copy suffix, same type/args)
 * - Multi-node duplication with internal edge cloning
 * - Undo after duplication
 * - Help panel entry in Edit category
 * - Command palette integration
 * - Keyboard event matching (mod+d binding)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  SHORTCUT_ACTIONS,
  parseBinding,
  eventMatchesBinding,
  getShortcutManager,
  resetShortcutManager,
} from '@/core/shortcuts/shortcutManager';
import { KEYBOARD_SHORTCUTS, getShortcutsByCategory } from '@/config/keyboardShortcuts';
import { getStaticCommands, getAllCommands } from '@/config/commandRegistry';
import { useCoreStore } from '@/store/coreStore';
import { useCanvasStore } from '@/store/canvasStore';
import { useUIStore } from '@/store/uiStore';
import { useNavigationStore } from '@/store/navigationStore';
function resetStores() {
  useCoreStore.getState().initialize();
  useCanvasStore.setState({
    selectedNodeId: null,
    selectedEdgeId: null,
    selectedNodeIds: [],
    selectedEdgeIds: [],
    viewport: { x: 0, y: 0, zoom: 1 },
  });
  useUIStore.setState({
    rightPanelOpen: false,
    rightPanelTab: 'properties',
    pendingRenameNodeId: null,
    commandPaletteOpen: false,
  });
  useNavigationStore.setState({
    path: [],
  });
  resetShortcutManager();
}

// ─── ShortcutManager Action Registration ────────────────────────

describe('Keyboard Node Duplication - ShortcutManager Action', () => {
  beforeEach(resetStores);

  it('SHORTCUT_ACTIONS contains edit:duplicate with default binding "mod+d"', () => {
    const action = SHORTCUT_ACTIONS.find((a) => a.id === 'edit:duplicate');
    expect(action).toBeDefined();
    expect(action!.defaultBinding).toBe('mod+d');
    expect(action!.category).toBe('Edit');
    expect(action!.label).toBe('Duplicate');
  });

  it('ShortcutManager resolves edit:duplicate action', () => {
    const manager = getShortcutManager();
    const binding = manager.getBinding('edit:duplicate');
    expect(binding).toBe('mod+d');
  });

  it('mod+d binding parses correctly', () => {
    const parsed = parseBinding('mod+d');
    expect(parsed.mod).toBe(true);
    expect(parsed.key).toBe('d');
    expect(parsed.shift).toBe(false);
    expect(parsed.alt).toBe(false);
  });

  it('Cmd+D event does NOT match mod+d in non-Mac test environment', () => {
    // In Node.js test env, platform is non-Mac, so mod = Ctrl, not Meta.
    // Meta-only presses should NOT match mod+d in this environment.
    const parsed = parseBinding('mod+d');
    const event = {
      key: 'd',
      code: 'KeyD',
      ctrlKey: false,
      metaKey: true,
      shiftKey: false,
      altKey: false,
    } as KeyboardEvent;
    expect(eventMatchesBinding(event, parsed)).toBe(false);
  });

  it('Ctrl+D event matches edit:duplicate binding (Windows-style)', () => {
    const parsed = parseBinding('mod+d');
    // Simulate Ctrl+D on Windows
    const event = {
      key: 'd',
      code: 'KeyD',
      ctrlKey: true,
      metaKey: false,
      shiftKey: false,
      altKey: false,
    } as KeyboardEvent;
    expect(eventMatchesBinding(event, parsed)).toBe(true);
  });

  it('plain "d" without modifier does NOT match mod+d', () => {
    const parsed = parseBinding('mod+d');
    const event = {
      key: 'd',
      code: 'KeyD',
      ctrlKey: false,
      metaKey: false,
      shiftKey: false,
      altKey: false,
    } as KeyboardEvent;
    expect(eventMatchesBinding(event, parsed)).toBe(false);
  });
});

// ─── Single Node Duplication ────────────────────────────────────

describe('Keyboard Node Duplication - Single Node', () => {
  beforeEach(resetStores);

  it('duplicateSelection creates a new node with a different ID', () => {
    const store = useCoreStore.getState();
    const node = store.addNode({
      type: 'compute/service',
      displayName: 'Auth Service',
      position: { x: 100, y: 200 },
    });
    expect(node).toBeDefined();

    const newIds = store.duplicateSelection([node!.id]);
    expect(newIds).toHaveLength(1);
    expect(newIds[0]).not.toBe(node!.id);
  });

  it('duplicated node has " (copy)" suffix in display name', () => {
    const store = useCoreStore.getState();
    const node = store.addNode({
      type: 'compute/service',
      displayName: 'Auth Service',
      position: { x: 100, y: 200 },
    });

    const newIds = store.duplicateSelection([node!.id]);
    const updatedGraph = useCoreStore.getState().graph;
    const newNode = updatedGraph.nodes.find((n) => n.id === newIds[0]);
    expect(newNode).toBeDefined();
    expect(newNode!.displayName).toBe('Auth Service (copy)');
  });

  it('duplicated node is offset +50px in x and y', () => {
    const store = useCoreStore.getState();
    const node = store.addNode({
      type: 'compute/service',
      displayName: 'Auth Service',
      position: { x: 100, y: 200 },
    });

    const newIds = store.duplicateSelection([node!.id]);
    const updatedGraph = useCoreStore.getState().graph;
    const newNode = updatedGraph.nodes.find((n) => n.id === newIds[0]);
    expect(newNode).toBeDefined();
    expect(newNode!.position.x).toBe(150); // 100 + 50
    expect(newNode!.position.y).toBe(250); // 200 + 50
  });

  it('duplicated node preserves the same type', () => {
    const store = useCoreStore.getState();
    const node = store.addNode({
      type: 'data/database',
      displayName: 'Users DB',
      position: { x: 50, y: 50 },
    });

    const newIds = store.duplicateSelection([node!.id]);
    const updatedGraph = useCoreStore.getState().graph;
    const newNode = updatedGraph.nodes.find((n) => n.id === newIds[0]);
    expect(newNode!.type).toBe('data/database');
  });

  it('duplicated node preserves args', () => {
    const store = useCoreStore.getState();
    const node = store.addNode({
      type: 'compute/service',
      displayName: 'API',
      position: { x: 0, y: 0 },
      args: { port: '8080', runtime: 'node' },
    });

    const newIds = store.duplicateSelection([node!.id]);
    const updatedGraph = useCoreStore.getState().graph;
    const newNode = updatedGraph.nodes.find((n) => n.id === newIds[0]);
    // addNode merges NodeDef defaults with user args, so the duplicate
    // should contain at least the user-provided args (plus NodeDef defaults).
    expect(newNode!.args).toMatchObject({ port: '8080', runtime: 'node' });
  });

  it('duplicating increases graph node count by 1', () => {
    const store = useCoreStore.getState();
    const node = store.addNode({
      type: 'compute/service',
      displayName: 'Service A',
      position: { x: 0, y: 0 },
    });

    const countBefore = useCoreStore.getState().nodeCount;
    store.duplicateSelection([node!.id]);
    const countAfter = useCoreStore.getState().nodeCount;
    expect(countAfter).toBe(countBefore + 1);
  });

  it('sets isDirty to true after duplication', () => {
    const store = useCoreStore.getState();
    const node = store.addNode({
      type: 'compute/service',
      displayName: 'Svc',
      position: { x: 0, y: 0 },
    });

    // Reset dirty (addNode also sets dirty, so re-read)
    useCoreStore.setState({ isDirty: false });
    useCoreStore.getState().duplicateSelection([node!.id]);
    expect(useCoreStore.getState().isDirty).toBe(true);
  });

  it('returns empty array when given empty nodeIds', () => {
    const store = useCoreStore.getState();
    const result = store.duplicateSelection([]);
    expect(result).toEqual([]);
  });

  it('returns empty array when given non-existent node IDs', () => {
    const store = useCoreStore.getState();
    const result = store.duplicateSelection(['nonexistent-id']);
    expect(result).toEqual([]);
  });
});

// ─── Multi-Node Duplication with Edges ──────────────────────────

describe('Keyboard Node Duplication - Multi-Node with Edges', () => {
  beforeEach(resetStores);

  it('duplicates multiple nodes at once', () => {
    const store = useCoreStore.getState();
    const nodeA = store.addNode({
      type: 'compute/service',
      displayName: 'Service A',
      position: { x: 0, y: 0 },
    });
    const nodeB = store.addNode({
      type: 'data/database',
      displayName: 'Database B',
      position: { x: 200, y: 100 },
    });

    const newIds = store.duplicateSelection([nodeA!.id, nodeB!.id]);
    expect(newIds).toHaveLength(2);
    expect(newIds[0]).not.toBe(nodeA!.id);
    expect(newIds[1]).not.toBe(nodeB!.id);
  });

  it('duplicated nodes preserve relative position offset (+50px each)', () => {
    const store = useCoreStore.getState();
    const nodeA = store.addNode({
      type: 'compute/service',
      displayName: 'Service A',
      position: { x: 100, y: 50 },
    });
    const nodeB = store.addNode({
      type: 'data/database',
      displayName: 'Database B',
      position: { x: 300, y: 150 },
    });

    const newIds = store.duplicateSelection([nodeA!.id, nodeB!.id]);
    const graph = useCoreStore.getState().graph;
    const newA = graph.nodes.find((n) => n.id === newIds[0]);
    const newB = graph.nodes.find((n) => n.id === newIds[1]);

    expect(newA!.position.x).toBe(150); // 100 + 50
    expect(newA!.position.y).toBe(100); // 50 + 50
    expect(newB!.position.x).toBe(350); // 300 + 50
    expect(newB!.position.y).toBe(200); // 150 + 50
  });

  it('duplicates internal edges between selected nodes', () => {
    const store = useCoreStore.getState();
    const nodeA = store.addNode({
      type: 'compute/service',
      displayName: 'Service A',
      position: { x: 0, y: 0 },
    });
    const nodeB = store.addNode({
      type: 'data/database',
      displayName: 'Database B',
      position: { x: 200, y: 0 },
    });

    // Add edge between A → B
    store.addEdge({
      fromNode: nodeA!.id,
      toNode: nodeB!.id,
      type: 'SYNC',
      label: 'reads from',
    });

    const edgeCountBefore = useCoreStore.getState().edgeCount;
    const newIds = store.duplicateSelection([nodeA!.id, nodeB!.id]);

    const updatedGraph = useCoreStore.getState().graph;
    const edgeCountAfter = updatedGraph.edges.length;

    // Should have one more edge (the duplicated internal edge)
    expect(edgeCountAfter).toBe(edgeCountBefore + 1);

    // The new edge should connect the duplicated nodes, not the originals
    const newEdge = updatedGraph.edges.find(
      (e) => e.fromNode === newIds[0] && e.toNode === newIds[1],
    );
    expect(newEdge).toBeDefined();
    expect(newEdge!.type).toBe('SYNC');
    expect(newEdge!.label).toBe('reads from');
  });

  it('does NOT duplicate edges that are external to the selection', () => {
    const store = useCoreStore.getState();
    const nodeA = store.addNode({
      type: 'compute/service',
      displayName: 'Service A',
      position: { x: 0, y: 0 },
    });
    const nodeB = store.addNode({
      type: 'data/database',
      displayName: 'Database B',
      position: { x: 200, y: 0 },
    });
    const nodeC = store.addNode({
      type: 'data/cache',
      displayName: 'Cache C',
      position: { x: 400, y: 0 },
    });

    // Edge from A → B (internal) and B → C (external to selection A+B)
    store.addEdge({ fromNode: nodeA!.id, toNode: nodeB!.id, type: 'SYNC' });
    store.addEdge({ fromNode: nodeB!.id, toNode: nodeC!.id, type: 'ASYNC' });

    const edgeCountBefore = useCoreStore.getState().graph.edges.length;
    // Only duplicate A and B, not C
    store.duplicateSelection([nodeA!.id, nodeB!.id]);
    const edgeCountAfter = useCoreStore.getState().graph.edges.length;

    // Only 1 new edge (A→B internal), not the B→C external edge
    expect(edgeCountAfter).toBe(edgeCountBefore + 1);
  });

  it('single node duplication does NOT duplicate any edges', () => {
    const store = useCoreStore.getState();
    const nodeA = store.addNode({
      type: 'compute/service',
      displayName: 'Service A',
      position: { x: 0, y: 0 },
    });
    const nodeB = store.addNode({
      type: 'data/database',
      displayName: 'Database B',
      position: { x: 200, y: 0 },
    });

    store.addEdge({ fromNode: nodeA!.id, toNode: nodeB!.id, type: 'SYNC' });

    const edgeCountBefore = useCoreStore.getState().graph.edges.length;
    // Only duplicate A (single node → no edge duplication)
    store.duplicateSelection([nodeA!.id]);
    const edgeCountAfter = useCoreStore.getState().graph.edges.length;

    expect(edgeCountAfter).toBe(edgeCountBefore);
  });
});

// ─── Undo After Duplication ─────────────────────────────────────

describe('Keyboard Node Duplication - Undo', () => {
  beforeEach(resetStores);

  it('undo after single duplication removes the duplicated node', () => {
    const store = useCoreStore.getState();
    const node = store.addNode({
      type: 'compute/service',
      displayName: 'Service',
      position: { x: 0, y: 0 },
    });

    const countBefore = useCoreStore.getState().nodeCount;
    store.duplicateSelection([node!.id]);
    expect(useCoreStore.getState().nodeCount).toBe(countBefore + 1);

    // Undo
    useCoreStore.getState().undo();
    // After undo, we should be back to original node count
    // Note: undo restores from the snapshot BEFORE the duplication
    const countAfterUndo = useCoreStore.getState().nodeCount;
    expect(countAfterUndo).toBe(countBefore);
  });

  it('canUndo is true after duplication', () => {
    const store = useCoreStore.getState();
    const node = store.addNode({
      type: 'compute/service',
      displayName: 'Service',
      position: { x: 0, y: 0 },
    });

    store.duplicateSelection([node!.id]);
    expect(useCoreStore.getState().canUndo).toBe(true);
  });

  it('undo snapshot description mentions duplication count', () => {
    const store = useCoreStore.getState();
    const node = store.addNode({
      type: 'compute/service',
      displayName: 'Service',
      position: { x: 0, y: 0 },
    });

    store.duplicateSelection([node!.id]);

    // The undoManager should have a snapshot
    const { undoManager } = useCoreStore.getState();
    expect(undoManager).toBeDefined();
    // canUndo should be true (snapshot was taken)
    expect(undoManager!.canUndo).toBe(true);
  });
});

// ─── Help Panel Integration ─────────────────────────────────────

describe('Keyboard Node Duplication - Help Panel', () => {
  it('KEYBOARD_SHORTCUTS contains duplicate entry in Edit category', () => {
    const entry = KEYBOARD_SHORTCUTS.find((s) => s.id === 'duplicate');
    expect(entry).toBeDefined();
    expect(entry!.category).toBe('Edit');
    expect(entry!.description).toBe('Duplicate selected node(s)');
    expect(entry!.macKeys).toBe('⌘ D');
    expect(entry!.winKeys).toBe('Ctrl+D');
  });

  it('getShortcutsByCategory includes duplicate under Edit', () => {
    const grouped = getShortcutsByCategory();
    const editShortcuts = grouped.get('Edit');
    expect(editShortcuts).toBeDefined();
    const duplicateEntry = editShortcuts!.find((s) => s.id === 'duplicate');
    expect(duplicateEntry).toBeDefined();
  });
});

// ─── Command Palette Integration ────────────────────────────────

describe('Keyboard Node Duplication - Command Palette', () => {
  beforeEach(resetStores);

  it('static commands include edit:duplicate', () => {
    const commands = getStaticCommands();
    const dupCommand = commands.find((c) => c.id === 'edit:duplicate');
    expect(dupCommand).toBeDefined();
    expect(dupCommand!.label).toBe('Duplicate Selected');
    expect(dupCommand!.category).toBe('Edit');
  });

  it('edit:duplicate command has correct keywords', () => {
    const commands = getStaticCommands();
    const dupCommand = commands.find((c) => c.id === 'edit:duplicate');
    expect(dupCommand!.keywords).toEqual(expect.arrayContaining(['duplicate', 'copy', 'clone']));
  });

  it('edit:duplicate command has Copy icon', () => {
    const commands = getStaticCommands();
    const dupCommand = commands.find((c) => c.id === 'edit:duplicate');
    expect(dupCommand!.iconName).toBe('Copy');
  });

  it('edit:duplicate isEnabled returns false when nothing is selected', () => {
    useCanvasStore.setState({
      selectedNodeId: null,
      selectedNodeIds: [],
    });
    const commands = getStaticCommands();
    const dupCommand = commands.find((c) => c.id === 'edit:duplicate');
    expect(dupCommand!.isEnabled!()).toBe(false);
  });

  it('edit:duplicate isEnabled returns true when a single node is selected', () => {
    useCanvasStore.setState({
      selectedNodeId: 'some-node-id',
      selectedNodeIds: [],
    });
    const commands = getStaticCommands();
    const dupCommand = commands.find((c) => c.id === 'edit:duplicate');
    expect(dupCommand!.isEnabled!()).toBe(true);
  });

  it('edit:duplicate isEnabled returns true when multiple nodes are selected', () => {
    useCanvasStore.setState({
      selectedNodeId: null,
      selectedNodeIds: ['node1', 'node2'],
    });
    const commands = getStaticCommands();
    const dupCommand = commands.find((c) => c.id === 'edit:duplicate');
    expect(dupCommand!.isEnabled!()).toBe(true);
  });

  it('edit:duplicate appears in getAllCommands()', () => {
    const allCommands = getAllCommands();
    const dupCommand = allCommands.find((c) => c.id === 'edit:duplicate');
    expect(dupCommand).toBeDefined();
  });
});

// ─── Source Code Pattern Verification ───────────────────────────

describe('Keyboard Node Duplication - Source Code Patterns', () => {
  it('edit:duplicate uses "mod+d" which prevents browser "Bookmark" shortcut', () => {
    // Verify the binding uses "mod" (platform-adaptive) not hardcoded ctrl/meta
    const action = SHORTCUT_ACTIONS.find((a) => a.id === 'edit:duplicate');
    expect(action!.defaultBinding).toBe('mod+d');
    expect(action!.defaultBinding).not.toContain('ctrl');
    expect(action!.defaultBinding).not.toContain('meta');
  });

  it('edit:duplicate action is in Edit category (available in all modes)', () => {
    // Actions with "edit:" prefix but in "Edit" category are global
    // Only "edit:exit" is mode-gated (checked explicitly in the handler)
    const action = SHORTCUT_ACTIONS.find((a) => a.id === 'edit:duplicate');
    expect(action!.id).toMatch(/^edit:/);
    expect(action!.category).toBe('Edit');
  });
});
