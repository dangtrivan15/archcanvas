/**
 * DataFlowEdge - thick line edge for data flow connections.
 */

import { memo } from 'react';
import { BaseEdge, getStraightPath, type EdgeProps } from '@xyflow/react';

function DataFlowEdgeComponent({
  sourceX, sourceY, targetX, targetY, id, selected, label,
}: EdgeProps) {
  const [edgePath] = getStraightPath({ sourceX, sourceY, targetX, targetY });

  return (
    <BaseEdge
      id={id}
      path={edgePath}
      style={{
        stroke: selected ? '#3b82f6' : '#8b5cf6',
        strokeWidth: selected ? 4 : 3,
      }}
      label={label}
    />
  );
}

export const DataFlowEdge = memo(DataFlowEdgeComponent);
