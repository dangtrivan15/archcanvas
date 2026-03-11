# P07: Decouple Canvas from React Flow — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Split `Canvas.tsx` (1,531 lines) into a slim orchestrator + 8 hooks + `CanvasRenderer`, isolating React Flow to a single component.

**Architecture:** Extract each concern (rendering pipeline, interactions, keyboard, context menus, viewport, navigation, connect mode, drag/drop) into dedicated hooks. A new `CanvasRenderer.tsx` becomes the only file mounting `<ReactFlow>`. The orchestrator Canvas.tsx composes everything in ~100 lines.

**Tech Stack:** React 19, @xyflow/react v12, Zustand, Vitest

**Worktree:** `.worktrees/p07-decouple-canvas` (branch `feature/p07-decouple-canvas-react-flow`)

**Test command:** `bash scripts/test.sh` (exclusive lock runner for multi-agent safety)

---

## Task 1: Create `useCanvasContextMenu` hook

Extract context menu state and handlers (lines 152-165, 660-753 of Canvas.tsx).

**Files:**
- Create: `src/components/canvas/hooks/useCanvasContextMenu.ts`

**Step 1: Create the hook file**

```typescript
// src/components/canvas/hooks/useCanvasContextMenu.ts
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

  // Close all
  const closeAllMenus = useCallback(() => {
    setContextMenu(null);
    setNodeContextMenu(null);
    setEdgeContextMenu(null);
  }, []);

  // Open handlers (mutually exclusive)
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

  // Close individual
  const closeContextMenu = useCallback(() => setContextMenu(null), []);
  const closeNodeContextMenu = useCallback(() => setNodeContextMenu(null), []);
  const closeEdgeContextMenu = useCallback(() => setEdgeContextMenu(null), []);

  // Long-press support (touch/iPad)
  const longPressTargetRef = useRef<EventTarget | null>(null);

  const handleLongPress = useCallback((x: number, y: number) => {
    const target = longPressTargetRef.current as HTMLElement | SVGElement | null;
    if (!target) return;

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
```

**Step 2: Verify build compiles**

Run: `cd .worktrees/p07-decouple-canvas && npx tsc --noEmit 2>&1 | head -20`
Expected: No errors related to the new file.

**Step 3: Commit**

```
git add src/components/canvas/hooks/useCanvasContextMenu.ts
git commit -m "refactor(canvas): extract useCanvasContextMenu hook"
```

---

## Task 2: Create `useCanvasViewport` hook

Extract viewport counter-diff watchers and onMoveEnd (lines 126-136, 194-232, 440-457, 1270-1277).

**Files:**
- Create: `src/components/canvas/hooks/useCanvasViewport.ts`

**Step 1: Create the hook file**

```typescript
// src/components/canvas/hooks/useCanvasViewport.ts
import { useCallback, useEffect, useRef } from 'react';
import { useReactFlow, type OnMoveEnd, type Viewport } from '@xyflow/react';
import { useCanvasStore, ZOOM_STEP, ZOOM_MIN, ZOOM_MAX, ZOOM_DURATION } from '@/store/canvasStore';
import type { CanvasNode } from '@/types/canvas';
import type { CanvasPerformanceReturn } from '@/hooks/useCanvasPerformance';

export function useCanvasViewport(
  rfNodes: CanvasNode[],
  perf: CanvasPerformanceReturn,
) {
  const { fitView, setCenter, getViewport, setViewport: rfSetViewport } = useReactFlow();
  const setViewport = useCanvasStore((s) => s.setViewport);

  // Counter-diff refs
  const fitViewCounter = useCanvasStore((s) => s.fitViewCounter);
  const zoomInCounter = useCanvasStore((s) => s.zoomInCounter);
  const zoomOutCounter = useCanvasStore((s) => s.zoomOutCounter);
  const zoom100Counter = useCanvasStore((s) => s.zoom100Counter);
  const centerOnNodeId = useCanvasStore((s) => s.centerOnNodeId);
  const centerOnNodeCounter = useCanvasStore((s) => s.centerOnNodeCounter);

  const prevFitViewCounterRef = useRef(fitViewCounter);
  const prevZoomInCounterRef = useRef(zoomInCounter);
  const prevZoomOutCounterRef = useRef(zoomOutCounter);
  const prevZoom100CounterRef = useRef(zoom100Counter);
  const prevCenterOnNodeCounterRef = useRef(centerOnNodeCounter);

  // Watch fitView requests
  useEffect(() => {
    if (fitViewCounter !== prevFitViewCounterRef.current) {
      prevFitViewCounterRef.current = fitViewCounter;
      setTimeout(() => {
        fitView({ padding: 0.2, duration: 300 });
      }, 50);
    }
  }, [fitViewCounter, fitView]);

  // Watch zoom-in requests
  useEffect(() => {
    if (zoomInCounter !== prevZoomInCounterRef.current) {
      prevZoomInCounterRef.current = zoomInCounter;
      const vp = getViewport();
      const newZoom = Math.min(ZOOM_MAX, vp.zoom + ZOOM_STEP);
      rfSetViewport({ x: vp.x, y: vp.y, zoom: newZoom }, { duration: ZOOM_DURATION });
    }
  }, [zoomInCounter, getViewport, rfSetViewport]);

  // Watch zoom-out requests
  useEffect(() => {
    if (zoomOutCounter !== prevZoomOutCounterRef.current) {
      prevZoomOutCounterRef.current = zoomOutCounter;
      const vp = getViewport();
      const newZoom = Math.max(ZOOM_MIN, vp.zoom - ZOOM_STEP);
      rfSetViewport({ x: vp.x, y: vp.y, zoom: newZoom }, { duration: ZOOM_DURATION });
    }
  }, [zoomOutCounter, getViewport, rfSetViewport]);

  // Watch zoom-to-100% requests
  useEffect(() => {
    if (zoom100Counter !== prevZoom100CounterRef.current) {
      prevZoom100CounterRef.current = zoom100Counter;
      const vp = getViewport();
      rfSetViewport({ x: vp.x, y: vp.y, zoom: 1.0 }, { duration: ZOOM_DURATION });
    }
  }, [zoom100Counter, getViewport, rfSetViewport]);

  // Watch center-on-node requests (from QuickSearch)
  useEffect(() => {
    if (centerOnNodeCounter !== prevCenterOnNodeCounterRef.current) {
      prevCenterOnNodeCounterRef.current = centerOnNodeCounter;
      if (centerOnNodeId) {
        const targetNode = rfNodes.find((n) => n.id === centerOnNodeId);
        if (targetNode) {
          const vp = getViewport();
          setCenter(targetNode.position.x, targetNode.position.y, {
            zoom: vp.zoom,
            duration: 200,
          });
        }
      }
    }
  }, [centerOnNodeCounter, centerOnNodeId, rfNodes, getViewport, setCenter]);

  // onMoveEnd: sync viewport back to store + update LOD
  const onMoveEnd: OnMoveEnd = useCallback(
    (_event: MouseEvent | TouchEvent | null, viewport: Viewport) => {
      setViewport({ x: viewport.x, y: viewport.y, zoom: viewport.zoom });
      perf.updateZoom(viewport.zoom);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [setViewport, perf.updateZoom],
  );

  return { onMoveEnd };
}
```

