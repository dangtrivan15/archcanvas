/**
 * Auto-height animation wrapper that measures content and animates
 * height changes with spring physics.
 * Adapted from animate-ui's AutoHeight primitive.
 */

import type { ReactNode } from 'react';
import { motion, useReducedMotion, type Transition } from 'motion/react';
import useMeasure from 'react-use-measure';

interface AutoHeightProps {
  children: ReactNode;
  className?: string;
  style?: React.CSSProperties;
  transition?: Transition;
}

const defaultTransition: Transition = {
  type: 'spring',
  stiffness: 300,
  damping: 30,
  bounce: 0,
  restDelta: 0.01,
};

export function AutoHeight({
  children,
  className,
  transition = defaultTransition,
  style,
}: AutoHeightProps) {
  const [ref, { height }] = useMeasure();
  const prefersReduced = useReducedMotion();

  return (
    <motion.div
      className={className}
      style={{ overflow: 'hidden', ...style }}
      animate={{ height: height || 'auto' }}
      transition={prefersReduced ? { duration: 0 } : transition}
    >
      <div ref={ref}>{children}</div>
    </motion.div>
  );
}
