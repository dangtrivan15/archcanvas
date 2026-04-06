/**
 * Custom DOM → Canvas / SVG renderer.
 *
 * Replaces `html-to-image` with a minimal pipeline that avoids the five
 * failure modes identified in the spec:
 *
 *  1. No `externalResourcesRequired` attribute
 *  2. No double-cloning — works directly on the pre-processed clone
 *  3. Sanitizes unresolvable `url()` references before serialization
 *  4. Uses Blob URLs instead of massive data URLs (SVG path)
 *  5. Clean XML serialization via XMLSerializer
 *
 * For SVG export: wraps the DOM in a foreignObject SVG.
 * For PNG export: paints visible DOM elements directly to a Canvas 2D context
 * to avoid Chrome's foreignObject canvas taint restriction.
 *
 * SVG images (Lucide icons, ReactFlow edge paths) are serialized to data URLs
 * and loaded via `new Image()`. A `pendingImages` array collects these load
 * promises so `renderToCanvas()` can `await` them all before returning the
 * canvas — fixing the race condition where `canvas.toBlob()` could fire
 * before icons finished loading.
 *
 * The caller is responsible for preparing the DOM clone (inline styles,
 * materialized pseudo-elements, embedded fonts) via `prepareExportClone`.
 */

import { sanitizeUrlReferences } from './sanitizeUrlReferences';

export interface RenderOptions {
  /** Width of the output canvas/SVG in CSS pixels */
  width: number;
  /** Height of the output canvas/SVG in CSS pixels */
  height: number;
  /** Device pixel ratio for PNG rasterization (default 1) */
  pixelRatio?: number;
  /** Background colour (CSS value) */
  backgroundColor?: string;
}

/**
 * Build the SVG markup that wraps the given DOM element in a foreignObject.
 *
 * The returned string is a well-formed SVG document suitable for standalone
 * SVG export. NOT used for PNG because Chrome taints the canvas when
 * drawing SVG images containing foreignObject.
 */
export function buildSvgString(
  element: HTMLElement,
  options: RenderOptions,
): string {
  const { width, height, backgroundColor } = options;

  // Sanitize url() references that would be unresolvable in foreignObject
  sanitizeUrlReferences(element);

  // Serialize the DOM to an XHTML string (required for foreignObject)
  const serializer = new XMLSerializer();
  const xhtml = serializer.serializeToString(element);

  // Build the SVG wrapper
  const bgRect = backgroundColor
    ? `<rect width="100%" height="100%" fill="${escapeXmlAttr(backgroundColor)}"/>`
    : '';

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">`,
    bgRect,
    `<foreignObject width="100%" height="100%">`,
    xhtml,
    `</foreignObject>`,
    `</svg>`,
  ].join('');
}

/**
 * Render a pre-processed DOM element to a Canvas.
 *
 * Uses direct canvas 2D painting (no foreignObject/Image pipeline)
 * to avoid Chrome's canvas taint restriction. Walks the clone's DOM tree
 * and paints each element's visual properties directly.
 *
 * Returns an `HTMLCanvasElement` whose dimensions account for the given
 * `pixelRatio` so that `canvas.toBlob()` yields a correctly-scaled PNG.
 */
export async function renderToCanvas(
  element: HTMLElement,
  options: RenderOptions,
): Promise<HTMLCanvasElement> {
  const { width, height, pixelRatio = 1, backgroundColor } = options;

  // Sanitize url() references before reading styles
  sanitizeUrlReferences(element);

  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(width * pixelRatio);
  canvas.height = Math.ceil(height * pixelRatio);

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not get 2d context');

  ctx.scale(pixelRatio, pixelRatio);

  // Fill background
  if (backgroundColor) {
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, width, height);
  }

  // Get the element's offscreen position to compute relative coordinates
  const rootRect = element.getBoundingClientRect();

  // Collect image-load promises so we can await them before returning.
  // SVG icons and edge paths are drawn via Image elements; without awaiting
  // these loads, canvas.toBlob() may fire before the images are painted.
  const pendingImages: Promise<void>[] = [];

  // Paint all visible elements
  paintElement(ctx, element, rootRect.left, rootRect.top, pendingImages);

  // Wait for all SVG images to load (with safety timeout)
  await Promise.all(pendingImages);

  return canvas;
}

/**
 * Render a pre-processed DOM element to a standalone SVG string.
 *
 * This is the SVG-export equivalent of `renderToCanvas`. The returned
 * string is a complete `<svg>` document with the DOM wrapped in a foreignObject.
 */
export function renderToSvgString(
  element: HTMLElement,
  options: RenderOptions,
): string {
  return buildSvgString(element, options);
}

/* ------------------------------------------------------------------ */
/*  Direct Canvas Painting                                            */
/* ------------------------------------------------------------------ */

/**
 * Recursively paint a DOM element and its children onto a canvas.
 *
 * Reads inline styles (already resolved by inlineStyles.ts) to draw
 * backgrounds, borders, and text. Handles the subset of CSS properties
 * that are visually significant for an architecture diagram export.
 */
