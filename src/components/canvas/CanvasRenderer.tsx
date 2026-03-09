/**
 * CanvasRenderer - The sole mount point for <ReactFlow>.
 * All React Flow configuration and rendering lives here.
 * Other canvas files should NOT import ReactFlow, Background, Controls, or MiniMap.
 */

import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  BackgroundVariant,
  type OnConnect,
  type OnMoveEnd,
  type OnSelectionChangeFunc,
  type NodeChange,
  type EdgeChange,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { nodeTypes } from '@/components/nodes/nodeTypeMap';
import { lodNodeTypes } from '@/components/nodes/lodNodeTypeMap';
import { edgeTypes } from '@/components/edges/edgeTypeMap';
import { CANVAS_BOUNDS } from '@/hooks/useCanvasPerformance';
import type { CanvasNode, CanvasEdge } from '@/types/canvas';

interface CanvasRendererProps {
  nodes: CanvasNode[];
  edges: CanvasEdge[];
  onNodesChange: (changes: NodeChange[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  onConnect: OnConnect;
  onSelectionChange: OnSelectionChangeFunc;
  onNodeDoubleClick: (event: React.MouseEvent, node: CanvasNode) => void;
  onNodeContextMenu: (event: React.MouseEvent, node: CanvasNode) => void;
  onEdgeContextMenu: (event: React.MouseEvent, edge: CanvasEdge) => void;
  onPaneContextMenu: (event: MouseEvent | React.MouseEvent) => void;
  onNodeDragStop: (event: React.MouseEvent, node: CanvasNode) => void;
  onMoveEnd: OnMoveEnd;
  onPaneClick: (event: React.MouseEvent) => void;
  onDragOver: (event: React.DragEvent) => void;
  onDrop: (event: React.DragEvent) => void;
  isLowDetailMode: boolean;
  isCompact: boolean;
  placementMode: boolean;
}

export function CanvasRenderer({
  nodes,
  edges,
  onNodesChange,
  onEdgesChange,
  onConnect,
  onSelectionChange,
  onNodeDoubleClick,
  onNodeContextMenu,
  onEdgeContextMenu,
  onPaneContextMenu,
  onNodeDragStop,
  onMoveEnd,
  onPaneClick,
  onDragOver,
  onDrop,
  isLowDetailMode,
  isCompact,
  placementMode,
}: CanvasRendererProps) {
  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
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
      nodeTypes={isLowDetailMode ? lodNodeTypes : nodeTypes}
      edgeTypes={edgeTypes}
      deleteKeyCode={null}
      fitView
      fitViewOptions={{ padding: 0.2 }}
      defaultEdgeOptions={{ type: 'sync' }}
      translateExtent={CANVAS_BOUNDS}
      proOptions={{ hideAttribution: true }}
      className={`bg-background ${placementMode ? 'cursor-crosshair' : ''}`}
    >
      <Background
        variant={BackgroundVariant.Dots}
        gap={20}
        size={1.5}
        className="!fill-subtle/30"
        style={{ backgroundColor: 'hsl(var(--background))' }}
        color="hsl(var(--subtle))"
        data-testid="canvas-background-grid"
      />
      {/* Controls - hidden in compact mode (toolbar provides zoom) */}
      {!isCompact && (
        <Controls
          position="bottom-right"
          aria-label="Canvas controls"
          data-testid="canvas-controls"
        />
      )}
      {/* MiniMap - hidden in compact mode */}
      {!isCompact && (
        <MiniMap
          position="bottom-left"
          nodeStrokeWidth={3}
          pannable
          zoomable
          className="!bg-surface !border !border-border"
          nodeColor="hsl(var(--highlight-high))"
          maskColor="hsl(var(--overlay) / 0.6)"
          aria-label="Mini map"
          data-testid="canvas-minimap"
        />
      )}
    </ReactFlow>
  );
}
