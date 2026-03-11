import { ReactFlow, Background, BackgroundVariant, Controls } from "@xyflow/react";

export function Canvas() {
  return (
    <div className="h-full w-full">
      <ReactFlow
        fitView
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={16} size={1} />
        <Controls />
      </ReactFlow>
    </div>
  );
}
