import { toSvg } from 'html-to-image';
import { ExportError } from './types';
import { getCanvasBackground, filterGhostElements } from './domUtils';

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

    // Convert data URL to SVG text, then to Blob.
    // Use substring to avoid truncating SVG content that may contain commas.
    const commaIdx = dataUrl.indexOf(',');
    const svgText = decodeURIComponent(dataUrl.substring(commaIdx + 1));
    return new Blob([svgText], { type: 'image/svg+xml' });
  } catch (err) {
    throw new ExportError(
      `SVG export failed: ${err instanceof Error ? err.message : String(err)}`,
      'RENDER_FAILED',
    );
  }
}
