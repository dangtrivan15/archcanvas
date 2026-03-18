export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Compute the ReactFlow viewport { x, y, zoom } that centers and fills
 * the screen with the given canvas-space rectangle.
 *
 * padding defaults to 0 (edge-to-edge) — intentional for switch-point viewports.
 */
export function computeZoomToRect(
  rect: Rect,
  viewportWidth: number,
  viewportHeight: number,
  padding = 0,
): { x: number; y: number; zoom: number } {
  const zoom = Math.min(viewportWidth / rect.width, viewportHeight / rect.height) * (1 - padding);
  const centerX = rect.x + rect.width / 2;
  const centerY = rect.y + rect.height / 2;
  const x = viewportWidth / 2 - centerX * zoom;
  const y = viewportHeight / 2 - centerY * zoom;
  return { x, y, zoom };
}
