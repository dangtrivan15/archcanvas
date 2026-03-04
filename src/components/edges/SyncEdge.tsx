/**
 * SyncEdge - solid line edge for synchronous connections.
 * Uses theme CSS variables for stroke colors.
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
        stroke: selected ? 'hsl(var(--iris))' : 'hsl(var(--muted-foreground))',
        strokeWidth: selected ? 2.5 : 2,
      }}
      label={label}
    />
  );
}

export const SyncEdge = memo(SyncEdgeComponent);
