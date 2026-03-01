/**
 * Canvas - main React Flow interactive canvas component.
 * Renders architecture graph as nodes and edges with selection support.
 * Supports fractal zoom: double-click a node with children to navigate into it.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
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
import { nodeTypes } from '@/components/nodes/nodeTypeMap';
import { edgeTypes } from '@/components/edges/edgeTypeMap';
import type { CanvasNode, CanvasEdge, CanvasNodeData } from '@/types/canvas';
import { NavigationBreadcrumb } from '@/components/canvas/NavigationBreadcrumb';

export function Canvas() {
  const graph = useCoreStore((s) => s.graph);
  const renderApi = useCoreStore((s) => s.renderApi);
  const storeAddEdge = useCoreStore((s) => s.addEdge);
  const moveNode = useCoreStore((s) => s.moveNode);
  const selectNode = useCanvasStore((s) => s.selectNode);
  const selectEdge = useCanvasStore((s) => s.selectEdge);
  const clearSelection = useCanvasStore((s) => s.clearSelection);
  const setViewport = useCanvasStore((s) => s.setViewport);
  const navigationPath = useNavigationStore((s) => s.path);
  const zoomIn = useNavigationStore((s) => s.zoomIn);
  const zoomOut = useNavigationStore((s) => s.zoomOut);

  // Render the graph through RenderApi
  const rendered = useMemo(() => {
    if (!renderApi) return { nodes: [] as CanvasNode[], edges: [] as CanvasEdge[] };
    return renderApi.render(graph, navigationPath);
  }, [graph, renderApi, navigationPath]);

  // Use local state for React Flow, synced from the store
  const [rfNodes, setRfNodes] = useState<CanvasNode[]>(rendered.nodes);
  const [rfEdges, setRfEdges] = useState<CanvasEdge[]>(rendered.edges);

  // Sync from store -> React Flow whenever the rendered graph changes
  useEffect(() => {
    setRfNodes(rendered.nodes);
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

  // Handle edge connections via drag
  const onConnect: OnConnect = useCallback(
    (connection: Connection) => {
      if (connection.source && connection.target) {
        // Add edge to graph engine
        const edge = storeAddEdge({
          fromNode: connection.source,
          toNode: connection.target,
          type: 'sync',
          fromPort: connection.sourceHandle ?? undefined,
          toPort: connection.targetHandle ?? undefined,
        });

        if (edge) {
          console.log('[Canvas] Edge created:', edge.id);
        }
      }
    },
    [storeAddEdge],
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

  // Handle Backspace key to navigate up one level
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle Backspace when not typing in an input/textarea
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return;
      }

      if (e.key === 'Backspace' && navigationPath.length > 0) {
        e.preventDefault();
        console.log('[Canvas] Backspace zoom out from:', navigationPath);
        zoomOut();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [navigationPath, zoomOut]);

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
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        defaultEdgeOptions={{ type: 'sync' }}
        proOptions={{ hideAttribution: true }}
        className="bg-gray-50"
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