**Note:** This hook requires being inside `<ReactFlowProvider>` because it uses `useReactFlow()`. That's fine — it will be called from `CanvasInner` which is wrapped by the provider.

**Note:** The `CanvasPerformanceReturn` type needs to be exported from `useCanvasPerformance`. Check if it already is; if not, export the return type.

**Step 2: Verify the `CanvasPerformanceReturn` type is exported**

Check `src/hooks/useCanvasPerformance.ts` — if the return type isn't exported, add:
```typescript
export type CanvasPerformanceReturn = ReturnType<typeof useCanvasPerformance>;
```

**Step 3: Verify build compiles**

Run: `cd .worktrees/p07-decouple-canvas && npx tsc --noEmit 2>&1 | head -20`

**Step 4: Commit**

```
git add src/components/canvas/hooks/useCanvasViewport.ts
git commit -m "refactor(canvas): extract useCanvasViewport hook"
```

---

## Task 3: Create `useCanvasRenderer` hook

Extract render pipeline: RenderApi call, local rfNodes/rfEdges state, selection sync (lines 234-242, 390-438, 459-467).

**Files:**
- Create: `src/components/canvas/hooks/useCanvasRenderer.ts`

**Step 1: Create the hook file**

```typescript
// src/components/canvas/hooks/useCanvasRenderer.ts
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { applyNodeChanges, applyEdgeChanges, type NodeChange, type EdgeChange } from '@xyflow/react';
import { useCoreStore } from '@/store/coreStore';
import { useCanvasStore } from '@/store/canvasStore';
import { useNavigationStore } from '@/store/navigationStore';
import { useUIStore } from '@/store/uiStore';
import { NODE_COUNT_WARNING } from '@/hooks/useCanvasPerformance';
import type { CanvasNode, CanvasEdge } from '@/types/canvas';
import type { CanvasPerformanceReturn } from '@/hooks/useCanvasPerformance';

export function useCanvasRenderer(perf: CanvasPerformanceReturn) {
  const graph = useCoreStore((s) => s.graph);
  const renderApi = useCoreStore((s) => s.renderApi);
  const navigationPath = useNavigationStore((s) => s.path);
  const showToast = useUIStore((s) => s.showToast);

  // Render the graph through RenderApi
  const rendered = useMemo(() => {
    if (!renderApi) return { nodes: [] as CanvasNode[], edges: [] as CanvasEdge[] };
    return renderApi.render(graph, navigationPath);
  }, [graph, renderApi, navigationPath]);

  // Local React Flow state
  const [rfNodes, setRfNodes] = useState<CanvasNode[]>(rendered.nodes);
  const [rfEdges, setRfEdges] = useState<CanvasEdge[]>(rendered.edges);

  // Monitor node count for performance warnings
  const nodeCountWarningShownRef = useRef(false);
  useEffect(() => {
    perf.setNodeCount(rendered.nodes.length);
    if (rendered.nodes.length > NODE_COUNT_WARNING && !nodeCountWarningShownRef.current) {
      nodeCountWarningShownRef.current = true;
      showToast(
        `${rendered.nodes.length} nodes visible — consider grouping nodes for better performance.`,
        6000,
      );
    } else if (rendered.nodes.length <= NODE_COUNT_WARNING) {
      nodeCountWarningShownRef.current = false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rendered.nodes.length, perf.setNodeCount, showToast]);

  // Sync rendered → rfNodes/rfEdges (preserve selection)
  useEffect(() => {
    setRfNodes((prevNodes) => {
      const selectedIds = new Set(prevNodes.filter((n) => n.selected).map((n) => n.id));
      if (selectedIds.size === 0) return rendered.nodes;
      return rendered.nodes.map((n) => (selectedIds.has(n.id) ? { ...n, selected: true } : n));
    });
    setRfEdges(rendered.edges);
  }, [rendered]);

  // Sync multi-selection from store → rfNodes
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

  // React Flow change handlers
  const onNodesChange = useCallback((changes: NodeChange[]) => {
    setRfNodes((nds) => applyNodeChanges(changes, nds) as CanvasNode[]);
  }, []);

  const onEdgesChange = useCallback((changes: EdgeChange[]) => {
    setRfEdges((eds) => applyEdgeChanges(changes, eds) as CanvasEdge[]);
  }, []);

  return {
    rfNodes,
    rfEdges,
    onNodesChange,
    onEdgesChange,
    rendered,
  };
}
```

