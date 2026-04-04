import { toSvg } from 'html-to-image';
import { ExportError } from './types';

/**
 * Export the ReactFlow viewport as an SVG image.
 *
 * Targets the `.react-flow__viewport` element inside the ReactFlow container.
 */
export async function exportSvg(): Promise<Blob> {
  const viewport = document.querySelector('.react-flow__viewport') as HTMLElement | null;

  if (!viewport) {
    throw new ExportError(
      'Could not find the ReactFlow viewport. Is the canvas mounted?',
      'NO_VIEWPORT',
    );
  }

  try {
    const dataUrl = await toSvg(viewport, {
      backgroundColor: getCanvasBackground(),
      filter: filterGhostElements,
    });

    // Convert data URL to SVG text, then to Blob
    const svgText = decodeURIComponent(dataUrl.split(',')[1]);
    return new Blob([svgText], { type: 'image/svg+xml' });
  } catch (err) {
    throw new ExportError(
      `SVG export failed: ${err instanceof Error ? err.message : String(err)}`,
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
  return getComputedStyle(document.documentElement)
    .getPropertyValue('--color-background')
    .trim() || '#ffffff';
}

/**
 * Filter out ghost/temporary elements from the export.
 */
function filterGhostElements(node: HTMLElement): boolean {
  if (node.dataset?.ghost === 'true') return false;
  if (node.classList?.contains('react-flow__minimap')) return false;
  if (node.classList?.contains('react-flow__controls')) return false;
  return true;
}
