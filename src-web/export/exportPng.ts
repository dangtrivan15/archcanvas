import { toPng } from 'html-to-image';
import type { PngScale } from './types';
import { ExportError } from './types';

/**
 * Export the ReactFlow viewport as a PNG image.
 *
 * Targets the `.react-flow__viewport` element inside the ReactFlow container.
 * Applies a pixel-ratio multiplier for higher resolution output.
 */
export async function exportPng(scale: PngScale = 2): Promise<Blob> {
  const viewport = document.querySelector('.react-flow__viewport') as HTMLElement | null;

  if (!viewport) {
    throw new ExportError(
      'Could not find the ReactFlow viewport. Is the canvas mounted?',
      'NO_VIEWPORT',
    );
  }

  try {
    const dataUrl = await toPng(viewport, {
      pixelRatio: scale,
      // Use background color from the canvas for consistent export
      backgroundColor: getCanvasBackground(),
      filter: filterGhostElements,
    });

    // Convert data URL to Blob
    const response = await fetch(dataUrl);
    return await response.blob();
  } catch (err) {
    throw new ExportError(
      `PNG export failed: ${err instanceof Error ? err.message : String(err)}`,
      'RENDER_FAILED',
    );
  }
}

/** Read the computed background color of the ReactFlow container */
function getCanvasBackground(): string {
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
 * Nodes with `data-ghost="true"` or the minimap are excluded.
 */
function filterGhostElements(node: HTMLElement): boolean {
  if (node.dataset?.ghost === 'true') return false;
  if (node.classList?.contains('react-flow__minimap')) return false;
  if (node.classList?.contains('react-flow__controls')) return false;
  return true;
}
