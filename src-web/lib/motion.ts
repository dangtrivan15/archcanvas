/**
 * Shared motion constants — durations, easing curves, spring configs, and
 * entrance presets used across the UI.
 *
 * This module is pure TypeScript (no React imports) so it can be consumed
 * by any layer without pulling in runtime dependencies.
 */

import type { Transition } from 'motion/react';

// ---------------------------------------------------------------------------
// Durations (seconds)
// ---------------------------------------------------------------------------

export const duration = {
  /** Ultra-fast — content switch / panel swap */
  fast: 0.12,
  /** Banner enter/exit, list item fade */
  normal: 0.15,
  /** Dialog overlay, fade-up intro */
  moderate: 0.2,
  /** Staggered landing elements */
  slow: 0.35,
} as const;

// ---------------------------------------------------------------------------
// Easing curves
// ---------------------------------------------------------------------------

export const ease = {
  /** Default exit curve */
  out: 'easeOut' as const,
  /** Natural deceleration curve used in dialogs & wizard steps */
  outExpo: [0.16, 1, 0.3, 1] as readonly [number, number, number, number],
  /** Shine / sweep effect */
  standard: [0.4, 0, 0.2, 1] as readonly [number, number, number, number],
} as const;

// ---------------------------------------------------------------------------
// Spring presets (for Motion's spring type)
// ---------------------------------------------------------------------------

export const spring = {
  /** Snappy selection / chip bounce */
  snappy: { type: 'spring', stiffness: 500, damping: 30 } as const,
  /** Smooth height change (auto-height wrapper) */
  smooth: {
    type: 'spring',
    stiffness: 300,
    damping: 30,
    bounce: 0,
    restDelta: 0.01,
  } as const,
} as const;

// ---------------------------------------------------------------------------
// Entrance presets (used with <motion.div {...entrance.fadeUp}>) when
// reduced motion is NOT active. Each preset is an object suitable for
// spreading onto a motion component.
// ---------------------------------------------------------------------------

export const entrance = {
  /** Opacity 0 → 1 + y offset 8 → 0 */
  fadeUp: {
    initial: { opacity: 0, y: 8 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: duration.moderate, ease: ease.out },
  },
  /** Opacity only (used by RightPanel content swap) */
  fade: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    transition: { duration: duration.fast },
  },
  /** Slide in from right (panel transition) */
  slideInRight: {
    initial: { opacity: 0, x: 12 },
    animate: { opacity: 1, x: 0 },
    transition: { duration: duration.moderate, ease: ease.out },
  },
  /** Slide in from left (reverse panel transition) */
  slideInLeft: {
    initial: { opacity: 0, x: -12 },
    animate: { opacity: 1, x: 0 },
    transition: { duration: duration.moderate, ease: ease.out },
  },
} as const;

// ---------------------------------------------------------------------------
// Banner transition
// ---------------------------------------------------------------------------

export const bannerTransition: Transition = {
  duration: duration.normal,
  ease: ease.out,
};

// ---------------------------------------------------------------------------
// Helper: conditionally return entrance props or static values when the
// user prefers reduced motion.
// ---------------------------------------------------------------------------

/**
 * Returns animation props suitable for spreading onto a `<motion.*>`
 * component. When `prefersReduced` is true the returned `initial` is
 * `false` (skip entrance) and `exit` is `undefined` (skip exit).
 *
 * Usage:
 * ```tsx
 * const prefersReduced = useReducedMotion();
 * <motion.div {...withReducedMotion(prefersReduced, entrance.fadeUp)} />
 * ```
 */
export function withReducedMotion(
  prefersReduced: boolean | null,
  preset: {
    initial: Record<string, unknown>;
    animate: Record<string, unknown>;
    transition: Transition;
    exit?: Record<string, unknown>;
  },
) {
  if (prefersReduced) {
    return {
      initial: false as const,
      animate: preset.animate,
      exit: undefined,
      transition: { duration: 0 },
    };
  }
  return preset;
}
