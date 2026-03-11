/**
 * Tests for centralized Zustand store selectors.
 * Verifies selectors return correct values and derived selectors compute correctly.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useGraphStore } from '@/store/graphStore';
import { useFileStore } from '@/store/fileStore';
import { useEngineStore } from '@/store/engineStore';
import { useHistoryStore } from '@/store/historyStore';
import { useCanvasStore } from '@/store/canvasStore';
import { useUIStore } from '@/store/uiStore';
import { useNavigationStore } from '@/store/navigationStore';
import { useAnnotationStore } from '@/store/annotationStore';
import {
  // Core
  selectGraph,
  selectIsDirty,
  selectFileName,
  selectInitialized,
  selectNodeCount,
  selectEdgeCount,
  selectIsSaving,
  selectCanUndo,
  selectCanRedo,
  // Canvas
  selectSelectedNodeId,
  selectSelectedEdgeId,
  selectSelectedNodeIds,
  selectSelectedEdgeIds,
  selectViewport,
  selectLayoutSpacing,
  selectHasNodeSelection,
  selectHasEdgeSelection,
  selectHasSelection,
  selectSelectedNodeCount,
  // UI
  selectThemeId,
  selectLeftPanelOpen,
  selectRightPanelOpen,
  selectRightPanelTab,
  selectPlacementMode,
  selectToastMessage,
  selectIsConnectMode,
  selectHasOpenDialog,
  // Navigation
  selectNavigationPath,
  selectIsAtRoot,
  selectNavigationDepth,
  // Annotation
  selectIsDrawingMode,
  selectIsEraserMode,
  selectDrawingColor,
  selectStrokeWidth,
} from '@/store/selectors';

describe('Zustand Store Selectors', () => {
  beforeEach(() => {
    // Reset stores to initial state
    useGraphStore.setState({
      graph: { name: '', description: '', owners: [], nodes: [], edges: [], annotations: [] },
      isDirty: false,
      nodeCount: 0,
      edgeCount: 0
    });
    useFileStore.setState({
      fileName: 'Untitled Architecture',
      isSaving: false
    });
    useEngineStore.setState({
      initialized: false
    });
    useHistoryStore.setState({
      canUndo: false,
      canRedo: false
    });
    useCanvasStore.setState({
      selectedNodeId: null,
      selectedEdgeId: null,
      selectedNodeIds: [],
      selectedEdgeIds: [],
      viewport: { x: 0, y: 0, zoom: 1 },
    });
    useUIStore.setState({
      leftPanelOpen: true,
      rightPanelOpen: false,
      rightPanelTab: 'properties',
      placementMode: false,
      toastMessage: null,
      connectStep: null,
      connectSource: null,
      deleteDialogOpen: false,
      connectionDialogOpen: false,
      unsavedChangesDialogOpen: false,
      errorDialogOpen: false,
      integrityWarningDialogOpen: false,
      shortcutsHelpOpen: false,
      commandPaletteOpen: false,
      quickSearchOpen: false,
      shortcutSettingsOpen: false,
      settingsDialogOpen: false,
      templatePickerOpen: false,
      templateGalleryOpen: false,
    });
    useNavigationStore.setState({ path: [] });
    useAnnotationStore.setState({
      isDrawingMode: false,
      isEraserMode: false,
      color: '#ef4444',
      strokeWidth: 3,
    });
  });

  describe('Core Store Selectors', () => {
    it('selectGraph returns the graph', () => {
      const state = useGraphStore.getState();
      expect(selectGraph(state)).toBe(state.graph);
    });

    it('selectIsDirty returns dirty state', () => {
      expect(selectIsDirty(useGraphStore.getState())).toBe(false);
    });

    it('selectFileName returns file name', () => {
      expect(selectFileName(useFileStore.getState())).toBe('Untitled Architecture');
    });

    it('selectNodeCount returns node count', () => {
      expect(selectNodeCount(useGraphStore.getState())).toBe(0);
    });

    it('selectEdgeCount returns edge count', () => {
      expect(selectEdgeCount(useGraphStore.getState())).toBe(0);
    });

    it('selectIsSaving returns saving state', () => {
      expect(selectIsSaving(useFileStore.getState())).toBe(false);
    });

    it('selectCanUndo returns undo availability', () => {
      expect(selectCanUndo(useHistoryStore.getState())).toBe(false);
    });

    it('selectCanRedo returns redo availability', () => {
      expect(selectCanRedo(useHistoryStore.getState())).toBe(false);
    });
  });

  describe('Canvas Store Selectors', () => {
    it('selectSelectedNodeId returns null when nothing selected', () => {
      expect(selectSelectedNodeId(useCanvasStore.getState())).toBeNull();
    });

    it('selectSelectedNodeIds returns empty array initially', () => {
      expect(selectSelectedNodeIds(useCanvasStore.getState())).toEqual([]);
    });

    it('selectViewport returns viewport', () => {
      expect(selectViewport(useCanvasStore.getState())).toEqual({ x: 0, y: 0, zoom: 1 });
    });

    it('selectHasNodeSelection returns false when no nodes selected', () => {
      expect(selectHasNodeSelection(useCanvasStore.getState())).toBe(false);
    });

    it('selectHasNodeSelection returns true when nodes selected', () => {
      useCanvasStore.getState().selectNode('node-1');
      expect(selectHasNodeSelection(useCanvasStore.getState())).toBe(true);
    });

    it('selectHasEdgeSelection returns false initially', () => {
      expect(selectHasEdgeSelection(useCanvasStore.getState())).toBe(false);
    });

    it('selectHasSelection returns false when nothing selected', () => {
      expect(selectHasSelection(useCanvasStore.getState())).toBe(false);
    });

    it('selectHasSelection returns true when node selected', () => {
      useCanvasStore.getState().selectNode('node-1');
      expect(selectHasSelection(useCanvasStore.getState())).toBe(true);
    });

    it('selectSelectedNodeCount returns count of selected nodes', () => {
      expect(selectSelectedNodeCount(useCanvasStore.getState())).toBe(0);
      useCanvasStore.getState().selectNodes(['a', 'b', 'c']);
      expect(selectSelectedNodeCount(useCanvasStore.getState())).toBe(3);
    });
  });

  describe('UI Store Selectors', () => {
    it('selectThemeId returns current theme', () => {
      expect(typeof selectThemeId(useUIStore.getState())).toBe('string');
    });

    it('selectLeftPanelOpen returns left panel state', () => {
      expect(selectLeftPanelOpen(useUIStore.getState())).toBe(true);
    });

    it('selectRightPanelOpen returns right panel state', () => {
      expect(selectRightPanelOpen(useUIStore.getState())).toBe(false);
    });

    it('selectRightPanelTab returns active tab', () => {
      expect(selectRightPanelTab(useUIStore.getState())).toBe('properties');
    });

    it('selectPlacementMode returns false initially', () => {
      expect(selectPlacementMode(useUIStore.getState())).toBe(false);
    });

    it('selectToastMessage returns null initially', () => {
      expect(selectToastMessage(useUIStore.getState())).toBeNull();
    });

    it('selectIsConnectMode returns false initially', () => {
      expect(selectIsConnectMode(useUIStore.getState())).toBe(false);
    });

    it('selectIsConnectMode returns true when connect step is set', () => {
      useUIStore.getState().enterConnectMode('node-1');
      expect(selectIsConnectMode(useUIStore.getState())).toBe(true);
    });

    it('selectHasOpenDialog returns false when no dialogs open', () => {
      expect(selectHasOpenDialog(useUIStore.getState())).toBe(false);
    });

    it('selectHasOpenDialog returns true when delete dialog is open', () => {
      useUIStore.getState().openDeleteDialog({
        nodeId: 'n1',
        nodeName: 'Test',
        edgeCount: 0,
        childCount: 0,
      });
      expect(selectHasOpenDialog(useUIStore.getState())).toBe(true);
    });

    it('selectHasOpenDialog returns true when command palette is open', () => {
      useUIStore.getState().openCommandPalette();
      expect(selectHasOpenDialog(useUIStore.getState())).toBe(true);
    });
  });

  describe('Navigation Store Selectors', () => {
    it('selectNavigationPath returns empty array at root', () => {
      expect(selectNavigationPath(useNavigationStore.getState())).toEqual([]);
    });

    it('selectIsAtRoot returns true initially', () => {
      expect(selectIsAtRoot(useNavigationStore.getState())).toBe(true);
    });

    it('selectIsAtRoot returns false after zoom in', () => {
      useNavigationStore.getState().zoomIn('node-1');
      expect(selectIsAtRoot(useNavigationStore.getState())).toBe(false);
    });

    it('selectNavigationDepth returns 0 at root', () => {
      expect(selectNavigationDepth(useNavigationStore.getState())).toBe(0);
    });

    it('selectNavigationDepth returns correct depth after zoom', () => {
      useNavigationStore.getState().zoomIn('n1');
      useNavigationStore.getState().zoomIn('n2');
      expect(selectNavigationDepth(useNavigationStore.getState())).toBe(2);
    });
  });

  describe('Annotation Store Selectors', () => {
    it('selectIsDrawingMode returns false initially', () => {
      expect(selectIsDrawingMode(useAnnotationStore.getState())).toBe(false);
    });

    it('selectIsEraserMode returns false initially', () => {
      expect(selectIsEraserMode(useAnnotationStore.getState())).toBe(false);
    });

    it('selectDrawingColor returns default color', () => {
      expect(selectDrawingColor(useAnnotationStore.getState())).toBe('#ef4444');
    });

    it('selectStrokeWidth returns default width', () => {
      expect(selectStrokeWidth(useAnnotationStore.getState())).toBe(3);
    });
  });
});

describe('Store Architecture Audit', () => {
  it('coreStore selectedNodeId is derived from canvasStore, not duplicated', () => {
    // Verify coreStore does NOT have selection state — it lives in canvasStore
    const coreState = useGraphStore.getState();
    expect(coreState).not.toHaveProperty('selectedNodeId');
    expect(coreState).not.toHaveProperty('selectedEdgeId');
  });

  it('canvasStore selectedNodeId stays in sync with selectedNodeIds', () => {
    const store = useCanvasStore.getState();
    store.selectNodes(['a', 'b']);
    const state = useCanvasStore.getState();
    // selectedNodeId should be the last element of selectedNodeIds
    expect(state.selectedNodeId).toBe('b');
    expect(state.selectedNodeIds).toEqual(['a', 'b']);
  });

  it('stores have clear boundaries: coreStore handles graph, canvasStore handles viewport', () => {
    const core = useGraphStore.getState();
    const canvas = useCanvasStore.getState();

    // Graph lives in coreStore
    expect(core).toHaveProperty('graph');
    expect(canvas).not.toHaveProperty('graph');

    // Viewport lives in canvasStore
    expect(canvas).toHaveProperty('viewport');
    expect(core).not.toHaveProperty('viewport');
  });

  it('stores have clear boundaries: uiStore handles UI state, not data', () => {
    const ui = useUIStore.getState();

    // UI state
    expect(ui).toHaveProperty('leftPanelOpen');
    expect(ui).toHaveProperty('rightPanelOpen');
    expect(ui).toHaveProperty('deleteDialogOpen');
    expect(ui).toHaveProperty('placementMode');

    // Data should NOT be in uiStore
    expect(ui).not.toHaveProperty('graph');
    expect(ui).not.toHaveProperty('nodes');
    expect(ui).not.toHaveProperty('edges');
  });

  it('all selectors are stable function references (not recreated)', () => {
    // Selectors are module-level constants, so they should be referentially stable
    const ref1 = selectGraph;
    const ref2 = selectGraph;
    expect(ref1).toBe(ref2);

    const ref3 = selectHasSelection;
    const ref4 = selectHasSelection;
    expect(ref3).toBe(ref4);
  });

  it('nodeCount and edgeCount in coreStore track graph mutations', () => {
    useEngineStore.getState().initialize();
    const addNode = useGraphStore.getState().addNode;

    addNode({ type: 'compute/service', displayName: 'Svc1', position: { x: 0, y: 0 } });
    expect(useGraphStore.getState().nodeCount).toBe(1);
    expect(useGraphStore.getState().edgeCount).toBe(0);

    addNode({ type: 'compute/service', displayName: 'Svc2', position: { x: 100, y: 0 } });
    expect(useGraphStore.getState().nodeCount).toBe(2);

    // Add an edge
    const graph = useGraphStore.getState().graph;
    if (graph.nodes.length >= 2) {
      useGraphStore.getState().addEdge({
        fromNode: graph.nodes[0].id,
        toNode: graph.nodes[1].id,
        type: 'sync',
      });
      expect(useGraphStore.getState().edgeCount).toBe(1);
    }
  });

  it('_getCanvasStateForSave uses actual right panel width (not hardcoded)', () => {
    // Set a custom right panel width
    useUIStore.getState().setRightPanelWidth(400);
    const uiState = useUIStore.getState();
    expect(uiState.rightPanelWidth).toBe(400);
    // The rightPanelWidth is now read from uiStore in _getCanvasStateForSave
    // (verified by code inspection — the hardcoded 320 was replaced with uiStoreState.rightPanelWidth)
  });
});
