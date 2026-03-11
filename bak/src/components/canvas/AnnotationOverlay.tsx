/**
 * AnnotationOverlay — SVG overlay on the React Flow canvas for freeform annotations.
 *
 * Renders saved annotations as SVG paths and handles live drawing input.
 * Uses pointer events to capture pencil/mouse input with pressure data.
 * Positioned absolutely over the canvas and transforms with the viewport.
 */

import { useCallback, useRef } from 'react';
import { useReactFlow } from '@xyflow/react';
import { useAnnotationStore } from '@/store/annotationStore';
import { useGraphStore } from '@/store/graphStore';
import { useCanvasStore } from '@/store/canvasStore';
import type { Annotation, AnnotationPathData } from '@/types/graph';

/**
 * Build an SVG path `d` attribute from annotation path data.
 * Uses quadratic bezier curves for smooth strokes.
 */
function buildSvgPath(pathData: AnnotationPathData): string {
  const { points } = pathData;
  if (points.length < 4) return '';

  let d = `M ${points[0]} ${points[1]}`;

  if (points.length === 4) {
    d += ` L ${points[2]} ${points[3]}`;
    return d;
  }

  // Use quadratic bezier for smoothing
  for (let i = 2; i < points.length - 2; i += 2) {
    const cpX = points[i] ?? 0;
    const cpY = points[i + 1] ?? 0;
    const endX = ((points[i] ?? 0) + (points[i + 2] ?? 0)) / 2;
    const endY = ((points[i + 1] ?? 0) + (points[i + 3] ?? 0)) / 2;
    d += ` Q ${cpX} ${cpY} ${endX} ${endY}`;
  }

  // Final point
  d += ` L ${points[points.length - 2]} ${points[points.length - 1]}`;
  return d;
}

/**
 * Compute variable stroke width based on pressure.
 * Returns an array of SVG path segments with varying widths.
 */
function renderAnnotationPath(
  pathData: AnnotationPathData,
  baseWidth: number,
  color: string,
  key: string,
) {
  const { points, pressures } = pathData;
  if (points.length < 4) return null;

  // If we have pressure data, use variable width
  const hasPressure = pressures.length > 0 && pressures.some((p) => p > 0);

  if (!hasPressure) {
    // Simple fixed-width path
    return (
      <path
        key={key}
        d={buildSvgPath(pathData)}
        fill="none"
        stroke={color}
        strokeWidth={baseWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    );
  }

  // Variable width: render as series of short segments with varying stroke width
  const segments: React.JSX.Element[] = [];
  for (let i = 0; i < points.length - 2; i += 2) {
    const idx = i / 2;
    const pressure = pressures[idx] ?? 0.5;
    const nextPressure = pressures[idx + 1] ?? pressure;
    const avgPressure = (pressure + nextPressure) / 2;
    const width = Math.max(1, baseWidth * (0.3 + avgPressure * 1.4));

    segments.push(
      <line
        key={`${key}-seg-${i}`}
        x1={points[i]}
        y1={points[i + 1]}
        x2={points[i + 2]}
        y2={points[i + 3]}
        stroke={color}
        strokeWidth={width}
        strokeLinecap="round"
      />,
    );
  }

  return <g key={key}>{segments}</g>;
}

function AnnotationPaths({ annotation }: { annotation: Annotation }) {
  return (
    <>
      {annotation.paths.map((pathData, idx) =>
        renderAnnotationPath(
          pathData,
          annotation.strokeWidth,
          annotation.color,
          `${annotation.id}-${idx}`,
        ),
      )}
    </>
  );
}

function LiveStrokePath() {
  const currentAnnotation = useAnnotationStore((s) => s.currentAnnotation);
  const color = useAnnotationStore((s) => s.color);
  const strokeWidth = useAnnotationStore((s) => s.strokeWidth);

  if (!currentAnnotation || currentAnnotation.points.length < 4) return null;

  const pathData: AnnotationPathData = {
    points: currentAnnotation.points,
    pressures: currentAnnotation.pressures,
  };

  return renderAnnotationPath(pathData, strokeWidth, color, 'live-stroke');
}

export function AnnotationOverlay() {
  const isDrawingMode = useAnnotationStore((s) => s.isDrawingMode);
  const isEraserMode = useAnnotationStore((s) => s.isEraserMode);
  const startStroke = useAnnotationStore((s) => s.startStroke);
  const continueStroke = useAnnotationStore((s) => s.continueStroke);
  const finishStroke = useAnnotationStore((s) => s.finishStroke);
  const pushUndo = useAnnotationStore((s) => s.pushUndo);
  const addAnnotation = useGraphStore((s) => s.addAnnotation);
  const removeAnnotation = useGraphStore((s) => s.removeAnnotation);
  const annotations = useGraphStore((s) => s.graph.annotations ?? []);
  const viewport = useCanvasStore((s) => s.viewport);
  const { screenToFlowPosition } = useReactFlow();

  const isDrawingRef = useRef(false);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!isDrawingMode) return;

      // In eraser mode, check if we hit an annotation
      if (isEraserMode) {
        // Find annotation under pointer
        const target = e.target as SVGElement;
        const annotationId = target
          .closest('[data-annotation-id]')
          ?.getAttribute('data-annotation-id');
        if (annotationId) {
          removeAnnotation(annotationId);
        }
        return;
      }

      // Get pressure from pointer event (Apple Pencil provides real pressure)
      const pressure = e.pointerType === 'pen' ? e.pressure : 0.5;

      // Convert screen coordinates to flow coordinates
      const flowPos = screenToFlowPosition({ x: e.clientX, y: e.clientY });
      startStroke(flowPos.x, flowPos.y, pressure);
      isDrawingRef.current = true;

      // Capture pointer for smooth drawing
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      e.preventDefault();
      e.stopPropagation();
    },
    [isDrawingMode, isEraserMode, startStroke, screenToFlowPosition, removeAnnotation],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isDrawingRef.current || !isDrawingMode || isEraserMode) return;

      const pressure = e.pointerType === 'pen' ? e.pressure : 0.5;
      const flowPos = screenToFlowPosition({ x: e.clientX, y: e.clientY });
      continueStroke(flowPos.x, flowPos.y, pressure);
      e.preventDefault();
      e.stopPropagation();
    },
    [isDrawingMode, isEraserMode, continueStroke, screenToFlowPosition],
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (!isDrawingRef.current) return;
      isDrawingRef.current = false;

      const completed = finishStroke();
      if (completed) {
        addAnnotation(completed);
        pushUndo(completed.id);
      }
      e.preventDefault();
      e.stopPropagation();
    },
    [finishStroke, addAnnotation, pushUndo],
  );

  // Even if not in drawing mode, render existing annotations
  const hasAnnotations = annotations.length > 0;

  if (!isDrawingMode && !hasAnnotations) return null;

  // SVG transform to match React Flow viewport
  const svgTransform = `translate(${viewport.x}, ${viewport.y}) scale(${viewport.zoom})`;

  return (
    <svg
      className="absolute inset-0 w-full h-full"
      style={{
        zIndex: isDrawingMode ? 40 : 5,
        pointerEvents: isDrawingMode ? 'auto' : 'none',
        cursor: isDrawingMode ? (isEraserMode ? 'crosshair' : 'crosshair') : 'default',
        touchAction: 'none',
      }}
      data-testid="annotation-overlay"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      <g transform={svgTransform}>
        {annotations.map((ann) => (
          <g key={ann.id} data-annotation-id={ann.id}>
            <AnnotationPaths annotation={ann} />
          </g>
        ))}
        <LiveStrokePath />
      </g>
    </svg>
  );
}
