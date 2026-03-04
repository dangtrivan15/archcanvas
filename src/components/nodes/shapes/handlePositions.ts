/**
 * handlePositions.ts - Shape-aware handle positioning for React Flow port handles.
 *
 * Instead of placing handles at fixed left/right bounding-box positions, this module
 * computes positions that sit on the actual shape boundary. Each shape has its own
 * parametric math:
 *   - Cylinder: handles on the curved body (avoiding top/bottom caps)
 *   - Hexagon: handles on the angled left/right edges
 *   - Parallelogram: handles on the slanted left/right edges
 *   - Cloud: handles at the widest left/right cloud bumps
 *   - Stadium: handles on the straight left/right sides (inside rounded ends)
 *   - Document: handles on straight sides (above the wavy bottom curl)
 *   - Badge: handles on straight sides (above the pointed bottom)
 *   - Rectangle: evenly distributed along left/right edges
 *
 * Usage:
 *   const style = getHandlePosition('hexagon', 'left', 0, 2, 240, 100);
 *   <Handle style={style} ... />
 */

import type { ShapeName } from './shapeRegistry';

export type HandleSide = 'left' | 'right';

export interface HandlePositionStyle {
  top: string;
  left?: number;
  right?: number;
  transform: string;
}

/**
 * Compute the CSS style for a port handle on a given shape boundary.
 *
 * @param shape  - The node shape name
 * @param side   - 'left' or 'right'
 * @param index  - The port index (0-based)
 * @param total  - Total number of ports on this side
 * @param width  - Node width in px (for width-dependent geometry)
 * @param height - Node height in px (for height-dependent geometry)
 * @returns CSS style object to spread onto the Handle component
 */
export function getHandlePosition(
  shape: ShapeName,
  side: HandleSide,
  index: number,
  total: number,
  width: number,
  height: number,
): HandlePositionStyle {
  switch (shape) {
    case 'cylinder':
      return getCylinderPosition(side, index, total, width, height);
    case 'hexagon':
      return getHexagonPosition(side, index, total, width, height);
    case 'parallelogram':
      return getParallelogramPosition(side, index, total, width, height);
    case 'cloud':
      return getCloudPosition(side, index, total, width, height);
    case 'stadium':
      return getStadiumPosition(side, index, total, width, height);
    case 'document':
      return getDocumentPosition(side, index, total, width, height);
    case 'badge':
      return getBadgePosition(side, index, total, width, height);
    case 'rectangle':
    default:
      return getRectanglePosition(side, index, total);
  }
}

// ─── Rectangle ──────────────────────────────────────────────────────────────
// Evenly spaced along the straight left/right edges.

function getRectanglePosition(
  side: HandleSide,
  index: number,
  total: number,
): HandlePositionStyle {
  const t = (index + 1) / (total + 1); // 0 < t < 1
  return {
    top: `${t * 100}%`,
    ...(side === 'left' ? { left: 0 } : { right: 0 }),
    transform: 'translateY(-50%)',
  };
}

// ─── Cylinder ───────────────────────────────────────────────────────────────
// Handles sit on the cylindrical body, avoiding the top and bottom elliptical caps.
// Cap radius: ry = Math.min(16, height * 0.12)
// Usable Y range: [ry * 1.5, height - ry * 1.5] to stay clear of cap curves.

function getCylinderPosition(
  side: HandleSide,
  index: number,
  total: number,
  _width: number,
  height: number,
): HandlePositionStyle {
  const ry = Math.min(16, height * 0.12);
  const topBound = ry * 1.5;
  const bottomBound = height - ry * 1.5;
  const usable = bottomBound - topBound;

  const t = total === 1 ? 0.5 : index / (total - 1);
  const yPos = topBound + t * usable;
  const topPercent = (yPos / height) * 100;

  return {
    top: `${topPercent}%`,
    ...(side === 'left' ? { left: 0 } : { right: 0 }),
    transform: 'translateY(-50%)',
  };
}

// ─── Hexagon ────────────────────────────────────────────────────────────────
// Hexagon left vertex is at (0, h/2). Edges slope inward:
//   Top-left: (inset, 0) -> (0, h/2)
//   Bottom-left: (0, h/2) -> (inset, h)
// At height fraction t:
//   if t <= 0.5: x = inset * (1 - 2t)
//   if t >  0.5: x = inset * (2t - 1)
// Handles are offset to sit on the angled edge boundary.

function getHexagonPosition(
  side: HandleSide,
  index: number,
  total: number,
  width: number,
  height: number,
): HandlePositionStyle {
  const inset = Math.min(width * 0.2, 30);
  // Constrain to middle 70% to stay on flat angled edges
  const minT = 0.15;
  const maxT = 0.85;
  const t = total === 1 ? 0.5 : minT + (index / (total - 1)) * (maxT - minT);

  // X offset from bounding box edge to shape boundary
  const xOffset = t <= 0.5
    ? inset * (1 - 2 * t)
    : inset * (2 * t - 1);

  if (side === 'left') {
    return {
      top: `${t * 100}%`,
      left: xOffset,
      transform: 'translateY(-50%) translateX(-50%)',
    };
  } else {
    return {
      top: `${t * 100}%`,
      right: xOffset,
      transform: 'translateY(-50%) translateX(50%)',
    };
  }
}

// ─── Parallelogram ──────────────────────────────────────────────────────────
// Left edge: from (skew, 0) to (0, h). At fraction t: x = skew * (1 - t)
// Right edge: from (w, 0) to (w - skew, h). At fraction t: offset from right = skew * t
// Handles offset inward so edges connect cleanly to the slanted sides.

