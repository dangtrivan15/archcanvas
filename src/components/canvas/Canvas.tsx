/**
 * Canvas - main React Flow interactive canvas component.
 * Renders architecture graph as nodes and edges with selection support.
 * Supports fractal zoom: double-click a node with children to navigate into it.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  useReactFlow,
  type OnSelectionChangeFunc,
  type OnConnect,
  type OnMoveEnd,
  type Connection,
  type NodeChange,
  type EdgeChange,
  type Viewport,
  applyNodeChanges,
  applyEdgeChanges,
  BackgroundVariant,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { useCoreStore } from '@/store/coreStore';
import { useCanvasStore, ZOOM_STEP, ZOOM_MIN, ZOOM_MAX, ZOOM_DURATION } from '@/store/canvasStore';
import { useNavigationStore } from '@/store/navigationStore';
import { useUIStore } from '@/store/uiStore';
import { nodeTypes } from '@/components/nodes/nodeTypeMap';
import { edgeTypes } from '@/components/edges/edgeTypeMap';
import type { CanvasNode, CanvasEdge, CanvasNodeData } from '@/types/canvas';
import { NavigationBreadcrumb } from '@/components/canvas/NavigationBreadcrumb';
import { ModeIndicator } from '@/components/canvas/ModeIndicator';
import { CanvasContextMenu } from '@/components/canvas/CanvasContextMenu';
import { NodeContextMenu } from '@/components/canvas/NodeContextMenu';
import { EdgeContextMenu } from '@/components/canvas/EdgeContextMenu';
import { calculateDeletionImpact } from '@/core/graph/deletionImpact';
import { findNode } from '@/core/graph/graphEngine';
import { isActiveElementTextInput } from '@/core/input/focusZones';
import { findNearestNode, findTopLeftNode, extractPositions, type Direction } from '@/core/input/spatialNavigation';
import { CanvasMode, MODE_DISPLAY } from '@/core/input/canvasMode';
import { formatBindingDisplay } from '@/core/input';

export function Canvas() {
  return (
    <ReactFlowProvider>
      <CanvasInner />
    </ReactFlowProvider>
  );
}

function CanvasInner() {
  const { fitView, screenToFlowPosition, setCenter, getViewport, setViewport: rfSetViewport } = useReactFlow();
  const graph = useCoreStore((s) => s.graph);
  const renderApi = useCoreStore((s) => s.renderApi);
  const addNode = useCoreStore((s) => s.addNode);
  const moveNode = useCoreStore((s) => s.moveNode);
  const selectNode = useCanvasStore((s) => s.selectNode);
  const selectEdge = useCanvasStore((s) => s.selectEdge);
  const selectedNodeId = useCanvasStore((s) => s.selectedNodeId);
  const clearSelection = useCanvasStore((s) => s.clearSelection);
  const addNodeToSelection = useCanvasStore((s) => s.addNodeToSelection);
  const toggleNodeInSelection = useCanvasStore((s) => s.toggleNodeInSelection);
  const setViewport = useCanvasStore((s) => s.setViewport);
  const navigationPath = useNavigationStore((s) => s.path);
  const zoomIn = useNavigationStore((s) => s.zoomIn);
  const zoomOut = useNavigationStore((s) => s.zoomOut);
  const removeEdge = useCoreStore((s) => s.removeEdge);
  const selectedEdgeId = useCanvasStore((s) => s.selectedEdgeId);
  const openDeleteDialog = useUIStore((s) => s.openDeleteDialog);
  const deleteDialogOpen = useUIStore((s) => s.deleteDialogOpen);
  const showToast = useUIStore((s) => s.showToast);
  const openConnectionDialog = useUIStore((s) => s.openConnectionDialog);
  const placementMode = useUIStore((s) => s.placementMode);
  const placementInfo = useUIStore((s) => s.placementInfo);
  const exitPlacementMode = useUIStore((s) => s.exitPlacementMode);
  const canvasMode = useUIStore((s) => s.canvasMode);
  const fitViewCounter = useCanvasStore((s) => s.fitViewCounter);
  const zoomInCounter = useCanvasStore((s) => s.zoomInCounter);
  const zoomOutCounter = useCanvasStore((s) => s.zoomOutCounter);
  const zoom100Counter = useCanvasStore((s) => s.zoom100Counter);
  const prevFitViewCounterRef = useRef(fitViewCounter);
  const prevZoomInCounterRef = useRef(zoomInCounter);
  const prevZoomOutCounterRef = useRef(zoomOutCounter);
  const prevZoom100CounterRef = useRef(zoom100Counter);

  // Context menu state (canvas background)
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  // Node context menu state (right-click on a node)
  const [nodeContextMenu, setNodeContextMenu] = useState<{ x: number; y: number; nodeId: string } | null>(null);
  // Edge context menu state (right-click on an edge)
  const [edgeContextMenu, setEdgeContextMenu] = useState<{ x: number; y: number; edgeId: string } | null>(null);

  // Watch for fitView requests from other components (e.g., LayoutMenu)
  useEffect(() => {
    if (fitViewCounter !== prevFitViewCounterRef.current) {
      prevFitViewCounterRef.current = fitViewCounter;
      // Slight delay to allow React Flow to update positions first
      setTimeout(() => {
        fitView({ padding: 0.2, duration: 300 });
      }, 50);
    }
  }, [fitViewCounter, fitView]);

  // Watch for zoom-in requests (keyboard shortcut or command palette)
  useEffect(() => {
    if (zoomInCounter !== prevZoomInCounterRef.current) {
      prevZoomInCounterRef.current = zoomInCounter;
      const vp = getViewport();
      const newZoom = Math.min(ZOOM_MAX, vp.zoom + ZOOM_STEP);
      rfSetViewport({ x: vp.x, y: vp.y, zoom: newZoom }, { duration: ZOOM_DURATION });
    }
  }, [zoomInCounter, getViewport, rfSetViewport]);

  // Watch for zoom-out requests
  useEffect(() => {
    if (zoomOutCounter !== prevZoomOutCounterRef.current) {
      prevZoomOutCounterRef.current = zoomOutCounter;
      const vp = getViewport();
      const newZoom = Math.max(ZOOM_MIN, vp.zoom - ZOOM_STEP);
      rfSetViewport({ x: vp.x, y: vp.y, zoom: newZoom }, { duration: ZOOM_DURATION });
    }
  }, [zoomOutCounter, getViewport, rfSetViewport]);

  // Watch for zoom-to-100% requests
  useEffect(() => {
    if (zoom100Counter !== prevZoom100CounterRef.current) {
      prevZoom100CounterRef.current = zoom100Counter;
      const vp = getViewport();
      rfSetViewport({ x: vp.x, y: vp.y, zoom: 1.0 }, { duration: ZOOM_DURATION });
    }
  }, [zoom100Counter, getViewport, rfSetViewport]);

  // Render the graph through RenderApi
  const rendered = useMemo(() => {
    if (!renderApi) return { nodes: [] as CanvasNode[], edges: [] as CanvasEdge[] };
    return renderApi.render(graph, navigationPath);
  }, [graph, renderApi, navigationPath]);

  // Use local state for React Flow, synced from the store
  const [rfNodes, setRfNodes] = useState<CanvasNode[]>(rendered.nodes);
  const [rfEdges, setRfEdges] = useState<CanvasEdge[]>(rendered.edges);

  // Sync from store -> React Flow whenever the rendered graph changes
  // Preserve selection state so that editing node properties doesn't deselect the node
  useEffect(() => {
    setRfNodes((prevNodes) => {
      const selectedIds = new Set(prevNodes.filter((n) => n.selected).map((n) => n.id));
      if (selectedIds.size === 0) return rendered.nodes;
      return rendered.nodes.map((n) =>
        selectedIds.has(n.id) ? { ...n, selected: true } : n,
      );
    });
    setRfEdges(rendered.edges);
  }, [rendered]);

  // Sync multi-selection state from store to React Flow
  const selectedNodeIds = useCanvasStore((s) => s.selectedNodeIds);
  const selectedEdgeIds = useCanvasStore((s) => s.selectedEdgeIds);
  useEffect(() => {
    const nodeIdSet = new Set(selectedNodeIds);
    setRfNodes((prevNodes) =>
      prevNodes.map((n) => {
        const shouldBeSelected = nodeIdSet.has(n.id);
        if (n.selected === shouldBeSelected) return n;
        return { ...n, selected: shouldBeSelected };
      }),
    );
  }, [selectedNodeIds]);

  useEffect(() => {
    const edgeIdSet = new Set(selectedEdgeIds);
    setRfEdges((prevEdges) =>
      prevEdges.map((e) => {
        const shouldBeSelected = edgeIdSet.has(e.id);
        if (e.selected === shouldBeSelected) return e;
        return { ...e, selected: shouldBeSelected };
      }),
    );
  }, [selectedEdgeIds]);

  // Handle React Flow node changes (drag, select, etc.)
  const onNodesChange = useCallback((changes: NodeChange[]) => {
    setRfNodes((nds) => applyNodeChanges(changes, nds) as CanvasNode[]);
  }, []);

  // Handle React Flow edge changes
  const onEdgesChange = useCallback((changes: EdgeChange[]) => {
    setRfEdges((eds) => applyEdgeChanges(changes, eds) as CanvasEdge[]);
  }, []);

  // Handle selection changes from React Flow (click, Shift+Click, drag-select)
  const selectNodes = useCanvasStore((s) => s.selectNodes);
  const selectEdges = useCanvasStore((s) => s.selectEdges);
  const onSelectionChange: OnSelectionChangeFunc = useCallback(
    ({ nodes: selectedNodes, edges: selectedEdges }) => {
      if (selectedNodes && selectedNodes.length > 1) {
        // Multi-node selection from React Flow (drag-box or Shift+Click)
        selectNodes(selectedNodes.map((n) => n.id));
      } else if (selectedNodes && selectedNodes.length === 1 && selectedNodes[0]) {
        selectNode(selectedNodes[0].id);
      } else if (selectedEdges && selectedEdges.length > 1) {
        // Multi-edge selection
        selectEdges(selectedEdges.map((e) => e.id));
      } else if (selectedEdges && selectedEdges.length === 1 && selectedEdges[0]) {
        selectEdge(selectedEdges[0].id);
      } else {
        clearSelection();
      }
    },
    [selectNode, selectNodes, selectEdge, selectEdges, clearSelection],
  );

  // Handle edge connections via drag - show connection type dialog
  const onConnect: OnConnect = useCallback(
    (connection: Connection) => {
      if (connection.source && connection.target) {
        // Open connection type dialog to let user choose edge type
        openConnectionDialog({
          sourceNodeId: connection.source,
          targetNodeId: connection.target,
          sourceHandle: connection.sourceHandle ?? undefined,
          targetHandle: connection.targetHandle ?? undefined,
        });
      }
    },
    [openConnectionDialog],
  );

  // Handle node drag end - persist position
  const onNodeDragStop = useCallback(
    (_event: React.MouseEvent, node: CanvasNode) => {
      moveNode(node.id, node.position.x, node.position.y);
    },
    [moveNode],
  );

  // Handle double-click on node - fractal zoom into children
  const onNodeDoubleClick = useCallback(
    (_event: React.MouseEvent, node: CanvasNode) => {
      const nodeData = node.data as unknown as CanvasNodeData;
      if (nodeData.hasChildren) {
        console.log('[Canvas] Fractal zoom into:', node.id, nodeData.displayName);
        zoomIn(node.id);
      }
    },
    [zoomIn],
  );

  // Handle click on canvas during placement mode - place node at click position
  const onPaneClick = useCallback(
    (event: React.MouseEvent) => {
      // Close context menus on any left-click
      setContextMenu(null);
      setNodeContextMenu(null);
      setEdgeContextMenu(null);

      if (placementMode && placementInfo) {
        const position = screenToFlowPosition({ x: event.clientX, y: event.clientY });
        addNode({
          type: placementInfo.nodeType,
          displayName: placementInfo.displayName,
          position: { x: position.x, y: position.y },
        });
        exitPlacementMode();
      }
    },
    [placementMode, placementInfo, screenToFlowPosition, addNode, exitPlacementMode],
  );

  // Handle drag and drop from NodeDefBrowser onto canvas
  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      const data = event.dataTransfer.getData('application/archcanvas-nodedef');
      if (!data) return;

      try {
        const { nodeType, displayName } = JSON.parse(data);
        const position = screenToFlowPosition({ x: event.clientX, y: event.clientY });
        addNode({
          type: nodeType,
          displayName,
          position: { x: position.x, y: position.y },
        });
      } catch {
        console.warn('[Canvas] Invalid drop data');
      }
    },
    [screenToFlowPosition, addNode],
  );

  // Handle right-click on canvas background (via React Flow onPaneContextMenu)
  const onPaneContextMenu = useCallback(
    (event: MouseEvent | React.MouseEvent) => {
      event.preventDefault();
      setNodeContextMenu(null);
      setEdgeContextMenu(null);
      setContextMenu({ x: event.clientX, y: event.clientY });
    },
    [],
  );

  // Handle right-click on a node - show node context menu
  const onNodeContextMenu = useCallback(
    (event: React.MouseEvent, node: CanvasNode) => {
      event.preventDefault();
      setContextMenu(null);
      setEdgeContextMenu(null);
      setNodeContextMenu({ x: event.clientX, y: event.clientY, nodeId: node.id });
    },
    [],
  );

  // Handle right-click on an edge - show edge context menu
  const onEdgeContextMenu = useCallback(
    (event: React.MouseEvent, edge: CanvasEdge) => {
      event.preventDefault();
      setContextMenu(null);
      setNodeContextMenu(null);
      setEdgeContextMenu({ x: event.clientX, y: event.clientY, edgeId: edge.id });
    },
    [],
  );

  // Close canvas context menu
  const closeContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  // Close node context menu
  const closeNodeContextMenu = useCallback(() => {
    setNodeContextMenu(null);
  }, []);

  // Close edge context menu
  const closeEdgeContextMenu = useCallback(() => {
    setEdgeContextMenu(null);
  }, []);

  // Handle Delete/Backspace keys for node deletion and navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't handle when typing in a text input (uses centralized FocusZone detection)
      if (isActiveElementTextInput()) {
        return;
      }

      // Escape exits Connect/Edit mode first (highest priority)
      if (e.key === 'Escape') {
        const uiState = useUIStore.getState();
        const currentMode = uiState.canvasMode;
        if (currentMode !== CanvasMode.Normal) {
          e.preventDefault();
          uiState.exitToNormal();
          return;
        }
      }

      // Escape exits placement mode
      if (e.key === 'Escape' && placementMode) {
        e.preventDefault();
        exitPlacementMode();
        return;
      }

      // Escape deselects selected node/edge and closes right panel
      if (e.key === 'Escape') {
        // Don't deselect if any modal dialog is open (they handle their own Escape)
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
      }

      // Don't handle if delete dialog is already open
      if (deleteDialogOpen) return;

      if (e.key === 'Delete') {
        // Delete key: node deletion (with confirmation) or edge deletion (direct)
        if (selectedNodeId) {
          e.preventDefault();
          const node = findNode(graph, selectedNodeId);
          if (node) {
            const impact = calculateDeletionImpact(graph, selectedNodeId);
            openDeleteDialog({
              nodeId: selectedNodeId,
              nodeName: node.displayName,
              edgeCount: impact.edgeCount,
              childCount: impact.childCount,
            });
          }
        } else if (selectedEdgeId) {
          // Edge deletion: direct (no confirmation needed)
          e.preventDefault();
          const edge = graph.edges.find((edge) => edge.id === selectedEdgeId);
          const edgeLabel = edge?.label || 'edge';
          removeEdge(selectedEdgeId);
          clearSelection();
          useUIStore.getState().closeRightPanel();
          showToast(`Deleted ${edgeLabel}. ${formatBindingDisplay('mod+z')} to undo`);
        }
      } else if (e.key === 'Backspace') {
        if (navigationPath.length > 0) {
          // Backspace with navigation path -> zoom out
          e.preventDefault();
          console.log('[Canvas] Backspace zoom out from:', navigationPath);
          zoomOut();
        } else if (selectedNodeId) {
          // Backspace at root level with selected node -> delete
          e.preventDefault();
          const node = findNode(graph, selectedNodeId);
          if (node) {
            const impact = calculateDeletionImpact(graph, selectedNodeId);
            openDeleteDialog({
              nodeId: selectedNodeId,
              nodeName: node.displayName,
              edgeCount: impact.edgeCount,
              childCount: impact.childCount,
            });
          }
        }
      }
    };

    // Use capture phase to ensure we handle Delete/Backspace before React Flow
    document.addEventListener('keydown', handleKeyDown, true);
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, [navigationPath, zoomOut, selectedNodeId, selectedEdgeId, graph, openDeleteDialog, deleteDialogOpen, placementMode, exitPlacementMode, removeEdge, clearSelection, showToast]);

  // Arrow key spatial navigation between nodes
  // Supports: plain arrow (single select), Shift+Arrow (extend selection), Mod+Arrow (toggle)
  useEffect(() => {
    const ARROW_KEY_MAP: Record<string, Direction> = {
      ArrowUp: 'up',
      ArrowDown: 'down',
      ArrowLeft: 'left',
      ArrowRight: 'right',
    };

    const handleArrowNav = (e: KeyboardEvent) => {
      // Don't handle when typing in text inputs
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
        uiState.commandPaletteOpen
      ) {
        return;
      }

      // Don't handle if placement mode is active
      if (placementMode) return;

      // Don't handle with Alt key
      if (e.altKey) return;

      const direction = ARROW_KEY_MAP[e.key];
      if (!direction) return;

      // Determine modifier mode
      const isShift = e.shiftKey && !e.ctrlKey && !e.metaKey;
      const isMod = (e.ctrlKey || e.metaKey) && !e.shiftKey;
      const isPlain = !e.shiftKey && !e.ctrlKey && !e.metaKey;

      // Only handle plain, shift, or mod (not combinations)
      if (!isPlain && !isShift && !isMod) return;

      e.preventDefault();

      const positions = extractPositions(rfNodes);
      if (positions.length === 0) return;

      const canvasState = useCanvasStore.getState();
      const currentSelectedId = canvasState.selectedNodeId;

      let targetId: string | null = null;

      if (currentSelectedId) {
        // Navigate from currently selected node
        targetId = findNearestNode(currentSelectedId, direction, positions);
      } else {
        // No selection: select top-left-most node
        targetId = findTopLeftNode(positions);
      }

      if (targetId) {
        if (isShift) {
          // Shift+Arrow: ADD target to selection (extend)
          addNodeToSelection(targetId);
        } else if (isMod) {
          // Mod+Arrow: TOGGLE target in selection
          toggleNodeInSelection(targetId);
        } else {
          // Plain arrow: REPLACE selection
          if (targetId !== currentSelectedId) {
            selectNode(targetId);
          }
        }

        // Pan viewport to keep the target node visible
        const targetPos = positions.find((p) => p.id === targetId);
        if (targetPos) {
          const currentViewport = getViewport();
          setCenter(targetPos.x, targetPos.y, {
            zoom: currentViewport.zoom,
            duration: 200,
          });
        }
      }
    };

    document.addEventListener('keydown', handleArrowNav);
    return () => document.removeEventListener('keydown', handleArrowNav);
  }, [rfNodes, selectNode, addNodeToSelection, toggleNodeInSelection, setCenter, getViewport, placementMode]);

  // Track viewport changes (pan/zoom) for saving
  const onMoveEnd: OnMoveEnd = useCallback(
    (_event: MouseEvent | TouchEvent | null, viewport: Viewport) => {
      setViewport({ x: viewport.x, y: viewport.y, zoom: viewport.zoom });
    },
    [setViewport],
  );

  // Get mode-specific visual tint class
  const modeTint = MODE_DISPLAY[canvasMode].canvasTint;

  return (
    <div className={`w-full h-full relative ${modeTint}`} data-testid="canvas" data-canvas-mode={canvasMode} onContextMenu={(e) => e.preventDefault()}>
      {/* Navigation Breadcrumb - shown at top of canvas */}
      <NavigationBreadcrumb />

      {/* Placement mode indicator */}
      {placementMode && placementInfo && (
        <div
          className="absolute top-10 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2
                     bg-blue-600 text-white px-4 py-2 rounded-lg shadow-lg text-sm font-medium"
          data-testid="placement-mode-indicator"
        >
          <span className="inline-block w-2 h-2 bg-white rounded-full animate-pulse" />
          Click on canvas to place <strong>{placementInfo.displayName}</strong>
          <button
            onClick={exitPlacementMode}
            className="ml-2 px-2 py-0.5 bg-blue-500 hover:bg-blue-400 rounded text-xs cursor-pointer"
            data-testid="placement-mode-cancel"
          >
            Esc to cancel
          </button>
        </div>
      )}

      <ReactFlow
        nodes={rfNodes}
        edges={rfEdges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onSelectionChange={onSelectionChange}
        onNodeDoubleClick={onNodeDoubleClick}
        onNodeContextMenu={onNodeContextMenu}
        onEdgeContextMenu={onEdgeContextMenu}
        onPaneContextMenu={onPaneContextMenu}
        onNodeDragStop={onNodeDragStop}
        onMoveEnd={onMoveEnd}
        onPaneClick={onPaneClick}
        onDragOver={onDragOver}
        onDrop={onDrop}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        deleteKeyCode={null}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        defaultEdgeOptions={{ type: 'sync' }}
        proOptions={{ hideAttribution: true }}
        className={`bg-gray-50 ${placementMode ? 'cursor-crosshair' : ''}`}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={20}
          size={1.5}
          color="#cbd5e1"
          data-testid="canvas-background-grid"
        />
        <Controls
          position="bottom-right"
          aria-label="Canvas controls"
          data-testid="canvas-controls"
        />
        <MiniMap
          position="bottom-left"
          nodeStrokeWidth={3}
          pannable
          zoomable
          className="!bg-white !border !border-gray-200"
          aria-label="Mini map"
          data-testid="canvas-minimap"
        />
      </ReactFlow>

      {/* Vim-style mode indicator (bottom-left, above minimap) */}
      <ModeIndicator />

      {/* Canvas Context Menu - shown on right-click on background */}
      {contextMenu && (
        <CanvasContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={closeContextMenu}
        />
      )}

      {/* Node Context Menu - shown on right-click on a node */}
      {nodeContextMenu && (
        <NodeContextMenu
          x={nodeContextMenu.x}
          y={nodeContextMenu.y}
          nodeId={nodeContextMenu.nodeId}
          onClose={closeNodeContextMenu}
        />
      )}

      {/* Edge Context Menu - shown on right-click on an edge */}
      {edgeContextMenu && (
        <EdgeContextMenu
          x={edgeContextMenu.x}
          y={edgeContextMenu.y}
          edgeId={edgeContextMenu.edgeId}
          onClose={closeEdgeContextMenu}
        />
      )}
    </div>
  );
}
