# Overlay Navigation — Task 1: Animation Utility Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `animateOverlayTransition` — the RAF loop that drives clip-path + viewport interpolation for overlay navigation transitions.

**Architecture:** Single exported function that takes a config object and returns a cancel function. Each frame computes an eased `t`, lerps clip-path insets + border-radius, lerps viewport x/y linearly and zoom logarithmically, then applies both to the DOM element and ReactFlow instance. Also exports `easeInOut` for reuse.

**Tech Stack:** TypeScript, Vitest, requestAnimationFrame

---

### Task 1.1: Write failing tests for easeInOut

**Files:**
- Create: `test/unit/lib/animateOverlayTransition.test.ts`

- [ ] **Step 1: Create test file with easeInOut tests**

```ts
import { describe, it, expect } from 'vitest';
import { easeInOut } from '@/lib/animateOverlayTransition';

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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:unit -- --reporter=verbose test/unit/lib/animateOverlayTransition.test.ts`
Expected: FAIL — cannot find module `@/lib/animateOverlayTransition`

### Task 1.2: Implement easeInOut + types

**Files:**
- Create: `src/lib/animateOverlayTransition.ts`

- [ ] **Step 3: Create source file with types and easeInOut**

```ts
export interface Inset {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface Viewport {
  x: number;
  y: number;
  zoom: number;
}

export interface OverlayAnimationConfig {
  overlayEl: HTMLElement;
  reactFlow: { setViewport(vp: Viewport): void };
  startInset: Inset;
  endInset: Inset;
  startVp: Viewport;
  endVp: Viewport;
  startRadius?: number;
  endRadius?: number;
  duration: number;
  onComplete: () => void;
}

/** Cubic ease-in-out: smooth acceleration then deceleration. */
export function easeInOut(t: number): number {
  return t < 0.5
    ? 4 * t * t * t
    : 1 - Math.pow(-2 * t + 2, 3) / 2;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:unit -- --reporter=verbose test/unit/lib/animateOverlayTransition.test.ts`
Expected: All 5 easeInOut tests PASS

### Task 1.3: Write failing tests for animateOverlayTransition

**Files:**
- Modify: `test/unit/lib/animateOverlayTransition.test.ts`

- [ ] **Step 5: Add RAF test harness and core animation tests**

Add these after the `easeInOut` describe block:

```ts
import { animateOverlayTransition } from '@/lib/animateOverlayTransition';
import { vi, beforeEach, afterEach } from 'vitest';

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
    const call = cfg.reactFlow.setViewport.mock.calls.at(-1)?.[0];
    expect(call.zoom).toBeCloseTo(2, 1);
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

    const call = cfg.reactFlow.setViewport.mock.calls.at(-1)?.[0];
    expect(call.zoom).toBe(1);
    expect(Number.isNaN(call.zoom)).toBe(false);
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
```

- [ ] **Step 6: Run tests to verify they fail**

Run: `npm run test:unit -- --reporter=verbose test/unit/lib/animateOverlayTransition.test.ts`
Expected: easeInOut tests PASS, all animateOverlayTransition tests FAIL (function not exported)

### Task 1.4: Implement animateOverlayTransition

**Files:**
- Modify: `src/lib/animateOverlayTransition.ts`

- [ ] **Step 7: Add the animation function**

Add after the `easeInOut` function:

```ts
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Animate an overlay's clip-path and viewport simultaneously using requestAnimationFrame.
 * Clip insets and border-radius are interpolated linearly.
 * Viewport x/y are interpolated linearly; zoom is interpolated logarithmically.
 * Returns a cancel function.
 */
export function animateOverlayTransition(config: OverlayAnimationConfig): () => void {
  const {
    overlayEl,
    reactFlow,
    startInset: si,
    endInset: ei,
    startVp,
    endVp,
    startRadius = 8,
    endRadius = 0,
    duration,
    onComplete,
  } = config;

  // Zero duration: apply end state immediately
  if (duration <= 0) {
    overlayEl.style.clipPath =
      `inset(${ei.top}px ${ei.right}px ${ei.bottom}px ${ei.left}px round ${endRadius}px)`;
    reactFlow.setViewport(endVp);
    onComplete();
    return () => {};
  }

  let cancelled = false;
  let startTime: number | null = null;
  let rafHandle: number;
  const sameZoom = startVp.zoom === endVp.zoom;

  function tick(now: number) {
    if (cancelled) return;

    if (startTime === null) {
      startTime = now;
      rafHandle = requestAnimationFrame(tick);
      return;
    }

    const elapsed = now - startTime;
    const rawT = Math.min(elapsed / duration, 1);
    const t = easeInOut(rawT);

    // Clip-path insets + border-radius
    const top = lerp(si.top, ei.top, t);
    const right = lerp(si.right, ei.right, t);
    const bottom = lerp(si.bottom, ei.bottom, t);
    const left = lerp(si.left, ei.left, t);
    const rad = lerp(startRadius, endRadius, t);
    overlayEl.style.clipPath =
      `inset(${top}px ${right}px ${bottom}px ${left}px round ${rad}px)`;

    // Viewport: linear x/y, logarithmic zoom
    const x = lerp(startVp.x, endVp.x, t);
    const y = lerp(startVp.y, endVp.y, t);
    const zoom = sameZoom
      ? startVp.zoom
      : startVp.zoom * Math.pow(endVp.zoom / startVp.zoom, t);
    reactFlow.setViewport({ x, y, zoom });

    if (rawT >= 1) {
      onComplete();
    } else {
      rafHandle = requestAnimationFrame(tick);
    }
  }

  rafHandle = requestAnimationFrame(tick);

  return () => {
    cancelled = true;
    cancelAnimationFrame(rafHandle);
  };
}
```

- [ ] **Step 8: Run all tests to verify they pass**

Run: `npm run test:unit -- --reporter=verbose test/unit/lib/animateOverlayTransition.test.ts`
Expected: All tests PASS (easeInOut + animateOverlayTransition)

- [ ] **Step 9: Run typecheck**

Run: `npm run typecheck`
Expected: No errors

- [ ] **Step 10: Commit**

```bash
git add src/lib/animateOverlayTransition.ts test/unit/lib/animateOverlayTransition.test.ts
git commit -m "feat: add animateOverlayTransition utility for clip-path + viewport RAF animation"
```
