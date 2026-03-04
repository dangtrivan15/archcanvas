/**
 * DataFlowEdge - thick line edge for data flow connections.
 * Uses theme CSS variables for stroke colors.
 * Simplifies rendering at low zoom (LOD mode) and respects reduced motion.
 */

import { memo } from 'react';
import { BaseEdge, getStraightPath, type EdgeProps } from '@xyflow/react';
import { useCanvasPerformanceContext } from '@/contexts/CanvasPerformanceContext';

function DataFlowEdgeComponent({
  sourceX, sourceY, targetX, targetY, id, selected, label,
}: EdgeProps) {
  const { prefersReducedMotion, isLowDetailEdges } = useCanvasPerformanceContext();
  const [edgePath] = getStraightPath({ sourceX, sourceY, targetX, targetY });

  // In low-detail mode, render a simple thinner line without label
  if (isLowDetailEdges) {
    return (
      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          stroke: 'hsl(var(--foam))',
          strokeWidth: 2,
        }}
      />
    );
  }

  return (
    <BaseEdge
      id={id}
      path={edgePath}
      style={{
        stroke: selected ? 'hsl(var(--iris))' : 'hsl(var(--foam))',
        strokeWidth: selected ? 4 : 3,
        transition: prefersReducedMotion ? 'none' : 'stroke-width 150ms ease, stroke 150ms ease',
      }}
      label={label}
    />
  );
}

export const DataFlowEdge = memo(DataFlowEdgeComponent);
