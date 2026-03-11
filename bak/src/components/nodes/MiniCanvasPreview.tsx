/**
 * MiniCanvasPreview - A scaled-down, read-only SVG preview of a child graph.
 *
 * Renders simplified node rectangles (colored by type) and edge lines
 * (styled by sync/async/data-flow) scaled to fit within a container.
 * Used inside ContainerNode to show a visual summary of nested .archc files.
 *
 * This is a pure SVG component (not a nested React Flow instance) for performance.
 * The preview is non-interactive — it serves as a visual indicator only.
 */

import { memo, useMemo } from 'react';
import type { ArchNode, ArchEdge, EdgeType } from '@/types/graph';
import { getEffectiveNodeColor } from '@/utils/nodeColors';

/** Padding around the scaled graph inside the SVG viewport */
const PREVIEW_PADDING = 8;

/** Default dimensions for nodes that don't have explicit sizing */
const DEFAULT_NODE_WIDTH = 120;
const DEFAULT_NODE_HEIGHT = 40;

/** Minimum preview dimensions */
const MIN_PREVIEW_WIDTH = 180;
const MIN_PREVIEW_HEIGHT = 80;

/** Edge colors by type */
const EDGE_COLORS: Record<EdgeType, string> = {
  sync: 'hsl(var(--iris))',
  async: 'hsl(var(--foam))',
  'data-flow': 'hsl(var(--gold))',
};

/** Edge dash patterns by type */
const EDGE_DASH: Record<EdgeType, string> = {
  sync: 'none',
  async: '4,3',
  'data-flow': '2,2',
};

export interface MiniCanvasPreviewProps {
  /** Child graph nodes to render */
  nodes: ArchNode[];
  /** Child graph edges to render */
  edges: ArchEdge[];
  /** Width of the preview area in pixels */
  width: number;
  /** Height of the preview area in pixels */
  height: number;
  /** Whether to show node labels (hidden at very small sizes) */
  showLabels?: boolean;
}

/**
 * Compute the bounding box of all nodes.
 */
function computeBoundingBox(nodes: ArchNode[]) {
  if (nodes.length === 0) {
    return { minX: 0, minY: 0, maxX: MIN_PREVIEW_WIDTH, maxY: MIN_PREVIEW_HEIGHT };
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const node of nodes) {
    const x = node.position.x;
    const y = node.position.y;
    const w = node.position.width || DEFAULT_NODE_WIDTH;
    const h = node.position.height || DEFAULT_NODE_HEIGHT;

    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x + w);
    maxY = Math.max(maxY, y + h);
  }

  return { minX, minY, maxX, maxY };
}

/**
 * Build a map from node ID to position center for edge rendering.
 */
function buildNodeCenterMap(nodes: ArchNode[]): Map<string, { cx: number; cy: number }> {
  const map = new Map<string, { cx: number; cy: number }>();
  for (const node of nodes) {
    const w = node.position.width || DEFAULT_NODE_WIDTH;
    const h = node.position.height || DEFAULT_NODE_HEIGHT;
    map.set(node.id, {
      cx: node.position.x + w / 2,
      cy: node.position.y + h / 2,
    });
  }
  return map;
}

