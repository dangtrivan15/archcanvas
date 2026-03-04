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
  const fpsColor = fps >= 50 ? '#4ade80' : fps >= 30 ? '#facc15' : '#ef4444';

  return (
    <div
      className="absolute top-2 right-2 z-50 pointer-events-none select-none"
      data-testid="fps-counter"
      style={{
        fontFamily: 'monospace',
        fontSize: 11,
        lineHeight: 1.4,
        padding: '6px 10px',
        borderRadius: 6,
        backgroundColor: 'hsla(0, 0%, 0%, 0.75)',
        color: '#e5e5e5',
        backdropFilter: 'blur(4px)',
      }}
    >
      <div>
        FPS: <span style={{ color: fpsColor, fontWeight: 700 }}>{fps}</span>
      </div>
      <div>Nodes: {nodeCount}</div>
      <div>Zoom: {(zoom * 100).toFixed(0)}%</div>
      {isLowDetailMode && (
        <div style={{ color: '#60a5fa' }}>LOD: ON</div>
      )}
      {prefersReducedMotion && (
        <div style={{ color: '#c084fc' }}>Reduced Motion</div>
      )}
    </div>
  );
}

export const FpsCounter = memo(FpsCounterComponent);
