/**
 * useCanvasInteractions - Handles canvas interaction callbacks:
 * selection changes, edge connections, node drag, double-click, and pane click.
 */

import { useCallback } from 'react';
import { useReactFlow, type OnSelectionChangeFunc, type OnConnect, type Connection } from '@xyflow/react';
import { useGraphStore } from '@/store/graphStore';
import { useCanvasStore } from '@/store/canvasStore';
import { useNavigationStore } from '@/store/navigationStore';
import { useUIStore } from '@/store/uiStore';
import type { CanvasNode } from '@/types/canvas';

export function useCanvasInteractions(closeAllMenus: () => void) {
  const moveNode = useGraphStore((s) => s.moveNode);
  const addNode = useGraphStore((s) => s.addNode);
  const selectNode = useCanvasStore((s) => s.selectNode);
  const selectEdge = useCanvasStore((s) => s.selectEdge);
  const clearSelection = useCanvasStore((s) => s.clearSelection);
  const selectNodes = useCanvasStore((s) => s.selectNodes);
  const selectEdges = useCanvasStore((s) => s.selectEdges);
  const zoomIn = useNavigationStore((s) => s.zoomIn);
  const openConnectionDialog = useUIStore((s) => s.openConnectionDialog);
  const placementMode = useUIStore((s) => s.placementMode);
  const placementInfo = useUIStore((s) => s.placementInfo);
  const exitPlacementMode = useUIStore((s) => s.exitPlacementMode);
  const { screenToFlowPosition } = useReactFlow();

  // Selection change from React Flow (click, Shift+Click, drag-select)
  const onSelectionChange: OnSelectionChangeFunc = useCallback(
    ({ nodes: selectedNodes, edges: selectedEdges }) => {
      if (selectedNodes && selectedNodes.length > 1) {
        selectNodes(selectedNodes.map((n) => n.id));
      } else if (selectedNodes && selectedNodes.length === 1 && selectedNodes[0]) {
        selectNode(selectedNodes[0].id);
      } else if (selectedEdges && selectedEdges.length > 1) {
        selectEdges(selectedEdges.map((e) => e.id));
      } else if (selectedEdges && selectedEdges.length === 1 && selectedEdges[0]) {
        selectEdge(selectedEdges[0].id);
      } else {
        clearSelection();
      }
    },
    [selectNode, selectNodes, selectEdge, selectEdges, clearSelection],
  );

  // Edge connection via drag — open connection type dialog
  const onConnect: OnConnect = useCallback(
    (connection: Connection) => {
      if (connection.source && connection.target) {
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

  // Node drag end — persist position
  const onNodeDragStop = useCallback(
    (_event: React.MouseEvent, node: CanvasNode) => {
      moveNode(node.id, node.position.x, node.position.y);
    },
    [moveNode],
  );

  // Double-click node — fractal zoom into children
  const onNodeDoubleClick = useCallback(
    (_event: React.MouseEvent, node: CanvasNode) => {
      if (node.data.hasChildren) {
        zoomIn(node.id);
      }
    },
    [zoomIn],
  );

  // Click on canvas pane — close menus, handle placement mode
  const onPaneClick = useCallback(
    (event: React.MouseEvent) => {
      closeAllMenus();
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
    [closeAllMenus, placementMode, placementInfo, screenToFlowPosition, addNode, exitPlacementMode],
  );

  return {
    onSelectionChange,
    onConnect,
    onNodeDragStop,
    onNodeDoubleClick,
    onPaneClick,
  };
}
