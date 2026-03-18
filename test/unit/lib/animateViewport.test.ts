import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { animateViewport } from '@/lib/animateViewport';

describe('animateViewport', () => {
  let rafCallbacks: Array<(time: number) => void>;
  let rafId: number;

  beforeEach(() => {
    rafCallbacks = [];
    rafId = 0;
    vi.stubGlobal('requestAnimationFrame', (cb: (time: number) => void) => {
      rafCallbacks.push(cb);
      return ++rafId;
    });
    vi.stubGlobal('cancelAnimationFrame', (id: number) => {
      // Remove by id (simplified: just clear all)
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function flushRAF(time: number) {
    const cbs = [...rafCallbacks];
    rafCallbacks = [];
    cbs.forEach((cb) => cb(time));
  }

  it('calls setViewport on each frame', () => {
    const setViewport = vi.fn();
    const reactFlow = { setViewport } as any;
    const from = { x: 0, y: 0, zoom: 1 };
    const to = { x: 100, y: 200, zoom: 2 };

    animateViewport(reactFlow, from, to, 200, (t) => t, vi.fn());

    // First RAF: starts the animation (captures start time)
    flushRAF(0);
    // Second RAF: progress = 0 (same time)
    flushRAF(0);
    expect(setViewport).toHaveBeenCalled();
  });

  it('interpolates zoom logarithmically', () => {
    const setViewport = vi.fn();
    const reactFlow = { setViewport } as any;
    const from = { x: 0, y: 0, zoom: 1 };
    const to = { x: 0, y: 0, zoom: 4 };

    animateViewport(reactFlow, from, to, 100, (t) => t, vi.fn());

    flushRAF(0);   // start
    flushRAF(50);  // midpoint (t=0.5)

    // At t=0.5 with log interpolation: 1 * (4/1)^0.5 = 1 * 2 = 2
    const midCall = setViewport.mock.calls[setViewport.mock.calls.length - 1][0];
    expect(midCall.zoom).toBeCloseTo(2, 1);
  });

  it('calls onComplete when duration is reached', () => {
    const onComplete = vi.fn();
    const setViewport = vi.fn();
    const reactFlow = { setViewport } as any;

    animateViewport(reactFlow, { x: 0, y: 0, zoom: 1 }, { x: 100, y: 0, zoom: 1 }, 100, (t) => t, onComplete);

    flushRAF(0);    // start
    flushRAF(100);  // end

    expect(onComplete).toHaveBeenCalledTimes(1);
    // Final setViewport should be at the target
    const lastCall = setViewport.mock.calls[setViewport.mock.calls.length - 1][0];
    expect(lastCall.x).toBe(100);
  });

  it('returns a cancel function that stops the animation', () => {
    const onComplete = vi.fn();
    const setViewport = vi.fn();
    const reactFlow = { setViewport } as any;

    const cancel = animateViewport(
      reactFlow, { x: 0, y: 0, zoom: 1 }, { x: 100, y: 0, zoom: 1 }, 200, (t) => t, onComplete,
    );

    flushRAF(0);   // start
    cancel();
    flushRAF(100); // would be midpoint, but cancelled

    expect(onComplete).not.toHaveBeenCalled();
  });

  it('handles from.zoom === to.zoom (no zoom change)', () => {
    const setViewport = vi.fn();
    const reactFlow = { setViewport } as any;

    animateViewport(reactFlow, { x: 0, y: 0, zoom: 1 }, { x: 100, y: 0, zoom: 1 }, 100, (t) => t, vi.fn());

    flushRAF(0);
    flushRAF(50);

    const midCall = setViewport.mock.calls[setViewport.mock.calls.length - 1][0];
    expect(midCall.zoom).toBe(1);
    expect(midCall.x).toBeCloseTo(50, 1);
  });
});
