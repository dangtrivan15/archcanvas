import { getBezierPath, EdgeLabelRenderer, type EdgeProps } from '@xyflow/react';
import type { Edge as RFEdge } from '@xyflow/react';
import type { CanvasEdgeData } from '../canvas/types';
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
  const hasRootFrom = edge?.from.node.startsWith('@root/');
  const hasRootTo = edge?.to.node.startsWith('@root/');

  return (
    <>
      <path
        id={id}
        className={`react-flow__edge-path edge-${styleCategory}`}
        d={edgePath}
        markerEnd={markerEnd}
      />
      {hasRootFrom && (
        <circle cx={sourceX} cy={sourceY} r={6} className="ghost-marker" />
      )}
      {hasRootTo && (
        <circle cx={targetX} cy={targetY} r={6} className="ghost-marker" />
      )}
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