function MiniCanvasPreviewComponent({
  nodes,
  edges,
  width,
  height,
  showLabels = true,
}: MiniCanvasPreviewProps) {
  const { viewBox, scale, nodeRects, edgeLines } = useMemo(() => {
    const bbox = computeBoundingBox(nodes);
    const graphW = bbox.maxX - bbox.minX;
    const graphH = bbox.maxY - bbox.minY;

    // Available space after padding
    const availW = Math.max(width - PREVIEW_PADDING * 2, 20);
    const availH = Math.max(height - PREVIEW_PADDING * 2, 20);

    // Uniform scale to fit
    const scaleVal = Math.min(availW / Math.max(graphW, 1), availH / Math.max(graphH, 1), 1);

    // Centering offsets
    const scaledW = graphW * scaleVal;
    const scaledH = graphH * scaleVal;
    const offsetX = (width - scaledW) / 2;
    const offsetY = (height - scaledH) / 2;

    const transform = (x: number, y: number) => ({
      tx: (x - bbox.minX) * scaleVal + offsetX,
      ty: (y - bbox.minY) * scaleVal + offsetY,
    });

    // Build node rectangles
    const rects = nodes.map((node) => {
      const w = node.position.width || DEFAULT_NODE_WIDTH;
      const h = node.position.height || DEFAULT_NODE_HEIGHT;
      const { tx, ty } = transform(node.position.x, node.position.y);
      const color = getEffectiveNodeColor(node.position.color, node.type) || '#888';

      return {
        id: node.id,
        x: tx,
        y: ty,
        width: w * scaleVal,
        height: h * scaleVal,
        color,
        label: node.displayName,
      };
    });

    // Build edge lines
    const centerMap = buildNodeCenterMap(nodes);
    const lines = edges
      .map((edge) => {
        const from = centerMap.get(edge.fromNode);
        const to = centerMap.get(edge.toNode);
        if (!from || !to) return null;

        const { tx: x1, ty: y1 } = transform(from.cx, from.cy);
        const { tx: x2, ty: y2 } = transform(to.cx, to.cy);

        return {
          id: edge.id,
          x1,
          y1,
          x2,
          y2,
          type: edge.type,
        };
      })
      .filter(Boolean) as Array<{
      id: string;
      x1: number;
      y1: number;
      x2: number;
      y2: number;
      type: EdgeType;
    }>;

    return {
      viewBox: `0 0 ${width} ${height}`,
      scale: scaleVal,
      nodeRects: rects,
      edgeLines: lines,
    };
  }, [nodes, edges, width, height]);

  // Determine if labels should be visible based on scale and node size
  const labelsVisible = showLabels && scale > 0.15;

  return (
    <svg
      width={width}
      height={height}
      viewBox={viewBox}
      className="mini-canvas-preview"
      data-testid="mini-canvas-preview"
      aria-label="Child canvas preview"
      role="img"
    >
      {/* Edge lines (render behind nodes) */}
      {edgeLines.map((line) => (
        <line
          key={line.id}
          x1={line.x1}
          y1={line.y1}
          x2={line.x2}
          y2={line.y2}
          stroke={EDGE_COLORS[line.type] || 'hsl(var(--muted-foreground))'}
          strokeWidth={Math.max(1, scale * 2)}
          strokeDasharray={EDGE_DASH[line.type]}
          opacity={0.6}
          data-testid={`preview-edge-${line.id}`}
        />
      ))}

      {/* Node rectangles */}
      {nodeRects.map((rect) => (
        <g key={rect.id} data-testid={`preview-node-${rect.id}`}>
          <rect
            x={rect.x}
            y={rect.y}
            width={rect.width}
            height={rect.height}
            rx={Math.max(2, scale * 4)}
            ry={Math.max(2, scale * 4)}
            fill={`${rect.color}30`}
            stroke={rect.color}
            strokeWidth={Math.max(0.5, scale * 1.5)}
          />
          {/* Color accent strip */}
          <rect
            x={rect.x}
            y={rect.y}
            width={rect.width}
            height={Math.max(1.5, scale * 3)}
            rx={Math.max(2, scale * 4)}
            fill={rect.color}
          />
          {/* Label (only if large enough to read) */}
          {labelsVisible && rect.width > 20 && rect.height > 10 && (
            <text
              x={rect.x + rect.width / 2}
              y={rect.y + rect.height / 2 + 1}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={Math.min(Math.max(7, scale * 11), 11)}
              fill="hsl(var(--text))"
              opacity={0.8}
              style={{ pointerEvents: 'none' }}
            >
              {rect.label.length > 12 ? rect.label.slice(0, 10) + '…' : rect.label}
            </text>
          )}
        </g>
      ))}

      {/* Empty state */}
      {nodes.length === 0 && (
        <text
          x={width / 2}
          y={height / 2}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={10}
          fill="hsl(var(--muted-foreground))"
          opacity={0.6}
        >
          Empty canvas
        </text>
      )}
    </svg>
  );
}

export const MiniCanvasPreview = memo(MiniCanvasPreviewComponent);
