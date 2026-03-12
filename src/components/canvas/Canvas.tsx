import { ReactFlow, Background, BackgroundVariant, Controls } from "@xyflow/react";
import { useCanvasRenderer } from "./hooks/useCanvasRenderer";
import { useCanvasKeyboard } from "./hooks/useCanvasKeyboard";
import { useCanvasInteractions } from "./hooks/useCanvasInteractions";
import { useCanvasNavigation } from "./hooks/useCanvasNavigation";
import { NodeRenderer } from "../nodes/NodeRenderer";
import { EdgeRenderer } from "../edges/EdgeRenderer";
import { Breadcrumb } from "../shared/Breadcrumb";

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
      >
        <Background variant={BackgroundVariant.Dots} gap={16} size={1} />
        <Controls />
      </ReactFlow>
    </div>
  );
}
