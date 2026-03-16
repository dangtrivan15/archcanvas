import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { Node as RFNode } from '@xyflow/react';
import type { CanvasNodeData } from '../canvas/types';

type GhostNodeProps = NodeProps<RFNode<CanvasNodeData>>;

export function GhostNodeRenderer({ data }: GhostNodeProps) {
  const displayName = data.node.displayName ?? data.node.id;

  return (
    <>
      <Handle type="target" position={Position.Left} />
      <div className="ghost-node">
        {displayName}
      </div>
      <Handle type="source" position={Position.Right} />
    </>
  );
}
