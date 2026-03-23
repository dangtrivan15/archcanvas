/**
 * Animated light-sweep (shine) effect with configurable triggers.
 * Adapted from animate-ui's Shine primitive.
 */

import * as React from 'react';
import { motion, useReducedMotion } from 'motion/react';

interface ShineProps extends React.ComponentProps<'div'> {
  /** Shine color */
  color?: string;
  /** Shine opacity */
  opacity?: number;
  /** Initial delay (ms) */
  delay?: number;
  /** Sweep duration (ms) */
  duration?: number;
  /** Repeat continuously */
  loop?: boolean;
  /** Delay between loops (ms) */
  loopDelay?: number;
  /** Skew angle */
  deg?: number;
  /** Enable on hover only */
  enableOnHover?: boolean;
}

export function Shine({
  color = 'currentColor',
  opacity: shineOpacity = 0.3,
  delay = 0,
  duration = 1200,
  loop = false,
  loopDelay = 0,
  deg = -15,
  enableOnHover = false,
  style,
  children,
  ...props
}: ShineProps) {
  const prefersReduced = useReducedMotion();
  const isAlwaysOn = !enableOnHover;
  const [animateState, setAnimateState] = React.useState<'initial' | 'shine'>(
    isAlwaysOn ? 'shine' : 'initial',
  );
  const [currentDelay, setCurrentDelay] = React.useState(delay);
  const isHovered = React.useRef(false);

  const handleMouseEnter = React.useCallback(() => {
    if (!enableOnHover) return;
    isHovered.current = true;
    setCurrentDelay(delay);
    setAnimateState('shine');
  }, [enableOnHover, delay]);

  const handleMouseLeave = React.useCallback(() => {
    if (!enableOnHover) return;
    isHovered.current = false;
  }, [enableOnHover]);

  const handleComplete = React.useCallback(() => {
    if (animateState !== 'shine') return;
    if (loop && (isAlwaysOn || isHovered.current)) {
      setAnimateState('initial');
      setCurrentDelay(0);
      // Schedule next loop
      const id = window.setTimeout(() => setAnimateState('shine'), loopDelay);
      return () => window.clearTimeout(id);
    }
    if (!isAlwaysOn) setAnimateState('initial');
  }, [animateState, loop, isAlwaysOn, loopDelay]);

  if (prefersReduced) {
    return (
      <div style={{ position: 'relative', overflow: 'hidden', ...style }} {...props}>
        {children}
      </div>
    );
  }

  return (
    <div
      style={{ position: 'relative', overflow: 'hidden', ...style }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      {...props}
    >
      {children}
      <motion.div
        initial="initial"
        animate={animateState}
        variants={{
          initial: { x: '-100%', skewX: deg, transition: { duration: 0 } },
          shine: { x: '100%', skewX: deg },
        }}
        transition={{
          duration: duration / 1000,
          ease: [0.4, 0, 0.2, 1],
          delay: currentDelay / 1000,
        }}
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 10,
          pointerEvents: 'none',
          width: '100%',
          height: '100%',
          background: `linear-gradient(to right, transparent, ${color}, transparent)`,
          opacity: shineOpacity,
        }}
        onAnimationComplete={handleComplete}
      />
    </div>
  );
}
