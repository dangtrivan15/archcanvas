/**
 * useCanvasContextMenu - Manages context menu state for canvas, node, and edge right-click menus.
 * Also handles long-press for touch/iPad devices.
 */

import { useCallback, useRef, useState } from 'react';
import { useLongPress } from '@/hooks/useLongPress';
import type { CanvasNode, CanvasEdge } from '@/types/canvas';

interface ContextMenuState {
  x: number;
  y: number;
}

interface NodeContextMenuState extends ContextMenuState {
  nodeId: string;
}

interface EdgeContextMenuState extends ContextMenuState {
  edgeId: string;
}

export function useCanvasContextMenu() {
  // Context menu states
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [nodeContextMenu, setNodeContextMenu] = useState<NodeContextMenuState | null>(null);
  const [edgeContextMenu, setEdgeContextMenu] = useState<EdgeContextMenuState | null>(null);

  // Close all menus
  const closeAllMenus = useCallback(() => {
    setContextMenu(null);
    setNodeContextMenu(null);
    setEdgeContextMenu(null);
  }, []);

  // Open handlers (mutually exclusive — opening one closes the others)
  const onPaneContextMenu = useCallback((event: MouseEvent | React.MouseEvent) => {
    event.preventDefault();
    setNodeContextMenu(null);
    setEdgeContextMenu(null);
    setContextMenu({ x: event.clientX, y: event.clientY });
  }, []);

  const onNodeContextMenu = useCallback((_event: React.MouseEvent, node: CanvasNode) => {
    _event.preventDefault();
    setContextMenu(null);
    setEdgeContextMenu(null);
    setNodeContextMenu({ x: _event.clientX, y: _event.clientY, nodeId: node.id });
  }, []);

  const onEdgeContextMenu = useCallback((_event: React.MouseEvent, edge: CanvasEdge) => {
    _event.preventDefault();
    setContextMenu(null);
    setNodeContextMenu(null);
    setEdgeContextMenu({ x: _event.clientX, y: _event.clientY, edgeId: edge.id });
  }, []);

  // Close individual menus
  const closeContextMenu = useCallback(() => setContextMenu(null), []);
  const closeNodeContextMenu = useCallback(() => setNodeContextMenu(null), []);
  const closeEdgeContextMenu = useCallback(() => setEdgeContextMenu(null), []);

  // Long-press support (touch/iPad)
  const longPressTargetRef = useRef<EventTarget | null>(null);

  const handleLongPress = useCallback((x: number, y: number) => {
    const target = longPressTargetRef.current as HTMLElement | SVGElement | null;
    if (!target) return;

    // Check if long-press is on a node (walk up DOM to find data-node-id)
    const nodeEl = (target as HTMLElement).closest?.('[data-node-id]');
    if (nodeEl) {
      const nodeId = nodeEl.getAttribute('data-node-id');
      if (nodeId) {
        setContextMenu(null);
        setEdgeContextMenu(null);
        setNodeContextMenu({ x, y, nodeId });
        return;
      }
    }

    // Check if long-press is on an edge
    const edgeEl = (target as HTMLElement | SVGElement).closest?.('.react-flow__edge');
    if (edgeEl) {
      const edgeId = edgeEl.getAttribute('data-id');
      if (edgeId) {
        setContextMenu(null);
        setNodeContextMenu(null);
        setEdgeContextMenu({ x, y, edgeId });
        return;
      }
    }

    // Otherwise it's the canvas background
    setNodeContextMenu(null);
    setEdgeContextMenu(null);
    setContextMenu({ x, y });
  }, []);

  const longPressHandlers = useLongPress(handleLongPress);

  const onLongPressPointerDown = useCallback(
    (e: React.PointerEvent) => {
      longPressTargetRef.current = e.target;
      longPressHandlers.onPointerDown(e);
    },
    [longPressHandlers],
  );

  return {
    // State
    contextMenu,
    nodeContextMenu,
    edgeContextMenu,
    // Open handlers (for ReactFlow props)
    onPaneContextMenu,
    onNodeContextMenu,
    onEdgeContextMenu,
    // Close handlers
    closeContextMenu,
    closeNodeContextMenu,
    closeEdgeContextMenu,
    closeAllMenus,
    // Long-press (for div wrapper)
    longPressHandlers: {
      onPointerDown: onLongPressPointerDown,
      onPointerUp: longPressHandlers.onPointerUp,
      onPointerMove: longPressHandlers.onPointerMove,
      onPointerCancel: longPressHandlers.onPointerCancel,
    },
  };
}
