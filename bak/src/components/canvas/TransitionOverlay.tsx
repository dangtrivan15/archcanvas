/**
 * TransitionOverlay - Handles the crossfade animation between parent and child canvases.
 *
 * Renders a full-screen overlay that fades in/out to create a smooth visual
 * transition when diving into or out of a container node. The overlay uses
 * the container node's color for a branded transition effect.
 *
 * Respects `prefers-reduced-motion`: when enabled, the overlay is not shown
 * and transitions happen instantly.
 */

import { memo, useEffect, useState } from 'react';

export type TransitionPhase = 'idle' | 'zoom-in' | 'crossfade-in' | 'crossfade-out' | 'zoom-out-fade' | 'zoom-out';

export interface TransitionOverlayProps {
  /** Current phase of the transition animation */
  phase: TransitionPhase;
  /** Color of the container node being transitioned into/from */
  color?: string;
  /** Duration of the crossfade in milliseconds */
  crossfadeDuration?: number;
  /** Callback when the crossfade-in phase completes (overlay fully opaque) */
  onCrossfadeInComplete?: () => void;
  /** Callback when the crossfade-out phase completes (overlay fully transparent) */
  onCrossfadeOutComplete?: () => void;
}

function TransitionOverlayComponent({
  phase,
  color = '#0EA5E9',
  crossfadeDuration = 150,
  onCrossfadeInComplete,
  onCrossfadeOutComplete,
}: TransitionOverlayProps) {
  const [opacity, setOpacity] = useState(0);

  useEffect(() => {
    if (phase === 'crossfade-in' || phase === 'zoom-out-fade') {
      // Fade in the overlay
      // Use requestAnimationFrame to ensure the opacity:0 is painted first
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setOpacity(1);
        });
      });
      // After the transition completes, notify parent
      const timer = setTimeout(() => {
        onCrossfadeInComplete?.();
      }, crossfadeDuration + 20); // small buffer
      return () => clearTimeout(timer);
    } else if (phase === 'crossfade-out' || phase === 'zoom-out') {
      // Fade out the overlay
      requestAnimationFrame(() => {
        setOpacity(0);
      });
      const timer = setTimeout(() => {
        onCrossfadeOutComplete?.();
      }, crossfadeDuration + 20);
      return () => clearTimeout(timer);
    } else if (phase === 'idle') {
      setOpacity(0);
    }
  }, [phase, crossfadeDuration, onCrossfadeInComplete, onCrossfadeOutComplete]);

  // Don't render anything when idle and fully transparent
  if (phase === 'idle') return null;

  return (
    <div
      className="absolute inset-0 pointer-events-none z-50"
      style={{
        opacity,
        transition: `opacity ${crossfadeDuration}ms ease-in-out`,
        background: `radial-gradient(ellipse at center, ${color}40 0%, ${color}18 40%, hsl(var(--background)) 100%)`,
        backdropFilter: opacity > 0.3 ? 'blur(2px)' : undefined,
      }}
      data-testid="transition-overlay"
      aria-hidden="true"
    />
  );
}

export const TransitionOverlay = memo(TransitionOverlayComponent);