**Step 2: Verify build compiles**

**Step 3: Commit**

```
git add src/components/canvas/hooks/useCanvasRenderer.ts
git commit -m "refactor(canvas): extract useCanvasRenderer hook"
```

---

## Task 4: Create `useCanvasInteractions` hook

Extract click, drag, connect, selection handlers (lines 469-524, 527-544).

**Files:**
- Create: `src/components/canvas/hooks/useCanvasInteractions.ts`

**Step 1: Create the hook file**

```typescript
// src/components/canvas/hooks/useCanvasInteractions.ts
import { useCallback } from 'react';
import { useReactFlow, type OnSelectionChangeFunc, type OnConnect, type Connection } from '@xyflow/react';
import { useCoreStore } from '@/store/coreStore';
import { useCanvasStore } from '@/store/canvasStore';
import { useNavigationStore } from '@/store/navigationStore';
import { useUIStore } from '@/store/uiStore';
import type { CanvasNode } from '@/types/canvas';

export function useCanvasInteractions(closeAllMenus: () => void) {
  const moveNode = useCoreStore((s) => s.moveNode);
  const addNode = useCoreStore((s) => s.addNode);
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

  // Selection change from React Flow
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

  // Edge connection via drag
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

  // Double-click node — fractal zoom
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
```

**Step 2: Verify build compiles**

**Step 3: Commit**

```
git add src/components/canvas/hooks/useCanvasInteractions.ts
git commit -m "refactor(canvas): extract useCanvasInteractions hook"
```

---

## Task 5: Create `useCanvasDragDrop` hook

Extract drag-over/enter/leave/drop logic (lines 147-150, 547-658).

**Files:**
- Create: `src/components/canvas/hooks/useCanvasDragDrop.ts`

**Step 1: Create the hook file**

```typescript
// src/components/canvas/hooks/useCanvasDragDrop.ts
import { useCallback, useRef, useState } from 'react';
import { useReactFlow } from '@xyflow/react';
import { useCoreStore } from '@/store/coreStore';
import { useUIStore } from '@/store/uiStore';

export function useCanvasDragDrop() {
  const addNode = useCoreStore((s) => s.addNode);
  const loadFromDroppedFile = useCoreStore((s) => s.loadFromDroppedFile);
  const showToast = useUIStore((s) => s.showToast);
  const { screenToFlowPosition } = useReactFlow();

  const [isDragOverWithFiles, setIsDragOverWithFiles] = useState(false);
  const dragOverCounterRef = useRef(0);

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
    if (event.dataTransfer.types.includes('Files')) {
      setIsDragOverWithFiles(true);
    }
  }, []);

  const onCanvasDragEnter = useCallback((event: React.DragEvent) => {
    if (event.dataTransfer.types.includes('Files')) {
      dragOverCounterRef.current += 1;
      if (dragOverCounterRef.current === 1) {
        setIsDragOverWithFiles(true);
      }
    }
  }, []);

  const onCanvasDragLeave = useCallback((event: React.DragEvent) => {
    if (event.dataTransfer.types.includes('Files')) {
      dragOverCounterRef.current -= 1;
      if (dragOverCounterRef.current <= 0) {
        dragOverCounterRef.current = 0;
        setIsDragOverWithFiles(false);
      }
    }
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      setIsDragOverWithFiles(false);
      dragOverCounterRef.current = 0;

      // 1. NodeDefBrowser drops
      const nodeDefData = event.dataTransfer.getData('application/archcanvas-nodedef');
      if (nodeDefData) {
        try {
          const { nodeType, displayName } = JSON.parse(nodeDefData);
          const position = screenToFlowPosition({ x: event.clientX, y: event.clientY });
          addNode({
            type: nodeType,
            displayName,
            position: { x: position.x, y: position.y },
          });
        } catch {
          console.warn('[Canvas] Invalid drop data');
        }
        return;
      }

      // 2. File drops
      const files = event.dataTransfer.files;
      if (files.length === 0) return;

      if (files.length > 1) {
        const archcFiles: File[] = [];
        const imageFiles: File[] = [];
        for (let i = 0; i < files.length; i++) {
          const f = files[i]!;
          if (f.name.toLowerCase().endsWith('.archc')) {
            archcFiles.push(f);
          } else if (f.type.startsWith('image/')) {
            imageFiles.push(f);
          }
        }

        if (archcFiles.length > 1) {
          showToast('Only one .archc file can be opened at a time. Please drop a single file.');
          return;
        }
        if (archcFiles.length === 1) {
          loadFromDroppedFile(archcFiles[0]!);
          return;
        }
        if (imageFiles.length > 0) {
          showToast(
            `${imageFiles.length} image(s) noted — image attachment to nodes is not yet available.`,
          );
          return;
        }
        showToast(
          'Unsupported file type. Drop .archc files to open an architecture, or images to attach.',
        );
        return;
      }

      const file = files[0]!;
      if (file.name.toLowerCase().endsWith('.archc')) {
        loadFromDroppedFile(file);
        return;
      }
      if (file.type.startsWith('image/')) {
        showToast('Image dropped — image attachment to nodes is not yet available.');
        return;
      }
      showToast(`Unsupported file type: "${file.name}". Only .archc files can be opened.`);
    },
    [screenToFlowPosition, addNode, loadFromDroppedFile, showToast],
  );

  return {
    isDragOverWithFiles,
    onDragOver,
    onCanvasDragEnter,
    onCanvasDragLeave,
    onDrop,
  };
}
```

