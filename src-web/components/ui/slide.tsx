/**
 * Slide animation primitive for directional enter/exit transitions.
 * Adapted from animate-ui's Slide primitive following the established
 * copy-paste-adapt model used by shine.tsx, auto-height.tsx, etc.
 *
 * Wraps children in a motion container that slides in/out along the
 * x or y axis. Respects prefers-reduced-motion.
 */

import * as React from 'react';
import { motion, AnimatePresence, useReducedMotion, type Transition } from 'motion/react';
import { duration, ease } from '@/lib/motion';

type Direction = 'left' | 'right' | 'up' | 'down';

interface SlideProps {
  children: React.ReactNode;
  /** Unique key for AnimatePresence — triggers enter/exit on change */
  motionKey: string;
  /** Direction the content slides FROM on enter */
  direction?: Direction;
  /** Translate distance in pixels */
  offset?: number;
  /** Also fade opacity during slide */
  fade?: boolean;
  /** Override the default transition */
  transition?: Transition;
  /** Additional class names on the motion wrapper */
  className?: string;
  /** Additional inline styles */
  style?: React.CSSProperties;
}

function getAxis(direction: Direction): 'x' | 'y' {
  return direction === 'left' || direction === 'right' ? 'x' : 'y';
}

function getSign(direction: Direction): 1 | -1 {
  return direction === 'right' || direction === 'down' ? 1 : -1;
}

const defaultTransition: Transition = {
  duration: duration.moderate,
  ease: ease.out,
};

export function Slide({
  children,
  motionKey,
  direction = 'right',
  offset = 12,
  fade = true,
  transition = defaultTransition,
  className,
  style,
}: SlideProps) {
  const prefersReduced = useReducedMotion();
  const axis = getAxis(direction);
  const sign = getSign(direction);

  const initial = prefersReduced
    ? false
    : {
        [axis]: offset * sign,
        ...(fade && { opacity: 0 }),
      };

  const animate = {
    [axis]: 0,
    ...(fade && { opacity: 1 }),
  };

  const exit = prefersReduced
    ? undefined
    : {
        [axis]: offset * -sign,
        ...(fade && { opacity: 0 }),
      };

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={motionKey}
        initial={initial}
        animate={animate}
        exit={exit}
        transition={prefersReduced ? { duration: 0 } : transition}
        className={className}
        style={style}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
