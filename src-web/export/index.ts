import type { ExportOptions, ExportResult } from './types';
import { ExportError } from './types';
import { exportPng } from './exportPng';
import { exportSvg } from './exportSvg';
import { exportMarkdown } from './exportMarkdown';
import { createFileSaver } from '@/platform/fileSaver';
import { useFileStore } from '@/store/fileStore';
import { useNavigationStore } from '@/store/navigationStore';

export type { ExportOptions, ExportResult } from './types';
export type { ExportFormat, PngScale } from './types';
export { ExportError } from './types';

/**
 * Perform a canvas export in the requested format.
 *
 * Returns the export result (data + suggested filename + MIME type).
 * Throws ExportError on failure.
 */
export async function performExport(options: ExportOptions): Promise<ExportResult> {
  const projectName = useFileStore.getState().project?.root.data.project?.name ?? 'architecture';
  const safeName = projectName.replace(/[^a-zA-Z0-9_-]/g, '_');

  switch (options.format) {
    case 'png': {
      const blob = await exportPng(options.pngScale ?? 2);
      return {
        data: blob,
        filename: `${safeName}.png`,
        mimeType: 'image/png',
      };
    }

    case 'svg': {
      const blob = await exportSvg();
      return {
        data: blob,
        filename: `${safeName}.svg`,
        mimeType: 'image/svg+xml',
      };
    }

    case 'markdown': {
      const canvasId = useNavigationStore.getState().currentCanvasId;
      const canvas = useFileStore.getState().getCanvas(canvasId);
      if (!canvas) {
        throw new ExportError(
          'No canvas is currently loaded.',
          'EMPTY_CANVAS',
        );
      }

      const nodes = canvas.data.nodes ?? [];
      const edges = canvas.data.edges ?? [];
      if (nodes.length === 0 && edges.length === 0) {
        throw new ExportError(
          'The canvas is empty. Add some nodes or edges before exporting.',
          'EMPTY_CANVAS',
        );
      }

      const text = exportMarkdown(canvas.data);
      return {
        data: text,
        filename: `${safeName}.md`,
        mimeType: 'text/markdown',
      };
    }

    default:
      throw new ExportError(`Unsupported format: ${options.format}`, 'UNKNOWN');
  }
}

/**
 * Perform an export and save to a file via the platform file saver.
 * Returns true if saved successfully, false if the user cancelled.
 * Throws ExportError on export failure.
 */
export async function exportAndSave(options: ExportOptions): Promise<boolean> {
  const result = await performExport(options);
  const saver = createFileSaver();

  const filters = getFilters(options.format);

  if (typeof result.data === 'string') {
    return saver.saveText(result.data, {
      defaultName: result.filename,
      mimeType: result.mimeType,
      filters,
    });
  }

  return saver.saveBlob(result.data, {
    defaultName: result.filename,
    mimeType: result.mimeType,
    filters,
  });
}

function getFilters(format: string): Array<{ name: string; extensions: string[] }> {
  switch (format) {
    case 'png':
      return [{ name: 'PNG Image', extensions: ['png'] }];
    case 'svg':
      return [{ name: 'SVG Image', extensions: ['svg'] }];
    case 'markdown':
      return [{ name: 'Markdown', extensions: ['md'] }];
    default:
      return [];
  }
}
