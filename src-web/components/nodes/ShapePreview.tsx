import type { Shape } from '@/types/nodeDefSchema';

/** Map of built-in shape names to SVG polygon/path data for tiny previews. */
const BUILTIN_PATHS: Record<string, { points?: string; d?: string; rx?: number }> = {
  rectangle:    { points: '1,1 15,1 15,11 1,11' },
  cylinder:     { points: '1,3 15,3 15,9 1,9', rx: 3 },
  hexagon:      { points: '3,1 13,1 16,6 13,11 3,11 0,6' },
  parallelogram:{ points: '3,1 15,1 13,11 1,11' },
  cloud:        { rx: 5 }, // rendered as rounded rect
  stadium:      { rx: 6 }, // rendered as rounded rect (pill)
  document:     { d: 'M1,1 H15 V9 Q11,12 8,9 Q5,6 1,9 Z' },
  badge:        { rx: 6 }, // rendered as rounded rect (pill)
  container:    { points: '1,1 15,1 15,11 1,11' },
  diamond:      { points: '8,0 16,6 8,12 0,6' },
  trapezoid:    { points: '3,1 13,1 16,11 0,11' },
  octagon:      { points: '5,1 11,1 16,4 16,8 11,11 5,11 0,8 0,4' },
  pentagon:     { points: '8,0 16,5 13,12 3,12 0,5' },
  'arrow-right':{ points: '0,1 12,1 16,6 12,11 0,11' },
  'rounded-rect':{ rx: 4 }, // rendered as rounded rect
};

interface ShapePreviewProps {
  shape: Shape;
  size?: number;
  className?: string;
}

/**
 * Renders a tiny SVG thumbnail of a node shape.
 * Works for all built-in shapes and custom `{ clipPath }` objects.
 */
export function ShapePreview({ shape, size = 16, className }: ShapePreviewProps) {
  const isCustom = typeof shape === 'object' && 'clipPath' in shape;
  const name = isCustom ? null : shape;
  const entry = name ? BUILTIN_PATHS[name] : undefined;

  // For unknown shapes or custom clip-paths, render a small generic diamond
  const fallbackPoints = '8,0 16,6 8,12 0,6';

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="-1 -1 18 14"
      width={size}
      height={size * (14 / 18)}
      className={className}
      aria-hidden="true"
    >
      {entry?.d ? (
        // Path-based shape (document)
        <path
          d={entry.d}
          fill="currentColor"
          opacity={0.35}
          stroke="currentColor"
          strokeWidth={0.8}
        />
      ) : entry?.rx !== undefined && !entry.points ? (
        // Rounded rect shapes (cloud, stadium, badge, rounded-rect)
        <rect
          x={1}
          y={1}
          width={14}
          height={10}
          rx={entry.rx}
          fill="currentColor"
          opacity={0.35}
          stroke="currentColor"
          strokeWidth={0.8}
        />
      ) : (
        // Polygon shapes (most shapes)
        <polygon
          points={entry?.points ?? fallbackPoints}
          fill="currentColor"
          opacity={0.35}
          stroke="currentColor"
          strokeWidth={0.8}
        />
      )}
    </svg>
  );
}
