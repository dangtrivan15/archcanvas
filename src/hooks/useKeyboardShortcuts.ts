/**
 * Global keyboard shortcuts hook.
 * Uses the configurable ShortcutManager to resolve key events to actions.
 * Uses the FocusZone system (isActiveElementTextInput) to suppress shortcuts
 * that conflict with text editing.
 * Handles file operations (Ctrl+S, Ctrl+Shift+S, Ctrl+N, Ctrl+O),
 * undo/redo (Ctrl+Z, Ctrl+Shift+Z / Ctrl+Y),
 * command palette (Ctrl+K), help (? to toggle shortcuts panel),
 * and Vim-style mode transitions (C → Connect, i/Enter → Edit, Escape → Normal).
 */

import { useEffect, useCallback } from 'react';
import { useCoreStore } from '@/store/coreStore';
import { useCanvasStore } from '@/store/canvasStore';
import { useUIStore } from '@/store/uiStore';
import { useNavigationStore } from '@/store/navigationStore';
import { getShortcutManager } from '@/core/shortcuts/shortcutManager';
import { isActiveElementTextInput } from '@/core/input/focusZones';
import { isPrimaryModifier } from '@/core/input';
import { CanvasMode } from '@/core/input/canvasMode';
import { quickSearchNext, quickSearchPrev } from '@/components/shared/QuickSearchOverlay';
import { findNode } from '@/core/graph/graphEngine';

/**
 * Map from node:add-* action IDs to NodeDef type keys.
 * Used by hotkey node creation shortcuts (Normal mode only).
 */
export const HOTKEY_NODE_TYPE_MAP: Record<string, string> = {
  'node:add-service': 'compute/service',
  'node:add-database': 'data/database',
  'node:add-queue': 'messaging/message-queue',
  'node:add-gateway': 'compute/api-gateway',
  'node:add-cache': 'data/cache',
};

