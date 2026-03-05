/**
 * shapeRegistry - SVG path generator functions for each node shape.
 *
 * Each generator takes (width, height) and returns an SVG path string (d attribute).
 * These shapes are used by NodeShell to render distinct SVG backgrounds for nodes.
 */

export type ShapeName =
  | 'rectangle'
  | 'cylinder'
  | 'hexagon'
  | 'parallelogram'
  | 'cloud'
  | 'stadium'
  | 'document'
  | 'badge';

export type ShapePathGenerator = (width: number, height: number) => string;

/** Rounded rectangle (radius 8px) */
function rectangle(w: number, h: number): string {
  const r = 8;
  return [
    `M ${r} 0`,
    `H ${w - r}`,
    `Q ${w} 0 ${w} ${r}`,
    `V ${h - r}`,
    `Q ${w} ${h} ${w - r} ${h}`,
    `H ${r}`,
    `Q 0 ${h} 0 ${h - r}`,
    `V ${r}`,
    `Q 0 0 ${r} 0`,
    'Z',
  ].join(' ');
}

/** Cylinder (database shape) - top and bottom ellipses with straight sides */
function cylinder(w: number, h: number): string {
  const ry = Math.min(16, h * 0.12); // ellipse vertical radius
  return [
    // Top ellipse
    `M 0 ${ry}`,
    `A ${w / 2} ${ry} 0 0 1 ${w} ${ry}`,
    // Right side down
    `V ${h - ry}`,
    // Bottom ellipse
    `A ${w / 2} ${ry} 0 0 1 0 ${h - ry}`,
    // Left side up
    `V ${ry}`,
    'Z',
  ].join(' ');
}

/** Top ellipse lid for cylinder (drawn separately for visual depth) */
export function cylinderLid(w: number, _h: number): string {
  const ry = Math.min(16, _h * 0.12);
  return [
    `M 0 ${ry}`,
    `A ${w / 2} ${ry} 0 0 1 ${w} ${ry}`,
    `A ${w / 2} ${ry} 0 0 1 0 ${ry}`,
    'Z',
  ].join(' ');
}

/** Hexagon - flat top and bottom */
function hexagon(w: number, h: number): string {
  const inset = Math.min(w * 0.2, 30);
  return [
    `M ${inset} 0`,
    `L ${w - inset} 0`,
    `L ${w} ${h / 2}`,
    `L ${w - inset} ${h}`,
    `L ${inset} ${h}`,
    `L 0 ${h / 2}`,
    'Z',
  ].join(' ');
}

/** Parallelogram - slanted sides */
function parallelogram(w: number, h: number): string {
  const skew = Math.min(w * 0.15, 24);
  return [`M ${skew} 0`, `L ${w} 0`, `L ${w - skew} ${h}`, `L 0 ${h}`, 'Z'].join(' ');
}

/** Cloud shape - composed of overlapping arcs */
function cloud(w: number, h: number): string {
  // Approximate a cloud with bezier curves
  return [
    `M ${w * 0.25} ${h * 0.7}`,
    `C ${w * -0.05} ${h * 0.7} ${w * -0.05} ${h * 0.3} ${w * 0.2} ${h * 0.3}`,
    `C ${w * 0.15} ${h * 0.05} ${w * 0.4} ${h * -0.05} ${w * 0.5} ${h * 0.15}`,
    `C ${w * 0.6} ${h * -0.05} ${w * 0.85} ${h * 0.05} ${w * 0.8} ${h * 0.3}`,
    `C ${w * 1.05} ${h * 0.3} ${w * 1.05} ${h * 0.7} ${w * 0.75} ${h * 0.7}`,
    'Z',
  ].join(' ');
}

/** Stadium (pill/capsule) - rectangle with fully rounded ends */
function stadium(w: number, h: number): string {
  const r = h / 2;
  if (w <= h) {
    // Degenerate case: circle
    return [
      `M ${w / 2} 0`,
      `A ${w / 2} ${h / 2} 0 0 1 ${w / 2} ${h}`,
      `A ${w / 2} ${h / 2} 0 0 1 ${w / 2} 0`,
      'Z',
    ].join(' ');
  }
  return [
    `M ${r} 0`,
    `H ${w - r}`,
    `A ${r} ${r} 0 0 1 ${w - r} ${h}`,
    `H ${r}`,
    `A ${r} ${r} 0 0 1 ${r} 0`,
    'Z',
  ].join(' ');
}

/** Document shape - rectangle with wavy bottom edge */
function document(w: number, h: number): string {
  const wave = Math.min(h * 0.12, 16);
  return [
    `M 0 0`,
    `H ${w}`,
    `V ${h - wave}`,
    `C ${w * 0.75} ${h - wave * 2} ${w * 0.25} ${h} 0 ${h - wave}`,
    'Z',
  ].join(' ');
}

/** Badge/shield shape - pointed bottom */
function badge(w: number, h: number): string {
  const r = 8;
  const pointH = Math.min(h * 0.2, 20); // how far the point extends
  return [
    `M ${r} 0`,
    `H ${w - r}`,
    `Q ${w} 0 ${w} ${r}`,
    `V ${h - pointH}`,
    `L ${w / 2} ${h}`,
    `L 0 ${h - pointH}`,
    `V ${r}`,
    `Q 0 0 ${r} 0`,
    'Z',
  ].join(' ');
}

/** Registry mapping shape name → SVG path generator function */
export const shapeRegistry: Record<ShapeName, ShapePathGenerator> = {
  rectangle,
  cylinder,
  hexagon,
  parallelogram,
  cloud,
  stadium,
  document,
  badge,
};

/** All supported shape names */
export const shapeNames = Object.keys(shapeRegistry) as ShapeName[];
