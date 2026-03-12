import { useState, useCallback } from 'react';
import { ReactFlow, Background, BackgroundVariant, Controls, useReactFlow } from "@xyflow/react";
import type { Node as RFNode, Edge as RFEdge } from "@xyflow/react";
import { useCanvasRenderer } from "./hooks/useCanvasRenderer";
import { useCanvasKeyboard } from "./hooks/useCanvasKeyboard";
import { useCanvasInteractions } from "./hooks/useCanvasInteractions";
import { useCanvasNavigation } from "./hooks/useCanvasNavigation";
import { NodeRenderer } from "../nodes/NodeRenderer";
import { EdgeRenderer } from "../edges/EdgeRenderer";
import { Breadcrumb } from "../shared/Breadcrumb";
import { ContextMenu } from "../shared/ContextMenu";
import type { ContextMenuState } from "../shared/ContextMenu";
import type { CanvasNodeData, CanvasEdgeData } from "./types";
import { useCanvasStore } from "@/store/canvasStore";
import { useGraphStore } from "@/store/graphStore";
import { useNavigationStore } from "@/store/navigationStore";
import { useUiStore } from "@/store/uiStore";

const nodeTypes = { archNode: NodeRenderer };
const edgeTypes = { archEdge: EdgeRenderer };

export function Canvas() {
  const { nodes, edges } = useCanvasRenderer();
  useCanvasKeyboard();
  useCanvasNavigation();
  const {
    onNodesChange, onNodeClick, onEdgeClick,
    onConnect, onConnectStart, onConnectEnd, onPaneClick,
  } = useCanvasInteractions();

  const reactFlow = useReactFlow();

  // -------------------------------------------------------------------------
  // Context menu state
  // -------------------------------------------------------------------------
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);

  const closeMenu = useCallback(() => setContextMenu(null), []);

  const onPaneContextMenu = useCallback((e: React.MouseEvent | MouseEvent) => {
    e.preventDefault();
    setContextMenu({ target: { kind: 'canvas' }, x: e.clientX, y: e.clientY });
  }, []);

  const onNodeContextMenu = useCallback(
    (e: React.MouseEvent, node: RFNode<CanvasNodeData>) => {
      e.preventDefault();
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
    const { rightPanelOpen } = useUiStore.getState();
    if (!rightPanelOpen) {
      useUiStore.getState().toggleRightPanel();
    }
  }, []);

  const handleNodeAddNote = useCallback((nodeId: string) => {
    // Select the node and open the right panel — Notes tab switching is a
    // future enhancement (the panel defaults to the Properties tab for now).
    useCanvasStore.getState().selectNodes([nodeId]);
    const { rightPanelOpen } = useUiStore.getState();
    if (!rightPanelOpen) {
      useUiStore.getState().toggleRightPanel();
    }
  }, []);

  const handleNodeDelete = useCallback(() => {
    useCanvasStore.getState().deleteSelection();
  }, []);

  const handleRefNodeDiveIn = useCallback((nodeId: string) => {
    useNavigationStore.getState().diveIn(nodeId);
    reactFlow.fitView({ duration: 300 });
  }, [reactFlow]);

  const handleEdgeEdit = useCallback((edgeData: CanvasEdgeData) => {
    const { from, to } = edgeData.edge;
    useCanvasStore.getState().selectEdge(from.node, to.node);
    const { rightPanelOpen } = useUiStore.getState();
    if (!rightPanelOpen) {
      useUiStore.getState().toggleRightPanel();
    }
  }, []);

  const handleEdgeDelete = useCallback((edgeData: CanvasEdgeData) => {
    const canvasId = useNavigationStore.getState().currentCanvasId;
    useGraphStore.getState().removeEdge(canvasId, edgeData.edge.from.node, edgeData.edge.to.node);
  }, []);

  return (
    <div className="relative h-full w-full">
      <Breadcrumb />
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        proOptions={{ hideAttribution: true }}
        onNodesChange={onNodesChange}
        onNodeClick={onNodeClick}
        onEdgeClick={onEdgeClick}
        onConnect={onConnect}
        onConnectStart={onConnectStart}
        onConnectEnd={onConnectEnd}
        onPaneClick={onPaneClick}
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
    </div>
  );
}