function paintElement(
  ctx: CanvasRenderingContext2D,
  el: HTMLElement,
  offsetX: number,
  offsetY: number,
  pendingImages: Promise<void>[],
): void {
  const style = el.style;

  // Skip invisible elements
  if (style.display === 'none' || style.visibility === 'hidden') return;
  const opacity = parseFloat(style.opacity);
  if (!isNaN(opacity) && opacity === 0) return;

  const rect = el.getBoundingClientRect();
  const x = rect.left - offsetX;
  const y = rect.top - offsetY;
  const w = rect.width;
  const h = rect.height;

  // Skip zero-size elements
  if (w <= 0 || h <= 0) return;

  // Save state for opacity
  const needsOpacity = !isNaN(opacity) && opacity < 1;
  if (needsOpacity) {
    ctx.save();
    ctx.globalAlpha *= opacity;
  }

  // Background
  const bg = style.backgroundColor;
  if (bg && bg !== 'transparent' && bg !== 'rgba(0, 0, 0, 0)') {
    ctx.fillStyle = bg;
    const radius = parseBorderRadius(style.borderRadius);
    if (radius > 0) {
      fillRoundedRect(ctx, x, y, w, h, radius);
    } else {
      ctx.fillRect(x, y, w, h);
    }
  }

  // Border
  const borderWidth = parsePixels(style.borderTopWidth || style.borderWidth);
  if (borderWidth > 0) {
    const borderColor =
      style.borderTopColor || style.borderColor || 'transparent';
    if (borderColor !== 'transparent' && borderColor !== 'rgba(0, 0, 0, 0)') {
      ctx.strokeStyle = borderColor;
      ctx.lineWidth = borderWidth;
      const radius = parseBorderRadius(style.borderRadius);
      if (radius > 0) {
        strokeRoundedRect(
          ctx,
          x + borderWidth / 2,
          y + borderWidth / 2,
          w - borderWidth,
          h - borderWidth,
          radius,
        );
      } else {
        ctx.strokeRect(
          x + borderWidth / 2,
          y + borderWidth / 2,
          w - borderWidth,
          h - borderWidth,
        );
      }
    }
  }

  // Text content (direct text nodes only)
  for (const node of el.childNodes) {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent?.trim();
      if (text) {
        const fontSize = style.fontSize || '14px';
        const fontWeight = style.fontWeight || '400';
        const fontFamily = style.fontFamily || 'sans-serif';
        ctx.font = `${fontWeight} ${fontSize} ${fontFamily}`;
        ctx.fillStyle = style.color || '#000000';
        ctx.textBaseline = 'top';

        const pl = parsePixels(style.paddingLeft);
        const pt = parsePixels(style.paddingTop);
        ctx.fillText(text, x + pl, y + pt);
      }
    }
  }

  // Handle SVG elements (e.g. Lucide icons, edge paths) — draw them as Images
  for (const child of el.children) {
    if (child instanceof SVGSVGElement) {
      drawSvgElement(ctx, child, offsetX, offsetY, pendingImages);
    } else if (child instanceof HTMLElement) {
      paintElement(ctx, child, offsetX, offsetY, pendingImages);
    }
  }

  if (needsOpacity) {
    ctx.restore();
  }
}

/** Per-image safety timeout (ms) to avoid hanging on broken SVGs. */
const IMAGE_LOAD_TIMEOUT_MS = 3_000;

/**
 * Draw an inline SVG element (e.g. Lucide icon, edge path) to canvas.
 *
 * Serializes the SVG to a data URL and draws it via `new Image()`.
 * The load promise is pushed onto `pendingImages` so the caller can
 * `await` all loads before calling `canvas.toBlob()`.
 *
 * Unlike foreignObject SVGs, standard SVG images do NOT taint the canvas.
 */
function drawSvgElement(
  ctx: CanvasRenderingContext2D,
  svg: SVGSVGElement,
  _offsetX: number,
  _offsetY: number,
  pendingImages: Promise<void>[],
): void {
  // Get the SVG's bounding rect
  const rect = svg.getBoundingClientRect();
  const x = rect.left - _offsetX;
  const y = rect.top - _offsetY;
  const w = rect.width;
  const h = rect.height;

  if (w <= 0 || h <= 0) return;

  try {
    const svgStr = new XMLSerializer().serializeToString(svg);
    const dataUrl =
      'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgStr);

    const img = new window.Image();

    const loadPromise = new Promise<void>((resolve) => {
      const timer = setTimeout(() => {
        // Safety timeout — resolve without drawing to avoid hanging forever
        resolve();
      }, IMAGE_LOAD_TIMEOUT_MS);

      img.onload = () => {
        clearTimeout(timer);
        try {
          ctx.drawImage(img, x, y, w, h);
        } catch {
          // Ignore draw errors for icons
        }
        resolve();
      };

      img.onerror = () => {
        clearTimeout(timer);
        resolve();
      };
    });

    pendingImages.push(loadPromise);
    img.src = dataUrl;
  } catch {
    // SVG serialization failed — skip this element
  }
}

/* ------------------------------------------------------------------ */
/*  Geometry Helpers                                                   */
/* ------------------------------------------------------------------ */

function parsePixels(value: string | undefined | null): number {
  if (!value) return 0;
  return parseFloat(value) || 0;
}

function parseBorderRadius(value: string | undefined | null): number {
  if (!value) return 0;
  // Take the first value (handles "8px 8px 8px 8px" format)
  const first = value.split(/\s+/)[0];
  return parseFloat(first) || 0;
}

function fillRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
  ctx.fill();
}

function strokeRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
  ctx.stroke();
}

function escapeXmlAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
