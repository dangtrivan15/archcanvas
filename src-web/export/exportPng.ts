import type { PngScale } from './types';
import { ExportError } from './types';
import { getCanvasBackground } from './domUtils';
import { prepareExportClone } from './prepareExportClone';
import { renderToCanvas } from './renderToCanvas';

/**
 * Export the ReactFlow viewport as a PNG image.
 *
 * Pre-processes the DOM before capture: clones the viewport, inlines all
 * computed styles (resolving CSS variables, color-mix(), Tailwind @layer),
 * materializes pseudo-elements, and embeds fonts as base64. Then renders
 * the self-contained clone via a foreignObject → Canvas pipeline.
 */
export async function exportPng(scale: PngScale = 2): Promise<Blob> {
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
    const canvas = await renderToCanvas(exportClone.viewport, {
      width: exportClone.wrapper.clientWidth || originalViewport.scrollWidth,
      height: exportClone.wrapper.clientHeight || originalViewport.scrollHeight,
      pixelRatio: scale,
      backgroundColor: getCanvasBackground(),
    });

    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error('canvas.toBlob returned null'));
        },
        'image/png',
      );
    });
  } catch (err) {
    throw new ExportError(
      `PNG export failed: ${err instanceof Error ? err.message : String(err)}`,
      'RENDER_FAILED',
    );
  } finally {
    exportClone.cleanup();
  }
}
