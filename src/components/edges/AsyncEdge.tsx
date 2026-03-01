/**
 * AsyncEdge - dashed/animated line edge for asynchronous connections.
 */

import { memo } from 'react';
import { BaseEdge, getStraightPath, type EdgeProps } from '@xyflow/react';

function AsyncEdgeComponent({
  sourceX, sourceY, targetX, targetY, id, selected, label,
}: EdgeProps) {
  const [edgePath] = getStraightPath({ sourceX, sourceY, targetX, targetY });

  return (
    <BaseEdge
      id={id}
      path={edgePath}
      style={{
        stroke: selected ? '#3b82f6' : '#f59e0b',
        strokeWidth: selected ? 2.5 : 2,
        strokeDasharray: '8,4',
      }}
      label={label}
    />
  );
}

export const AsyncEdge = memo(AsyncEdgeComponent);
