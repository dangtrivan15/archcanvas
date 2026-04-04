import { getBezierPath, EdgeLabelRenderer, type EdgeProps } from '@xyflow/react';
import type { Edge as RFEdge } from '@xyflow/react';
import type { CanvasEdgeData } from '../canvas/types';
import { useCanvasStore } from '../../store/canvasStore';
import './EdgeRenderer.css';

type EdgeRendererProps = EdgeProps<RFEdge<CanvasEdgeData>>;

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
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  });

  const styleCategory = data?.styleCategory ?? 'default';
  const edge = data?.edge;
  const isInherited = data?.inherited === true;
  const isSelected = data?.isSelected === true;
  const highlightedEdgeIds = useCanvasStore((s) => s.highlightedEdgeIds);
  const isHighlighted = highlightedEdgeIds.includes(id);

  const classNames = [
    'react-flow__edge-path',
    `edge-${styleCategory}`,
    isInherited ? 'edge-inherited' : '',
    isHighlighted ? 'edge-highlighted' : '',
    isSelected ? 'edge-selected' : '',
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
