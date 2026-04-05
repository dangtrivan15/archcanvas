/**
 * Shared DOM utilities for canvas export.
 *
 * Used by both the PNG and SVG exporters to read canvas styles and
 * filter temporary elements.
 */

/** Read the computed background color of the ReactFlow container */
export function getCanvasBackground(): string {
  const container = document.querySelector('.react-flow') as HTMLElement | null;
  if (container) {
    const bg = getComputedStyle(container).backgroundColor;
    if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') {
      return bg;
    }
  }
  // Fallback to the page background
  return getComputedStyle(document.documentElement)
    .getPropertyValue('--color-background')
    .trim() || '#ffffff';
}

/**
 * Filter out ghost/temporary elements from the export.
 * Nodes with `data-ghost="true"` or the minimap/controls are excluded.
 */
export function filterGhostElements(node: HTMLElement): boolean {
  if (node.dataset?.ghost === 'true') return false;
  if (node.classList?.contains('react-flow__minimap')) return false;
  if (node.classList?.contains('react-flow__controls')) return false;
  return true;
}
