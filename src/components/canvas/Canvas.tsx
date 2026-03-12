import { ReactFlow, Background, BackgroundVariant, Controls } from "@xyflow/react";
import { useCanvasRenderer } from "./hooks/useCanvasRenderer";
import { useCanvasKeyboard } from "./hooks/useCanvasKeyboard";
import { useCanvasInteractions } from "./hooks/useCanvasInteractions";

export function Canvas() {
  const { nodes, edges } = useCanvasRenderer();
  useCanvasKeyboard();
  const { onNodesChange, onNodeClick, onEdgeClick, onConnect, onPaneClick } =
    useCanvasInteractions();

  return (
    <div className="h-full w-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        fitView
        proOptions={{ hideAttribution: true }}
        onNodesChange={onNodesChange}
        onNodeClick={onNodeClick}
        onEdgeClick={onEdgeClick}
        onConnect={onConnect}
        onPaneClick={onPaneClick}
      >
        <Background variant={BackgroundVariant.Dots} gap={16} size={1} />
        <Controls />
      </ReactFlow>
    </div>
  );
}
