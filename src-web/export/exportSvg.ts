import { toSvg } from 'html-to-image';
import { ExportError } from './types';
import { getCanvasBackground } from './domUtils';
import { decodeDataUrl } from './dataUrlUtils';
import { prepareExportClone } from './prepareExportClone';

/**
 * Export the ReactFlow viewport as an SVG image.
 *
 * Pre-processes the DOM before capture: clones the viewport, inlines all
 * computed styles (resolving CSS variables, color-mix(), Tailwind @layer),
 * materializes pseudo-elements, and embeds fonts as base64. This ensures
 * `html-to-image` produces a faithful rendering regardless of CSS complexity.
 */
export async function exportSvg(): Promise<Blob> {
  const originalViewport = document.querySelector(
    '.react-flow__viewport',
  ) as HTMLElement | null;

  if (!originalViewport) {
    throw new ExportError(
      'Could not find the ReactFlow viewport. Is the canvas mounted?',
      'NO_VIEWPORT',
    );
  }

  const exportClone = await prepareExportClone(originalViewport);

  try {
    const dataUrl = await toSvg(exportClone.viewport, {
      backgroundColor: getCanvasBackground(),
      // Filtering is already done during clone preparation
    });

    const svgText = decodeDataUrl(dataUrl);
    return new Blob([svgText], { type: 'image/svg+xml' });
  } catch (err) {
    if (err instanceof ExportError) throw err;
    throw new ExportError(
      `SVG export failed: ${err instanceof Error ? err.message : String(err)}`,
      'RENDER_FAILED',
    );
  } finally {
    exportClone.cleanup();
  }
}
