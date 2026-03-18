import { describe, it, expect } from 'vitest';
import { easeInOut, animateOverlayTransition } from '@/lib/animateOverlayTransition';
import { vi, beforeEach, afterEach } from 'vitest';

describe('easeInOut', () => {
  it('returns 0 at t=0', () => {
    expect(easeInOut(0)).toBe(0);
  });

  it('returns 1 at t=1', () => {
    expect(easeInOut(1)).toBe(1);
  });

  it('returns 0.5 at t=0.5', () => {
    expect(easeInOut(0.5)).toBe(0.5);
  });

  it('is below 0.5 for t < 0.5', () => {
    expect(easeInOut(0.25)).toBeLessThan(0.5);
  });

  it('is above 0.5 for t > 0.5', () => {
    expect(easeInOut(0.75)).toBeGreaterThan(0.5);
  });
});

describe('animateOverlayTransition', () => {
  let rafCallbacks: Array<(time: number) => void>;
  let rafId: number;

  beforeEach(() => {
    rafCallbacks = [];
    rafId = 0;
    vi.stubGlobal('requestAnimationFrame', (cb: (time: number) => void) => {
      rafCallbacks.push(cb);
      return ++rafId;
    });
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function flushRAF(time: number) {
    const cbs = [...rafCallbacks];
    rafCallbacks = [];
    cbs.forEach((cb) => cb(time));
  }

  function makeConfig(overrides: Partial<import('@/lib/animateOverlayTransition').OverlayAnimationConfig> = {}) {
    const overlayEl = { style: { clipPath: '' } } as unknown as HTMLElement;
    const reactFlow = { setViewport: vi.fn() };
    return {
      overlayEl,
      reactFlow,
      startInset: { top: 100, right: 200, bottom: 300, left: 50 },
      endInset: { top: 0, right: 0, bottom: 0, left: 0 },
      startVp: { x: 50, y: 80, zoom: 0.5 },
      endVp: { x: 0, y: 0, zoom: 1 },
      duration: 300,
      onComplete: vi.fn(),
      ...overrides,
    };
  }

  it('sets clip-path and calls setViewport each frame', () => {
    const cfg = makeConfig();
    animateOverlayTransition(cfg);

    flushRAF(0);    // capture start time
    flushRAF(150);  // midpoint

    expect(cfg.overlayEl.style.clipPath).toContain('inset(');
    expect(cfg.reactFlow.setViewport).toHaveBeenCalled();
  });

  it('interpolates clip-path insets linearly', () => {
    const cfg = makeConfig({
      startInset: { top: 100, right: 0, bottom: 0, left: 0 },
      endInset: { top: 0, right: 0, bottom: 0, left: 0 },
      duration: 100,
    });
    animateOverlayTransition(cfg);

    flushRAF(0);
    flushRAF(50); // t=0.5 → eased t ≈ 0.5

    // At eased t=0.5: top = lerp(100, 0, 0.5) = 50
    expect(cfg.overlayEl.style.clipPath).toMatch(/inset\(50/);
  });

  it('interpolates zoom logarithmically', () => {
    const cfg = makeConfig({
      startVp: { x: 0, y: 0, zoom: 1 },
      endVp: { x: 0, y: 0, zoom: 4 },
      duration: 100,
    });
    animateOverlayTransition(cfg);

    flushRAF(0);
    flushRAF(50); // t=0.5, eased ≈ 0.5

    // Log interp at t=0.5: 1 * (4/1)^0.5 = 2
    const call = vi.mocked(cfg.reactFlow.setViewport).mock.calls.at(-1)?.[0];
    expect(call!.zoom).toBeCloseTo(2, 1);
  });

  it('handles same start/end zoom without NaN', () => {
    const cfg = makeConfig({
      startVp: { x: 0, y: 0, zoom: 1 },
      endVp: { x: 100, y: 0, zoom: 1 },
      duration: 100,
    });
    animateOverlayTransition(cfg);

    flushRAF(0);
    flushRAF(50);

    const call = vi.mocked(cfg.reactFlow.setViewport).mock.calls.at(-1)?.[0];
    expect(call!.zoom).toBe(1);
    expect(Number.isNaN(call!.zoom)).toBe(false);
  });

  it('calls onComplete when duration is reached', () => {
    const cfg = makeConfig({ duration: 100 });
    animateOverlayTransition(cfg);

    flushRAF(0);
    flushRAF(100);

    expect(cfg.onComplete).toHaveBeenCalledTimes(1);
  });

  it('does not call onComplete after cancel', () => {
    const cfg = makeConfig({ duration: 200 });
    const cancel = animateOverlayTransition(cfg);

    flushRAF(0);
    cancel();
    flushRAF(200);

    expect(cfg.onComplete).not.toHaveBeenCalled();
  });

  it('calls onComplete immediately for zero duration', () => {
    const cfg = makeConfig({ duration: 0 });
    animateOverlayTransition(cfg);

    expect(cfg.onComplete).toHaveBeenCalledTimes(1);
    expect(cfg.reactFlow.setViewport).toHaveBeenCalledWith(cfg.endVp);
  });

  it('sets final clip-path with endInset at completion', () => {
    const cfg = makeConfig({
      startInset: { top: 100, right: 200, bottom: 300, left: 50 },
      endInset: { top: 0, right: 0, bottom: 0, left: 0 },
      duration: 100,
    });
    animateOverlayTransition(cfg);

    flushRAF(0);
    flushRAF(100);

    expect(cfg.overlayEl.style.clipPath).toMatch(/inset\(0px 0px 0px 0px/);
  });

  it('interpolates border-radius from startRadius to endRadius', () => {
    const cfg = makeConfig({
      startRadius: 10,
      endRadius: 0,
      duration: 100,
    });
    animateOverlayTransition(cfg);

    flushRAF(0);
    flushRAF(50); // eased t ≈ 0.5

    expect(cfg.overlayEl.style.clipPath).toMatch(/round 5/);
  });

  it('defaults startRadius=8, endRadius=0', () => {
    const cfg = makeConfig({ duration: 100 });
    animateOverlayTransition(cfg);

    flushRAF(0);
    flushRAF(0); // t=0 → radius should be 8

    expect(cfg.overlayEl.style.clipPath).toMatch(/round 8/);
  });
});
