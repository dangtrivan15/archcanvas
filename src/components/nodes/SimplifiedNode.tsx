/**
 * SimplifiedNode - Low-detail node for performance at low zoom levels.
 *
 * When the canvas is zoomed out far enough that node text is unreadable,
 * this renders a simple colored rectangle with handles instead of the
 * full node component. This dramatically reduces DOM complexity and
 * improves pan/zoom performance on constrained devices like iPads.
 */

import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { CanvasNodeData } from '@/types/canvas';
import { getEffectiveNodeColor } from '@/utils/nodeColors';

function SimplifiedNodeComponent({ data, selected }: NodeProps) {
  const nodeData = data as unknown as CanvasNodeData;
  const effectiveColor = getEffectiveNodeColor(nodeData.color, nodeData.nodedefType);

  return (
    <div
      style={{
        width: 180,
        height: 60,
        borderRadius: 6,
        border: `2px solid ${selected ? effectiveColor : `${effectiveColor}80`}`,
        backgroundColor: `${effectiveColor}25`,
        boxShadow: selected ? `0 0 8px ${effectiveColor}60` : 'none',
        transition: 'none', // No transitions in LOD mode for performance
      }}
      data-testid={`node-simplified-${nodeData.archNodeId}`}
      data-node-id={nodeData.archNodeId}
      data-node-type={nodeData.nodedefType}
      data-node-name={nodeData.displayName}
    >
      {/* Minimal color accent strip at top */}
      <div
        style={{
          height: 3,
          borderRadius: '4px 4px 0 0',
          background: effectiveColor,
        }}
      />
      {/* Single label - just the display name, truncated */}
      <div
        style={{
          padding: '4px 8px',
          fontSize: 10,
          fontWeight: 600,
          color: 'hsl(var(--text))',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {nodeData.displayName}
      </div>
      {/* Simplified handles - just in/out */}
      <Handle
        type="target"
        position={Position.Left}
        id="in"
        style={{ width: 6, height: 6, background: 'hsl(var(--foam))', border: 'none' }}
      />
      <Handle
        type="source"
        position={Position.Right}
        id="out"
        style={{ width: 6, height: 6, background: 'hsl(var(--pine))', border: 'none' }}
      />
    </div>
  );
}

export const SimplifiedNode = memo(SimplifiedNodeComponent);
