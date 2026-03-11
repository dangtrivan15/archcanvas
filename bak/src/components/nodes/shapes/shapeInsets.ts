/**
 * shapeInsets - Shape-aware content padding for non-rectangular SVG shapes.
 *
 * Each shape type has different geometry that affects where content can safely
 * be placed without clipping against the shape boundary. This module calculates
 * the appropriate {top, right, bottom, left} insets for each shape based on
 * the actual shape geometry (matching the path generators in shapeRegistry).
 */

import type { ShapeName } from './shapeRegistry';

export interface ShapeInsets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

const BASE_PADDING = 8;
const INNER_GAP = 4; // breathing room between shape edge and content

/**
 * Calculate shape-aware content insets for a given shape at the given dimensions.
 *
 * These insets define the foreignObject position inside the SVG bounding box,
 * ensuring that inner content never overlaps the shape's stroke/boundary.
 */
export function getShapeInsets(shape: ShapeName, width: number, height: number): ShapeInsets {
  switch (shape) {
    case 'rectangle':
    case 'badge':
      // Rectangle: uniform padding; badge bottom point is handled by extra bottom
      if (shape === 'badge') {
        const pointH = Math.min(height * 0.2, 20);
        return {
          top: BASE_PADDING,
          right: BASE_PADDING,
          bottom: pointH + INNER_GAP,
          left: BASE_PADDING,
        };
      }
      return {
        top: BASE_PADDING,
        right: BASE_PADDING,
        bottom: BASE_PADDING,
        left: BASE_PADDING,
      };

    case 'cylinder': {
      // Cylinder: elliptical caps at top and bottom
      // ry = min(16, h * 0.12) from shapeRegistry
      const ry = Math.min(16, height * 0.12);
      return {
        top: ry + INNER_GAP,
        right: BASE_PADDING,
        bottom: ry + INNER_GAP,
        left: BASE_PADDING,
      };
    }

    case 'hexagon': {
      // Hexagon: angled sides inset by min(w*0.2, 30) from shapeRegistry
      const inset = Math.min(width * 0.2, 30);
      return {
        top: BASE_PADDING,
        right: inset + INNER_GAP,
        bottom: BASE_PADDING,
        left: inset + INNER_GAP,
      };
    }

    case 'parallelogram': {
      // Parallelogram: slanted sides with skew = min(w*0.15, 24) from shapeRegistry
      // Top-left starts at x=skew, bottom-right ends at x=w-skew
      // Content needs to fit within the narrower middle region
      const skew = Math.min(width * 0.15, 24);
      return {
        top: BASE_PADDING,
        right: skew / 2 + INNER_GAP,
        bottom: BASE_PADDING,
        left: skew / 2 + INNER_GAP,
      };
    }

    case 'cloud': {
      // Cloud: irregular bezier boundary. Content safe area is roughly
      // the center region. Cloud bumps extend to ~x*-0.05 and ~x*1.05.
      // Visible content area: roughly x 20-80%, y 15-70% of bounding box.
      const hPad = Math.max(width * 0.2, 24);
      const topPad = Math.max(height * 0.22, 16);
      const bottomPad = Math.max(height * 0.22, 16);
      return {
        top: topPad,
        right: hPad,
        bottom: bottomPad,
        left: hPad,
      };
    }

    case 'stadium': {
      // Stadium (pill): rounded ends with radius = h/2
      // Content must stay inside the flat middle section
      const r = height / 2;
      // Use a portion of the radius as horizontal inset
      const hPad = Math.min(r * 0.5, 24) + INNER_GAP;
      return {
        top: BASE_PADDING,
        right: hPad,
        bottom: BASE_PADDING,
        left: hPad,
      };
    }

    case 'document': {
      // Document: wavy bottom edge, wave = min(h*0.12, 16) from shapeRegistry
      const wave = Math.min(height * 0.12, 16);
      return {
        top: BASE_PADDING,
        right: BASE_PADDING,
        bottom: wave + INNER_GAP,
        left: BASE_PADDING,
      };
    }

    default:
      return {
        top: BASE_PADDING,
        right: BASE_PADDING,
        bottom: BASE_PADDING,
        left: BASE_PADDING,
      };
  }
}
