import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { SkeletonLoader } from '@/components/ui/skeleton-loader';

// ---------------------------------------------------------------------------
// Mock motion/react (used transitively by Shine)
// ---------------------------------------------------------------------------

vi.mock('motion/react', () => ({
  motion: {
    div: ({
      children,
      ...props
    }: Record<string, unknown> & { children?: React.ReactNode }) => {
      const {
        initial: _i,
        animate: _a,
        exit: _e,
        transition: _t,
        variants: _v,
        onAnimationComplete: _o,
        ...domProps
      } = props;
      return <div {...domProps}>{children}</div>;
    },
  },
  useReducedMotion: () => false,
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('SkeletonLoader', () => {
  it('renders a single line skeleton by default', () => {
    const { container } = render(<SkeletonLoader />);
    const skeletons = container.querySelectorAll('[aria-hidden="true"]');
    expect(skeletons).toHaveLength(1);
  });

  it('renders multiple line skeletons when count > 1', () => {
    const { container } = render(<SkeletonLoader count={3} />);
    const skeletons = container.querySelectorAll('[aria-hidden="true"]');
    expect(skeletons).toHaveLength(3);
  });

  it('renders a circle skeleton', () => {
    const { container } = render(<SkeletonLoader variant="circle" />);
    const skeleton = container.querySelector('[aria-hidden="true"]');
    expect(skeleton).toBeInTheDocument();
    expect(skeleton?.className).toContain('rounded-full');
  });

  it('renders a rect skeleton', () => {
    const { container } = render(<SkeletonLoader variant="rect" />);
    const skeleton = container.querySelector('[aria-hidden="true"]');
    expect(skeleton).toBeInTheDocument();
    expect(skeleton?.className).toContain('rounded');
    expect(skeleton?.className).not.toContain('rounded-full');
  });

  it('applies custom width and height to circle', () => {
    const { container } = render(
      <SkeletonLoader variant="circle" width="3rem" height="3rem" />,
    );
    const skeleton = container.querySelector('[aria-hidden="true"]') as HTMLElement;
    expect(skeleton.style.width).toBe('3rem');
    expect(skeleton.style.height).toBe('3rem');
  });

  it('applies custom className', () => {
    const { container } = render(
      <SkeletonLoader className="custom-skeleton" />,
    );
    const skeleton = container.querySelector('[aria-hidden="true"]');
    expect(skeleton?.className).toContain('custom-skeleton');
  });

  it('all skeletons are aria-hidden', () => {
    const { container } = render(<SkeletonLoader count={2} />);
    const skeletons = container.querySelectorAll('[aria-hidden="true"]');
    skeletons.forEach((el) => {
      expect(el.getAttribute('aria-hidden')).toBe('true');
    });
  });

  it('last line in multi-count is shorter (60% width)', () => {
    const { container } = render(<SkeletonLoader count={3} />);
    const skeletons = container.querySelectorAll('[aria-hidden="true"]');
    const lastSkeleton = skeletons[2] as HTMLElement;
    expect(lastSkeleton.style.width).toBe('60%');
  });
});
