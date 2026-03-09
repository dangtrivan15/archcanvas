/**
 * Canvas - main interactive canvas component.
 * Slim orchestrator composing extracted hooks and CanvasRenderer.
 */

import { ReactFlowProvider } from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { useCanvasStore } from '@/store/canvasStore';
import { useUIStore } from '@/store/uiStore';
import { useCanvasPerformance } from '@/hooks/useCanvasPerformance';
import { CanvasPerformanceContext } from '@/contexts/CanvasPerformanceContext';
import { useViewportSize } from '@/hooks/useViewportSize';
import { usePencilInput } from '@/hooks/usePencilInput';
import { useStageManagerResize } from '@/hooks/useStageManagerResize';

// Canvas sub-components
import { CanvasRenderer } from '@/components/canvas/CanvasRenderer';
import { FpsCounter } from '@/components/canvas/FpsCounter';
import { NavigationBreadcrumb } from '@/components/canvas/NavigationBreadcrumb';
import { CanvasContextMenu } from '@/components/canvas/CanvasContextMenu';
import { NodeContextMenu } from '@/components/canvas/NodeContextMenu';
import { EdgeContextMenu } from '@/components/canvas/EdgeContextMenu';
import { NodePalette } from '@/components/canvas/NodePalette';
import { AnnotationOverlay } from '@/components/canvas/AnnotationOverlay';
import { AnnotationToolbar } from '@/components/canvas/AnnotationToolbar';
import { TransitionOverlay } from '@/components/canvas/TransitionOverlay';
import { ParentEdgeIndicators } from '@/components/canvas/ParentEdgeIndicators';
import { NestingFrame } from '@/components/canvas/NestingFrame';
import { DropZoneOverlay } from '@/components/canvas/DropZoneOverlay';
import { ConnectModeIndicator } from '@/components/canvas/ConnectModeIndicator';
import { PlacementModeIndicator } from '@/components/canvas/PlacementModeIndicator';

// Extracted hooks
import { useCanvasRenderer } from '@/components/canvas/hooks/useCanvasRenderer';
import { useCanvasInteractions } from '@/components/canvas/hooks/useCanvasInteractions';
import { useCanvasKeyboard } from '@/components/canvas/hooks/useCanvasKeyboard';
import { useCanvasContextMenu } from '@/components/canvas/hooks/useCanvasContextMenu';
import { useCanvasViewport } from '@/components/canvas/hooks/useCanvasViewport';
import { useCanvasNavigation } from '@/components/canvas/hooks/useCanvasNavigation';
import { useCanvasConnectMode } from '@/components/canvas/hooks/useCanvasConnectMode';
import { useCanvasDragDrop } from '@/components/canvas/hooks/useCanvasDragDrop';

export function Canvas() {
  return (
    <ReactFlowProvider>
      <CanvasInner />
    </ReactFlowProvider>
  );
}

