/**
 * SyncEdge - solid line edge for synchronous connections.
 * Uses theme CSS variables for stroke colors.
 * Supports hover thickening on pointer (trackpad/mouse) devices.
 * Simplifies rendering at low zoom (LOD mode) and respects reduced motion.
 */

import { memo } from 'react';
import { BaseEdge, getStraightPath, type EdgeProps } from '@xyflow/react';
import { useCanvasPerformanceContext } from '@/contexts/CanvasPerformanceContext';

function SyncEdgeComponent({
  sourceX, sourceY, targetX, targetY, id, selected, label,
}: EdgeProps) {
  const { prefersReducedMotion, isLowDetailEdges } = useCanvasPerformanceContext();
  const [edgePath] = getStraightPath({ sourceX, sourceY, targetX, targetY });

  // In low-detail mode, render a simple thin line without label
  if (isLowDetailEdges) {
    return (
      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          stroke: 'hsl(var(--muted-foreground))',
          strokeWidth: 1.5,
        }}
      />
    );
  }

  return (
    <BaseEdge
      id={id}
      path={edgePath}
      style={{
        stroke: selected ? 'hsl(var(--iris))' : 'hsl(var(--muted-foreground))',
        strokeWidth: selected ? 2.5 : 2,
        transition: prefersReducedMotion ? 'none' : 'stroke-width 150ms ease, stroke 150ms ease',
      }}
      label={label}
    />
  );
}

export const SyncEdge = memo(SyncEdgeComponent);
