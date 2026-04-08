/**
 * Skeleton placeholder that composes the existing Shine component
 * (adapted from animate-ui) for its shimmer effect.
 *
 * Provides common skeleton shapes (line, circle, rect) for use as
 * loading placeholders across the UI.
 */

import { cn } from '@/lib/utils';
import { Shine } from '@/components/ui/shine';

interface SkeletonLoaderProps {
  /** Visual shape of the skeleton */
  variant?: 'line' | 'circle' | 'rect';
  /** Width — CSS value or Tailwind class override via className */
  width?: string;
  /** Height — CSS value or Tailwind class override via className */
  height?: string;
  /** Additional class names */
  className?: string;
  /** Number of skeleton lines to render (only for variant="line") */
  count?: number;
}

const baseClasses = 'rounded bg-muted';

export function SkeletonLoader({
  variant = 'line',
  width,
  height,
  className,
  count = 1,
}: SkeletonLoaderProps) {
  if (variant === 'circle') {
    return (
      <Shine loop loopDelay={600} duration={1200} color="currentColor" opacity={0.12}>
        <div
          className={cn(baseClasses, 'rounded-full', className)}
          style={{ width: width ?? '2rem', height: height ?? '2rem' }}
          aria-hidden="true"
        />
      </Shine>
    );
  }

  if (variant === 'rect') {
    return (
      <Shine loop loopDelay={600} duration={1200} color="currentColor" opacity={0.12}>
        <div
          className={cn(baseClasses, className)}
          style={{ width: width ?? '100%', height: height ?? '4rem' }}
          aria-hidden="true"
        />
      </Shine>
    );
  }

  // Default: line(s)
  const lines = Array.from({ length: count }, (_, i) => (
    <Shine key={i} loop loopDelay={600 + i * 100} duration={1200} color="currentColor" opacity={0.12}>
      <div
        className={cn(baseClasses, 'h-3', className)}
        style={{
          width: width ?? (i === count - 1 && count > 1 ? '60%' : '100%'),
          height: height,
        }}
        aria-hidden="true"
      />
    </Shine>
  ));

  return count === 1 ? lines[0] : <div className="space-y-2">{lines}</div>;
}
