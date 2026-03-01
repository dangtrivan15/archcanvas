/**
 * AsyncEdge - dashed/animated line edge for asynchronous connections.
 * Uses CSS animation to create a flowing dash effect along the edge path.
 */

import { memo } from 'react';
import { BaseEdge, getStraightPath, type EdgeProps } from '@xyflow/react';

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
  const [edgePath] = getStraightPath({ sourceX, sourceY, targetX, targetY });

  return (
    <BaseEdge
      id={id}
      path={edgePath}
      style={{
        stroke: selected ? '#3b82f6' : '#f59e0b',
        strokeWidth: selected ? 2.5 : 2,
        strokeDasharray: '8,4',
        animation: 'async-edge-flow 0.6s linear infinite',
      }}
      label={label}
    />
  );
}

export const AsyncEdge = memo(AsyncEdgeComponent);
