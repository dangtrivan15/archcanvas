import { toPng } from 'html-to-image';
import type { PngScale } from './types';
import { ExportError } from './types';
import { getCanvasBackground } from './domUtils';
import { prepareExportClone } from './prepareExportClone';

/**
 * Export the ReactFlow viewport as a PNG image.
 *
 * Pre-processes the DOM before capture: clones the viewport, inlines all
 * computed styles (resolving CSS variables, color-mix(), Tailwind @layer),
 * materializes pseudo-elements, and embeds fonts as base64. This ensures
 * `html-to-image` produces a faithful rendering regardless of CSS complexity.
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
    const dataUrl = await toPng(exportClone.viewport, {
      pixelRatio: scale,
      backgroundColor: getCanvasBackground(),
      // Filtering is already done during clone preparation — no need for a
      // runtime filter. Skipping it avoids double-filtering and lets
      // html-to-image render every node in the pre-processed clone.
    });

    // Convert data URL to Blob
    const response = await fetch(dataUrl);
    return await response.blob();
  } catch (err) {
    throw new ExportError(
      `PNG export failed: ${err instanceof Error ? err.message : String(err)}`,
      'RENDER_FAILED',
    );
  } finally {
    exportClone.cleanup();
  }
}
