import { getSmoothStepPath, EdgeLabelRenderer, type EdgeProps } from '@xyflow/react';
import type { Edge as RFEdge } from '@xyflow/react';
import type { CanvasEdgeData } from '../canvas/types';
import type { EdgeRoute } from '@/core/layout/elk';
import { useCanvasStore } from '../../store/canvasStore';
import './EdgeRenderer.css';

type EdgeRendererProps = EdgeProps<RFEdge<CanvasEdgeData>>;

const BEND_RADIUS = 8;

/**
 * Build an SVG path from an array of points with rounded corners at bends.
 */
function buildRoutePath(points: EdgeRoute['points']): string {
  if (points.length < 2) return '';
  const parts: string[] = [`M ${points[0].x} ${points[0].y}`];

  for (let i = 1; i < points.length - 1; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const next = points[i + 1];

    // Direction vectors from curr to prev and curr to next
    const dxIn = curr.x - prev.x;
    const dyIn = curr.y - prev.y;
    const dxOut = next.x - curr.x;
    const dyOut = next.y - curr.y;

    const lenIn = Math.sqrt(dxIn * dxIn + dyIn * dyIn);
    const lenOut = Math.sqrt(dxOut * dxOut + dyOut * dyOut);

    // Clamp radius to half the shortest segment
    const r = Math.min(BEND_RADIUS, lenIn / 2, lenOut / 2);

    // Points where the curve starts and ends
    const startX = curr.x - (dxIn / lenIn) * r;
    const startY = curr.y - (dyIn / lenIn) * r;
    const endX = curr.x + (dxOut / lenOut) * r;
    const endY = curr.y + (dyOut / lenOut) * r;

    parts.push(`L ${startX} ${startY}`);
    parts.push(`Q ${curr.x} ${curr.y} ${endX} ${endY}`);
  }

  const last = points[points.length - 1];
  parts.push(`L ${last.x} ${last.y}`);
  return parts.join(' ');
}

/**
 * Compute the label position at the midpoint of the total path length.
 */
function routeLabelPosition(points: EdgeRoute['points']): { x: number; y: number } {
  if (points.length < 2) return points[0] ?? { x: 0, y: 0 };

  // Calculate total length
  let totalLength = 0;
  const segLengths: number[] = [];
  for (let i = 1; i < points.length; i++) {
    const dx = points[i].x - points[i - 1].x;
    const dy = points[i].y - points[i - 1].y;
    const len = Math.sqrt(dx * dx + dy * dy);
    segLengths.push(len);
    totalLength += len;
  }

  // Walk to the midpoint
  let remaining = totalLength / 2;
  for (let i = 0; i < segLengths.length; i++) {
    if (remaining <= segLengths[i]) {
      const t = remaining / segLengths[i];
      return {
        x: points[i].x + (points[i + 1].x - points[i].x) * t,
        y: points[i].y + (points[i + 1].y - points[i].y) * t,
      };
    }
    remaining -= segLengths[i];
  }

  return points[points.length - 1];
}

export function EdgeRenderer({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  markerEnd,
}: EdgeRendererProps) {
  let edgePath: string;
  let labelX: number;
  let labelY: number;

  const route = data?.route;

  if (route && route.points.length >= 2) {
    // ELK-computed obstacle-aware path.
    // ELK's startPoint/endPoint are at the node border, not the handle.
    // We use ReactFlow's handle coords as start/end and ELK's bendPoints
    // as channel waypoints, building orthogonal connectors between them.
    const elkBends = route.points.slice(1, -1);
    const adjustedPoints: Array<{ x: number; y: number }> = [
      { x: sourceX, y: sourceY },
    ];

    if (elkBends.length >= 2) {
      // Horizontal exit from source handle → first bend's x channel
      adjustedPoints.push({ x: elkBends[0].x, y: sourceY });
      // Middle bends (obstacle avoidance) — keep as-is
      for (let i = 1; i < elkBends.length - 1; i++) {
        adjustedPoints.push(elkBends[i]);
      }
      // Horizontal entry to target handle from last bend's x channel
      adjustedPoints.push({ x: elkBends[elkBends.length - 1].x, y: targetY });
    } else {
      // 0 or 1 bend points: simple step path through midpoint/bend x
      const midX = elkBends.length === 1
        ? elkBends[0].x
        : (sourceX + targetX) / 2;
      adjustedPoints.push({ x: midX, y: sourceY });
      adjustedPoints.push({ x: midX, y: targetY });
    }

    adjustedPoints.push({ x: targetX, y: targetY });

    edgePath = buildRoutePath(adjustedPoints);
    const labelPos = routeLabelPosition(adjustedPoints);
    labelX = labelPos.x;
    labelY = labelPos.y;
  } else {
    // Fallback: client-side orthogonal path (no obstacle awareness)
    [edgePath, labelX, labelY] = getSmoothStepPath({
      sourceX,
      sourceY,
      targetX,
      targetY,
      sourcePosition,
      targetPosition,
      borderRadius: BEND_RADIUS,
    });
  }

  const styleCategory = data?.styleCategory ?? 'default';
  const edge = data?.edge;
  const isInherited = data?.inherited === true;
  const highlightedEdgeIds = useCanvasStore((s) => s.highlightedEdgeIds);
  const isHighlighted = highlightedEdgeIds.includes(id);

  const classNames = [
    'react-flow__edge-path',
    `edge-${styleCategory}`,
    isInherited ? 'edge-inherited' : '',
    isHighlighted ? 'edge-highlighted' : '',
  ].filter(Boolean).join(' ');

  return (
    <>
      <path
        id={id}
        className={classNames}
        d={edgePath}
        markerEnd={isInherited ? undefined : markerEnd}
      />
      {edge?.label && (
        <EdgeLabelRenderer>
          <div
            className="edge-label nodrag nopan"
            style={{
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              position: 'absolute',
              pointerEvents: 'all',
            }}
          >
            {edge.label}
            {edge.entities && edge.entities.length > 0 && (
              <div className="entity-pills">
                {edge.entities.map((e) => (
                  <span key={e} className="entity-pill">
                    {e}
                  </span>
                ))}
              </div>
            )}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}
