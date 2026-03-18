import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { ReactFlow, Background, BackgroundVariant, Controls, useReactFlow, applyNodeChanges } from "@xyflow/react";
import type { Node as RFNode, Edge as RFEdge, NodeChange } from "@xyflow/react";
import { useCanvasRenderer } from "./hooks/useCanvasRenderer";
import { useCanvasKeyboard } from "./hooks/useCanvasKeyboard";
import { useCanvasInteractions } from "./hooks/useCanvasInteractions";
import { useCanvasNavigation } from "./hooks/useCanvasNavigation";
import { NodeRenderer } from "../nodes/NodeRenderer";
import { GhostNodeRenderer } from "../nodes/GhostNodeRenderer";
import { EdgeRenderer } from "../edges/EdgeRenderer";
import { Breadcrumb } from "../shared/Breadcrumb";
import { ContextMenu } from "../shared/ContextMenu";
import type { ContextMenuState } from "../shared/ContextMenu";
import { CommandPalette } from "../shared/CommandPalette";
import { CreateSubsystemDialog } from "@/components/CreateSubsystemDialog";
import type { CanvasNodeData, CanvasEdgeData } from "./types";
import { useCanvasStore } from "@/store/canvasStore";
import { useGraphStore } from "@/store/graphStore";
import { useNavigationStore } from "@/store/navigationStore";
import { useUiStore } from "@/store/uiStore";
import { useToolStore } from "@/store/toolStore";
import { useFileStore } from "@/store/fileStore";
import { computeLayout } from "@/core/layout/elk";
import type { EdgeRoute } from "@/core/layout/elk";
import { extractInheritedEdges } from "./inheritedEdges";
import { GHOST_NODE_PREFIX } from "./hooks/useCanvasRenderer";

const nodeTypes = { archNode: NodeRenderer, archGhostNode: GhostNodeRenderer };
const edgeTypes = { archEdge: EdgeRenderer };