**Step 2: Verify build compiles**

**Step 3: Commit**

```
git add src/components/canvas/hooks/useCanvasDragDrop.ts
git commit -m "refactor(canvas): extract useCanvasDragDrop hook"
```

---

## Task 6: Create `useCanvasNavigation` hook

Extract container dive-in/out, escape zoom-out, enter dive-in, pinch-out, auto-layout on zoom-in (lines 143-145, 167-192, 244-388).

**Files:**
- Create: `src/components/canvas/hooks/useCanvasNavigation.ts`

**Step 1: Create the hook file**

```typescript
// src/components/canvas/hooks/useCanvasNavigation.ts
import { useEffect, useRef } from 'react';
import { useCoreStore } from '@/store/coreStore';
import { useCanvasStore } from '@/store/canvasStore';
import { useNavigationStore } from '@/store/navigationStore';
import { useUIStore } from '@/store/uiStore';
import { useNestedCanvasStore } from '@/store/nestedCanvasStore';
import { useContainerDiveIn } from '@/hooks/useContainerDiveIn';
import { isActiveElementTextInput } from '@/core/input/focusZones';
import { getNodesAtLevel } from '@/core/graph/graphQuery';
import { needsAutoLayout } from '@/core/layout/positionDetection';
import type { CanvasNode } from '@/types/canvas';
import type { CanvasPerformanceReturn } from '@/hooks/useCanvasPerformance';

export function useCanvasNavigation(
  rfNodes: CanvasNode[],
  perf: CanvasPerformanceReturn,
) {
  const graph = useCoreStore((s) => s.graph);
  const autoLayout = useCoreStore((s) => s.autoLayout);
  const navigationPath = useNavigationStore((s) => s.path);
  const zoomOut = useNavigationStore((s) => s.zoomOut);
  const selectedNodeId = useCanvasStore((s) => s.selectedNodeId);
  const deleteDialogOpen = useUIStore((s) => s.deleteDialogOpen);
  const connectStep = useUIStore((s) => s.connectStep);
  const placementMode = useUIStore((s) => s.placementMode);

  const [diveState, diveActions] = useContainerDiveIn();
  const nestedDepth = useNestedCanvasStore((s) => s.fileStack.length);

  // Auto-layout when zooming into a parent whose children lack positions
  const prevNavigationPathRef = useRef(navigationPath);
  useEffect(() => {
    const prevPath = prevNavigationPathRef.current;
    prevNavigationPathRef.current = navigationPath;

    if (navigationPath.length <= prevPath.length) return;
    if (graph.nodes.length === 0) return;

    const nodesAtLevel = getNodesAtLevel(graph, navigationPath);
    if (nodesAtLevel.length > 0 && needsAutoLayout(nodesAtLevel)) {
      console.log('[Canvas] Children lack positions — triggering auto-layout on zoom-in');
      setTimeout(() => {
        autoLayout('horizontal', navigationPath)
          .then(() => {
            useCanvasStore.getState().requestFitView();
            console.log('[Canvas] Auto-layout on zoom-in complete');
          })
          .catch((err) => {
            console.warn('[Canvas] Auto-layout on zoom-in failed:', err);
          });
      }, 0);
    }
  }, [navigationPath, graph, autoLayout]);

  // TODO: replace DOM event with store action when ContainerNode is updated
  // Listen for container dive-in events (dispatched by ContainerNode)
  useEffect(() => {
    const handleDiveIn = (event: Event) => {
      const { nodeId, refSource } = (event as CustomEvent).detail ?? {};
      if (nodeId && refSource) {
        diveActions.diveIn(nodeId, refSource, rfNodes, perf.prefersReducedMotion);
      }
    };
    document.addEventListener('archcanvas:container-dive-in', handleDiveIn);
    return () => document.removeEventListener('archcanvas:container-dive-in', handleDiveIn);
  }, [diveActions, rfNodes, perf.prefersReducedMotion]);

  // Escape key for nested file dive-out
  useEffect(() => {
    const handleEscapeDiveOut = (e: KeyboardEvent) => {
      if (
        e.key === 'Escape' &&
        nestedDepth > 0 &&
        !diveState.isAnimating &&
        !deleteDialogOpen &&
        !connectStep &&
        !placementMode &&
        !isActiveElementTextInput()
      ) {
        e.preventDefault();
        e.stopPropagation();
        if (navigationPath.length > 0) {
          zoomOut();
        } else {
          diveActions.diveOut(perf.prefersReducedMotion);
        }
      }
    };
    document.addEventListener('keydown', handleEscapeDiveOut, true);
    return () => document.removeEventListener('keydown', handleEscapeDiveOut, true);
  }, [nestedDepth, navigationPath, diveState.isAnimating, diveActions, perf.prefersReducedMotion, deleteDialogOpen, connectStep, placementMode, zoomOut]);

  // Ctrl+Shift+Home: jump directly to project root
  useEffect(() => {
    const handleJumpToRoot = (e: KeyboardEvent) => {
      if (
        e.key === 'Home' &&
        (e.ctrlKey || e.metaKey) &&
        e.shiftKey &&
        nestedDepth > 0 &&
        !diveState.isAnimating &&
        !isActiveElementTextInput()
      ) {
        e.preventDefault();
        e.stopPropagation();
        useNestedCanvasStore.getState().popToRoot();
      }
    };
    document.addEventListener('keydown', handleJumpToRoot, true);
    return () => document.removeEventListener('keydown', handleJumpToRoot, true);
  }, [nestedDepth, diveState.isAnimating]);

  // Enter key on selected container node: trigger dive-in
  useEffect(() => {
    const handleEnterDiveIn = (e: KeyboardEvent) => {
      if (
        e.key === 'Enter' &&
        !e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey &&
        selectedNodeId &&
        !diveState.isAnimating &&
        !deleteDialogOpen &&
        !connectStep &&
        !placementMode &&
        !isActiveElementTextInput()
      ) {
        const targetNode = rfNodes.find((n) => n.id === selectedNodeId);
        if (targetNode?.data?.refSource) {
          e.preventDefault();
          e.stopPropagation();
          diveActions.diveIn(
            selectedNodeId,
            targetNode.data.refSource as string,
            rfNodes,
            perf.prefersReducedMotion,
          );
        }
      }
    };
    document.addEventListener('keydown', handleEnterDiveIn, true);
    return () => document.removeEventListener('keydown', handleEnterDiveIn, true);
  }, [selectedNodeId, rfNodes, diveState.isAnimating, diveActions, perf.prefersReducedMotion, deleteDialogOpen, connectStep, placementMode]);

  // Two-finger pinch-out gesture
  useEffect(() => {
    if (nestedDepth === 0) return;

    let initialDistance: number | null = null;
    const PINCH_OUT_THRESHOLD = 1.5;

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        const dx = e.touches[1]!.clientX - e.touches[0]!.clientX;
        const dy = e.touches[1]!.clientY - e.touches[0]!.clientY;
        initialDistance = Math.hypot(dx, dy);
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2 && initialDistance !== null && !diveState.isAnimating) {
        const dx = e.touches[1]!.clientX - e.touches[0]!.clientX;
        const dy = e.touches[1]!.clientY - e.touches[0]!.clientY;
        const currentDistance = Math.hypot(dx, dy);
        const ratio = currentDistance / initialDistance;

        if (ratio > PINCH_OUT_THRESHOLD) {
          initialDistance = null;
          if (navigationPath.length > 0) {
            zoomOut();
          } else {
            diveActions.diveOut(perf.prefersReducedMotion);
          }
        }
      }
    };

    const handleTouchEnd = () => {
      initialDistance = null;
    };

    const canvasEl = document.querySelector('[data-testid="canvas"]');
    if (canvasEl) {
      canvasEl.addEventListener('touchstart', handleTouchStart as EventListener, { passive: true });
      canvasEl.addEventListener('touchmove', handleTouchMove as EventListener, { passive: true });
      canvasEl.addEventListener('touchend', handleTouchEnd as EventListener);
    }

    return () => {
      if (canvasEl) {
        canvasEl.removeEventListener('touchstart', handleTouchStart as EventListener);
        canvasEl.removeEventListener('touchmove', handleTouchMove as EventListener);
        canvasEl.removeEventListener('touchend', handleTouchEnd as EventListener);
      }
    };
  }, [nestedDepth, navigationPath, diveState.isAnimating, diveActions, perf.prefersReducedMotion, zoomOut]);

  return { diveState, diveActions, nestedDepth };
}
```

