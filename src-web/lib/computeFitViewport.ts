interface FitNode {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface FitViewportInput {
  nodes: FitNode[];
  viewportWidth: number;
  viewportHeight: number;
  padding?: number;   // 0-1, default 0.1
  minZoom?: number;    // default 0.1
  maxZoom?: number;    // default 2
}

interface ScreenRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface FitViewportResult {
  zoom: number;
  offsetX: number;
  offsetY: number;
  nodeScreenRects: ScreenRect[];
}

export function computeFitViewport(input: FitViewportInput): FitViewportResult {
  const {
    nodes,
    viewportWidth,
    viewportHeight,
    padding = 0.1,
    minZoom = 0.1,
    maxZoom = 2,
  } = input;

  if (nodes.length === 0) {
    return { zoom: 1, offsetX: 0, offsetY: 0, nodeScreenRects: [] };
  }

  // Compute bounding box
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const n of nodes) {
    if (n.x < minX) minX = n.x;
    if (n.y < minY) minY = n.y;
    if (n.x + n.width > maxX) maxX = n.x + n.width;
    if (n.y + n.height > maxY) maxY = n.y + n.height;
  }

  const contentW = maxX - minX;
  const contentH = maxY - minY;

  // Compute zoom to fit content in viewport with padding
  const scaleX = viewportWidth / contentW;
  const scaleY = viewportHeight / contentH;
  let zoom = Math.min(scaleX, scaleY) * (1 - padding);
  zoom = Math.max(minZoom, Math.min(maxZoom, zoom));

  // Center content in viewport
  const offsetX = (viewportWidth - contentW * zoom) / 2 - minX * zoom;
  const offsetY = (viewportHeight - contentH * zoom) / 2 - minY * zoom;

  // Compute per-node screen positions
  const nodeScreenRects: ScreenRect[] = nodes.map((n) => ({
    x: n.x * zoom + offsetX,
    y: n.y * zoom + offsetY,
    width: n.width * zoom,
    height: n.height * zoom,
  }));

  return { zoom, offsetX, offsetY, nodeScreenRects };
}
