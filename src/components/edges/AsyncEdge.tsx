/**
 * AsyncEdge - dashed/animated line edge for asynchronous connections.
 * Uses CSS animation to create a flowing dash effect along the edge path.
 * Uses theme CSS variables for stroke colors.
 * Respects prefers-reduced-motion by disabling animation.
 * Simplifies rendering at low zoom (LOD mode).
 */

import { memo } from 'react';
import { BaseEdge, getStraightPath, type EdgeProps } from '@xyflow/react';
import { useCanvasPerformanceContext } from '@/contexts/CanvasPerformanceContext';

// Inject keyframe animation once
const STYLE_ID = 'async-edge-animation';
if (typeof document !== 'undefined' && !document.getElementById(STYLE_ID)) {
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    @keyframes async-edge-flow {
      to {
        stroke-dashoffset: -24;
      }
    }
  `;
  document.head.appendChild(style);
}

function AsyncEdgeComponent({
  sourceX, sourceY, targetX, targetY, id, selected, label,
}: EdgeProps) {
  const { prefersReducedMotion, isLowDetailEdges } = useCanvasPerformanceContext();
  const [edgePath] = getStraightPath({ sourceX, sourceY, targetX, targetY });

  // In low-detail mode, render a simple dashed line without animation or label
  if (isLowDetailEdges) {
    return (
      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          stroke: 'hsl(var(--gold))',
          strokeWidth: 1.5,
          strokeDasharray: '6,3',
        }}
      />
    );
  }

  return (
    <BaseEdge
      id={id}
      path={edgePath}
      style={{
        stroke: selected ? 'hsl(var(--iris))' : 'hsl(var(--gold))',
        strokeWidth: selected ? 2.5 : 2,
        strokeDasharray: '8,4',
        animation: prefersReducedMotion ? 'none' : 'async-edge-flow 0.6s linear infinite',
        transition: prefersReducedMotion ? 'none' : 'stroke-width 150ms ease, stroke 150ms ease',
      }}
      label={label}
    />
  );
}

export const AsyncEdge = memo(AsyncEdgeComponent);