**Step 2: Verify build compiles**

**Step 3: Commit**

```
git add src/components/canvas/hooks/useCanvasNavigation.ts
git commit -m "refactor(canvas): extract useCanvasNavigation hook"
```

---

## Task 7: Create `useCanvasKeyboard` hook

Extract all keyboard handlers: Delete/Escape, arrow nav, bulk move (lines 756-1129).

**Files:**
- Create: `src/components/canvas/hooks/useCanvasKeyboard.ts`

**Step 1: Create the hook file**

```typescript
// src/components/canvas/hooks/useCanvasKeyboard.ts
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
      if (isActiveElementTextInput()) return;

      // Escape exits placement mode
      if (e.key === 'Escape' && placementMode) {
        e.preventDefault();
        exitPlacementMode();
        return;
      }

      // Escape deselects
      if (e.key === 'Escape') {
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

        if (navigationPath.length > 0) {
          e.preventDefault();
          zoomOut();
          return;
        }
      }

      if (deleteDialogOpen) return;

      // Helper: delete selected edge(s)
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

      // Helper: open delete dialog for selected nodes
      const openDeleteForSelectedNodes = () => {
        const canvasState = useCanvasStore.getState();
        const multiIds = canvasState.selectedNodeIds;

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
      ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
    };

    const handleArrowNav = (e: KeyboardEvent) => {
      if (isActiveElementTextInput()) return;

      const uiState = useUIStore.getState();
      if (
        uiState.deleteDialogOpen || uiState.connectionDialogOpen ||
        uiState.unsavedChangesDialogOpen || uiState.errorDialogOpen ||
        uiState.integrityWarningDialogOpen || uiState.shortcutsHelpOpen ||
        uiState.commandPaletteOpen || uiState.quickSearchOpen
      ) return;

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

  // Block 3: Alt+Arrow bulk move
  useEffect(() => {
    const SMALL_STEP = 20;
    const LARGE_STEP = 100;
    const ARROW_OFFSETS: Record<string, { dx: number; dy: number }> = {
      ArrowUp: { dx: 0, dy: -1 }, ArrowDown: { dx: 0, dy: 1 },
      ArrowLeft: { dx: -1, dy: 0 }, ArrowRight: { dx: 1, dy: 0 },
    };

    const handleBulkMove = (e: KeyboardEvent) => {
      if (!e.altKey) return;
      const offset = ARROW_OFFSETS[e.key];
      if (!offset) return;
      if (isActiveElementTextInput()) return;

      const uiState = useUIStore.getState();
      if (
        uiState.deleteDialogOpen || uiState.connectionDialogOpen ||
        uiState.unsavedChangesDialogOpen || uiState.errorDialogOpen ||
        uiState.integrityWarningDialogOpen || uiState.shortcutsHelpOpen ||
        uiState.commandPaletteOpen || uiState.quickSearchOpen
      ) return;

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
          moves.push({ nodeId, x: node.position.x + dx, y: node.position.y + dy });
        }
      }

      if (moves.length > 0) {
        const count = moves.length;
        moveNodes(moves, `Move ${count} node${count === 1 ? '' : 's'}`);
      }
    };

    document.addEventListener('keydown', handleBulkMove, true);
    return () => document.removeEventListener('keydown', handleBulkMove, true);
  }, [moveNodes, placementMode]);
}
```

