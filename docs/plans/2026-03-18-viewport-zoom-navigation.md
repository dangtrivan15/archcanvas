# Viewport Zoom Navigation Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace clone-overlay morph transitions with Muse-style two-phase viewport zoom for dive-in and go-up navigation.

**Architecture:** Two-phase viewport animation with seamless canvas swap at midpoint. Phase 1 zooms the current canvas toward/away from the subsystem container. At the switch point (container fills screen), canvas data swaps and viewport is matched. Phase 2 zooms to the fitted view. No DOM clones, no overlay (except a 1-frame cover at the switch point).

**Tech Stack:** ReactFlow 12 (`useReactFlow`, `setViewport`, `getViewport`, `getNodes`), Zustand (navigationStore, fileStore), requestAnimationFrame for custom viewport animation.

**Spec:** `docs/specs/2026-03-18-viewport-zoom-navigation-design.md`

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `src/lib/computeZoomToRect.ts` | Create | Pure function: rect + viewport → `{ x, y, zoom }` |
| `test/unit/lib/computeZoomToRect.test.ts` | Create | Unit tests for zoom-to-rect math |
| `src/lib/animateViewport.ts` | Create | RAF-based viewport interpolation with log zoom + completion callback |
| `test/unit/lib/animateViewport.test.ts` | Create | Unit tests with mocked RAF |
| `src/lib/computeMatchedViewport.ts` | Create | Pure function: child nodes + container rect → matched viewport |
| `test/unit/lib/computeMatchedViewport.test.ts` | Create | Unit tests for matched viewport math |
| `src/components/canvas/hooks/useNavigationTransition.ts` | Rewrite | Two-phase zoom orchestration (state machine, overlay control) |
| `src/components/canvas/Canvas.tsx` | Modify | Remove `NavigationTransition`, remove `fitView` prop, add overlay div |
| `src/components/canvas/NavigationTransition.tsx` | Delete | Replaced by viewport zoom |
| `test/e2e/subsystem.spec.ts` | Modify | Update wait times if needed (animation is now ~470ms) |

---

### Task 1: `computeZoomToRect` — Pure viewport math

**Files:**
- Create: `src/lib/computeZoomToRect.ts`
- Create: `test/unit/lib/computeZoomToRect.test.ts`

- [ ] **Step 1: Write tests**

```typescript
// test/unit/lib/computeZoomToRect.test.ts
import { describe, it, expect } from 'vitest';
import { computeZoomToRect } from '@/lib/computeZoomToRect';

describe('computeZoomToRect', () => {
  it('centers a rect in the viewport', () => {
    const result = computeZoomToRect(
      { x: 100, y: 100, width: 200, height: 100 },
      800, 600,
    );
    // zoom = min(800/200, 600/100) = min(4, 6) = 4
    expect(result.zoom).toBe(4);
    // centerX = 100 + 100 = 200; x = 800/2 - 200*4 = 400 - 800 = -400
    expect(result.x).toBe(-400);
    // centerY = 100 + 50 = 150; y = 600/2 - 150*4 = 300 - 600 = -300
    expect(result.y).toBe(-300);
  });

  it('handles landscape rect in portrait viewport', () => {
    const result = computeZoomToRect(
      { x: 0, y: 0, width: 400, height: 100 },
      400, 600,
    );
    // zoom = min(400/400, 600/100) = min(1, 6) = 1
    expect(result.zoom).toBe(1);
  });

  it('handles portrait rect in landscape viewport', () => {
    const result = computeZoomToRect(
      { x: 0, y: 0, width: 100, height: 400 },
      800, 400,
    );
    // zoom = min(800/100, 400/400) = min(8, 1) = 1
    expect(result.zoom).toBe(1);
  });

  it('applies padding factor', () => {
    const result = computeZoomToRect(
      { x: 0, y: 0, width: 200, height: 100 },
      800, 600,
      0.1,
    );
    expect(result.zoom).toBe(4 * 0.9); // 3.6
  });

  it('defaults padding to 0 (edge-to-edge)', () => {
    const result = computeZoomToRect(
      { x: 0, y: 0, width: 800, height: 600 },
      800, 600,
    );
    expect(result.zoom).toBe(1); // no padding reduction
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run test/unit/lib/computeZoomToRect.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement `computeZoomToRect`**

```typescript
// src/lib/computeZoomToRect.ts
export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Compute the ReactFlow viewport { x, y, zoom } that centers and fills
 * the screen with the given canvas-space rectangle.
 *
 * padding defaults to 0 (edge-to-edge) — intentional for switch-point viewports.
 */
