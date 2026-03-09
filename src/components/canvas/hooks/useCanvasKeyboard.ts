/**
 * useCanvasKeyboard - Handles keyboard shortcuts for the canvas:
 * Delete/Backspace/Escape, arrow key spatial navigation, and Alt+Arrow bulk move.
 */

import { useEffect } from 'react';
import { useReactFlow } from '@xyflow/react';
import { useCoreStore } from '@/store/coreStore';
import { useCanvasStore } from '@/store/canvasStore';
import { useNavigationStore } from '@/store/navigationStore';
import { useUIStore } from '@/store/uiStore';
import { isActiveElementTextInput } from '@/core/input/focusZones';
import { calculateDeletionImpact } from '@/core/graph/deletionImpact';
import { findNode } from '@/core/graph/graphEngine';
import {
  findNearestNode,
  findTopLeftNode,
  extractPositions,
  type Direction,
} from '@/core/input/spatialNavigation';
import { formatBindingDisplay } from '@/core/input';
import type { CanvasNode } from '@/types/canvas';

export function useCanvasKeyboard(rfNodes: CanvasNode[]) {
  const graph = useCoreStore((s) => s.graph);
  const moveNodes = useCoreStore((s) => s.moveNodes);
  const removeEdge = useCoreStore((s) => s.removeEdge);
  const selectedNodeId = useCanvasStore((s) => s.selectedNodeId);
  const selectedEdgeId = useCanvasStore((s) => s.selectedEdgeId);
  const clearSelection = useCanvasStore((s) => s.clearSelection);
  const selectNode = useCanvasStore((s) => s.selectNode);
  const addNodeToSelection = useCanvasStore((s) => s.addNodeToSelection);
  const toggleNodeInSelection = useCanvasStore((s) => s.toggleNodeInSelection);
  const navigationPath = useNavigationStore((s) => s.path);
  const zoomOut = useNavigationStore((s) => s.zoomOut);
  const openDeleteDialog = useUIStore((s) => s.openDeleteDialog);
  const deleteDialogOpen = useUIStore((s) => s.deleteDialogOpen);
  const showToast = useUIStore((s) => s.showToast);
  const placementMode = useUIStore((s) => s.placementMode);
  const exitPlacementMode = useUIStore((s) => s.exitPlacementMode);
  const { setCenter, getViewport } = useReactFlow();

  // Block 1: Delete/Backspace/Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't handle when typing in a text input
      if (isActiveElementTextInput()) return;

      // Escape exits placement mode
      if (e.key === 'Escape' && placementMode) {
        e.preventDefault();
        exitPlacementMode();
        return;
      }

      // Escape deselects selected node/edge and closes right panel
      if (e.key === 'Escape') {
        // Don't deselect if any modal dialog is open
        const uiState = useUIStore.getState();
        if (
          uiState.deleteDialogOpen ||
          uiState.connectionDialogOpen ||
          uiState.unsavedChangesDialogOpen ||
          uiState.errorDialogOpen ||
          uiState.integrityWarningDialogOpen
        ) {
          return;
        }

        const canvasState = useCanvasStore.getState();
        if (canvasState.selectedNodeId || canvasState.selectedEdgeId) {
          e.preventDefault();
          canvasState.clearSelection();
          uiState.closeRightPanel();
          return;
        }

        // Escape with nothing selected and inside a group → navigate up
        if (navigationPath.length > 0) {
          e.preventDefault();
          zoomOut();
          return;
        }
      }

      // Don't handle if delete dialog is already open
      if (deleteDialogOpen) return;

      // Helper: delete selected edge(s) directly (no confirmation needed)
      const deleteSelectedEdges = () => {
        const canvasState = useCanvasStore.getState();
        const edgeIds =
          canvasState.selectedEdgeIds.length > 0
            ? canvasState.selectedEdgeIds
            : canvasState.selectedEdgeId
              ? [canvasState.selectedEdgeId]
              : [];

        if (edgeIds.length === 0) return false;

        e.preventDefault();
        if (edgeIds.length === 1) {
          const edge = graph.edges.find((edge) => edge.id === edgeIds[0]);
          const edgeLabel = edge?.label || 'edge';
          removeEdge(edgeIds[0]!);
          clearSelection();
          useUIStore.getState().closeRightPanel();
          showToast(`Deleted ${edgeLabel}. ${formatBindingDisplay('mod+z')} to undo`);
        } else {
          // Multi-edge deletion
          const { textApi, undoManager } = useCoreStore.getState();
          if (textApi && undoManager) {
            for (const edgeId of edgeIds) {
              textApi.removeEdge(edgeId);
            }
            const updatedGraph = textApi.getGraph();
            undoManager.snapshot(`Delete ${edgeIds.length} edges`, updatedGraph);
            useCoreStore.setState({
              graph: updatedGraph,
              isDirty: true,
              edgeCount: updatedGraph.edges.length,
              canUndo: undoManager.canUndo,
              canRedo: undoManager.canRedo,
            });
          }
          clearSelection();
          useUIStore.getState().closeRightPanel();
          showToast(`Deleted ${edgeIds.length} edges. ${formatBindingDisplay('mod+z')} to undo`);
        }
        return true;
      };

      // Helper: open delete dialog for selected nodes (single or multi)
      const openDeleteForSelectedNodes = () => {
        const canvasState = useCanvasStore.getState();
        const multiIds = canvasState.selectedNodeIds;

        // Multi-node selection: aggregate impact
        if (multiIds.length > 1) {
          e.preventDefault();
          const allRemovedIds = new Set<string>();
          let totalChildCount = 0;

          for (const nid of multiIds) {
            const node = findNode(graph, nid);
            if (node) {
              const impact = calculateDeletionImpact(graph, nid);
              totalChildCount += impact.childCount;
              const collectIds = (n: typeof node) => {
                allRemovedIds.add(n.id);
                for (const child of n.children) collectIds(child);
              };
              collectIds(node);
            }
          }

          const totalEdgeCount = graph.edges.filter(
            (edge) => allRemovedIds.has(edge.fromNode) || allRemovedIds.has(edge.toNode),
          ).length;

          const firstName = findNode(graph, multiIds[0]!)?.displayName || 'node';
          openDeleteDialog({
            nodeId: multiIds[0]!,
            nodeName: firstName,
            edgeCount: totalEdgeCount,
            childCount: totalChildCount,
            nodeIds: multiIds,
            nodeCount: multiIds.length,
          });
          return true;
        }

        // Single node selection
        const singleId = selectedNodeId || (multiIds.length === 1 ? multiIds[0] : null);
        if (singleId) {
          e.preventDefault();
          const node = findNode(graph, singleId);
          if (node) {
            const impact = calculateDeletionImpact(graph, singleId);
            openDeleteDialog({
              nodeId: singleId,
              nodeName: node.displayName,
              edgeCount: impact.edgeCount,
              childCount: impact.childCount,
            });
          }
          return true;
        }
        return false;
      };

      if (e.key === 'Delete') {
        if (!openDeleteForSelectedNodes()) {
          if (selectedEdgeId || useCanvasStore.getState().selectedEdgeIds.length > 0) {
            deleteSelectedEdges();
          }
        }
      } else if (e.key === 'Backspace') {
        if (navigationPath.length > 0) {
          e.preventDefault();
          zoomOut();
        } else if (!openDeleteForSelectedNodes()) {
          if (selectedEdgeId || useCanvasStore.getState().selectedEdgeIds.length > 0) {
            deleteSelectedEdges();
          }
        }
      }
    };

    // Use capture phase to ensure we handle Delete/Backspace before React Flow
    document.addEventListener('keydown', handleKeyDown, true);
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, [
    navigationPath, zoomOut, selectedNodeId, selectedEdgeId, graph,
    openDeleteDialog, deleteDialogOpen, placementMode, exitPlacementMode,
    removeEdge, clearSelection, showToast,
  ]);

  // Block 2: Arrow key spatial navigation
  useEffect(() => {
    const ARROW_KEY_MAP: Record<string, Direction> = {
      ArrowUp: 'up',
      ArrowDown: 'down',
      ArrowLeft: 'left',
      ArrowRight: 'right',
    };

    const handleArrowNav = (e: KeyboardEvent) => {
      if (isActiveElementTextInput()) return;

      // Don't handle when any dialog is open
      const uiState = useUIStore.getState();
      if (
        uiState.deleteDialogOpen ||
        uiState.connectionDialogOpen ||
        uiState.unsavedChangesDialogOpen ||
        uiState.errorDialogOpen ||
        uiState.integrityWarningDialogOpen ||
        uiState.shortcutsHelpOpen ||
        uiState.commandPaletteOpen ||
        uiState.quickSearchOpen
      ) {
        return;
      }

      if (placementMode) return;
      if (e.altKey) return;

      const direction = ARROW_KEY_MAP[e.key];
      if (!direction) return;

      const isShift = e.shiftKey && !e.ctrlKey && !e.metaKey;
      const isMod = (e.ctrlKey || e.metaKey) && !e.shiftKey;
      const isPlain = !e.shiftKey && !e.ctrlKey && !e.metaKey;
      if (!isPlain && !isShift && !isMod) return;

      e.preventDefault();

      const positions = extractPositions(rfNodes);
      if (positions.length === 0) return;

      const canvasState = useCanvasStore.getState();
      const currentSelectedId = canvasState.selectedNodeId;
      let targetId: string | null = null;

      if (currentSelectedId) {
        targetId = findNearestNode(currentSelectedId, direction, positions);
      } else {
        targetId = findTopLeftNode(positions);
      }

      if (targetId) {
        if (isShift) {
          addNodeToSelection(targetId);
        } else if (isMod) {
          toggleNodeInSelection(targetId);
        } else {
          if (targetId !== currentSelectedId) {
            selectNode(targetId);
          }
        }

        // Pan viewport to keep the target node visible
        const targetPos = positions.find((p) => p.id === targetId);
        if (targetPos) {
          const currentViewport = getViewport();
          setCenter(targetPos.x, targetPos.y, { zoom: currentViewport.zoom, duration: 200 });
        }
      }
    };

    document.addEventListener('keydown', handleArrowNav);
    return () => document.removeEventListener('keydown', handleArrowNav);
  }, [rfNodes, selectNode, addNodeToSelection, toggleNodeInSelection, setCenter, getViewport, placementMode]);

  // Block 3: Alt+Arrow bulk move selected nodes
  useEffect(() => {
    const SMALL_STEP = 20;
    const LARGE_STEP = 100;

    const ARROW_OFFSETS: Record<string, { dx: number; dy: number }> = {
      ArrowUp: { dx: 0, dy: -1 },
      ArrowDown: { dx: 0, dy: 1 },
      ArrowLeft: { dx: -1, dy: 0 },
      ArrowRight: { dx: 1, dy: 0 },
    };

    const handleBulkMove = (e: KeyboardEvent) => {
      if (!e.altKey) return;

      const offset = ARROW_OFFSETS[e.key];
      if (!offset) return;

      if (isActiveElementTextInput()) return;

      const uiState = useUIStore.getState();
      if (
        uiState.deleteDialogOpen ||
        uiState.connectionDialogOpen ||
        uiState.unsavedChangesDialogOpen ||
        uiState.errorDialogOpen ||
        uiState.integrityWarningDialogOpen ||
        uiState.shortcutsHelpOpen ||
        uiState.commandPaletteOpen ||
        uiState.quickSearchOpen
      ) {
        return;
      }

      if (placementMode) return;

      const canvasState = useCanvasStore.getState();
      const selectedIds = canvasState.selectedNodeIds;
      if (selectedIds.length === 0) return;

      e.preventDefault();

      const step = e.shiftKey ? LARGE_STEP : SMALL_STEP;
      const dx = offset.dx * step;
      const dy = offset.dy * step;

      const currentGraph = useCoreStore.getState().graph;
      const moves: Array<{ nodeId: string; x: number; y: number }> = [];

      for (const nodeId of selectedIds) {
        const node = findNode(currentGraph, nodeId);
        if (node) {
          moves.push({
            nodeId,
            x: node.position.x + dx,
            y: node.position.y + dy,
          });
        }
      }

      if (moves.length > 0) {
        const count = moves.length;
        moveNodes(moves, `Move ${count} node${count === 1 ? '' : 's'}`);
      }
    };

    // Use capture phase so it fires before the normal arrow handler
    document.addEventListener('keydown', handleBulkMove, true);
    return () => document.removeEventListener('keydown', handleBulkMove, true);
  }, [moveNodes, placementMode]);
}
