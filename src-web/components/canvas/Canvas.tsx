import { useState, useCallback, useEffect, useRef } from 'react';
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
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import type { CanvasNodeData, CanvasEdgeData } from "./types";
import { useCanvasStore } from "@/store/canvasStore";
import { useGraphStore } from "@/store/graphStore";
import { useNavigationStore } from "@/store/navigationStore";
import { useUiStore } from "@/store/uiStore";
import { useToolStore } from "@/store/toolStore";
import { useFileStore } from "@/store/fileStore";
import { computeLayout } from "@/core/layout/elk";
import { setReactFlowInstance } from '@/lib/reactFlowRef';
import { extractInheritedEdges } from "./inheritedEdges";
import { GHOST_NODE_PREFIX } from "./hooks/useCanvasRenderer";
import { exportCanvas } from "@/core/export/orchestrator";
import type { ExportFormat } from "@/core/export/orchestrator";

const nodeTypes = { archNode: NodeRenderer, archGhostNode: GhostNodeRenderer };
const edgeTypes = { archEdge: EdgeRenderer };

export function Canvas() {
  const { nodes: storeNodes, edges } = useCanvasRenderer();
  const { diveIn, goUp } = useCanvasNavigation();
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

  const onNodesChange = useCallback((changes: NodeChange<RFNode<CanvasNodeData>>[]) => {
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
  // Delete confirmation state
  // -------------------------------------------------------------------------
  const [pendingDelete, setPendingDelete] = useState<{ label: string; action: () => void } | null>(null);

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

  useEffect(() => {
    setReactFlowInstance(reactFlow);
  }, [reactFlow]);

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

    // Fit view after layout settles
    requestAnimationFrame(() => reactFlow.fitView({ duration: 400, padding: 0.15 }));
  }, [reactFlow]);

  useCanvasKeyboard({ onOpenPalette: openPalette, onAutoLayout: handleAutoLayout, onGoUp: goUp });

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
    const handleExport = (e: Event) => {
      const detail = (e as CustomEvent<{ format?: ExportFormat }>).detail;
      const format = detail?.format ?? 'png';
      void exportCanvas({ format });
    };

    window.addEventListener('archcanvas:fit-view', handleFitView);
    window.addEventListener('archcanvas:auto-layout', handleLayout);
    window.addEventListener('archcanvas:open-palette', handleOpenPalette);
    window.addEventListener('archcanvas:export', handleExport);
    return () => {
      window.removeEventListener('archcanvas:fit-view', handleFitView);
      window.removeEventListener('archcanvas:auto-layout', handleLayout);
      window.removeEventListener('archcanvas:open-palette', handleOpenPalette);
      window.removeEventListener('archcanvas:export', handleExport);
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
    const canvasId = useNavigationStore.getState().currentCanvasId;
    const canvas = useFileStore.getState().getCanvas(canvasId);
    const node = canvas?.data.nodes?.find((n) => n.id === nodeId);
    const label = (node && 'displayName' in node ? node.displayName : node?.id) ?? 'this node';
    setPendingDelete({
      label,
      action: () => {
        useCanvasStore.getState().selectNodes([nodeId]);
        useCanvasStore.getState().deleteSelection(canvasId);
      },
    });
  }, []);

  const handleRefNodeDiveIn = useCallback((nodeId: string) => {
    diveIn(nodeId);
  }, [diveIn]);

  const handleRefNodeFitContent = useCallback((nodeId: string) => {
    const canvasId = useNavigationStore.getState().currentCanvasId;
    const canvas = useFileStore.getState().getCanvas(canvasId);
    const node = canvas?.data.nodes?.find((n) => n.id === nodeId);
    if (!node?.position) return;
    useGraphStore.getState().updateNodePosition(canvasId, nodeId, {
      ...node.position,
      autoSize: true,
      width: undefined,
      height: undefined,
    });
  }, []);

  const handleCanvasExportPng = useCallback(() => {
    void exportCanvas({ format: 'png' });
  }, []);

  const handleEdgeEdit = useCallback((edgeData: CanvasEdgeData) => {
    const { from, to } = edgeData.edge;
    useCanvasStore.getState().selectEdge(from.node, to.node);
    useUiStore.getState().openRightPanel();
  }, []);

  const handleEdgeDelete = useCallback((edgeData: CanvasEdgeData) => {
    const canvasId = useNavigationStore.getState().currentCanvasId;
    const label = `${edgeData.edge.from.node} → ${edgeData.edge.to.node}`;
    setPendingDelete({
      label,
      action: () => {
        useGraphStore.getState().removeEdge(canvasId, edgeData.edge.from.node, edgeData.edge.to.node);
      },
    });
  }, []);

  return (
    <div
      data-testid="main-canvas"
      className="relative h-full w-full"
    >
      <Breadcrumb />
      <ReactFlow
        nodes={rfNodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        proOptions={{ hideAttribution: true }}
        panOnDrag={toolMode === 'pan' ? true : [1, 2]}
        panOnScroll
        zoomOnScroll={false}
        zoomOnPinch
        nodesDraggable={toolMode === 'select'}
        nodesConnectable={toolMode === 'select'}
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
          onCanvasExportPng={handleCanvasExportPng}
          onNodeEditProperties={handleNodeEditProperties}
          onNodeAddNote={handleNodeAddNote}
          onNodeDelete={handleNodeDelete}
          onRefNodeDiveIn={handleRefNodeDiveIn}
          onRefNodeFitContent={handleRefNodeFitContent}
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

      <AlertDialog open={!!pendingDelete} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Delete</AlertDialogTitle>
            <AlertDialogDescription>
              Delete <strong>{pendingDelete?.label}</strong>? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                pendingDelete?.action();
                setPendingDelete(null);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
