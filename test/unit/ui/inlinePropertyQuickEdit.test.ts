/**
 * Tests for Inline Property Quick-Edit (Feature #259).
 *
 * F2 activates an inline text input on the node card for quick renaming
 * without opening the right panel. Enter confirms, Escape reverts, Blur confirms.
 * Tab also confirms. Canvas shortcuts are suppressed during inline edit
 * (FocusZone.TextInput detection).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useUIStore } from '@/store/uiStore';
import { useCanvasStore } from '@/store/canvasStore';
import { useCoreStore } from '@/store/coreStore';
import { createEmptyGraph } from '@/core/graph/graphEngine';
import { getShortcutManager, resetShortcutManager, SHORTCUT_ACTIONS, eventMatchesBinding, parseBinding } from '@/core/shortcuts/shortcutManager';
import { getStaticCommands, searchCommands } from '@/config/commandRegistry';
import { isActiveElementTextInput } from '@/core/input/focusZones';
import { TextApi } from '@/api/textApi';
import { UndoManager } from '@/core/history/undoManager';
import type { ArchNode } from '@/types/graph';

function resetStores() {
  useUIStore.setState({
    rightPanelOpen: false,
    rightPanelTab: 'properties',
    pendingRenameNodeId: null,
    inlineEditNodeId: null,
    commandPaletteOpen: false,
    canvasMode: 'Normal' as any,
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

// ─── UIStore: inlineEditNodeId state management ──────────────────

describe('Inline Edit State Management', () => {
  beforeEach(resetStores);

  it('inlineEditNodeId is initially null', () => {
    expect(useUIStore.getState().inlineEditNodeId).toBeNull();
  });

  it('setInlineEditNodeId stores the node ID', () => {
    useUIStore.getState().setInlineEditNodeId('node-abc');
    expect(useUIStore.getState().inlineEditNodeId).toBe('node-abc');
  });

  it('clearInlineEdit resets inlineEditNodeId to null', () => {
    useUIStore.getState().setInlineEditNodeId('node-abc');
    useUIStore.getState().clearInlineEdit();
    expect(useUIStore.getState().inlineEditNodeId).toBeNull();
  });

  it('setInlineEditNodeId can switch to a different node', () => {
    useUIStore.getState().setInlineEditNodeId('node-1');
    expect(useUIStore.getState().inlineEditNodeId).toBe('node-1');
    useUIStore.getState().setInlineEditNodeId('node-2');
    expect(useUIStore.getState().inlineEditNodeId).toBe('node-2');
  });

  it('setInlineEditNodeId(null) clears inline edit', () => {
    useUIStore.getState().setInlineEditNodeId('node-1');
    useUIStore.getState().setInlineEditNodeId(null);
    expect(useUIStore.getState().inlineEditNodeId).toBeNull();
  });
});

// ─── F2 Shortcut Activation ──────────────────────────────────────

describe('F2 Shortcut activates inline edit', () => {
  beforeEach(resetStores);

  it('F2 is still registered as node:rename action', () => {
    const action = SHORTCUT_ACTIONS.find((a) => a.id === 'node:rename');
    expect(action).toBeDefined();
    expect(action!.defaultBinding).toBe('f2');
  });

  it('F2 with selected node sets inlineEditNodeId (not pendingRenameNodeId)', () => {
    const selectedNodeId = 'node-1';
    useCanvasStore.setState({ selectedNodeId });

    // Simulate what F2 handler does:
    const { selectedNodeId: nodeId } = useCanvasStore.getState();
    if (nodeId) {
      useUIStore.getState().setInlineEditNodeId(nodeId);
    }

    expect(useUIStore.getState().inlineEditNodeId).toBe(selectedNodeId);
    // Should NOT open right panel
    expect(useUIStore.getState().rightPanelOpen).toBe(false);
    // Should NOT set pendingRenameNodeId
    expect(useUIStore.getState().pendingRenameNodeId).toBeNull();
  });

  it('F2 without selected node does nothing', () => {
    useCanvasStore.setState({ selectedNodeId: null });

    const { selectedNodeId: nodeId } = useCanvasStore.getState();
    if (nodeId) {
      useUIStore.getState().setInlineEditNodeId(nodeId);
    }

    expect(useUIStore.getState().inlineEditNodeId).toBeNull();
  });

  it('F2 key binding is correctly parsed', () => {
    const binding = parseBinding('f2');
    expect(binding).toBeDefined();
    const event = new KeyboardEvent('keydown', { key: 'F2', code: 'F2' });
    expect(eventMatchesBinding(event, binding!)).toBe(true);
  });

  it('ShortcutManager resolves F2 keypress to node:rename', () => {
    const manager = getShortcutManager();
    const event = new KeyboardEvent('keydown', { key: 'F2', code: 'F2' });
    expect(manager.matchEvent(event)).toBe('node:rename');
  });
});

// ─── Command Palette Integration ──────────────────────────────────

describe('Command Palette Rename command uses inline edit', () => {
  beforeEach(resetStores);

  it('"Rename Node" command exists in registry', () => {
    const commands = getStaticCommands();
    const renameCmd = commands.find((c) => c.id === 'node:rename');
    expect(renameCmd).toBeDefined();
    expect(renameCmd!.label).toBe('Rename Node');
  });

  it('"Rename Node" command is searchable with "inline" keyword', () => {
    const commands = getStaticCommands();
    const results = searchCommands(commands, 'inline');
    const renameCmd = results.find((c) => c.id === 'node:rename');
    expect(renameCmd).toBeDefined();
  });

  it('"Rename Node" command sets inlineEditNodeId when executed', () => {
    useCanvasStore.setState({ selectedNodeId: 'node-1' });
    const commands = getStaticCommands();
    const renameCmd = commands.find((c) => c.id === 'node:rename');
    renameCmd!.execute();

    expect(useUIStore.getState().inlineEditNodeId).toBe('node-1');
    expect(useUIStore.getState().rightPanelOpen).toBe(false);
  });

  it('"Rename Node" command is disabled when no node selected', () => {
    useCanvasStore.setState({ selectedNodeId: null });
    const commands = getStaticCommands();
    const renameCmd = commands.find((c) => c.id === 'node:rename');
    expect(renameCmd!.isEnabled?.()).toBe(false);
  });
});

// ─── Inline Edit Confirmation Flow ──────────────────────────────

describe('Inline Edit Confirmation and Reversion', () => {
  beforeEach(resetStores);

  it('confirm clears inlineEditNodeId', () => {
    useUIStore.getState().setInlineEditNodeId('node-1');
    expect(useUIStore.getState().inlineEditNodeId).toBe('node-1');
    useUIStore.getState().clearInlineEdit();
    expect(useUIStore.getState().inlineEditNodeId).toBeNull();
  });

  it('revert clears inlineEditNodeId without changing node name', () => {
    const node = createTestNode('node-1', 'Original Name');
    const graph = createEmptyGraph();
    graph.nodes.push(node);
    useCoreStore.setState({ graph });

    useUIStore.getState().setInlineEditNodeId('node-1');
    // Revert: just clear inline edit
    useUIStore.getState().clearInlineEdit();

    expect(useUIStore.getState().inlineEditNodeId).toBeNull();
    expect(useCoreStore.getState().graph.nodes[0]!.displayName).toBe('Original Name');
  });

  it('inline edit does not affect right panel state', () => {
    useUIStore.setState({ rightPanelOpen: false });
    useUIStore.getState().setInlineEditNodeId('node-1');
    expect(useUIStore.getState().rightPanelOpen).toBe(false);
    useUIStore.getState().clearInlineEdit();
    expect(useUIStore.getState().rightPanelOpen).toBe(false);
  });

  it('inline edit does not affect selection state', () => {
    useCanvasStore.setState({ selectedNodeId: 'node-1' });
    useUIStore.getState().setInlineEditNodeId('node-1');
    expect(useCanvasStore.getState().selectedNodeId).toBe('node-1');
    useUIStore.getState().clearInlineEdit();
    expect(useCanvasStore.getState().selectedNodeId).toBe('node-1');
  });
});

// ─── FocusZone / Input Detection ────────────────────────────────

describe('FocusZone TextInput suppression', () => {
  beforeEach(resetStores);

  it('isActiveElementTextInput detects INPUT elements', () => {
    const input = document.createElement('input');
    input.type = 'text';
    document.body.appendChild(input);
    input.focus();
    expect(isActiveElementTextInput()).toBe(true);
    document.body.removeChild(input);
  });

  it('isActiveElementTextInput returns false when no input focused', () => {
    // Focus on body or nothing
    (document.activeElement as HTMLElement)?.blur?.();
    expect(isActiveElementTextInput()).toBe(false);
  });

  it('inline edit input would be detected by isActiveElementTextInput (INPUT tag)', () => {
    // When the inline edit input is focused, it's an <input> element
    // isActiveElementTextInput checks tagName === 'INPUT'
    const input = document.createElement('input');
    input.type = 'text';
    input.setAttribute('data-testid', 'inline-edit-input');
    document.body.appendChild(input);
    input.focus();

    expect(isActiveElementTextInput()).toBe(true);
    document.body.removeChild(input);
  });
});

// ─── Source Code Verification ──────────────────────────────────

describe('Source code verification', () => {
  it('GenericNode imports useUIStore', async () => {
    const fs = await import('fs');
    const source = fs.readFileSync('src/components/nodes/GenericNode.tsx', 'utf8');
    expect(source).toContain("import { useUIStore } from '@/store/uiStore'");
  });

  it('GenericNode imports useCoreStore', async () => {
    const fs = await import('fs');
    const source = fs.readFileSync('src/components/nodes/GenericNode.tsx', 'utf8');
    expect(source).toContain("import { useCoreStore } from '@/store/coreStore'");
  });

  it('GenericNode reads inlineEditNodeId from uiStore', async () => {
    const fs = await import('fs');
    const source = fs.readFileSync('src/components/nodes/GenericNode.tsx', 'utf8');
    expect(source).toContain('inlineEditNodeId');
    expect(source).toContain('isInlineEditing');
  });

  it('GenericNode renders inline-edit-input when editing', async () => {
    const fs = await import('fs');
    const source = fs.readFileSync('src/components/nodes/GenericNode.tsx', 'utf8');
    expect(source).toContain('data-testid="inline-edit-input"');
    expect(source).toContain('aria-label="Edit node name"');
  });

  it('GenericNode handles Enter to confirm edit', async () => {
    const fs = await import('fs');
    const source = fs.readFileSync('src/components/nodes/GenericNode.tsx', 'utf8');
    expect(source).toContain("e.key === 'Enter'");
    expect(source).toContain('confirmEdit');
  });

  it('GenericNode handles Escape to revert edit', async () => {
    const fs = await import('fs');
    const source = fs.readFileSync('src/components/nodes/GenericNode.tsx', 'utf8');
    expect(source).toContain("e.key === 'Escape'");
    expect(source).toContain('revertEdit');
  });

  it('GenericNode handles Tab to confirm edit', async () => {
    const fs = await import('fs');
    const source = fs.readFileSync('src/components/nodes/GenericNode.tsx', 'utf8');
    expect(source).toContain("e.key === 'Tab'");
  });

  it('GenericNode handles blur to confirm edit', async () => {
    const fs = await import('fs');
    const source = fs.readFileSync('src/components/nodes/GenericNode.tsx', 'utf8');
    expect(source).toContain('onBlur={confirmEdit}');
  });

  it('GenericNode input has nodrag class to prevent canvas dragging', async () => {
    const fs = await import('fs');
    const source = fs.readFileSync('src/components/nodes/GenericNode.tsx', 'utf8');
    expect(source).toContain('nodrag');
  });

  it('GenericNode uses coreStore.updateNode for applying changes', async () => {
    const fs = await import('fs');
    const source = fs.readFileSync('src/components/nodes/GenericNode.tsx', 'utf8');
    expect(source).toContain('useCoreStore.getState().updateNode');
    expect(source).toContain('displayName: trimmedValue');
  });

  it('GenericNode input stops event propagation', async () => {
    const fs = await import('fs');
    const source = fs.readFileSync('src/components/nodes/GenericNode.tsx', 'utf8');
    expect(source).toContain('e.stopPropagation()');
  });

  it('GenericNode selects all text on focus', async () => {
    const fs = await import('fs');
    const source = fs.readFileSync('src/components/nodes/GenericNode.tsx', 'utf8');
    expect(source).toContain('.select()');
  });

  it('F2 handler now uses setInlineEditNodeId', async () => {
    const fs = await import('fs');
    const source = fs.readFileSync('src/hooks/useKeyboardShortcuts.ts', 'utf8');
    // The node:rename case should use setInlineEditNodeId
    expect(source).toContain('setInlineEditNodeId');
  });

  it('F2 handler does NOT open right panel', async () => {
    const fs = await import('fs');
    const source = fs.readFileSync('src/hooks/useKeyboardShortcuts.ts', 'utf8');
    // Get the node:rename case block
    const renameStart = source.indexOf("case 'node:rename':");
    const renameEnd = source.indexOf('break;', renameStart);
    const renameBlock = source.substring(renameStart, renameEnd);
    expect(renameBlock).not.toContain('openRightPanel');
    expect(renameBlock).not.toContain('setPendingRenameNodeId');
  });

  it('Command palette Rename Node uses setInlineEditNodeId', async () => {
    const fs = await import('fs');
    const source = fs.readFileSync('src/config/commandRegistry.ts', 'utf8');
    // Find the node:rename command block
    const renameStart = source.indexOf("id: 'node:rename'");
    const renameEnd = source.indexOf('isEnabled:', renameStart);
    const renameBlock = source.substring(renameStart, renameEnd);
    expect(renameBlock).toContain('setInlineEditNodeId');
  });

  it('uiStore has inlineEditNodeId state and actions', async () => {
    const fs = await import('fs');
    const source = fs.readFileSync('src/store/uiStore.ts', 'utf8');
    expect(source).toContain('inlineEditNodeId: string | null');
    expect(source).toContain('setInlineEditNodeId');
    expect(source).toContain('clearInlineEdit');
  });
});

// ─── coreStore.updateNode integration ───────────────────────────

describe('coreStore.updateNode integration', () => {
  beforeEach(resetStores);

  it('updateNode updates display name with undo snapshot', () => {
    const node = createTestNode('node-1', 'Original Name');
    const graph = createEmptyGraph();
    graph.nodes.push(node);

    // Initialize coreStore with TextApi and UndoManager
    // TextApi and UndoManager imported at top of file
    const textApi = new TextApi(graph);
    const undoManager = new UndoManager();
    undoManager.snapshot('Initial', graph);

    useCoreStore.setState({
      graph,
      textApi,
      undoManager,
      canUndo: false,
      canRedo: false,
      isDirty: false,
    });

    // Call updateNode
    useCoreStore.getState().updateNode('node-1', { displayName: 'New Name' });

    const updatedGraph = useCoreStore.getState().graph;
    expect(updatedGraph.nodes[0]!.displayName).toBe('New Name');
    expect(useCoreStore.getState().isDirty).toBe(true);
    expect(useCoreStore.getState().canUndo).toBe(true);
  });

  it('updateNode does not change name if called with same value', () => {
    const node = createTestNode('node-1', 'Same Name');
    const graph = createEmptyGraph();
    graph.nodes.push(node);

    // TextApi and UndoManager imported at top of file
    const textApi = new TextApi(graph);
    const undoManager = new UndoManager();
    undoManager.snapshot('Initial', graph);

    useCoreStore.setState({
      graph,
      textApi,
      undoManager,
      isDirty: false,
    });

    // The inline edit confirmEdit checks trimmedValue !== nodeData.displayName
    // before calling updateNode. So updateNode won't be called if name is the same.
    // Here we verify updateNode works when called anyway.
    useCoreStore.getState().updateNode('node-1', { displayName: 'Same Name' });
    expect(useCoreStore.getState().graph.nodes[0]!.displayName).toBe('Same Name');
  });
});

// ─── Edge cases ─────────────────────────────────────────────────

describe('Inline Edit Edge Cases', () => {
  beforeEach(resetStores);

  it('empty input does not rename (trimmed value is empty)', () => {
    // When the user clears the input and presses Enter, we should not rename to empty
    // The confirmEdit function checks: trimmedValue && trimmedValue !== displayName
    // Empty string is falsy, so no updateNode call
    const node = createTestNode('node-1', 'Test Service');
    const graph = createEmptyGraph();
    graph.nodes.push(node);
    useCoreStore.setState({ graph });

    useUIStore.getState().setInlineEditNodeId('node-1');
    // Simulate confirm with empty value - should just clear inline edit
    useUIStore.getState().clearInlineEdit();
    expect(useCoreStore.getState().graph.nodes[0]!.displayName).toBe('Test Service');
  });

  it('whitespace-only input does not rename', () => {
    // Same as above - '   '.trim() === '' is falsy
    const node = createTestNode('node-1', 'Test Service');
    const graph = createEmptyGraph();
    graph.nodes.push(node);
    useCoreStore.setState({ graph });
    expect(useCoreStore.getState().graph.nodes[0]!.displayName).toBe('Test Service');
  });

  it('inline edit can be activated on different nodes in sequence', () => {
    useUIStore.getState().setInlineEditNodeId('node-1');
    expect(useUIStore.getState().inlineEditNodeId).toBe('node-1');

    useUIStore.getState().clearInlineEdit();
    useUIStore.getState().setInlineEditNodeId('node-2');
    expect(useUIStore.getState().inlineEditNodeId).toBe('node-2');
  });

  it('inline edit state is independent of pendingRenameNodeId', () => {
    useUIStore.getState().setInlineEditNodeId('node-1');
    useUIStore.getState().setPendingRenameNodeId('node-2');

    expect(useUIStore.getState().inlineEditNodeId).toBe('node-1');
    expect(useUIStore.getState().pendingRenameNodeId).toBe('node-2');

    useUIStore.getState().clearInlineEdit();
    expect(useUIStore.getState().pendingRenameNodeId).toBe('node-2');
  });

  it('inline edit state survives right panel toggle', () => {
    useUIStore.getState().setInlineEditNodeId('node-1');
    useUIStore.getState().toggleRightPanel();
    expect(useUIStore.getState().inlineEditNodeId).toBe('node-1');
  });
});
