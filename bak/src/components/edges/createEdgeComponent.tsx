/**
 * createEdgeComponent - Factory function for creating themed edge components.
 *
 * Consolidates the duplicated logic across AsyncEdge, SyncEdge, and DataFlowEdge.
 * All three edges shared the same structure:
 * - Same imports and context usage (useCanvasPerformanceContext)
 * - Same path computation (getStraightPath)
 * - Same LOD-mode simplification pattern
 * - Same reduced-motion transition handling
 *
 * The only differences between edges are:
 * - Stroke color (normal and selected states)
 * - Stroke width (normal and selected states)
 * - Dash pattern (strokeDasharray)
 * - Animation (only AsyncEdge has animation)
 */

import { memo } from 'react';
import { BaseEdge, getStraightPath, type EdgeProps } from '@xyflow/react';
import { useCanvasPerformanceContext } from '@/contexts/CanvasPerformanceContext';

export interface EdgeStyleConfig {
  /** Display name for debugging */
  displayName: string;
  /** Stroke color in normal state */
  color: string;
  /** Stroke color when selected */
  selectedColor: string;
  /** Stroke width in normal state */
  strokeWidth: number;
  /** Stroke width when selected */
  selectedStrokeWidth: number;
  /** Stroke width in LOD (low detail) mode */
  lodStrokeWidth: number;
  /** Optional stroke dash array (e.g., '8,4' for dashed) */
  strokeDasharray?: string;
  /** Optional CSS animation string */
  animation?: string;
}

/**
 * Creates a memoized React Flow edge component with the given style config.
 */
export function createEdgeComponent(config: EdgeStyleConfig) {
  function EdgeComponent({ sourceX, sourceY, targetX, targetY, id, selected, label }: EdgeProps) {
    const { prefersReducedMotion, isLowDetailEdges } = useCanvasPerformanceContext();
    const [edgePath] = getStraightPath({ sourceX, sourceY, targetX, targetY });

    // In low-detail mode, render a simple line without animation or label
    if (isLowDetailEdges) {
      return (
        <BaseEdge
          id={id}
          path={edgePath}
          style={{
            stroke: config.color,
            strokeWidth: config.lodStrokeWidth,
            ...(config.strokeDasharray ? { strokeDasharray: '6,3' } : {}),
          }}
        />
      );
    }

    return (
      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          stroke: selected ? config.selectedColor : config.color,
          strokeWidth: selected ? config.selectedStrokeWidth : config.strokeWidth,
          ...(config.strokeDasharray ? { strokeDasharray: config.strokeDasharray } : {}),
          ...(config.animation
            ? { animation: prefersReducedMotion ? 'none' : config.animation }
            : {}),
          transition: prefersReducedMotion ? 'none' : 'stroke-width 150ms ease, stroke 150ms ease',
        }}
        label={label}
      />
    );
  }

  EdgeComponent.displayName = config.displayName;
  return memo(EdgeComponent);
}
