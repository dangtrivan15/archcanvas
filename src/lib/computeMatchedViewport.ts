import { computeZoomToRect } from './computeZoomToRect';
import { computeFitViewport } from './computeFitViewport';

// Container layout constants — must match nodeShapes.css
// .node-shape-container { padding: 14px 16px }
// .arch-node-header { font-size: 12px; line-height: 1.4 } → ~17px
export const CONTAINER_HEADER_H = 17;
export const CONTAINER_PAD_X = 16;
export const CONTAINER_PAD_Y = 14;

interface FitNode {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Compute the ReactFlow viewport where child nodes appear at the same
 * screen positions as they do in the mini-preview when the container
 * fills the screen.
 */
export function computeMatchedViewport(
  childNodes: FitNode[],
  containerCanvasRect: Rect,
  viewportWidth: number,
  viewportHeight: number,
): { x: number; y: number; zoom: number } {
  if (childNodes.length === 0) {
    return { x: 0, y: 0, zoom: 1 };
  }

  // 1. Zoom level that fills the screen with the container
  const zoomedVp = computeZoomToRect(containerCanvasRect, viewportWidth, viewportHeight);

  // 2. Content area dimensions at that zoom level
  const contentW = containerCanvasRect.width * zoomedVp.zoom - 2 * CONTAINER_PAD_X;
  const contentH = containerCanvasRect.height * zoomedVp.zoom - CONTAINER_HEADER_H - 2 * CONTAINER_PAD_Y;

  if (contentW <= 0 || contentH <= 0) {
    return { x: 0, y: 0, zoom: 1 };
  }

  // 3. Fit child nodes within the content area
  const fit = computeFitViewport({
    nodes: childNodes,
    viewportWidth: contentW,
    viewportHeight: contentH,
  });

  // 4. Offset for content area position within the full viewport
  const contentLeft = (viewportWidth - contentW) / 2;
  const contentTop = (viewportHeight - contentH) / 2 + CONTAINER_HEADER_H / 2;

  return {
    x: fit.offsetX + contentLeft,
    y: fit.offsetY + contentTop,
    zoom: fit.zoom,
  };
}