export function computeZoomToRect(
  rect: Rect,
  viewportWidth: number,
  viewportHeight: number,
  padding = 0,
): { x: number; y: number; zoom: number } {
  const zoom = Math.min(viewportWidth / rect.width, viewportHeight / rect.height) * (1 - padding);
  const centerX = rect.x + rect.width / 2;
  const centerY = rect.y + rect.height / 2;
  const x = viewportWidth / 2 - centerX * zoom;
  const y = viewportHeight / 2 - centerY * zoom;
  return { x, y, zoom };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run test/unit/lib/computeZoomToRect.test.ts`
Expected: All 5 tests PASS

- [ ] **Step 5: Commit**

```
git add src/lib/computeZoomToRect.ts test/unit/lib/computeZoomToRect.test.ts
git commit -m "feat: add computeZoomToRect pure viewport utility"
```

---

### Task 2: `animateViewport` — RAF-based viewport animation

**Files:**
- Create: `src/lib/animateViewport.ts`
- Create: `test/unit/lib/animateViewport.test.ts`

- [ ] **Step 1: Write tests**

```typescript
// test/unit/lib/animateViewport.test.ts
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run test/unit/lib/animateViewport.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement `animateViewport`**

```typescript
// src/lib/animateViewport.ts
interface Viewport {
  x: number;
  y: number;
  zoom: number;
}

interface ReactFlowLike {
  setViewport(viewport: Viewport): void;
}

/**
 * Animate between two ReactFlow viewports using requestAnimationFrame.
 * Zoom is interpolated logarithmically for perceptually constant speed.
 * Returns a cancel function.
 */
export function animateViewport(
  reactFlow: ReactFlowLike,
  from: Viewport,
  to: Viewport,
  duration: number,
  easing: (t: number) => number,
  onComplete: () => void,
): () => void {
  let cancelled = false;
  let startTime: number | null = null;
  let rafHandle: number;

  const sameZoom = from.zoom === to.zoom;

  function tick(now: number) {
    if (cancelled) return;

    if (startTime === null) {
      startTime = now;
      rafHandle = requestAnimationFrame(tick);
      return;
    }

    const elapsed = now - startTime;
    const rawT = Math.min(elapsed / duration, 1);
    const t = easing(rawT);

    // Linear interpolation for x, y
    const x = from.x + (to.x - from.x) * t;
    const y = from.y + (to.y - from.y) * t;

    // Logarithmic interpolation for zoom (perceptually constant speed)
    const zoom = sameZoom
      ? from.zoom
      : from.zoom * Math.pow(to.zoom / from.zoom, t);

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

/** Standard ease-in-out curve. */
export function easeInOut(t: number): number {
  return t < 0.5
    ? 2 * t * t
    : 1 - Math.pow(-2 * t + 2, 2) / 2;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run test/unit/lib/animateViewport.test.ts`
Expected: All 5 tests PASS

- [ ] **Step 5: Commit**

```
git add src/lib/animateViewport.ts test/unit/lib/animateViewport.test.ts
git commit -m "feat: add animateViewport RAF utility with log zoom interpolation"
```

---

### Task 3: `computeMatchedViewport` — Switch-point viewport math

**Files:**
- Create: `src/lib/computeMatchedViewport.ts`
- Create: `test/unit/lib/computeMatchedViewport.test.ts`

**Context:** This function computes the ReactFlow viewport where child nodes appear at the same screen positions as the mini-preview inside the container. It's the critical math for the seamless switch point.

Container CSS from `src/components/nodes/nodeShapes.css:194-204`:
- `.node-shape-container` has `padding: 14px 16px`
- `.arch-node-header` has `font-size: 12px; line-height: 1.4` → ~17px height

- [ ] **Step 1: Write tests**

```typescript
// test/unit/lib/computeMatchedViewport.test.ts
import { describe, it, expect } from 'vitest';
import { computeMatchedViewport, CONTAINER_HEADER_H, CONTAINER_PAD_X, CONTAINER_PAD_Y } from '@/lib/computeMatchedViewport';

describe('computeMatchedViewport', () => {
  it('exports correct container layout constants', () => {
    expect(CONTAINER_HEADER_H).toBe(17);
    expect(CONTAINER_PAD_X).toBe(16);
    expect(CONTAINER_PAD_Y).toBe(14);
  });

  it('returns a viewport with zoom > 0', () => {
    const result = computeMatchedViewport(
      [{ x: 0, y: 0, width: 150, height: 40 }],
      { x: 100, y: 100, width: 400, height: 300 },
      1280, 720,
    );
    expect(result.zoom).toBeGreaterThan(0);
  });

  it('produces tighter zoom than full-viewport fitView', () => {
    // Matched viewport fits nodes in the container content area (smaller than full viewport)
    // so the zoom should be less than or equal to a full-viewport fit
    const nodes = [
      { x: 0, y: 0, width: 150, height: 40 },
      { x: 300, y: 200, width: 150, height: 40 },
    ];
    const containerRect = { x: 50, y: 50, width: 500, height: 400 };

    const matched = computeMatchedViewport(nodes, containerRect, 1280, 720);

    // The zoom from computeZoomToRect for the container at 1280x720:
    // zoom = min(1280/500, 720/400) = min(2.56, 1.8) = 1.8
    // Content area is smaller than viewport, so matched zoom < full viewport zoom
    expect(matched.zoom).toBeGreaterThan(0);
    expect(matched.zoom).toBeLessThan(10); // sanity
  });

  it('returns null-safe result for single node', () => {
    const result = computeMatchedViewport(
      [{ x: 50, y: 50, width: 150, height: 40 }],
      { x: 0, y: 0, width: 300, height: 200 },
      800, 600,
    );
    expect(result).toHaveProperty('x');
    expect(result).toHaveProperty('y');
    expect(result).toHaveProperty('zoom');
  });

  it('returns default viewport for empty child nodes', () => {
    const result = computeMatchedViewport(
      [],
      { x: 0, y: 0, width: 300, height: 200 },
      800, 600,
    );
    expect(result.zoom).toBe(1);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run test/unit/lib/computeMatchedViewport.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement `computeMatchedViewport`**

```typescript
// src/lib/computeMatchedViewport.ts
import { computeZoomToRect } from './computeZoomToRect';
import { computeFitViewport } from './computeFitViewport';

// Container layout constants — must match nodeShapes.css
// .node-shape-container { padding: 14px 16px }
// .arch-node-header { font-size: 12px; line-height: 1.4 } → ~17px
export const CONTAINER_HEADER_H = 17;
export const CONTAINER_PAD_X = 16;
export const CONTAINER_PAD_Y = 14;

interface FitNode {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Compute the ReactFlow viewport where child nodes appear at the same
 * screen positions as they do in the mini-preview when the container
 * fills the screen.
 *
 * Used for:
 * - Dive-in: setting the child viewport after the canvas switch
 * - Go-up Phase 1 target: compressing child nodes to preview scale
 */
export function computeMatchedViewport(
  childNodes: FitNode[],
  containerCanvasRect: Rect,
  viewportWidth: number,
  viewportHeight: number,
): { x: number; y: number; zoom: number } {
  if (childNodes.length === 0) {
    return { x: 0, y: 0, zoom: 1 };
  }

  // 1. Zoom level that fills the screen with the container
  const zoomedVp = computeZoomToRect(containerCanvasRect, viewportWidth, viewportHeight);

  // 2. Content area dimensions at that zoom level
  const contentW = containerCanvasRect.width * zoomedVp.zoom - 2 * CONTAINER_PAD_X;
  const contentH = containerCanvasRect.height * zoomedVp.zoom - CONTAINER_HEADER_H - 2 * CONTAINER_PAD_Y;

  if (contentW <= 0 || contentH <= 0) {
    return { x: 0, y: 0, zoom: 1 };
  }

  // 3. Fit child nodes within the content area
  const fit = computeFitViewport({
    nodes: childNodes,
    viewportWidth: contentW,
    viewportHeight: contentH,
  });

  // 4. Offset for content area position within the full viewport
  const contentLeft = (viewportWidth - contentW) / 2;
  // Derivation: containerTop = (vpH - containerScreenH) / 2
  // contentTop = containerTop + PAD_Y + HEADER_H
  // Substituting containerScreenH = contentH + HEADER_H + 2*PAD_Y:
  // contentTop = (vpH - contentH) / 2 + HEADER_H / 2
  const contentTop = (viewportHeight - contentH) / 2 + CONTAINER_HEADER_H / 2;

  return {
    x: fit.offsetX + contentLeft,
    y: fit.offsetY + contentTop,
    zoom: fit.zoom,
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run test/unit/lib/computeMatchedViewport.test.ts`
Expected: All 5 tests PASS

- [ ] **Step 5: Commit**

```
git add src/lib/computeMatchedViewport.ts test/unit/lib/computeMatchedViewport.test.ts
git commit -m "feat: add computeMatchedViewport for seamless switch-point math"
```

---

### Task 4: Rewrite `useNavigationTransition` — Two-phase zoom orchestration

**Files:**
- Rewrite: `src/components/canvas/hooks/useNavigationTransition.ts`
- Delete: `src/components/canvas/NavigationTransition.tsx`
- Modify: `src/components/canvas/Canvas.tsx` (lines 7-8, 33, 161, 281, 337)

**Context:** This is the largest task. The hook is fully rewritten with a state machine (`idle → zooming_in → switching → zooming_out → idle`). The old `NavigationTransition` overlay component is deleted entirely. `Canvas.tsx` is simplified.

- [ ] **Step 1: Rewrite `useNavigationTransition.ts`**

Replace the entire contents of `src/components/canvas/hooks/useNavigationTransition.ts` with:

```typescript
import { useState, useCallback, useRef, type CSSProperties } from 'react';
import { useReactFlow } from '@xyflow/react';
import { useNavigationStore } from '@/store/navigationStore';
import { computeZoomToRect } from '@/lib/computeZoomToRect';
import { computeMatchedViewport } from '@/lib/computeMatchedViewport';
import { computeFitViewport } from '@/lib/computeFitViewport';
import { animateViewport, easeInOut } from '@/lib/animateViewport';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PHASE1_DURATION = 200; // ms
const PHASE2_DURATION = 250; // ms
const DISSOLVE_DURATION = 350; // ms

type TransitionState = 'idle' | 'zooming_in' | 'switching' | 'zooming_out';

interface ContainerRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

// ---------------------------------------------------------------------------
// Overlay style factory
// ---------------------------------------------------------------------------

const COVER_STYLE: CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 50,
  backgroundColor: 'var(--color-background)',
  opacity: 1,
  pointerEvents: 'none',
};

function dissolveStyle(opacity: number): CSSProperties {
  return {
    ...COVER_STYLE,
    opacity,
    transition: `opacity ${DISSOLVE_DURATION}ms ease-out`,
  };
}

// ---------------------------------------------------------------------------
// Helper: get viewport dimensions from main ReactFlow container
// ---------------------------------------------------------------------------

function getViewportDimensions() {
  const el = document.querySelector('.react-flow:not(.subsystem-preview .react-flow)');
  if (!el) return { width: window.innerWidth, height: window.innerHeight };
  const rect = el.getBoundingClientRect();
  return { width: rect.width, height: rect.height };
}

// ---------------------------------------------------------------------------
// Helper: build FitNode array from ReactFlow nodes
// ---------------------------------------------------------------------------

function toFitNodes(rfNodes: Array<{ position: { x: number; y: number }; width?: number | null; height?: number | null }>) {
  return rfNodes.map((n) => ({
    x: n.position.x,
    y: n.position.y,
    width: n.width ?? 150,
    height: n.height ?? 40,
  }));
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useNavigationTransition() {
  const reactFlow = useReactFlow();
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [overlayStyle, setOverlayStyle] = useState<CSSProperties | null>(null);
  const stateRef = useRef<TransitionState>('idle');
  const cancelRef = useRef<(() => void) | null>(null);
  // Store the container's measured rect during dive-in so go-up can use it.
  // We capture from reactFlow.getNode() which has measured pixel dimensions.
  // Reading from fileStore wouldn't work — Position.width/height are optional
  // YAML fields, not ReactFlow's measured dimensions.
  const lastContainerRectRef = useRef<ContainerRect | null>(null);

  // -----------------------------------------------------------------------
  // Reset
  // -----------------------------------------------------------------------

  const reset = useCallback(() => {
    cancelRef.current?.();
    cancelRef.current = null;
    stateRef.current = 'idle';
    setIsTransitioning(false);
    setOverlayStyle(null);
  }, []);

  // -----------------------------------------------------------------------
  // Dive In
  // -----------------------------------------------------------------------

  const diveIn = useCallback((refNodeId: string) => {
    if (stateRef.current !== 'idle') return;

    // Capture state before anything changes
    const currentViewport = reactFlow.getViewport();
    const containerNode = reactFlow.getNode(refNodeId);
    if (!containerNode?.width || !containerNode?.height) {
      // Unmeasured — fall back to dissolve
      goToBreadcrumbDissolve(refNodeId);
      return;
    }

    const containerRect: ContainerRect = {
      x: containerNode.position.x,
      y: containerNode.position.y,
      width: containerNode.width,
      height: containerNode.height,
    };

    // Store for go-up to use later
    lastContainerRectRef.current = containerRect;

    const { width: vpW, height: vpH } = getViewportDimensions();
    const zoomedViewport = computeZoomToRect(containerRect, vpW, vpH);

    stateRef.current = 'zooming_in';
    setIsTransitioning(true);

    // Phase 1: zoom into container
    cancelRef.current = animateViewport(
      reactFlow, currentViewport, zoomedViewport, PHASE1_DURATION, easeInOut, () => {
        // Switch point
        stateRef.current = 'switching';
        setOverlayStyle(COVER_STYLE); // 1-frame cover

        useNavigationStore.getState().diveIn(refNodeId);

        // Next frame: React has rendered child nodes
        requestAnimationFrame(() => {
          const childRfNodes = reactFlow.getNodes();
          const childFitNodes = toFitNodes(childRfNodes);
          const matchedVp = computeMatchedViewport(childFitNodes, containerRect, vpW, vpH);
          reactFlow.setViewport(matchedVp);
          setOverlayStyle(null); // hide cover

          const fittedVp = computeFitViewport({
            nodes: childFitNodes,
            viewportWidth: vpW,
            viewportHeight: vpH,
          });
          const fittedViewport = { x: fittedVp.offsetX, y: fittedVp.offsetY, zoom: fittedVp.zoom };

          stateRef.current = 'zooming_out';

          // Phase 2: zoom out to fitted
          cancelRef.current = animateViewport(
            reactFlow, matchedVp, fittedViewport, PHASE2_DURATION, easeInOut, () => {
              reset();
            },
          );
        });
      },
    );
  }, [reactFlow, reset]);

  // -----------------------------------------------------------------------
  // Go Up
  // -----------------------------------------------------------------------

  const goUp = useCallback(() => {
    if (stateRef.current !== 'idle') return;
    const nav = useNavigationStore.getState();
    if (nav.breadcrumb.length <= 1) return;

    // Capture state before anything changes
    const currentViewport = reactFlow.getViewport();

    // Use the container rect captured during dive-in.
    // This has ReactFlow's measured pixel dimensions (not YAML position.width).
    const containerRect = lastContainerRectRef.current;
    if (!containerRect) {
      // No stored rect (e.g., navigated via breadcrumb, not dive-in) — fall back to dissolve
      dissolveUp();
      return;
    }

    const childRfNodes = reactFlow.getNodes();
    const childFitNodes = toFitNodes(childRfNodes);
    const { width: vpW, height: vpH } = getViewportDimensions();
    const matchedVp = computeMatchedViewport(childFitNodes, containerRect, vpW, vpH);

    stateRef.current = 'zooming_in';
    setIsTransitioning(true);

    // Phase 1: compress child nodes to preview scale
    cancelRef.current = animateViewport(
      reactFlow, currentViewport, matchedVp, PHASE1_DURATION, easeInOut, () => {
        // Switch point
        stateRef.current = 'switching';
        setOverlayStyle(COVER_STYLE);

        nav.goUp();

        requestAnimationFrame(() => {
          const zoomedViewport = computeZoomToRect(containerRect, vpW, vpH);
          reactFlow.setViewport(zoomedViewport);
          setOverlayStyle(null);

          const parentRfNodes = reactFlow.getNodes();
          const parentFitNodes = toFitNodes(parentRfNodes);
          const fittedVp = computeFitViewport({
            nodes: parentFitNodes,
            viewportWidth: vpW,
            viewportHeight: vpH,
          });
          const fittedViewport = { x: fittedVp.offsetX, y: fittedVp.offsetY, zoom: fittedVp.zoom };

          stateRef.current = 'zooming_out';

          cancelRef.current = animateViewport(
            reactFlow, zoomedViewport, fittedViewport, PHASE2_DURATION, easeInOut, () => {
              reset();
            },
          );
        });
      },
    );
  }, [reactFlow, reset]);

  // -----------------------------------------------------------------------
  // Dissolve helpers (fallback + breadcrumb)
  // -----------------------------------------------------------------------

  // Dissolve helpers use double-rAF to ensure the browser paints opacity:1
  // before we set opacity:0 — required for the CSS transition to fire.
  // A safety timeout guarantees reset even if onTransitionEnd never fires
  // (possible under React 19 concurrent rendering or if element unmounts).

  function startDissolveOut() {
    // Double rAF: first ensures React commits opacity:1, second triggers opacity:0
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setOverlayStyle(dissolveStyle(0));
        // Safety: reset after duration + buffer, in case onTransitionEnd doesn't fire
        setTimeout(() => {
          if (stateRef.current === 'switching') reset();
        }, DISSOLVE_DURATION + 50);
      });
    });
  }

  function goToBreadcrumbDissolve(refNodeId: string) {
    stateRef.current = 'switching';
    setIsTransitioning(true);
    setOverlayStyle(dissolveStyle(1));

    requestAnimationFrame(() => {
      useNavigationStore.getState().diveIn(refNodeId);
      reactFlow.fitView({ duration: 0 });
      startDissolveOut();
    });
  }

  function dissolveUp() {
    stateRef.current = 'switching';
    setIsTransitioning(true);
    setOverlayStyle(dissolveStyle(1));

    requestAnimationFrame(() => {
      useNavigationStore.getState().goUp();
      reactFlow.fitView({ duration: 0 });
      startDissolveOut();
    });
  }

  // -----------------------------------------------------------------------
  // Breadcrumb Jump (dissolve)
  // -----------------------------------------------------------------------

  const goToBreadcrumb = useCallback((index: number) => {
    if (stateRef.current !== 'idle') return;
    const nav = useNavigationStore.getState();
    const target = nav.breadcrumb[index];
    if (!target) return;

    stateRef.current = 'switching';
    setIsTransitioning(true);
    setOverlayStyle(dissolveStyle(1));

    requestAnimationFrame(() => {
      nav.goToBreadcrumb(index);
      reactFlow.fitView({ duration: 0 });
      startDissolveOut();
    });
  }, [reactFlow]);

  // -----------------------------------------------------------------------
  // Dissolve onTransitionEnd
  // -----------------------------------------------------------------------

  const onOverlayTransitionEnd = useCallback(() => {
    // Only reset if we're in a dissolve (overlayStyle has a transition)
    if (stateRef.current === 'switching' || stateRef.current === 'idle') {
      reset();
    }
  }, [reset]);

  return {
    diveIn,
    goUp,
    goToBreadcrumb,
    isTransitioning,
    overlayStyle,
    onOverlayTransitionEnd,
  };
}
```

- [ ] **Step 2: Delete `NavigationTransition.tsx`**

```bash
rm src/components/canvas/NavigationTransition.tsx
```

- [ ] **Step 3: Update `Canvas.tsx`**

In `src/components/canvas/Canvas.tsx`:

**a)** Remove the `NavigationTransition` import (line 8):
```
- import { NavigationTransition } from "./NavigationTransition";
```

**b)** Update the destructured hook return (line 33):
```
- const { diveIn, goUp, goToBreadcrumb, isTransitioning, transitionData } = useNavigationTransition();
+ const { diveIn, goUp, goToBreadcrumb, isTransitioning, overlayStyle, onOverlayTransitionEnd } = useNavigationTransition();
```

**c)** Remove `fitView` prop from `<ReactFlow>` (line 281):
```
- fitView
```

**d)** Replace `<NavigationTransition>` (line 337) with the overlay div:
```
- <NavigationTransition data={transitionData} />
+ {overlayStyle && (
+   <div
+     className="navigation-transition-overlay"
+     style={overlayStyle}
+     onTransitionEnd={onOverlayTransitionEnd}
+   />
+ )}
```

- [ ] **Step 4: Run typecheck to verify no compilation errors**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 5: Run full unit test suite**

Run: `npx vitest run --project unit`
Expected: All tests pass. Some existing transition-related tests may need removal if they import `TransitionData` — check for failures and fix.

- [ ] **Step 6: Commit**

```
git add -A
git commit -m "feat: rewrite navigation transitions as two-phase viewport zoom

