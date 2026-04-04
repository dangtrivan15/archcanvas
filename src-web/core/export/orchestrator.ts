/**
 * Export orchestrator — ties rendering, file saving, and error handling together.
 *
 * Provides a single `exportCanvas()` entry point that:
 * 1. Resolves the current canvas data
 * 2. Delegates to the appropriate renderer (PNG/SVG/Markdown)
 * 3. Saves via the platform FileSaver abstraction
 * 4. Returns success/failure status
 */

import type { Canvas } from '@/types';
import { useFileStore } from '@/store/fileStore';
import { useNavigationStore } from '@/store/navigationStore';
import { exportCanvasToPng, exportCanvasToSvg } from './image';
import type { ImageExportOptions } from './image';
import { exportCanvasToMarkdown } from './markdown';
import type { MarkdownExportOptions } from './markdown';
import { createFileSaver } from '@/platform/fileSaver';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ExportFormat = 'png' | 'svg' | 'markdown';

export interface ExportOptions {
  format: ExportFormat;
  /** Override default filename (without extension). */
  filename?: string;
  /** PNG/SVG options */
  imageOptions?: ImageExportOptions;
  /** Markdown options */
  markdownOptions?: MarkdownExportOptions;
}

export interface ExportResult {
  success: boolean;
  /** Human-readable message (e.g. "Exported diagram.png") */
  message: string;
  /** true if the user cancelled the save dialog */
  cancelled?: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getCanvasName(): string {
  const canvasId = useNavigationStore.getState().currentCanvasId;
  const loaded = useFileStore.getState().getCanvas(canvasId);
  if (!loaded) return 'canvas';

  const data = loaded.data;
  if (data.displayName) return sanitizeFilename(data.displayName);
  if (data.project?.name) return sanitizeFilename(data.project.name);
  if (canvasId === '__root__') return 'root';
  return sanitizeFilename(canvasId);
}

function sanitizeFilename(name: string): string {
  return name
    .replace(/[<>:"/\\|?*]/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
}

function getExtension(format: ExportFormat): string {
  switch (format) {
    case 'png': return 'png';
    case 'svg': return 'svg';
    case 'markdown': return 'md';
  }
}

function getMimeType(format: ExportFormat): string {
  switch (format) {
    case 'png': return 'image/png';
    case 'svg': return 'image/svg+xml';
    case 'markdown': return 'text/markdown';
  }
}

function getFilterLabel(format: ExportFormat): string {
  switch (format) {
    case 'png': return 'PNG Image';
    case 'svg': return 'SVG Image';
    case 'markdown': return 'Markdown';
  }
}

function getCurrentCanvasData(): Canvas | null {
  const canvasId = useNavigationStore.getState().currentCanvasId;
  const loaded = useFileStore.getState().getCanvas(canvasId);
  return loaded?.data ?? null;
}

// ---------------------------------------------------------------------------
// Main export function
// ---------------------------------------------------------------------------

export async function exportCanvas(options: ExportOptions): Promise<ExportResult> {
  const { format, filename, imageOptions, markdownOptions } = options;
  const baseName = filename ?? getCanvasName();
  const ext = getExtension(format);
  const fullName = `${baseName}.${ext}`;

  try {
    let data: Blob | string;

    switch (format) {
      case 'png': {
        const result = await exportCanvasToPng(imageOptions);
        data = result.blob;
        break;
      }
      case 'svg': {
        const result = await exportCanvasToSvg(imageOptions);
        data = result.blob;
        break;
      }
      case 'markdown': {
        const canvas = getCurrentCanvasData();
        if (!canvas) {
          return { success: false, message: 'No canvas data available' };
        }
        data = exportCanvasToMarkdown(canvas, markdownOptions);
        break;
      }
    }

    const saver = createFileSaver();
    const saved = await saver.saveFile(data, {
      defaultName: fullName,
      mimeType: getMimeType(format),
      filters: [{ name: getFilterLabel(format), extensions: [ext] }],
    });

    if (!saved) {
      return { success: false, message: 'Export cancelled', cancelled: true };
    }

    return { success: true, message: `Exported ${fullName}` };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Export failed';
    console.error(`[export] ${format} export failed:`, err);
    return { success: false, message };
  }
}
