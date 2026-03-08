/**
 * NestingFrame - Renders concentric inset border frames around the canvas
 * as the user dives deeper into nested canvases.
 *
 * Each level adds a subtle border frame with a tint derived from the parent
 * container node's color. This creates the spatial metaphor of "going deeper":
 * the visible canvas area appears to shrink with each nesting level.
 *
 * - Frame thickness: configurable per level (default 4px), max total inset ~48px
 * - Color: uses the container node's color at each level for the tint
 * - Animation: frames slide in from edges on dive-in and slide out on dive-out
 * - Purely visual overlay - does NOT affect React Flow's coordinate system
 * - Can be disabled entirely in settings
 */

import { memo, useMemo } from 'react';
import { useNestedCanvasStore } from '@/store/nestedCanvasStore';
import { useNavigationStore } from '@/store/navigationStore';
import { useUIStore } from '@/store/uiStore';

// ─── Constants ──────────────────────────────────────────────────

/** Maximum depth before capping frame thickness (prevents canvas from becoming unusable) */
const MAX_DEPTH_CAP = 12;

/** Default color when no container color is available */
const DEFAULT_FRAME_COLOR = '#64748B'; // slate-500

/** Minimum opacity for the outermost (shallowest) frame */
const MIN_OPACITY = 0.08;

/** Maximum opacity for the innermost (deepest) frame */
const MAX_OPACITY = 0.25;

// ─── Types ──────────────────────────────────────────────────────

interface FrameLevel {
  /** Depth index (0 = shallowest / outermost frame) */
  index: number;
  /** Inset distance from edge in px */
  inset: number;
  /** Color for this frame's border and tint */
  color: string;
  /** Opacity of the background tint */
  opacity: number;
  /** Border width in px */
  borderWidth: number;
}

// ─── Component ──────────────────────────────────────────────────

function NestingFrameComponent() {
  const fileStack = useNestedCanvasStore((s) => s.fileStack);
  const navigationPath = useNavigationStore((s) => s.path);
  const nestingFrameEnabled = useUIStore((s) => s.nestingFrameEnabled);
  const nestingFrameThickness = useUIStore((s) => s.nestingFrameThickness);

  // Total depth = cross-file depth + intra-file fractal zoom depth
  const fileDepth = fileStack.length;
  const navDepth = navigationPath.length;
  const totalDepth = fileDepth + navDepth;

  // Compute frame levels
  const frames = useMemo(() => {
    if (!nestingFrameEnabled || totalDepth === 0) return [];

    const cappedDepth = Math.min(totalDepth, MAX_DEPTH_CAP);
    const levels: FrameLevel[] = [];

    for (let i = 0; i < cappedDepth; i++) {
      // Get color from file stack if available, otherwise default
      const stackEntry = fileStack[i];
      const color = stackEntry?.containerColor || DEFAULT_FRAME_COLOR;

      // Inset increases with each level
      const inset = i * nestingFrameThickness;

      // Opacity increases as we go deeper (inner frames more prominent)
      const opacityRange = MAX_OPACITY - MIN_OPACITY;
      const opacity = cappedDepth === 1
        ? MIN_OPACITY + opacityRange * 0.5
        : MIN_OPACITY + (opacityRange * i) / (cappedDepth - 1);

      // Border width: thin for outer frames, slightly thicker for inner
      const borderWidth = i === cappedDepth - 1 ? 2 : 1;

      levels.push({ index: i, inset, color, opacity, borderWidth });
    }

    return levels;
  }, [nestingFrameEnabled, totalDepth, fileStack, nestingFrameThickness]);

  if (frames.length === 0) return null;

  return (
    <div
      className="absolute inset-0 pointer-events-none"
      style={{ zIndex: 35 }}
      data-testid="nesting-frame"
      data-depth={totalDepth}
      aria-hidden="true"
    >
      {frames.map((frame) => (
        <div
          key={frame.index}
          className="absolute transition-all duration-300 ease-out"
          data-testid={`nesting-frame-level-${frame.index}`}
          style={{
            top: frame.inset,
            left: frame.inset,
            right: frame.inset,
            bottom: frame.inset,
            borderWidth: frame.borderWidth,
            borderStyle: 'solid',
            borderColor: hexToRgba(frame.color, 0.3 + frame.opacity),
            backgroundColor: hexToRgba(frame.color, frame.opacity * 0.3),
            borderRadius: Math.max(0, 8 - frame.index),
            // Animation: slide in from edges
            animation: 'nestingFrameSlideIn 300ms ease-out both',
            animationDelay: `${frame.index * 30}ms`,
          }}
        />
      ))}
    </div>
  );
}

/**
 * Convert a hex color string to rgba with the given alpha.
 * Handles 3-char, 6-char, and 8-char hex values.
 */
function hexToRgba(hex: string, alpha: number): string {
  // Strip # prefix
  let h = hex.replace(/^#/, '');

  // Expand shorthand (e.g. "abc" -> "aabbcc")
  if (h.length === 3) {
    h = h[0]! + h[0]! + h[1]! + h[1]! + h[2]! + h[2]!;
  }

  // If 8-char (with alpha), strip the last 2 chars
  if (h.length === 8) {
    h = h.slice(0, 6);
  }

  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);

  if (isNaN(r) || isNaN(g) || isNaN(b)) {
    // Fallback for invalid hex
    return `rgba(100, 116, 139, ${alpha})`;
  }

  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export const NestingFrame = memo(NestingFrameComponent);
