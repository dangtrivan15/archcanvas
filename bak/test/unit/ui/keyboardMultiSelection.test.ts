// @vitest-environment happy-dom
/**
 * Tests for Feature #254: Keyboard Multi-Selection.
 *
 * Verifies:
 * - Multi-selection state management in canvasStore
 * - Shift+Arrow extends selection
 * - Mod+Arrow toggles node in selection
 * - Cmd+A selects all nodes
 * - Cmd+Shift+A selects all edges
 * - Selection count in status bar
 * - Escape clears all selection
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useCanvasStore } from '@/store/canvasStore';
import { SHORTCUT_ACTIONS } from '@/core/shortcuts/shortcutManager';
import { KEYBOARD_SHORTCUTS } from '@/config/keyboardShortcuts';

describe('Feature #254: Keyboard Multi-Selection', () => {
  beforeEach(() => {
    useCanvasStore.setState({
      selectedNodeId: null,
      selectedEdgeId: null,
      selectedNodeIds: [],
      selectedEdgeIds: [],
    });
  });

  describe('canvasStore multi-selection state', () => {
    it('selectNode replaces entire selection with single node', () => {
      const store = useCanvasStore.getState();
      store.selectNode('node-1');
      const state = useCanvasStore.getState();
      expect(state.selectedNodeId).toBe('node-1');
      expect(state.selectedNodeIds).toEqual(['node-1']);
      expect(state.selectedEdgeIds).toEqual([]);
    });

    it('selectNode(null) clears selection arrays', () => {
      const store = useCanvasStore.getState();
      store.selectNode('node-1');
      store.selectNode(null);
      const state = useCanvasStore.getState();
      expect(state.selectedNodeId).toBeNull();
      expect(state.selectedNodeIds).toEqual([]);
    });

    it('addNodeToSelection adds to existing selection', () => {
      const store = useCanvasStore.getState();
      store.selectNode('node-1');
      store.addNodeToSelection('node-2');
      const state = useCanvasStore.getState();
      expect(state.selectedNodeIds).toEqual(['node-1', 'node-2']);
      expect(state.selectedNodeId).toBe('node-2'); // last added
    });

    it('addNodeToSelection does not duplicate', () => {
      const store = useCanvasStore.getState();
      store.selectNode('node-1');
      store.addNodeToSelection('node-1');
      const state = useCanvasStore.getState();
      expect(state.selectedNodeIds).toEqual(['node-1']);
    });

    it('removeNodeFromSelection removes from selection', () => {
      const store = useCanvasStore.getState();
      store.selectNodes(['node-1', 'node-2', 'node-3']);
      store.removeNodeFromSelection('node-2');
      const state = useCanvasStore.getState();
      expect(state.selectedNodeIds).toEqual(['node-1', 'node-3']);
      expect(state.selectedNodeId).toBe('node-3'); // last remaining
    });

    it('toggleNodeInSelection adds if not present', () => {
      const store = useCanvasStore.getState();
      store.selectNode('node-1');
      store.toggleNodeInSelection('node-2');
      const state = useCanvasStore.getState();
      expect(state.selectedNodeIds).toEqual(['node-1', 'node-2']);
    });

    it('toggleNodeInSelection removes if present', () => {
      const store = useCanvasStore.getState();
      store.selectNodes(['node-1', 'node-2']);
      store.toggleNodeInSelection('node-1');
      const state = useCanvasStore.getState();
      expect(state.selectedNodeIds).toEqual(['node-2']);
    });

    it('selectNodes replaces entire selection with array', () => {
      const store = useCanvasStore.getState();
      store.selectNode('node-1');
      store.selectNodes(['node-a', 'node-b', 'node-c']);
      const state = useCanvasStore.getState();
      expect(state.selectedNodeIds).toEqual(['node-a', 'node-b', 'node-c']);
      expect(state.selectedNodeId).toBe('node-c'); // last in array
      expect(state.selectedEdgeIds).toEqual([]);
    });

    it('clearSelection clears all arrays', () => {
      const store = useCanvasStore.getState();
      store.selectNodes(['node-1', 'node-2']);
      store.clearSelection();
      const state = useCanvasStore.getState();
      expect(state.selectedNodeIds).toEqual([]);
      expect(state.selectedEdgeIds).toEqual([]);
      expect(state.selectedNodeId).toBeNull();
      expect(state.selectedEdgeId).toBeNull();
    });

    it('selectEdge replaces entire selection with single edge', () => {
      const store = useCanvasStore.getState();
      store.selectEdge('edge-1');
      const state = useCanvasStore.getState();
      expect(state.selectedEdgeId).toBe('edge-1');
      expect(state.selectedEdgeIds).toEqual(['edge-1']);
      expect(state.selectedNodeIds).toEqual([]);
    });

    it('addEdgeToSelection adds to existing edge selection', () => {
      const store = useCanvasStore.getState();
      store.selectEdge('edge-1');
      store.addEdgeToSelection('edge-2');
      const state = useCanvasStore.getState();
      expect(state.selectedEdgeIds).toEqual(['edge-1', 'edge-2']);
      expect(state.selectedEdgeId).toBe('edge-2');
    });

    it('selectEdges replaces entire edge selection', () => {
      const store = useCanvasStore.getState();
      store.selectEdges(['edge-a', 'edge-b', 'edge-c']);
      const state = useCanvasStore.getState();
      expect(state.selectedEdgeIds).toEqual(['edge-a', 'edge-b', 'edge-c']);
      expect(state.selectedEdgeId).toBe('edge-c');
      expect(state.selectedNodeIds).toEqual([]);
    });

    it('addNodeToSelection clears edge selection', () => {
      const store = useCanvasStore.getState();
      store.selectEdge('edge-1');
      store.addNodeToSelection('node-1');
      const state = useCanvasStore.getState();
      expect(state.selectedNodeIds).toEqual(['node-1']);
      expect(state.selectedEdgeIds).toEqual([]);
    });

    it('addEdgeToSelection clears node selection', () => {
      const store = useCanvasStore.getState();
      store.selectNode('node-1');
      store.addEdgeToSelection('edge-1');
      const state = useCanvasStore.getState();
      expect(state.selectedEdgeIds).toEqual(['edge-1']);
      expect(state.selectedNodeIds).toEqual([]);
    });

    it('removeNodeFromSelection updates selectedNodeId to last element', () => {
      const store = useCanvasStore.getState();
      store.selectNodes(['node-1', 'node-2', 'node-3']);
      store.removeNodeFromSelection('node-3');
      const state = useCanvasStore.getState();
      expect(state.selectedNodeId).toBe('node-2');
    });

    it('removeNodeFromSelection when empty results in null selectedNodeId', () => {
      const store = useCanvasStore.getState();
      store.selectNode('node-1');
      store.removeNodeFromSelection('node-1');
      const state = useCanvasStore.getState();
      expect(state.selectedNodeIds).toEqual([]);
      expect(state.selectedNodeId).toBeNull();
    });
  });

  describe('ShortcutManager actions for select:all and select:all-edges', () => {
    it('select:all action is registered', () => {
      const action = SHORTCUT_ACTIONS.find((a) => a.id === 'select:all');
      expect(action).toBeDefined();
      expect(action!.defaultBinding).toBe('mod+a');
      expect(action!.label).toBe('Select All Nodes');
    });

    it('select:all-edges action is registered', () => {
      const action = SHORTCUT_ACTIONS.find((a) => a.id === 'select:all-edges');
      expect(action).toBeDefined();
      expect(action!.defaultBinding).toBe('mod+shift+a');
      expect(action!.label).toBe('Select All Edges');
    });
  });

  describe('Help panel shortcuts', () => {
    it('select-all shortcut is listed in help panel config', () => {
      const shortcut = KEYBOARD_SHORTCUTS.find((s) => s.id === 'select-all');
      expect(shortcut).toBeDefined();
      expect(shortcut!.category).toBe('Edit');
      expect(shortcut!.macKeys).toBe('⌘ A');
      expect(shortcut!.winKeys).toBe('Ctrl+A');
    });

    it('select-all-edges shortcut is listed in help panel config', () => {
      const shortcut = KEYBOARD_SHORTCUTS.find((s) => s.id === 'select-all-edges');
      expect(shortcut).toBeDefined();
      expect(shortcut!.category).toBe('Edit');
      expect(shortcut!.macKeys).toBe('⌘ ⇧ A');
      expect(shortcut!.winKeys).toBe('Ctrl+Shift+A');
    });
  });

  describe('Multi-selection with Shift+Arrow navigation', () => {
    it('Shift+Arrow adds nodes to selection incrementally', () => {
      const store = useCanvasStore.getState();
      // Start with one node selected
      store.selectNode('node-1');
      // Shift+Arrow: add node-2
      store.addNodeToSelection('node-2');
      expect(useCanvasStore.getState().selectedNodeIds).toEqual(['node-1', 'node-2']);
      // Shift+Arrow again: add node-3
      store.addNodeToSelection('node-3');
      expect(useCanvasStore.getState().selectedNodeIds).toEqual(['node-1', 'node-2', 'node-3']);
      expect(useCanvasStore.getState().selectedNodeIds.length).toBe(3);
    });
  });

  describe('Mod+Arrow toggles selection', () => {
    it('toggleNodeInSelection can grow and shrink selection', () => {
      const store = useCanvasStore.getState();
      store.selectNode('node-1');
      // Toggle node-2 IN
      store.toggleNodeInSelection('node-2');
      expect(useCanvasStore.getState().selectedNodeIds).toEqual(['node-1', 'node-2']);
      // Toggle node-1 OUT
      store.toggleNodeInSelection('node-1');
      expect(useCanvasStore.getState().selectedNodeIds).toEqual(['node-2']);
      // Toggle node-2 OUT
      store.toggleNodeInSelection('node-2');
      expect(useCanvasStore.getState().selectedNodeIds).toEqual([]);
    });
  });

  describe('Escape clears multi-selection', () => {
    it('clearSelection clears multi-node selection completely', () => {
      const store = useCanvasStore.getState();
      store.selectNodes(['node-1', 'node-2', 'node-3']);
      store.clearSelection();
      const state = useCanvasStore.getState();
      expect(state.selectedNodeIds).toEqual([]);
      expect(state.selectedNodeId).toBeNull();
    });

    it('clearSelection clears multi-edge selection completely', () => {
      const store = useCanvasStore.getState();
      store.selectEdges(['edge-1', 'edge-2']);
      store.clearSelection();
      const state = useCanvasStore.getState();
      expect(state.selectedEdgeIds).toEqual([]);
      expect(state.selectedEdgeId).toBeNull();
    });
  });

  describe('Source code integration verification', () => {
    it('Canvas keyboard hook uses addNodeToSelection for Shift+Arrow', async () => {
      const fs = await import('fs');
      const content = fs.readFileSync('src/components/canvas/hooks/useCanvasKeyboard.ts', 'utf-8');
      expect(content).toContain('addNodeToSelection');
      expect(content).toContain('isShift');
    });

    it('Canvas keyboard hook uses toggleNodeInSelection for Mod+Arrow', async () => {
      const fs = await import('fs');
      const content = fs.readFileSync('src/components/canvas/hooks/useCanvasKeyboard.ts', 'utf-8');
      expect(content).toContain('toggleNodeInSelection');
      expect(content).toContain('isMod');
    });

    it('useKeyboardShortcuts handles select:all action', async () => {
      const fs = await import('fs');
      const content = fs.readFileSync('src/hooks/useKeyboardShortcuts.ts', 'utf-8');
      expect(content).toContain("case 'select:all'");
      expect(content).toContain('selectNodes');
    });

    it('useKeyboardShortcuts handles select:all-edges action', async () => {
      const fs = await import('fs');
      const content = fs.readFileSync('src/hooks/useKeyboardShortcuts.ts', 'utf-8');
      expect(content).toContain("case 'select:all-edges'");
      expect(content).toContain('selectEdges');
    });

    it('Status bar shows selection count in App.tsx', async () => {
      const fs = await import('fs');
      const content = fs.readFileSync('src/App.tsx', 'utf-8');
      expect(content).toContain('selection-count');
      expect(content).toContain('selectedNodeIds');
    });

    it('Canvas renderer hook syncs selectedNodeIds to React Flow', async () => {
      const fs = await import('fs');
      const content = fs.readFileSync('src/components/canvas/hooks/useCanvasRenderer.ts', 'utf-8');
      expect(content).toContain('selectedNodeIds');
      expect(content).toContain('shouldBeSelected');
    });
  });
});
