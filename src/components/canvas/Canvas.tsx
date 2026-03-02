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
import { useCanvasStore } from '@/store/canvasStore';
import { useNavigationStore } from '@/store/navigationStore';
import { useUIStore } from '@/store/uiStore';
import { nodeTypes } from '@/components/nodes/nodeTypeMap';
import { edgeTypes } from '@/components/edges/edgeTypeMap';
import type { CanvasNode, CanvasEdge, CanvasNodeData } from '@/types/canvas';
import { NavigationBreadcrumb } from '@/components/canvas/NavigationBreadcrumb';
import { calculateDeletionImpact } from '@/core/graph/deletionImpact';
import { findNode } from '@/core/graph/graphEngine';

export function Canvas() {
  return (
    <ReactFlowProvider>
      <CanvasInner />
    </ReactFlowProvider>
  );
}

function CanvasInner() {
  const { fitView, screenToFlowPosition } = useReactFlow();
  const graph = useCoreStore((s) => s.graph);
  const renderApi = useCoreStore((s) => s.renderApi);
  const addNode = useCoreStore((s) => s.addNode);
  const moveNode = useCoreStore((s) => s.moveNode);
  const selectNode = useCanvasStore((s) => s.selectNode);
  const selectEdge = useCanvasStore((s) => s.selectEdge);
  const selectedNodeId = useCanvasStore((s) => s.selectedNodeId);
  const clearSelection = useCanvasStore((s) => s.clearSelection);
  const setViewport = useCanvasStore((s) => s.setViewport);
  const navigationPath = useNavigationStore((s) => s.path);
  const zoomIn = useNavigationStore((s) => s.zoomIn);
  const zoomOut = useNavigationStore((s) => s.zoomOut);
  const openDeleteDialog = useUIStore((s) => s.openDeleteDialog);
  const deleteDialogOpen = useUIStore((s) => s.deleteDialogOpen);
  const openConnectionDialog = useUIStore((s) => s.openConnectionDialog);
  const placementMode = useUIStore((s) => s.placementMode);
  const placementInfo = useUIStore((s) => s.placementInfo);
  const exitPlacementMode = useUIStore((s) => s.exitPlacementMode);
  const fitViewCounter = useCanvasStore((s) => s.fitViewCounter);
  const prevFitViewCounterRef = useRef(fitViewCounter);

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

  // Handle React Flow node changes (drag, select, etc.)
  const onNodesChange = useCallback((changes: NodeChange[]) => {
    setRfNodes((nds) => applyNodeChanges(changes, nds) as CanvasNode[]);
  }, []);

  // Handle React Flow edge changes
  const onEdgesChange = useCallback((changes: EdgeChange[]) => {
    setRfEdges((eds) => applyEdgeChanges(changes, eds) as CanvasEdge[]);
  }, []);

  // Handle selection changes
  const onSelectionChange: OnSelectionChangeFunc = useCallback(
    ({ nodes: selectedNodes, edges: selectedEdges }) => {
      if (selectedNodes && selectedNodes.length > 0 && selectedNodes[0]) {
        selectNode(selectedNodes[0].id);
      } else if (selectedEdges && selectedEdges.length > 0 && selectedEdges[0]) {
        selectEdge(selectedEdges[0].id);
      } else {
        clearSelection();
      }
    },
    [selectNode, selectEdge, clearSelection],
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

  // Handle Delete/Backspace keys for node deletion and navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't handle when typing in an input/textarea
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return;
      }

      // Escape exits placement mode
      if (e.key === 'Escape' && placementMode) {
        e.preventDefault();
        exitPlacementMode();
        return;
      }

      // Don't handle if delete dialog is already open
      if (deleteDialogOpen) return;

      if (e.key === 'Delete') {
        // Delete key always triggers node deletion if a node is selected
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
  }, [navigationPath, zoomOut, selectedNodeId, graph, openDeleteDialog, deleteDialogOpen, placementMode, exitPlacementMode]);

  // Track viewport changes (pan/zoom) for saving
  const onMoveEnd: OnMoveEnd = useCallback(
    (_event: MouseEvent | TouchEvent | null, viewport: Viewport) => {
      setViewport({ x: viewport.x, y: viewport.y, zoom: viewport.zoom });
    },
    [setViewport],
  );

  return (
    <div className="w-full h-full relative" data-testid="canvas">
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
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#e5e7eb" />
        <Controls position="bottom-right" />
        <MiniMap
          position="bottom-left"
          nodeStrokeWidth={3}
          pannable
          zoomable
          className="!bg-white !border !border-gray-200"
        />
      </ReactFlow>
    </div>
  );
}