function CanvasInner() {
  const { isCompact } = useViewportSize();
  const perf = useCanvasPerformance();
  const viewportZoom = useCanvasStore((s) => s.viewport.zoom);
  const placementMode = useUIStore((s) => s.placementMode);
  const placementInfo = useUIStore((s) => s.placementInfo);
  const exitPlacementMode = useUIStore((s) => s.exitPlacementMode);

  // Core rendering pipeline
  const { rfNodes, rfEdges, onNodesChange, onEdgesChange } = useCanvasRenderer(perf);

  // Context menus (state + handlers + long-press)
  const contextMenus = useCanvasContextMenu();

  // Interactions (click, drag, connect, selection)
  const interactions = useCanvasInteractions(contextMenus.closeAllMenus);

  // Viewport counter-diff watchers
  const { onMoveEnd } = useCanvasViewport(rfNodes, perf);

  // Navigation (dive-in/out, keyboard nav for nested canvases)
  const { diveState, diveActions } = useCanvasNavigation(rfNodes, perf);

  // Connect mode (keyboard + visual decoration)
  const { connectStep, connectNodes, connectEdges } = useCanvasConnectMode(rfNodes, rfEdges);

  // Drag & drop (NodeDef palette + file drops)
  const dragDrop = useCanvasDragDrop();

  // Keyboard shortcuts (delete, arrow nav, bulk move)
  useCanvasKeyboard(rfNodes);

  // iPad/stylus support (side-effect only)
  usePencilInput();
  useStageManagerResize();

  return (
    <div
      className="w-full h-full relative"
      data-testid="canvas"
      onContextMenu={(e) => e.preventDefault()}
      onPointerDown={contextMenus.longPressHandlers.onPointerDown}
      onPointerUp={contextMenus.longPressHandlers.onPointerUp}
      onPointerMove={contextMenus.longPressHandlers.onPointerMove}
      onPointerCancel={contextMenus.longPressHandlers.onPointerCancel}
      onDragEnter={dragDrop.onCanvasDragEnter}
      onDragLeave={dragDrop.onCanvasDragLeave}
    >
      {dragDrop.isDragOverWithFiles && <DropZoneOverlay />}

      <NavigationBreadcrumb />
      <NestingFrame />
      <ParentEdgeIndicators />

      {connectStep && <ConnectModeIndicator step={connectStep as 'select-target' | 'pick-type'} />}
      {placementMode && placementInfo && (
        <PlacementModeIndicator displayName={placementInfo.displayName} onCancel={exitPlacementMode} />
      )}

      {perf.fpsEnabled && (
        <FpsCounter
          fps={perf.fps}
          nodeCount={perf.nodeCount}
          zoom={viewportZoom}
          isLowDetailMode={perf.isLowDetailMode}
          prefersReducedMotion={perf.prefersReducedMotion}
        />
      )}

      <CanvasPerformanceContext.Provider
        value={{
          isLowDetailMode: perf.isLowDetailMode,
          isLowDetailEdges: perf.isLowDetailEdges,
          prefersReducedMotion: perf.prefersReducedMotion,
        }}
      >
        <CanvasRenderer
          nodes={connectNodes}
          edges={connectEdges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={interactions.onConnect}
          onSelectionChange={interactions.onSelectionChange}
          onNodeDoubleClick={interactions.onNodeDoubleClick}
          onNodeContextMenu={contextMenus.onNodeContextMenu}
          onEdgeContextMenu={contextMenus.onEdgeContextMenu}
          onPaneContextMenu={contextMenus.onPaneContextMenu}
          onNodeDragStop={interactions.onNodeDragStop}
          onMoveEnd={onMoveEnd}
          onPaneClick={interactions.onPaneClick}
          onDragOver={dragDrop.onDragOver}
          onDrop={dragDrop.onDrop}
          isLowDetailMode={perf.isLowDetailMode}
          isCompact={isCompact}
          placementMode={!!placementMode}
        />
      </CanvasPerformanceContext.Provider>

      {contextMenus.contextMenu && (
        <CanvasContextMenu
          x={contextMenus.contextMenu.x}
          y={contextMenus.contextMenu.y}
          onClose={contextMenus.closeContextMenu}
        />
      )}
      {contextMenus.nodeContextMenu && (
        <NodeContextMenu
          x={contextMenus.nodeContextMenu.x}
          y={contextMenus.nodeContextMenu.y}
          nodeId={contextMenus.nodeContextMenu.nodeId}
          onClose={contextMenus.closeNodeContextMenu}
        />
      )}
      {contextMenus.edgeContextMenu && (
        <EdgeContextMenu
          x={contextMenus.edgeContextMenu.x}
          y={contextMenus.edgeContextMenu.y}
          edgeId={contextMenus.edgeContextMenu.edgeId}
          onClose={contextMenus.closeEdgeContextMenu}
        />
      )}

      <NodePalette />
      <AnnotationOverlay />
      <AnnotationToolbar />

      <TransitionOverlay
        phase={diveState.phase}
        color={diveState.transitionColor}
        onCrossfadeInComplete={diveActions.onCrossfadeInComplete}
        onCrossfadeOutComplete={diveActions.onCrossfadeOutComplete}
      />
    </div>
  );
}
