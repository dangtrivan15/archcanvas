/**
 * SVG builder for the SVG export path.
 *
 * Wraps a pre-processed DOM clone in a `<foreignObject>` SVG document.
 * The caller is responsible for preparing the DOM clone (inline styles,
 * materialized pseudo-elements, embedded fonts) via `prepareExportClone`.
 *
 * Extracted from `renderToCanvas.ts` after removing the PNG export path.
 */

import { sanitizeUrlReferences } from './sanitizeUrlReferences';

export interface RenderOptions {
  /** Width of the output SVG in CSS pixels */
  width: number;
  /** Height of the output SVG in CSS pixels */
  height: number;
  /** Background colour (CSS value) */
  backgroundColor?: string;
}

/**
 * Build the SVG markup that wraps the given DOM element in a foreignObject.
 *
 * The returned string is a well-formed SVG document suitable for standalone
 * SVG export.
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
 * Render a pre-processed DOM element to a standalone SVG string.
 *
 * This is a thin wrapper around `buildSvgString` for API symmetry with
 * the export pipeline.
 */
export function renderToSvgString(
  element: HTMLElement,
  options: RenderOptions,
): string {
  return buildSvgString(element, options);
}

function escapeXmlAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
