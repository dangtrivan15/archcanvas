/**
 * FpsCounter - Dev-mode FPS counter overlay for the canvas.
 *
 * Shows frames-per-second, node count, and current zoom level
 * to help profile canvas performance on constrained devices.
 * Only visible when explicitly enabled via the performance hook.
 */

import { memo } from 'react';

interface FpsCounterProps {
  fps: number;
  nodeCount: number;
  zoom: number;
  isLowDetailMode: boolean;
  prefersReducedMotion: boolean;
}

function FpsCounterComponent({
  fps,
  nodeCount,
  zoom,
  isLowDetailMode,
  prefersReducedMotion,
}: FpsCounterProps) {
  const fpsColor = fps >= 50 ? 'text-green-400' : fps >= 30 ? 'text-yellow-300' : 'text-red-500';

  return (
    <div
      className="absolute top-2 right-2 z-50 pointer-events-none select-none font-mono text-[11px] leading-snug px-2.5 py-1.5 rounded-md bg-black/75 text-neutral-200 backdrop-blur-sm"
      data-testid="fps-counter"
    >
      <div>
        FPS: <span className={`${fpsColor} font-bold`}>{fps}</span>
      </div>
      <div>Nodes: {nodeCount}</div>
      <div>Zoom: {(zoom * 100).toFixed(0)}%</div>
      {isLowDetailMode && <div className="text-foam">LOD: ON</div>}
      {prefersReducedMotion && <div className="text-iris">Reduced Motion</div>}
    </div>
  );
}

export const FpsCounter = memo(FpsCounterComponent);
