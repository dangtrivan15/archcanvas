/**
 * Image export (PNG / SVG) for the canvas.
 *
 * Uses `html-to-image` to rasterize or vectorize the ReactFlow viewport DOM
 * element. Accesses the ReactFlow instance via the singleton ref for viewport
 * bounds calculation.
 */

import { toPng, toSvg } from 'html-to-image';
import { getReactFlowInstance } from '@/lib/reactFlowRef';
import { useThemeStore } from '@/store/themeStore';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ImageExportOptions {
  /** Pixel ratio for raster exports. Default: 2 */
  pixelRatio?: number;
  /** Include the background color/pattern. Default: true */
  includeBackground?: boolean;
  /** Maximum dimension (width or height) in pixels. Prevents runaway exports. Default: 8192 */
  maxDimension?: number;
}

export interface ImageExportResult {
  blob: Blob;
  width: number;
  height: number;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function getViewportElement(): HTMLElement {
  // ReactFlow renders the canvas inside .react-flow__viewport
  const el = document.querySelector('.react-flow__viewport');
  if (!el) throw new Error('ReactFlow viewport element not found');
  return el as HTMLElement;
}

function getCanvasBackgroundColor(): string {
  // Resolve from CSS custom properties applied by the theme system
  const mode = useThemeStore.getState().getResolvedMode();
  return mode === 'dark' ? '#1a1a2e' : '#ffffff';
}

function getNodesBoundingBox(): { x: number; y: number; width: number; height: number } | null {
  const rf = getReactFlowInstance();
  if (!rf) return null;

  const nodes = rf.getNodes();
  if (nodes.length === 0) return null;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const node of nodes) {
    const x = node.position.x;
    const y = node.position.y;
    const w = node.measured?.width ?? node.width ?? 200;
    const h = node.measured?.height ?? node.height ?? 60;

    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x + w);
    maxY = Math.max(maxY, y + h);
  }

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

// ---------------------------------------------------------------------------
// Export functions
// ---------------------------------------------------------------------------

/**
 * Export the current canvas view as a PNG Blob.
 */
export async function exportCanvasToPng(
  options: ImageExportOptions = {},
): Promise<ImageExportResult> {
  const {
    pixelRatio = 2,
    includeBackground = true,
    maxDimension = 8192,
  } = options;

  const rf = getReactFlowInstance();
  if (!rf) throw new Error('ReactFlow instance not available');

  const bounds = getNodesBoundingBox();
  if (!bounds) throw new Error('Canvas is empty — nothing to export');

  // Add padding around content
  const padding = 40;
  const exportWidth = bounds.width + padding * 2;
  const exportHeight = bounds.height + padding * 2;

  // Clamp to max dimension to prevent memory issues
  const scale = Math.min(
    1,
    maxDimension / (exportWidth * pixelRatio),
    maxDimension / (exportHeight * pixelRatio),
  );
  const effectiveRatio = pixelRatio * scale;

  const viewport = rf.getViewport();
  const el = getViewportElement();

  const dataUrl = await toPng(el, {
    backgroundColor: includeBackground ? getCanvasBackgroundColor() : undefined,
    width: exportWidth,
    height: exportHeight,
    pixelRatio: effectiveRatio,
    style: {
      width: `${exportWidth}px`,
      height: `${exportHeight}px`,
      transform: `translate(${-bounds.x + padding}px, ${-bounds.y + padding}px) scale(1)`,
    },
    filter: (node) => {
      // Exclude ReactFlow controls and minimap from export
      if (node instanceof HTMLElement) {
        const cls = node.className;
        if (typeof cls === 'string') {
          if (cls.includes('react-flow__controls')) return false;
          if (cls.includes('react-flow__minimap')) return false;
        }
      }
      return true;
    },
  });

  // Restore viewport after export
  rf.setViewport(viewport);

  // Convert data URL to Blob
  const response = await fetch(dataUrl);
  const blob = await response.blob();

  return {
    blob,
    width: Math.round(exportWidth * effectiveRatio),
    height: Math.round(exportHeight * effectiveRatio),
  };
}

/**
 * Export the current canvas view as an SVG Blob.
 */
export async function exportCanvasToSvg(
  options: ImageExportOptions = {},
): Promise<ImageExportResult> {
  const {
    includeBackground = true,
    maxDimension = 8192,
  } = options;

  const rf = getReactFlowInstance();
  if (!rf) throw new Error('ReactFlow instance not available');

  const bounds = getNodesBoundingBox();
  if (!bounds) throw new Error('Canvas is empty — nothing to export');

  const padding = 40;
  const exportWidth = bounds.width + padding * 2;
  const exportHeight = bounds.height + padding * 2;

  // Clamp to max dimension
  const scale = Math.min(1, maxDimension / exportWidth, maxDimension / exportHeight);
  const clampedWidth = exportWidth * scale;
  const clampedHeight = exportHeight * scale;

  const viewport = rf.getViewport();
  const el = getViewportElement();

  const svgString = await toSvg(el, {
    backgroundColor: includeBackground ? getCanvasBackgroundColor() : undefined,
    width: clampedWidth,
    height: clampedHeight,
    style: {
      width: `${clampedWidth}px`,
      height: `${clampedHeight}px`,
      transform: `translate(${-bounds.x + padding}px, ${-bounds.y + padding}px) scale(${scale})`,
    },
    filter: (node) => {
      if (node instanceof HTMLElement) {
        const cls = node.className;
        if (typeof cls === 'string') {
          if (cls.includes('react-flow__controls')) return false;
          if (cls.includes('react-flow__minimap')) return false;
        }
      }
      return true;
    },
  });

  // Restore viewport
  rf.setViewport(viewport);

  const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });

  return {
    blob,
    width: Math.round(clampedWidth),
    height: Math.round(clampedHeight),
  };
}