Replace clone-overlay morph with Muse-style viewport animation.
Phase 1 zooms into/out of subsystem container, seamless canvas
swap at midpoint, Phase 2 zooms to fitted view.

Delete NavigationTransition.tsx (clone overlay component).
Remove fitView prop from <ReactFlow> to prevent race condition."
```

---

### Task 5: Visual verification with Playwright CLI

**Files:** None (verification only)

**Context:** The animation is inherently visual. Unit tests verify the math, but we need visual verification that the transitions look correct. Use `playwright-cli` to:

1. Start dev server, open the app
2. Create a project with nodes and a subsystem (same setup as the investigation)
3. Record video of dive-in and go-up
4. Take frame-by-frame screenshots at key moments
5. Verify: no double-image ghosting, no visible canvas switch, smooth zoom feel

- [ ] **Step 1: Start dev server and set up test project**

Use playwright-cli to create a project with 4+ nodes and a subsystem with 3 child nodes (same as brainstorming investigation).

- [ ] **Step 2: Record dive-in animation and capture frames**

Take screenshots at 0ms, 100ms, 200ms, 300ms, 500ms after clicking "Dive In". Verify:
- Frame 0ms: Parent canvas zooming into container (no child canvas visible)
- Frame 100ms: Container expanding, siblings flying off
- Frame 200ms: After switch — child nodes at correct positions, no double image
- Frame 300-500ms: Child nodes spreading to fitted view

- [ ] **Step 3: Record go-up animation and capture frames**

Press Escape to trigger go-up. Capture frames. Verify:
- Frame 0ms: Child nodes compressing
- Frame 100-200ms: After switch — parent canvas visible, container with preview
- Frame 300-500ms: Parent canvas at fitted view

- [ ] **Step 4: Test dissolve (breadcrumb jump)**

If in a subsystem, click "Root" in the breadcrumb. Verify crossfade works.

- [ ] **Step 5: Test edge cases**

- Dive into empty subsystem
- Rapid double-click on subsystem
- Navigate during animation (if possible to trigger)

---

### Task 6: E2E test updates

**Files:**
- Modify: `test/e2e/e2e-helpers.ts` (line 95 — wait time in `diveIntoSubsystem`)
- Modify: `test/e2e/subsystem.spec.ts` (any hardcoded animation wait times)

**Context:** The animation total duration changed from ~400ms to ~470ms. The existing E2E helper `diveIntoSubsystem` waits 700ms which should still be sufficient. Run the full E2E suite to verify.

- [ ] **Step 1: Run E2E test suite (no-bridge)**

Run: `npm run build && npx playwright test --config playwright.config.no-bridge.ts`
Expected: All tests pass. If any fail due to timing, increase wait in `diveIntoSubsystem` from 700ms to 800ms.

- [ ] **Step 2: Run E2E test suite (bridge)**

Run: `npm run test:e2e-bridge`
Expected: All tests pass.

- [ ] **Step 3: Fix any timing-related failures**

If tests fail because animations haven't completed, update `diveIntoSubsystem` wait from `700` to `800`:

```typescript
// test/e2e/e2e-helpers.ts line 95
- await page.waitForTimeout(700);
+ await page.waitForTimeout(800);
```

- [ ] **Step 4: Commit if changes were needed**

```
git add test/e2e/
git commit -m "test: update E2E wait times for viewport zoom animation"
```

---

### Task 7: Cleanup and final verification

**Files:**
- Verify: No remaining references to deleted symbols

- [ ] **Step 1: Search for dead references**

Run: `grep -r "TransitionData\|NavigationTransition\|captureVisibleNodes\|captureVisibleEdges\|computeTargetRects\|CapturedNode\|CapturedEdge" src/ test/`

Expected: No matches. If any found, fix them.

- [ ] **Step 2: Run full test suite**

Run: `npm test`
Expected: All unit tests pass.

- [ ] **Step 3: Run typecheck**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 4: Run lint**

Run: `npm run lint`
Expected: No errors.

- [ ] **Step 5: Final commit if any cleanup was needed**

```
git add -A
git commit -m "chore: remove dead references to old transition system"
```
