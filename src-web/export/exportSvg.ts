import { ExportError } from './types';
import { getCanvasBackground } from './domUtils';
import { prepareExportClone } from './prepareExportClone';
import { renderToSvgString } from './renderToCanvas';

/**
 * Export the ReactFlow viewport as an SVG image.
 *
 * Pre-processes the DOM before capture: clones the viewport, inlines all
 * computed styles (resolving CSS variables, color-mix(), Tailwind @layer),
 * materializes pseudo-elements, and embeds fonts as base64. Then wraps
 * the self-contained clone in a foreignObject SVG document.
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
    const svgText = renderToSvgString(exportClone.viewport, {
      width: exportClone.wrapper.clientWidth || originalViewport.scrollWidth,
      height: exportClone.wrapper.clientHeight || originalViewport.scrollHeight,
      backgroundColor: getCanvasBackground(),
    });

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
