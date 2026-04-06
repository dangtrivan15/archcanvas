import { useState } from 'react';
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
  const diffStatus = data?.diffStatus;
  const highlightedEdgeIds = useCanvasStore((s) => s.highlightedEdgeIds);
  const isHighlighted = highlightedEdgeIds.includes(id);

  const [isHovered, setIsHovered] = useState(false);

  const classNames = [
    'react-flow__edge-path',
    `edge-${styleCategory}`,
    isInherited ? 'edge-inherited' : '',
    isSelected ? 'edge-selected' : '',
    isHighlighted ? 'edge-highlighted' : '',
    isHovered && !isInherited ? 'edge-hovered' : '',
    diffStatus ? `edge-diff-${diffStatus}` : '',
  ].filter(Boolean).join(' ');

  const showHalo = isSelected || isHighlighted;

  const labelClassNames = [
    'edge-label',
    'nodrag',
    'nopan',
    isSelected ? 'edge-label--selected' : '',
    isHighlighted ? 'edge-label--highlighted' : '',
  ].filter(Boolean).join(' ');

  return (
    <>
      {/* Selection / highlight halo — wider semi-transparent path behind the edge */}
      {showHalo && (
        <path
          className="edge-halo"
          d={edgePath}
        />
      )}

      {/* Invisible wider interaction zone for hover detection */}
      {!isInherited && (
        <path
          className="edge-interaction-zone"
          d={edgePath}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        />
      )}

      <path
        id={id}
        className={classNames}
        d={edgePath}
        markerEnd={isInherited ? undefined : markerEnd}
      />
      {edge?.label && (
        <EdgeLabelRenderer>
          <div
            className={labelClassNames}
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