function getParallelogramPosition(
  side: HandleSide,
  index: number,
  total: number,
  width: number,
  height: number,
): HandlePositionStyle {
  const skew = Math.min(width * 0.15, 24);
  // Use 20%-80% vertical range
  const minT = 0.2;
  const maxT = 0.8;
  const t = total === 1 ? 0.5 : minT + (index / (total - 1)) * (maxT - minT);

  if (side === 'left') {
    // Left edge: at y = t*h, shape boundary x = skew * (1 - t)
    const xOffset = skew * (1 - t);
    return {
      top: `${t * 100}%`,
      left: xOffset,
      transform: 'translateY(-50%) translateX(-50%)',
    };
  } else {
    // Right edge: at y = t*h, shape boundary offset from right = skew * t
    const xOffset = skew * t;
    return {
      top: `${t * 100}%`,
      right: xOffset,
      transform: 'translateY(-50%) translateX(50%)',
    };
  }
}

// ─── Cloud ──────────────────────────────────────────────────────────────────
// Cloud bezier curves: left widest point is approximately at (0, h*0.5).
// Right widest point is approximately at (w, h*0.5).
// The cloud shape only has good "edge" contact near the center, so we
// cluster handles near 50% and space them with a small pixel offset.

function getCloudPosition(
  side: HandleSide,
  index: number,
  total: number,
  _width: number,
  _height: number,
): HandlePositionStyle {
  const SPACING = 16; // px between adjacent ports
  const centerOffset = (index - (total - 1) / 2) * SPACING;

  return {
    top: '50%',
    ...(side === 'left' ? { left: 0 } : { right: 0 }),
    transform: total === 1
      ? 'translateY(-50%)'
      : `translateY(calc(-50% + ${centerOffset}px))`,
  };
}

// ─── Stadium ────────────────────────────────────────────────────────────────
// Stadium (pill): left/right semicircles with straight top/bottom.
// Radius r = h/2. The straight section is x in [r, w-r].
// Handles should sit on the straight left/right sides of the pill,
// constrained to the vertical range where the sides are straight.
// At the semicircle center (y = h/2), the leftmost point is x = 0.
// For y away from center within the straight section: x = r - sqrt(r^2 - (y - r)^2)

function getStadiumPosition(
  side: HandleSide,
  index: number,
  total: number,
  _width: number,
  height: number,
): HandlePositionStyle {
  const r = height / 2;
  // Constrain to the middle portion where the semicircle is near x=0
  // At the very center (t=0.5), x offset = 0. As we move away, x increases.
  const SPACING = 16;
  const centerOffset = (index - (total - 1) / 2) * SPACING;

  // For the stadium, the boundary x at center is 0, so handles at left:0 / right:0 work
  // but if ports are offset vertically, they need x correction for the curve
  if (total === 1) {
    return {
      top: '50%',
      ...(side === 'left' ? { left: 0 } : { right: 0 }),
      transform: 'translateY(-50%)',
    };
  }

  // Compute x offset for each handle based on its vertical offset from center
  const yDelta = Math.abs(centerOffset);
  // On the semicircle: x = r - sqrt(r^2 - yDelta^2) (how far inward from the flat edge)
  const xCorrection = yDelta < r ? r - Math.sqrt(r * r - yDelta * yDelta) : r;

  if (side === 'left') {
    return {
      top: '50%',
      left: xCorrection,
      transform: `translateY(calc(-50% + ${centerOffset}px)) translateX(-50%)`,
    };
  } else {
    return {
      top: '50%',
      right: xCorrection,
      transform: `translateY(calc(-50% + ${centerOffset}px)) translateX(50%)`,
    };
  }
}

// ─── Document ───────────────────────────────────────────────────────────────
// Document shape: straight left/right sides with a wavy bottom edge.
// Wave height: Math.min(h * 0.12, 16). Safe Y range is above the curl.
// The left and right edges are straight (x=0 and x=w), so no X offset needed,
// but we constrain vertical placement to avoid the wavy bottom area.

function getDocumentPosition(
  side: HandleSide,
  index: number,
  total: number,
  _width: number,
  height: number,
): HandlePositionStyle {
  const wave = Math.min(height * 0.12, 16);
  // Safe range: 15% to (h - wave*2)/h to stay above the curl
  const maxT = Math.max(0.5, (height - wave * 2) / height);
  const minT = 0.15;
  const t = total === 1 ? (minT + maxT) / 2 : minT + (index / (total - 1)) * (maxT - minT);

  return {
    top: `${t * 100}%`,
    ...(side === 'left' ? { left: 0 } : { right: 0 }),
    transform: 'translateY(-50%)',
  };
}

// ─── Badge ──────────────────────────────────────────────────────────────────
// Badge/shield: straight sides until the pointed bottom at (w/2, h).
// Point starts at h - pointH where pointH = Math.min(h * 0.2, 20).
// Safe Y range: above the point start.

function getBadgePosition(
  side: HandleSide,
  index: number,
  total: number,
  _width: number,
  height: number,
): HandlePositionStyle {
  const pointH = Math.min(height * 0.2, 20);
  const maxT = Math.max(0.5, (height - pointH * 1.2) / height);
  const minT = 0.15;
  const t = total === 1 ? (minT + maxT) / 2 : minT + (index / (total - 1)) * (maxT - minT);

  return {
    top: `${t * 100}%`,
    ...(side === 'left' ? { left: 0 } : { right: 0 }),
    transform: 'translateY(-50%)',
  };
}