**Step 2: Verify build compiles**

**Step 3: Commit**

```
git add src/components/canvas/hooks/useCanvasKeyboard.ts
git commit -m "refactor(canvas): extract useCanvasKeyboard hook"
```

---

## Task 8: Create `useCanvasConnectMode` hook

Extract connect mode keyboard handler + node/edge decoration logic (lines 110-118, 1131-1267, 1394-1428).

**Files:**
- Create: `src/components/canvas/hooks/useCanvasConnectMode.ts`

**Step 1: Create the hook file**

```typescript
// src/components/canvas/hooks/useCanvasConnectMode.ts
import { useEffect, useMemo } from 'react';
import { useReactFlow } from '@xyflow/react';
import { useCoreStore } from '@/store/coreStore';
import { useCanvasStore } from '@/store/canvasStore';
import { useUIStore } from '@/store/uiStore';
import { isActiveElementTextInput } from '@/core/input/focusZones';
import {
  findNearestNode,
  findTopLeftNode,
  extractPositions,
  type Direction,
} from '@/core/input/spatialNavigation';
import type { CanvasNode, CanvasEdge } from '@/types/canvas';

export function useCanvasConnectMode(rfNodes: CanvasNode[], rfEdges: CanvasEdge[]) {
  const addEdge = useCoreStore((s) => s.addEdge);
  const connectSource = useUIStore((s) => s.connectSource);
  const connectTarget = useUIStore((s) => s.connectTarget);
  const connectStep = useUIStore((s) => s.connectStep);
  const enterConnectMode = useUIStore((s) => s.enterConnectMode);
  const setConnectTarget = useUIStore((s) => s.setConnectTarget);
  const advanceToPickType = useUIStore((s) => s.advanceToPickType);
  const exitConnectMode = useUIStore((s) => s.exitConnectMode);
  const { setCenter, getViewport } = useReactFlow();

  // Keyboard handler
  useEffect(() => {
    const handleConnectMode = (e: KeyboardEvent) => {
      if (isActiveElementTextInput()) return;

      const uiState = useUIStore.getState();
      const { connectSource: src, connectTarget: tgt, connectStep: step } = uiState;
      const inConnectMode = step !== null;

      // Enter connect mode with 'C'
      if (!inConnectMode && e.key === 'c' && !e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey) {
        if (
          uiState.deleteDialogOpen || uiState.connectionDialogOpen ||
          uiState.unsavedChangesDialogOpen || uiState.errorDialogOpen ||
          uiState.integrityWarningDialogOpen || uiState.commandPaletteOpen ||
          uiState.quickSearchOpen || uiState.placementMode
        ) return;

        const canvasState = useCanvasStore.getState();
        const currentSelected = canvasState.selectedNodeId;
        if (!currentSelected) return;

        e.preventDefault();
        enterConnectMode(currentSelected);

        const positions = extractPositions(rfNodes);
        const firstTarget =
          findNearestNode(currentSelected, 'right', positions) ||
          findNearestNode(currentSelected, 'down', positions) ||
          findTopLeftNode(positions.filter((p) => p.id !== currentSelected));
        if (firstTarget) {
          setConnectTarget(firstTarget);
          const targetPos = positions.find((p) => p.id === firstTarget);
          if (targetPos) {
            const currentViewport = getViewport();
            setCenter(targetPos.x, targetPos.y, { zoom: currentViewport.zoom, duration: 200 });
          }
        }
        return;
      }

      if (!inConnectMode) return;

      // Escape
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        exitConnectMode();
        return;
      }

      // select-target step
      if (step === 'select-target') {
        const ARROW_MAP: Record<string, Direction> = {
          ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
        };
        const direction = ARROW_MAP[e.key];
        if (direction) {
          e.preventDefault();
          e.stopPropagation();
          const positions = extractPositions(rfNodes);
          const fromId = tgt || src;
          if (!fromId) return;
          const nextTarget = findNearestNode(fromId, direction, positions);
          if (nextTarget && nextTarget !== src) {
            setConnectTarget(nextTarget);
            const targetPos = positions.find((p) => p.id === nextTarget);
            if (targetPos) {
              const currentViewport = getViewport();
              setCenter(targetPos.x, targetPos.y, { zoom: currentViewport.zoom, duration: 200 });
            }
          }
          return;
        }

        if (e.key === 'Enter' && tgt && tgt !== src) {
          e.preventDefault();
          e.stopPropagation();
          advanceToPickType();
          return;
        }
      }

      // pick-type step
      if (step === 'pick-type') {
        const TYPE_MAP: Record<string, 'sync' | 'async' | 'data-flow'> = {
          '1': 'sync', '2': 'async', '3': 'data-flow',
        };
        const edgeType = TYPE_MAP[e.key];
        if (edgeType && src && tgt) {
          e.preventDefault();
          e.stopPropagation();
          const typeLabels: Record<string, string> = {
            sync: 'Sync', async: 'Async', 'data-flow': 'Data Flow',
          };
          const newEdge = addEdge({ fromNode: src, toNode: tgt, type: edgeType });
          exitConnectMode();
          if (newEdge) {
            useCanvasStore.getState().selectEdge(newEdge.id);
            useUIStore.getState().showToast(`Created ${typeLabels[edgeType]} edge`);
          }
          return;
        }
      }
    };

    document.addEventListener('keydown', handleConnectMode, true);
    return () => document.removeEventListener('keydown', handleConnectMode, true);
  }, [rfNodes, enterConnectMode, setConnectTarget, advanceToPickType, exitConnectMode, addEdge, setCenter, getViewport]);

  // Decorate nodes/edges for connect mode visualization
  const connectNodes = useMemo(() => {
    if (!connectStep) return rfNodes;
    return rfNodes.map((n) => {
      if (n.id === connectSource) {
        return { ...n, className: `${n.className || ''} connect-mode-source`.trim() };
      }
      if (n.id === connectTarget && connectStep === 'select-target') {
        return { ...n, className: `${n.className || ''} connect-mode-target`.trim() };
      }
      return n;
    });
  }, [connectStep, connectSource, connectTarget, rfNodes]);

  const connectEdges = useMemo(() => {
    if (!connectStep || !connectSource || !connectTarget) return rfEdges;
    return [
      ...rfEdges,
      {
        id: '__connect-preview__',
        source: connectSource,
        target: connectTarget,
        type: 'default',
        animated: true,
        style: {
          strokeDasharray: '8 4',
          stroke: 'hsl(var(--pine))',
          strokeWidth: 2,
          opacity: 0.8,
        },
        data: {},
      } as CanvasEdge,
    ];
  }, [connectStep, connectSource, connectTarget, rfEdges]);

  return {
    connectStep,
    connectSource,
    connectTarget,
    connectNodes,
    connectEdges,
    exitConnectMode,
  };
}
```

