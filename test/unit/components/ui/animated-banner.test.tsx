import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AnimatedBanner } from '@/components/ui/animated-banner';

// ---------------------------------------------------------------------------
// Mock motion/react to avoid animation runtime in tests
// ---------------------------------------------------------------------------

vi.mock('motion/react', () => ({
  motion: {
    div: ({
      children,
      ...props
    }: Record<string, unknown> & { children?: React.ReactNode }) => {
      // Filter out motion-specific props before forwarding to DOM
      const {
        initial: _i,
        animate: _a,
        exit: _e,
        transition: _t,
        ...domProps
      } = props;
      return <div {...domProps}>{children}</div>;
    },
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
  useReducedMotion: () => false,
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AnimatedBanner', () => {
  it('renders children when visible', () => {
    render(
      <AnimatedBanner visible variant="error">
        Something went wrong
      </AnimatedBanner>,
    );
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
  });

  it('does not render when not visible', () => {
    render(
      <AnimatedBanner visible={false} variant="error">
        Hidden content
      </AnimatedBanner>,
    );
    expect(screen.queryByText('Hidden content')).not.toBeInTheDocument();
  });

  it('uses role="alert" for error variant by default', () => {
    render(
      <AnimatedBanner visible variant="error">
        Error!
      </AnimatedBanner>,
    );
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('uses role="status" for non-error variants by default', () => {
    render(
      <AnimatedBanner visible variant="warning">
        Warning!
      </AnimatedBanner>,
    );
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('uses role="status" for info variant', () => {
    render(
      <AnimatedBanner visible variant="info">
        Info!
      </AnimatedBanner>,
    );
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('applies error variant styling', () => {
    render(
      <AnimatedBanner visible variant="error">
        Error text
      </AnimatedBanner>,
    );
    const banner = screen.getByRole('alert');
    expect(banner.className).toContain('border-red-800');
    expect(banner.className).toContain('bg-red-950/50');
    expect(banner.className).toContain('text-red-300');
  });

  it('applies warning variant styling', () => {
    render(
      <AnimatedBanner visible variant="warning">
        Warning text
      </AnimatedBanner>,
    );
    const banner = screen.getByRole('status');
    expect(banner.className).toContain('border-amber-800');
    expect(banner.className).toContain('text-amber-300');
  });

  it('applies success variant styling', () => {
    render(
      <AnimatedBanner visible variant="success">
        Success text
      </AnimatedBanner>,
    );
    const banner = screen.getByRole('status');
    expect(banner.className).toContain('border-green-800');
    expect(banner.className).toContain('text-green-300');
  });

  it('allows role override', () => {
    render(
      <AnimatedBanner visible variant="error" role="log">
        Custom role
      </AnimatedBanner>,
    );
    expect(screen.getByRole('log')).toBeInTheDocument();
  });

  it('applies additional className', () => {
    render(
      <AnimatedBanner visible variant="info" className="custom-class">
        Styled
      </AnimatedBanner>,
    );
    const banner = screen.getByRole('status');
    expect(banner.className).toContain('custom-class');
  });
});
