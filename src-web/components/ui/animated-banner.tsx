/**
 * Reusable animated banner for error, warning, info, and success messages.
 * Animates height + opacity on enter/exit. Respects prefers-reduced-motion.
 *
 * Replaces the inline banner pattern found in ChatPanel and ProjectGate
 * with a single, consistent implementation.
 */

import * as React from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { cn } from '@/lib/utils';
import { bannerTransition } from '@/lib/motion';

type BannerVariant = 'error' | 'warning' | 'info' | 'success';

interface AnimatedBannerProps {
  /** Controls visibility — when falsy the banner exit-animates out */
  visible: boolean;
  /** Visual variant determines color scheme */
  variant?: BannerVariant;
  /** Banner content */
  children: React.ReactNode;
  /** ARIA role override (default: 'alert' for error, 'status' otherwise) */
  role?: React.AriaRole;
  /** Additional class names */
  className?: string;
}

const variantStyles: Record<BannerVariant, string> = {
  error:
    'border-red-800 bg-red-950/50 text-red-300',
  warning:
    'border-amber-800 bg-amber-950/50 text-amber-300',
  info:
    'border-blue-800 bg-blue-950/50 text-blue-300',
  success:
    'border-green-800 bg-green-950/50 text-green-300',
};

export function AnimatedBanner({
  visible,
  variant = 'error',
  children,
  role: roleProp,
  className,
}: AnimatedBannerProps) {
  const prefersReduced = useReducedMotion();
  const defaultRole = variant === 'error' ? 'alert' : 'status';

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key={`banner-${variant}`}
          className={cn(
            'overflow-hidden border-b px-3 py-1.5 text-xs',
            variantStyles[variant],
            className,
          )}
          role={roleProp ?? defaultRole}
          initial={prefersReduced ? false : { height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={prefersReduced ? undefined : { height: 0, opacity: 0 }}
          transition={bannerTransition}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
