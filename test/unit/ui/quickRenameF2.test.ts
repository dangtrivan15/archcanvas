// @vitest-environment happy-dom
/**
 * Tests for Quick Rename (F2) feature.
 *
 * F2 on selected node focuses display name field for editing.
 * Opens right panel if closed. Also available via command palette ('Rename Node').
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  SHORTCUT_ACTIONS,
  parseBinding,
  eventMatchesBinding,
  getShortcutManager,
  resetShortcutManager,
} from '@/core/shortcuts/shortcutManager';
import { KEYBOARD_SHORTCUTS } from '@/config/keyboardShortcuts';
import { getStaticCommands, searchCommands } from '@/config/commandRegistry';
import { useUIStore } from '@/store/uiStore';
import { useCanvasStore } from '@/store/canvasStore';
import { useCoreStore } from '@/store/coreStore';
import { createEmptyGraph } from '@/core/graph/graphEngine';
import type { ArchNode } from '@/types/graph';

function resetStores() {
  useUIStore.setState({
    rightPanelOpen: false,
    rightPanelTab: 'properties',
    pendingRenameNodeId: null,
    commandPaletteOpen: false,
  });
  useCanvasStore.setState({
    selectedNodeId: null,
    selectedEdgeId: null,
  });
  useCoreStore.setState({
    graph: createEmptyGraph(),
  });
  resetShortcutManager();
}

function createTestNode(id = 'node-1', displayName = 'Test Service'): ArchNode {
  return {
    id,
    type: 'compute/service',
    displayName,
    args: {},
    codeRefs: [],
    notes: [],
    properties: {},
    position: { x: 100, y: 200, width: 200, height: 100 },
    children: [],
  };
}

describe('Quick Rename (F2) - ShortcutManager Registration', () => {
  beforeEach(resetStores);

  it('registers edit:rename action in SHORTCUT_ACTIONS', () => {
    const action = SHORTCUT_ACTIONS.find((a) => a.id === 'node:rename');
    expect(action).toBeDefined();
    expect(action!.label).toBe('Quick Rename');
    expect(action!.category).toBe('Edit');
    expect(action!.defaultBinding).toBe('f2');
  });

  it('ShortcutManager resolves F2 keypress to edit:rename', () => {
    const manager = getShortcutManager();
    const event = new KeyboardEvent('keydown', { key: 'F2', code: 'F2' });
    const actionId = manager.matchEvent(event);
    expect(actionId).toBe('node:rename');
  });

  it('parseBinding correctly parses f2', () => {
    const binding = parseBinding('f2');
    expect(binding.key).toBe('f2');
    expect(binding.mod).toBe(false);
    expect(binding.shift).toBe(false);
    expect(binding.alt).toBe(false);
  });

  it('F2 binding matches F2 keyboard event', () => {
    const binding = parseBinding('f2');
    const event = new KeyboardEvent('keydown', { key: 'F2', code: 'F2' });
    expect(eventMatchesBinding(event, binding)).toBe(true);
  });

  it('F2 binding does NOT match other keys', () => {
    const binding = parseBinding('f2');
    const event = new KeyboardEvent('keydown', { key: 'F1', code: 'F1' });
    expect(eventMatchesBinding(event, binding)).toBe(false);
  });

  it('F2 binding does NOT match F2 with Ctrl modifier', () => {
    const binding = parseBinding('f2');
    const event = new KeyboardEvent('keydown', { key: 'F2', code: 'F2', ctrlKey: true });
    expect(eventMatchesBinding(event, binding)).toBe(false);
  });
});

describe('Quick Rename (F2) - Help Panel Registration', () => {
  it('has quick-rename entry in KEYBOARD_SHORTCUTS', () => {
    const shortcut = KEYBOARD_SHORTCUTS.find((s) => s.id === 'quick-rename');
    expect(shortcut).toBeDefined();
    expect(shortcut!.category).toBe('Edit');
    expect(shortcut!.description).toBe('Quick rename selected node');
    expect(shortcut!.macKeys).toBe('F2');
    expect(shortcut!.winKeys).toBe('F2');
  });
});

describe('Quick Rename (F2) - Rename Action Logic', () => {
  beforeEach(resetStores);

  it('F2 with selected node sets pendingRenameNodeId', () => {
    const testNode = createTestNode();
    useCoreStore.setState({
      graph: { ...createEmptyGraph(), nodes: [testNode] },
    });
    useCanvasStore.setState({ selectedNodeId: 'node-1' });

    // Simulate what the keyboard handler does
    const selectedNodeId = useCanvasStore.getState().selectedNodeId;
    if (selectedNodeId) {
      useUIStore.getState().setPendingRenameNodeId(selectedNodeId);
      useUIStore.getState().openRightPanel('properties');
    }

    expect(useUIStore.getState().pendingRenameNodeId).toBe('node-1');
    expect(useUIStore.getState().rightPanelOpen).toBe(true);
    expect(useUIStore.getState().rightPanelTab).toBe('properties');
  });

  it('F2 with no selected node does nothing', () => {
    // No node selected
    useCanvasStore.setState({ selectedNodeId: null });

    const selectedNodeId = useCanvasStore.getState().selectedNodeId;
    if (selectedNodeId) {
      useUIStore.getState().setPendingRenameNodeId(selectedNodeId);
      useUIStore.getState().openRightPanel('properties');
    }

    expect(useUIStore.getState().pendingRenameNodeId).toBeNull();
    expect(useUIStore.getState().rightPanelOpen).toBe(false);
  });

  it('F2 opens right panel if it was closed', () => {
    useCanvasStore.setState({ selectedNodeId: 'node-1' });
    useUIStore.setState({ rightPanelOpen: false });

    const selectedNodeId = useCanvasStore.getState().selectedNodeId;
    if (selectedNodeId) {
      useUIStore.getState().setPendingRenameNodeId(selectedNodeId);
      useUIStore.getState().openRightPanel('properties');
    }

    expect(useUIStore.getState().rightPanelOpen).toBe(true);
  });

  it('F2 switches to properties tab if on different tab', () => {
    useCanvasStore.setState({ selectedNodeId: 'node-1' });
    useUIStore.setState({ rightPanelOpen: true, rightPanelTab: 'notes' });

    const selectedNodeId = useCanvasStore.getState().selectedNodeId;
    if (selectedNodeId) {
      useUIStore.getState().setPendingRenameNodeId(selectedNodeId);
      useUIStore.getState().openRightPanel('properties');
    }

    expect(useUIStore.getState().rightPanelTab).toBe('properties');
  });

  it('setPendingRenameNodeId correctly stores node ID', () => {
    useUIStore.getState().setPendingRenameNodeId('node-abc');
    expect(useUIStore.getState().pendingRenameNodeId).toBe('node-abc');
  });

  it('clearPendingRename clears the pending rename', () => {
    useUIStore.getState().setPendingRenameNodeId('node-abc');
    useUIStore.getState().clearPendingRename();
    expect(useUIStore.getState().pendingRenameNodeId).toBeNull();
  });
});

describe('Quick Rename (F2) - Command Palette', () => {
  beforeEach(resetStores);

  it('has Rename Node command in static commands', () => {
    const commands = getStaticCommands();
    const renameCmd = commands.find((c) => c.id === 'node:rename');
    expect(renameCmd).toBeDefined();
    expect(renameCmd!.label).toBe('Rename Node');
    expect(renameCmd!.category).toBe('Edit');
  });

  it('Rename Node command has F2 shortcut display', () => {
    const commands = getStaticCommands();
    const renameCmd = commands.find((c) => c.id === 'node:rename');
    expect(renameCmd!.shortcut).toBeDefined();
    // The shortcut display will be platform-specific but should contain F2
    expect(renameCmd!.shortcut!.toLowerCase()).toContain('f2');
  });

  it('Rename Node command has rename keywords', () => {
    const commands = getStaticCommands();
    const renameCmd = commands.find((c) => c.id === 'node:rename');
    expect(renameCmd!.keywords).toContain('rename');
    expect(renameCmd!.keywords).toContain('name');
  });

  it('Rename Node command is searchable by "rename"', () => {
    const commands = getStaticCommands();
    const results = searchCommands(commands, 'rename');
    const renameCmd = results.find((c) => c.id === 'node:rename');
    expect(renameCmd).toBeDefined();
  });

  it('Rename Node command is searchable by "f2"', () => {
    const commands = getStaticCommands();
    const results = searchCommands(commands, 'f2');
    const renameCmd = results.find((c) => c.id === 'node:rename');
    expect(renameCmd).toBeDefined();
  });

  it('Rename Node command isEnabled returns false when no node selected', () => {
    useCanvasStore.setState({ selectedNodeId: null });
    const commands = getStaticCommands();
    const renameCmd = commands.find((c) => c.id === 'node:rename')!;
    expect(renameCmd.isEnabled!()).toBe(false);
  });

  it('Rename Node command isEnabled returns true when node selected', () => {
    useCanvasStore.setState({ selectedNodeId: 'node-1' });
    const commands = getStaticCommands();
    const renameCmd = commands.find((c) => c.id === 'node:rename')!;
    expect(renameCmd.isEnabled!()).toBe(true);
  });

  it('Rename Node command execute activates inline edit on the canvas node', () => {
    const testNode = createTestNode();
    useCoreStore.setState({
      graph: { ...createEmptyGraph(), nodes: [testNode] },
    });
    useCanvasStore.setState({ selectedNodeId: 'node-1' });
    useUIStore.setState({ rightPanelOpen: false, inlineEditNodeId: null });

    const commands = getStaticCommands();
    const renameCmd = commands.find((c) => c.id === 'node:rename')!;
    renameCmd.execute();

    // Now uses inline edit directly on the node card (Feature #259)
    expect(useUIStore.getState().inlineEditNodeId).toBe('node-1');
    // Should NOT open right panel for inline edit
    expect(useUIStore.getState().rightPanelOpen).toBe(false);
  });

  it('Rename Node command has Pencil icon', () => {
    const commands = getStaticCommands();
    const renameCmd = commands.find((c) => c.id === 'node:rename');
    expect(renameCmd!.iconName).toBe('Pencil');
  });
});

describe('Quick Rename (F2) - Integration with existing rename mechanism', () => {
  beforeEach(resetStores);

  it('pendingRenameNodeId is consumed by the same mechanism as node creation rename', () => {
    // The pendingRenameNodeId mechanism is shared between:
    // 1. Node creation (getNodeCreationCommands sets it)
    // 2. F2 quick rename (sets it the same way)
    // Verify that the mechanism is the same
    const testNode = createTestNode();
    useCoreStore.setState({
      graph: { ...createEmptyGraph(), nodes: [testNode] },
    });
    useCanvasStore.setState({ selectedNodeId: 'node-1' });

    useUIStore.getState().setPendingRenameNodeId('node-1');
    expect(useUIStore.getState().pendingRenameNodeId).toBe('node-1');

    // After NodeDetailPanel consumes it, clearPendingRename is called
    useUIStore.getState().clearPendingRename();
    expect(useUIStore.getState().pendingRenameNodeId).toBeNull();
  });

  it('F2 on a different node updates pendingRenameNodeId', () => {
    useCanvasStore.setState({ selectedNodeId: 'node-1' });
    useUIStore.getState().setPendingRenameNodeId('node-1');

    // User selects a different node and presses F2
    useCanvasStore.setState({ selectedNodeId: 'node-2' });
    useUIStore.getState().setPendingRenameNodeId('node-2');

    expect(useUIStore.getState().pendingRenameNodeId).toBe('node-2');
  });

  it('multiple F2 presses in sequence work correctly', () => {
    useCanvasStore.setState({ selectedNodeId: 'node-1' });

    // First F2
    useUIStore.getState().setPendingRenameNodeId('node-1');
    expect(useUIStore.getState().pendingRenameNodeId).toBe('node-1');

    // NodeDetailPanel consumes it
    useUIStore.getState().clearPendingRename();

    // Second F2 (e.g., after Escape cancel)
    useUIStore.getState().setPendingRenameNodeId('node-1');
    expect(useUIStore.getState().pendingRenameNodeId).toBe('node-1');
  });
});