**Step 2: Verify build compiles**

**Step 3: Commit**

```
git add src/components/canvas/hooks/useCanvasConnectMode.ts
git commit -m "refactor(canvas): extract useCanvasConnectMode hook"
```

---

## Task 9: Create `CanvasRenderer.tsx`

Extract the `<ReactFlow>` mount point + `<Background>`, `<Controls>`, `<MiniMap>` (lines 1386-1484).

**Files:**
- Create: `src/components/canvas/CanvasRenderer.tsx`

**Step 1: Create the component**

```typescript
// src/components/canvas/CanvasRenderer.tsx
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
  isLowDetailEdges: boolean;
  prefersReducedMotion: boolean;
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
  isLowDetailEdges,
  prefersReducedMotion,
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
      {!isCompact && (
        <Controls
          position="bottom-right"
          aria-label="Canvas controls"
          data-testid="canvas-controls"
        />
      )}
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
```

**Step 2: Verify build compiles**

**Step 3: Commit**

```
git add src/components/canvas/CanvasRenderer.tsx
git commit -m "refactor(canvas): create CanvasRenderer component"
```

---

## Task 10: Rewrite Canvas.tsx as slim orchestrator

Replace the 1,531-line `CanvasInner` with a ~100-line orchestrator that composes all hooks and renders the tree.

**Files:**
- Modify: `src/components/canvas/Canvas.tsx` (complete rewrite)

**Step 1: Rewrite Canvas.tsx**

Replace entire file with:

```typescript
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

      {connectStep && <ConnectModeIndicator step={connectStep} />}
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
          isLowDetailEdges={perf.isLowDetailEdges}
          prefersReducedMotion={perf.prefersReducedMotion}
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
```

**Note:** This references three small components that need to be extracted from inline JSX: `DropZoneOverlay`, `ConnectModeIndicator`, `PlacementModeIndicator`. Create them in the next task.

**Step 2: Do NOT commit yet — depends on Task 11.**

---

## Task 11: Create small extracted inline components

Extract the inline JSX for drop zone overlay, connect mode indicator, and placement mode indicator into small components.

**Files:**
- Create: `src/components/canvas/DropZoneOverlay.tsx`
- Create: `src/components/canvas/ConnectModeIndicator.tsx`
- Create: `src/components/canvas/PlacementModeIndicator.tsx`

**Step 1: Create DropZoneOverlay**

```typescript
// src/components/canvas/DropZoneOverlay.tsx
export function DropZoneOverlay() {
  return (
    <div
      className="absolute inset-0 z-50 pointer-events-none flex items-center justify-center"
      data-testid="drop-zone-overlay"
      style={{
        backgroundColor: 'hsla(var(--pine), 0.08)',
        border: '3px dashed hsl(var(--pine))',
        borderRadius: '12px',
      }}
    >
      <div
        className="flex flex-col items-center gap-2 px-6 py-4 rounded-xl"
        style={{
          backgroundColor: 'hsl(var(--surface))',
          boxShadow: '0 8px 32px hsla(0, 0%, 0%, 0.2)',
        }}
      >
        <svg
          width="40"
          height="40"
          viewBox="0 0 24 24"
          fill="none"
          stroke="hsl(var(--pine))"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="7 10 12 15 17 10" />
          <line x1="12" y1="15" x2="12" y2="3" />
        </svg>
        <span className="text-sm font-medium" style={{ color: 'hsl(var(--text))' }}>
          Drop .archc file to open
        </span>
        <span className="text-xs" style={{ color: 'hsl(var(--subtle))' }}>
          or drop an image to attach
        </span>
      </div>
    </div>
  );
}
```

**Step 2: Create ConnectModeIndicator**