export function Canvas() {
  const { nodes: storeNodes, edges } = useCanvasRenderer();
  const { diveIn } = useCanvasNavigation();
  const toolMode = useToolStore((s) => s.mode);

  // ---------------------------------------------------------------------------
  // Local node state for smooth dragging.
  // ReactFlow controlled mode requires ALL changes (including drag positions)
  // to be applied via applyNodeChanges. We sync from the engine store whenever
  // it changes, and apply drag changes locally for smooth visual feedback.
  // ---------------------------------------------------------------------------
  const [rfNodes, setRfNodes] = useState<RFNode<CanvasNodeData>[]>(storeNodes);

  useEffect(() => {
    setRfNodes(storeNodes);
  }, [storeNodes]);

  // ---------------------------------------------------------------------------
  // Transient edge routes from ELK auto-layout.
  // Valid only for current node positions — cleared on drag-start.
  // ---------------------------------------------------------------------------
  const [edgeRoutes, setEdgeRoutes] = useState<Map<string, EdgeRoute>>(new Map());

  const onNodesChange = useCallback((changes: NodeChange<RFNode<CanvasNodeData>>[]) => {
    // Clear ELK edge routes on drag-start — stale during drag
    for (const change of changes) {
      if (change.type === 'position' && change.dragging) {
        setEdgeRoutes(new Map());
        break;
      }
    }

    // Apply ALL changes locally so ReactFlow can render smooth drag movement
    setRfNodes((nds) => applyNodeChanges(changes, nds));

    // Commit final position to the engine only when drag ends (creates undo entry)
    // Skip ghost nodes — they are render-only and never saved
    const canvasId = useNavigationStore.getState().currentCanvasId;
    for (const change of changes) {
      if (change.type === 'position' && change.position && !change.dragging && !change.id.startsWith(GHOST_NODE_PREFIX)) {
        useGraphStore.getState().updateNodePosition(canvasId, change.id, change.position);
      }
    }
  }, []);

  // -------------------------------------------------------------------------
  // Command palette state
  // -------------------------------------------------------------------------
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [paletteInitial, setPaletteInitial] = useState('');
  const [paletteMode, setPaletteMode] = useState<'default' | 'subsystem'>('default');
  const [subsystemType, setSubsystemType] = useState<string | null>(null);
  const openPalette = useCallback((prefix = '') => {
    setPaletteInitial(prefix);
    setPaletteOpen(true);
  }, []);
  const closePalette = useCallback(() => {
    setPaletteOpen(false);
    setPaletteMode('default');
  }, []);

  // -------------------------------------------------------------------------
  // Auto-layout
  // -------------------------------------------------------------------------
  const reactFlow = useReactFlow();

  const handleAutoLayout = useCallback(async () => {
    const navState = useNavigationStore.getState();
    const canvasId = navState.currentCanvasId;
    const loaded = useFileStore.getState().getCanvas(canvasId);
    if (!loaded) return;

    // Build ghost node/edge lists for inherited edges (if in a child canvas)
    const ghostNodes: { id: string }[] = [];
    const ghostEdges: { source: string; target: string }[] = [];

    if (navState.breadcrumb.length > 1 && navState.parentEdges.length > 0) {
      const inherited = extractInheritedEdges(navState.parentEdges, canvasId);
      const seenGhosts = new Set<string>();
      for (const ie of inherited) {
        const ghostId = `${GHOST_NODE_PREFIX}${ie.ghostEndpoint}`;
        if (!seenGhosts.has(ghostId)) {
          ghostNodes.push({ id: ghostId });
          seenGhosts.add(ghostId);
        }
        const source = ie.direction === 'outbound' ? ie.localEndpoint : ghostId;
        const target = ie.direction === 'outbound' ? ghostId : ie.localEndpoint;
        ghostEdges.push({ source, target });
      }
    }

    const result = await computeLayout(loaded.data, { ghostNodes, ghostEdges });
    const gs = useGraphStore.getState();

    for (const [nodeId, position] of result.positions) {
      // Only update real nodes in the store — ghost nodes are render-only
      if (!nodeId.startsWith(GHOST_NODE_PREFIX)) {
        gs.updateNodePosition(canvasId, nodeId, position);
      }
    }

    // Store ELK edge routes for obstacle-aware rendering
    setEdgeRoutes(result.edgeRoutes);

    // Fit view after layout settles
    requestAnimationFrame(() => reactFlow.fitView({ duration: 400, padding: 0.15 }));
  }, [reactFlow]);

  useCanvasKeyboard({ onOpenPalette: openPalette, onAutoLayout: handleAutoLayout });

  // -------------------------------------------------------------------------
  // Wire custom events dispatched by CommandPalette's ActionProvider and
  // LeftToolbar buttons
  // -------------------------------------------------------------------------
  useEffect(() => {
    const handleFitView = () => reactFlow.fitView({ duration: 300 });
    const handleLayout = () => void handleAutoLayout();
    const handleOpenPalette = (e: Event) => {
      const detail = (e as CustomEvent<{ prefix?: string; mode?: string }>).detail;
      setPaletteMode((detail?.mode as 'default' | 'subsystem') ?? 'default');
      openPalette(detail?.prefix ?? '');
    };
    window.addEventListener('archcanvas:fit-view', handleFitView);
    window.addEventListener('archcanvas:auto-layout', handleLayout);
    window.addEventListener('archcanvas:open-palette', handleOpenPalette);
    return () => {
      window.removeEventListener('archcanvas:fit-view', handleFitView);
      window.removeEventListener('archcanvas:auto-layout', handleLayout);
      window.removeEventListener('archcanvas:open-palette', handleOpenPalette);
    };
  }, [reactFlow, handleAutoLayout, openPalette]);

  const {
    onNodeClick, onEdgeClick,
    onConnect, onConnectStart, onConnectEnd, onPaneClick,
  } = useCanvasInteractions();

  const onNodeDoubleClick = useCallback((_: React.MouseEvent, node: RFNode<CanvasNodeData>) => {
    const nodeData = node.data as CanvasNodeData;
    if (nodeData.isRef) {
      diveIn(node.id, node.position);
    }
  }, [diveIn]);

  // -------------------------------------------------------------------------
  // Context menu state
  // -------------------------------------------------------------------------
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);

  // Ref-based flag so the pane click guard can read the current open state
  // without a stale closure (state reads in useCallback would go stale).
  const contextMenuOpenRef = useRef(false);
  useEffect(() => {
    contextMenuOpenRef.current = contextMenu !== null;
  }, [contextMenu]);

  const closeMenu = useCallback(() => setContextMenu(null), []);

  // Guard against ReactFlow's onPaneClick firing through an open context menu
  // overlay and inadvertently clearing the selection. When the menu is open,
  // consume the click by closing the menu instead of passing it to the canvas.
  const onPaneClickGuarded = useCallback(() => {
    if (contextMenuOpenRef.current) {
      setContextMenu(null);
      return;
    }
    onPaneClick();
  }, [onPaneClick]);

  const onPaneContextMenu = useCallback((e: React.MouseEvent | MouseEvent) => {
    e.preventDefault();
    setContextMenu({ target: { kind: 'canvas' }, x: e.clientX, y: e.clientY });
  }, []);

  const onNodeContextMenu = useCallback(
    (e: React.MouseEvent, node: RFNode<CanvasNodeData>) => {
      e.preventDefault();
      useCanvasStore.getState().selectNodes([node.id]);
      const nodeData = node.data as CanvasNodeData;
      const target = nodeData.isRef
        ? { kind: 'refNode' as const, nodeId: node.id, nodeData }
        : { kind: 'inlineNode' as const, nodeId: node.id, nodeData };
      setContextMenu({ target, x: e.clientX, y: e.clientY });
    },
    [],
  );

  const onEdgeContextMenu = useCallback(
    (e: React.MouseEvent, edge: RFEdge<CanvasEdgeData>) => {
      e.preventDefault();
      const edgeData = edge.data as CanvasEdgeData;
      setContextMenu({ target: { kind: 'edge', edgeData }, x: e.clientX, y: e.clientY });
    },
    [],
  );

  // -------------------------------------------------------------------------
  // Menu action handlers
  // -------------------------------------------------------------------------

  const handleCanvasFitView = useCallback(() => {
    reactFlow.fitView({ duration: 300 });
  }, [reactFlow]);

  const handleNodeEditProperties = useCallback((nodeId: string) => {
    useCanvasStore.getState().selectNodes([nodeId]);
    useUiStore.getState().openRightPanel();
  }, []);

  const handleNodeAddNote = useCallback((nodeId: string) => {
    // Select the node and open the right panel — Notes tab switching is a
    // future enhancement (the panel defaults to the Properties tab for now).
    useCanvasStore.getState().selectNodes([nodeId]);
    useUiStore.getState().openRightPanel();
  }, []);

  const handleNodeDelete = useCallback((nodeId: string) => {
    useCanvasStore.getState().selectNodes([nodeId]);
    useCanvasStore.getState().deleteSelection(useNavigationStore.getState().currentCanvasId);
  }, []);

  const handleRefNodeDiveIn = useCallback((nodeId: string) => {
    diveIn(nodeId);
  }, [diveIn]);

  const handleEdgeEdit = useCallback((edgeData: CanvasEdgeData) => {
    const { from, to } = edgeData.edge;
    useCanvasStore.getState().selectEdge(from.node, to.node);
    useUiStore.getState().openRightPanel();
  }, []);

  const handleEdgeDelete = useCallback((edgeData: CanvasEdgeData) => {
    const canvasId = useNavigationStore.getState().currentCanvasId;
    useGraphStore.getState().removeEdge(canvasId, edgeData.edge.from.node, edgeData.edge.to.node);
  }, []);

  const edgesWithRoutes = useMemo((): RFEdge<CanvasEdgeData>[] => {
    if (edgeRoutes.size === 0) return edges;
    return edges.map((edge) => {
      const routeKey = `${edge.source}->${edge.target}`;
      const route = edgeRoutes.get(routeKey);
      if (!route || !edge.data) return edge;
      return { ...edge, data: { ...edge.data, route } as CanvasEdgeData };
    });
  }, [edges, edgeRoutes]);

  return (
    <div className="relative h-full w-full">
      <Breadcrumb />
      <ReactFlow
        nodes={rfNodes}
        edges={edgesWithRoutes}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        proOptions={{ hideAttribution: true }}
        panOnDrag={toolMode === 'pan' ? true : [1, 2]}
        nodesDraggable={toolMode === 'select'}
        nodesConnectable={toolMode === 'connect' || toolMode === 'select'}
        selectionOnDrag={toolMode === 'select'}
        onNodesChange={onNodesChange}
        onNodeClick={onNodeClick}
        onNodeDoubleClick={onNodeDoubleClick}
        onEdgeClick={onEdgeClick}
        onConnect={onConnect}
        onConnectStart={onConnectStart}
        onConnectEnd={onConnectEnd}
        onPaneClick={onPaneClickGuarded}
        onPaneContextMenu={onPaneContextMenu}
        onNodeContextMenu={onNodeContextMenu}
        onEdgeContextMenu={onEdgeContextMenu}
      >
        <Background variant={BackgroundVariant.Dots} gap={16} size={1} />
        <Controls />
      </ReactFlow>

      {contextMenu && (
        <ContextMenu
          menu={contextMenu}
          onClose={closeMenu}
          onCanvasFitView={handleCanvasFitView}
          onNodeEditProperties={handleNodeEditProperties}
          onNodeAddNote={handleNodeAddNote}
          onNodeDelete={handleNodeDelete}
          onRefNodeDiveIn={handleRefNodeDiveIn}
          onEdgeEdit={handleEdgeEdit}
          onEdgeDelete={handleEdgeDelete}
        />
      )}

      <CommandPalette
        open={paletteOpen}
        onClose={closePalette}
        initialInput={paletteInitial}
        mode={paletteMode}
        onSelectSubsystemType={(type) => setSubsystemType(type)}
      />

      {subsystemType && (
        <CreateSubsystemDialog
          open={!!subsystemType}
          type={subsystemType}
          onClose={() => setSubsystemType(null)}
        />
      )}
    </div>
  );
}
