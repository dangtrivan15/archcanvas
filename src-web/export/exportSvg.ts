import { toSvg } from 'html-to-image';
import { ExportError } from './types';
import { getCanvasBackground, filterGhostElements } from './domUtils';
import { decodeDataUrl } from './dataUrlUtils';

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

    const svgText = decodeDataUrl(dataUrl);
    return new Blob([svgText], { type: 'image/svg+xml' });
  } catch (err) {
    if (err instanceof ExportError) throw err;
    throw new ExportError(
      `SVG export failed: ${err instanceof Error ? err.message : String(err)}`,
      'RENDER_FAILED',
    );
  }
}