```typescript
// src/components/canvas/ConnectModeIndicator.tsx
interface ConnectModeIndicatorProps {
  step: 'select-target' | 'pick-type';
}

export function ConnectModeIndicator({ step }: ConnectModeIndicatorProps) {
  return (
    <div
      className="absolute top-10 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2
                 bg-green-600 text-white px-4 py-2 rounded-lg shadow-lg text-sm font-medium"
      data-testid="connect-mode-indicator"
    >
      <span className="inline-block w-2 h-2 bg-white rounded-full animate-pulse" />
      {step === 'select-target'
        ? 'CONNECT: Select target (↑↓←→) then Enter | Esc to cancel'
        : 'CONNECT: Pick type — 1=Sync  2=Async  3=Data Flow | Esc to cancel'}
    </div>
  );
}
```

**Step 3: Create PlacementModeIndicator**

```typescript
// src/components/canvas/PlacementModeIndicator.tsx
interface PlacementModeIndicatorProps {
  displayName: string;
  onCancel: () => void;
}

export function PlacementModeIndicator({ displayName, onCancel }: PlacementModeIndicatorProps) {
  return (
    <div
      className="absolute top-10 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2
                 bg-blue-600 text-white px-4 py-2 rounded-lg shadow-lg text-sm font-medium"
      data-testid="placement-mode-indicator"
    >
      <span className="inline-block w-2 h-2 bg-white rounded-full animate-pulse" />
      Click on canvas to place <strong>{displayName}</strong>
      <button
        onClick={onCancel}
        className="ml-2 px-2 py-0.5 bg-blue-500 hover:bg-blue-400 rounded text-xs cursor-pointer"
        data-testid="placement-mode-cancel"
      >
        Esc to cancel
      </button>
    </div>
  );
}
```

**Step 4: Verify build compiles**

Run: `cd .worktrees/p07-decouple-canvas && npx tsc --noEmit 2>&1 | head -30`

**Step 5: Commit Tasks 10 + 11 together**

```
git add src/components/canvas/Canvas.tsx \
  src/components/canvas/CanvasRenderer.tsx \
  src/components/canvas/DropZoneOverlay.tsx \
  src/components/canvas/ConnectModeIndicator.tsx \
  src/components/canvas/PlacementModeIndicator.tsx \
  src/components/canvas/hooks/
git commit -m "refactor(canvas): rewrite Canvas.tsx as slim orchestrator

Split 1,531-line Canvas.tsx into:
- 8 focused hooks (context menu, viewport, renderer, interactions,
  drag-drop, navigation, keyboard, connect mode)
- CanvasRenderer component (sole ReactFlow mount point)
- 3 small indicator components
- ~120 line orchestrator"
```

---

## Task 12: Fix compilation errors and type issues

After the rewrite, there will likely be type mismatches or missing exports. This task is for fixing them.

**Step 1: Run TypeScript check**

Run: `cd .worktrees/p07-decouple-canvas && npx tsc --noEmit 2>&1`

**Step 2: Fix all errors**

Common expected issues:
- `CanvasPerformanceReturn` type may need to be exported from `useCanvasPerformance`
- `connectStep` type may be `string | null` vs expected union — adjust `ConnectModeIndicator` props
- `placementInfo` shape might need checking for `displayName` vs `nodeType`

**Step 3: Run tests**

Run: `bash scripts/test.sh`

Expected: Same 264 files pass as baseline (no new failures).

**Step 4: Run build**

Run: `cd .worktrees/p07-decouple-canvas && npx vite build 2>&1 | tail -10`

**Step 5: Commit fixes**

```
git add -u
git commit -m "fix: resolve type errors from canvas split"
```

---

## Task 13: Verify acceptance criteria

**Step 1: Line count check**

Run: `wc -l src/components/canvas/Canvas.tsx`
Expected: Under 120 lines.

**Step 2: Import isolation check**

Run: `grep -r "from '@xyflow/react'" src/components/canvas/ --include='*.tsx' --include='*.ts' | grep -v 'node_modules'`
Expected: Only `CanvasRenderer.tsx` and hook files import @xyflow/react types. No `ReactFlow` component import outside CanvasRenderer.

**Step 3: Full test suite**

Run: `bash scripts/test.sh`
Expected: Same pass rate as baseline.

**Step 4: Build**

Run: `cd .worktrees/p07-decouple-canvas && npx vite build`
Expected: Success.

**Step 5: Commit if any final adjustments needed**

---

## Summary

| Task | What | New File(s) |
|------|------|-------------|
| 1 | useCanvasContextMenu | `hooks/useCanvasContextMenu.ts` |
| 2 | useCanvasViewport | `hooks/useCanvasViewport.ts` |
| 3 | useCanvasRenderer | `hooks/useCanvasRenderer.ts` |
| 4 | useCanvasInteractions | `hooks/useCanvasInteractions.ts` |
| 5 | useCanvasDragDrop | `hooks/useCanvasDragDrop.ts` |
| 6 | useCanvasNavigation | `hooks/useCanvasNavigation.ts` |
| 7 | useCanvasKeyboard | `hooks/useCanvasKeyboard.ts` |
| 8 | useCanvasConnectMode | `hooks/useCanvasConnectMode.ts` |
| 9 | CanvasRenderer | `CanvasRenderer.tsx` |
| 10 | Rewrite Canvas.tsx | Modify `Canvas.tsx` |
| 11 | Small indicator components | `DropZoneOverlay.tsx`, `ConnectModeIndicator.tsx`, `PlacementModeIndicator.tsx` |
| 12 | Fix compilation | Various fixes |
| 13 | Verify acceptance criteria | No files |