export function useKeyboardShortcuts() {
  const saveFile = useCoreStore((s) => s.saveFile);
  const saveFileAs = useCoreStore((s) => s.saveFileAs);
  const newFile = useCoreStore((s) => s.newFile);
  const openFile = useCoreStore((s) => s.openFile);
  const undo = useCoreStore((s) => s.undo);
  const redo = useCoreStore((s) => s.redo);
  const openUnsavedChangesDialog = useUIStore((s) => s.openUnsavedChangesDialog);
  const toggleShortcutsHelp = useUIStore((s) => s.toggleShortcutsHelp);
  const toggleCommandPalette = useUIStore((s) => s.toggleCommandPalette);
  const enterMode = useUIStore((s) => s.enterMode);
  const zoomToRoot = useNavigationStore((s) => s.zoomToRoot);
  const requestZoomIn = useCanvasStore((s) => s.requestZoomIn);
  const requestZoomOut = useCanvasStore((s) => s.requestZoomOut);
  const requestFitView = useCanvasStore((s) => s.requestFitView);
  const requestZoom100 = useCanvasStore((s) => s.requestZoom100);
  const selectNodes = useCanvasStore((s) => s.selectNodes);
  const selectEdges = useCanvasStore((s) => s.selectEdges);
  const toggleQuickSearch = useUIStore((s) => s.toggleQuickSearch);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Intercept browser default zoom shortcuts (Cmd+= / Cmd+- / Cmd+0)
      // These must be caught even if ShortcutManager doesn't match them as actions,
      // because the ShortcutManager binds zoom-in to plain '=' not 'mod+='
      const key = e.key;
      if (isPrimaryModifier(e)) {
        if (key === '=' || key === '+') {
          e.preventDefault();
          requestZoomIn();
          return;
        }
        if (key === '-') {
          e.preventDefault();
          requestZoomOut();
          return;
        }
        if (key === '0') {
          e.preventDefault();
          requestFitView();
          return;
        }
        if (key === '1') {
          e.preventDefault();
          requestZoom100();
          return;
        }
      }

      // ── Vim-style mode entry shortcuts (only in Normal mode, not in text input) ──
      const inInput = isActiveElementTextInput();
      const currentMode = useUIStore.getState().canvasMode;

      if (!inInput && currentMode === CanvasMode.Normal) {
        const noModifiers = !e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey;

        // 'C' → Enter Connect mode (with source = selected node, or pick source first)
        if (noModifiers && key.toLowerCase() === 'c') {
          e.preventDefault();
          const selectedNodeId = useCanvasStore.getState().selectedNodeId;
          enterMode(CanvasMode.Connect);
          useUIStore.getState().startConnect(selectedNodeId);
          return;
        }

        // 'i' → Enter Edit mode (requires selected node)
        if (noModifiers && key.toLowerCase() === 'i') {
          const selectedNodeId = useCanvasStore.getState().selectedNodeId;
          if (selectedNodeId) {
            e.preventDefault();
            enterMode(CanvasMode.Edit);
            useUIStore.getState().openRightPanel('properties');
            return;
          }
        }

        // 'n' → Next search match (Vim-style)
        if (noModifiers && key.toLowerCase() === 'n' && !e.shiftKey) {
          e.preventDefault();
          quickSearchNext();
          return;
        }

        // 'N' (Shift+n) → Previous search match (Vim-style)
        if (key === 'N' && e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey) {
          e.preventDefault();
          quickSearchPrev();
          return;
        }

        // Enter → Drill into group node (fractal zoom) or Enter Edit mode (leaf node)
        if (noModifiers && key === 'Enter') {
          const selectedNodeId = useCanvasStore.getState().selectedNodeId;
          if (selectedNodeId) {
            e.preventDefault();
            const { graph } = useCoreStore.getState();
            const node = findNode(graph, selectedNodeId);
            if (node && node.children.length > 0) {
              // Group node: drill in (fractal zoom)
              console.log('[KeyboardNav] Drill into group node:', node.displayName);
              useNavigationStore.getState().zoomIn(selectedNodeId);
              useCanvasStore.getState().clearSelection();
              useCanvasStore.getState().requestFitView();
            } else {
              // Leaf node: enter Edit mode
              enterMode(CanvasMode.Edit);
              useUIStore.getState().openRightPanel('properties');
            }
            return;
          }
        }
      }

      // ── Standard ShortcutManager matching ──
      console.log('[KeyboardShortcuts] key:', key, 'ctrl:', e.ctrlKey, 'meta:', e.metaKey, 'shift:', e.shiftKey);
      const manager = getShortcutManager();
      const actionId = manager.matchEvent(e);

      console.log('[KeyboardShortcuts] matched actionId:', actionId);
      if (!actionId) return;

      // Filter mode-prefixed actions by current mode
      // Only actual mode-transition actions are mode-gated:
      // - normal:* actions (enter-connect, enter-edit) are only in Normal mode
      // - connect:* actions (exit) are only in Connect mode
      // - edit:exit is only in Edit mode
      // Category-based actions (edit:undo, edit:redo, edit:delete) work in ALL modes.
      if (actionId.startsWith('normal:') && currentMode !== CanvasMode.Normal) return;
      if (actionId.startsWith('connect:') && currentMode !== CanvasMode.Connect) return;
      if (actionId === 'edit:exit' && currentMode !== CanvasMode.Edit) return;

      switch (actionId) {
        case 'canvas:shortcuts-help':
          if (inInput) return;
          e.preventDefault();
          toggleShortcutsHelp();
          break;

        case 'canvas:command-palette':
          e.preventDefault();
          toggleCommandPalette();
          break;

        case 'file:save':
          e.preventDefault();
          saveFile();
          break;

        case 'file:save-as':
          e.preventDefault();
          saveFileAs();
          break;

        case 'file:new':
          e.preventDefault();
          {
            const isDirty = useCoreStore.getState().isDirty;
            const doNew = () => {
              newFile();
              zoomToRoot();
            };
            if (isDirty) {
              openUnsavedChangesDialog({ onConfirm: doNew });
            } else {
              doNew();
            }
          }
          break;

        case 'file:open':
          e.preventDefault();
          openFile();
          break;

        case 'edit:undo':
          e.preventDefault();
          undo();
          break;

        case 'edit:redo':
        case 'edit:redo-alt':
          e.preventDefault();
          redo();
          break;

        case 'edit:duplicate':
          e.preventDefault();
          {
            const { selectedNodeId, selectedNodeIds, selectNode, selectNodes } = useCanvasStore.getState();
            const { duplicateSelection } = useCoreStore.getState();

            // Determine which nodes to duplicate
            let nodeIds: string[] = [];
            if (selectedNodeIds.length > 0) {
              nodeIds = selectedNodeIds;
            } else if (selectedNodeId) {
              nodeIds = [selectedNodeId];
            }

            if (nodeIds.length > 0) {
              const newIds = duplicateSelection(nodeIds);
              if (newIds.length === 1) {
                selectNode(newIds[0]!);
              } else if (newIds.length > 1) {
                selectNodes(newIds);
              }
            }
          }
          break;

        case 'node:rename':
          if (inInput) return;
          e.preventDefault();
          {
            const selectedNodeId = useCanvasStore.getState().selectedNodeId;
            if (selectedNodeId) {
              // Activate inline edit on the canvas node (F2 quick-edit)
              useUIStore.getState().setInlineEditNodeId(selectedNodeId);
            }
          }
          break;

        // View / Zoom shortcuts (plain keys, skip when typing)
        case 'view:zoom-in':
          if (inInput) return;
          e.preventDefault();
          requestZoomIn();
          break;

        case 'view:zoom-out':
          if (inInput) return;
          e.preventDefault();
          requestZoomOut();
          break;

        case 'view:fit-all':
          e.preventDefault();
          requestFitView();
          break;

        case 'view:zoom-100':
          e.preventDefault();
          requestZoom100();
          break;

        case 'select:all':
          e.preventDefault();
          {
            // Select all nodes at the current navigation level
            const coreState = useCoreStore.getState();
            const navPath = useNavigationStore.getState().path;
            if (coreState.renderApi && coreState.graph) {
              const { nodes } = coreState.renderApi.render(coreState.graph, navPath);
              selectNodes(nodes.map((n) => n.id));
            }
          }
          break;

        case 'select:all-edges':
          e.preventDefault();
          {
            // Select all edges at the current navigation level
            const coreState = useCoreStore.getState();
            const navPath = useNavigationStore.getState().path;
            if (coreState.renderApi && coreState.graph) {
              const { edges } = coreState.renderApi.render(coreState.graph, navPath);
              selectEdges(edges.map((e) => e.id));
            }
          }
          break;

        // Quick Search (Vim '/' search)
        case 'nav:search':
          if (inInput) return;
          e.preventDefault();
          toggleQuickSearch();
          break;

        // Edge Type Cycling (Normal mode only, not in text input)
        case 'edge:cycle-type':
          if (inInput || currentMode !== CanvasMode.Normal) return;
          e.preventDefault();
          {
            const { graph, updateEdge } = useCoreStore.getState();
            const { selectedEdgeId } = useCanvasStore.getState();
            const { showToast } = useUIStore.getState();

            console.log('[edge:cycle-type] selectedEdgeId:', selectedEdgeId, 'edgeCount:', graph.edges.length);
            if (!selectedEdgeId) break;

            const edge = graph.edges.find((ed) => ed.id === selectedEdgeId);
            if (!edge) {
              console.log('[edge:cycle-type] Edge NOT FOUND in graph.edges');
              break;
            }

            const types: Array<'sync' | 'async' | 'data-flow'> = ['sync', 'async', 'data-flow'];
            const typeLabels: Record<string, string> = { sync: 'Sync', async: 'Async', 'data-flow': 'Data Flow' };
            const currentIdx = types.indexOf(edge.type);
            const nextType = types[(currentIdx + 1) % types.length]!;

            console.log('[edge:cycle-type] currentType:', edge.type, 'currentIdx:', currentIdx, 'nextType:', nextType);
            updateEdge(selectedEdgeId, { type: nextType }, `Change edge type to ${typeLabels[nextType]}`);
            // Verify the graph was actually updated
            const afterGraph = useCoreStore.getState().graph;
            const afterEdge = afterGraph.edges.find((ed) => ed.id === selectedEdgeId);
            console.log('[edge:cycle-type] AFTER update - edge type:', afterEdge?.type, 'graph ref changed:', afterGraph !== graph);
            showToast(`Changed to ${typeLabels[nextType]}`);
          }
          break;

        // Node Quick Create hotkeys (Normal mode only, not in text input)
        case 'node:add-service':
        case 'node:add-database':
        case 'node:add-queue':
        case 'node:add-gateway':
        case 'node:add-cache':
          if (inInput || currentMode !== CanvasMode.Normal) return;
          e.preventDefault();
          {
            const typeKey = HOTKEY_NODE_TYPE_MAP[actionId];
            if (!typeKey) break;

            const { addNode, registry, graph } = useCoreStore.getState();
            const { viewport, selectedNodeId, selectNode } = useCanvasStore.getState();
            const { openRightPanel, setPendingRenameNodeId } = useUIStore.getState();
            const { path } = useNavigationStore.getState();

            if (!registry) break;

            // Resolve NodeDef to get display name
            const nodeDef = registry.resolve(typeKey);
            if (!nodeDef) break;
            const displayName = nodeDef.metadata.displayName;

            // Position logic: if node selected, offset +150px right; else viewport center
            let x: number;
            let y: number;

            if (selectedNodeId) {
              const selectedNode = _findNodeById(graph.nodes, selectedNodeId);
              if (selectedNode) {
                x = selectedNode.position.x + 150;
                y = selectedNode.position.y;
              } else {
                const center = _viewportCenter(viewport);
                x = center.x;
                y = center.y;
              }
            } else {
              const center = _viewportCenter(viewport);
              x = center.x;
              y = center.y;
            }

            // Determine parent if inside a group (nested navigation)
            const parentId = path.length > 0 ? path[path.length - 1] : undefined;

            // Create the node
            const node = addNode({
              type: typeKey,
              displayName,
              position: { x, y },
              parentId,
            });

            if (node) {
              // Select and enter rename mode
              selectNode(node.id);
              openRightPanel('properties');
              setPendingRenameNodeId(node.id);
              console.log(`[HotkeyCreate] Created ${typeKey} node: ${node.displayName} at (${x}, ${y})`);
            }
          }
          break;
      }
    },
    [saveFile, saveFileAs, newFile, openFile, undo, redo, openUnsavedChangesDialog, toggleShortcutsHelp, toggleCommandPalette, toggleQuickSearch, enterMode, zoomToRoot, requestZoomIn, requestZoomOut, requestFitView, requestZoom100, selectNodes, selectEdges],
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}

// ─── Helper functions for hotkey node creation ──────────────────

/**
 * Calculate viewport center in graph coordinates.
 */
function _viewportCenter(viewport: { x: number; y: number; zoom: number }): { x: number; y: number } {
  const windowWidth = typeof window !== 'undefined' ? window.innerWidth : 1200;
  const windowHeight = typeof window !== 'undefined' ? window.innerHeight : 800;
  return {
    x: Math.round((-viewport.x + windowWidth / 2) / viewport.zoom),
    y: Math.round((-viewport.y + windowHeight / 2) / viewport.zoom),
  };
}

/**
 * Find a node by ID, recursively searching children.
 */
function _findNodeById(nodes: import('@/types/graph').ArchNode[], id: string): import('@/types/graph').ArchNode | undefined {
  for (const node of nodes) {
    if (node.id === id) return node;
    if (node.children.length > 0) {
      const found = _findNodeById(node.children, id);
      if (found) return found;
    }
  }
  return undefined;
}
