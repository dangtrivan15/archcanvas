/**
 * SyncEdge - solid line edge for synchronous connections.
 */

import { memo } from 'react';
import { BaseEdge, getStraightPath, type EdgeProps } from '@xyflow/react';

function SyncEdgeComponent({
  sourceX, sourceY, targetX, targetY, id, selected, label,
}: EdgeProps) {
  const [edgePath] = getStraightPath({ sourceX, sourceY, targetX, targetY });

  return (
    <BaseEdge
      id={id}
      path={edgePath}
      style={{
        stroke: selected ? '#3b82f6' : '#6b7280',
        strokeWidth: selected ? 2.5 : 2,
      }}
      label={label}
    />
  );
}

export const SyncEdge = memo(SyncEdgeComponent);
