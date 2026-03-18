# Navigation Animation Fix + Resize Handle Visibility — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the one-frame flash in dive-in/go-up transitions by mounting the overlay before the canvas switch, implement true spatial morph (mini-nodes → full-size nodes), and make resize handles visible.

**Architecture:** The overlay (`NavigationTransition`) must be mounted and opaque before `navigationStore.diveIn()`/`goUp()` switches the canvas. The hook (`useNavigationTransition`) calls `setTransitionData` twice: first with `sourceNodes` (overlay appears), then with `targetNodes` after the canvas renders behind it (triggers CSS transition). A `currentTransitionRef` in the component distinguishes "new transition" from "targets arrived" to avoid resetting the phase.

**Tech Stack:** React 19, ReactFlow 12, Zustand 5, CSS transitions, Vitest, Playwright

**Spec:** `docs/specs/2026-03-18-navigation-animation-fix-design.md`

---

## Files

| File | Action | Responsibility |
|------|--------|----------------|
| `src/components/nodes/SubsystemPreview.tsx` | Modify | Add `data-node-id` attr to `<g>` elements |
| `src/components/canvas/hooks/useNavigationTransition.ts` | Rewrite | Two-phase sequencing, `captureMiniNodes`, `transitioningRef` |
| `src/components/canvas/NavigationTransition.tsx` | Rewrite | Source→target morph rendering, `currentTransitionRef` phase logic |
| `src/components/nodes/nodeShapes.css` | Modify | Resize handle corner visibility |
| `test/unit/components/SubsystemPreview.test.tsx` | Modify | Test `data-node-id` attribute |

---

## Task 1: SubsystemPreview — add `data-node-id` attribute

**Files:**
- Modify: `src/components/nodes/SubsystemPreview.tsx:83`
- Modify: `test/unit/components/SubsystemPreview.test.tsx`

- [ ] **Step 1: Write the failing test**

In `test/unit/components/SubsystemPreview.test.tsx`, add after the existing tests:

```tsx
it('renders data-node-id attribute on each g element', () => {
  setCanvas('test-canvas', {
    nodes: [
      { id: 'node-a', type: 'service', position: { x: 0, y: 0 } },
      { id: 'node-b', type: 'database', position: { x: 100, y: 50 } },
    ],
  });
  const { container } = render(<SubsystemPreview canvasId="test-canvas" />);
  const groups = container.querySelectorAll('g[data-node-id]');
  expect(groups.length).toBe(2);
  expect(groups[0].getAttribute('data-node-id')).toBe('node-a');
  expect(groups[1].getAttribute('data-node-id')).toBe('node-b');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/unit/components/SubsystemPreview.test.tsx`
Expected: FAIL — `g[data-node-id]` selector finds 0 elements.

- [ ] **Step 3: Add the attribute**

In `src/components/nodes/SubsystemPreview.tsx`, line 83, change:

```tsx
// Before
<g key={n.id}>

// After
<g key={n.id} data-node-id={n.id}>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/unit/components/SubsystemPreview.test.tsx`
Expected: All 6 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/nodes/SubsystemPreview.tsx test/unit/components/SubsystemPreview.test.tsx
git commit -m "feat: add data-node-id to SubsystemPreview for morph capture"
```

---

## Task 2: Rewrite useNavigationTransition hook

**Files:**
- Rewrite: `src/components/canvas/hooks/useNavigationTransition.ts`

**Context:**
- The `TransitionData` interface changes: `nodes` → `sourceNodes` + `targetNodes`, add `targetContainerRect`.
- The `dissolve` direction still uses `sourceNodes: []` / `targetNodes: []` (no morph).
- `NavigationTransition.tsx` consumes `TransitionData` — it will be updated in Task 3 but will temporarily break between Tasks 2 and 3. That's fine since both are committed together.

- [ ] **Step 1: Rewrite the full hook**

Replace the entire contents of `src/components/canvas/hooks/useNavigationTransition.ts` with:

```ts
import { useState, useCallback, useRef } from 'react';
import { useReactFlow } from '@xyflow/react';
import { useNavigationStore } from '@/store/navigationStore';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CapturedNode {
  id: string;
  rect: DOMRect;
  label: string;
  color: string;
}

interface CapturedEdge {
  sourceId: string;
  targetId: string;
}

export interface TransitionData {
  direction: 'in' | 'out' | 'dissolve';
  /** Where clones START (mini-node rects for dive-in, full-size rects for go-up) */
  sourceNodes: CapturedNode[];
  /** Where clones END (full-size rects for dive-in, mini-node rects for go-up) */
  targetNodes: CapturedNode[];
  /** Edges connecting animated nodes */
  edges: CapturedEdge[];
  /** Container rect at source phase */
  containerRect: DOMRect | null;
  /** Container rect at target phase (for go-up: where nodes shrink to) */
  targetContainerRect: DOMRect | null;
  /** Sibling nodes (for fade-out on dive-in, fade-in on go-up) */
  siblings: CapturedNode[];
  /** The canvas ID we're transitioning FROM */
  fromCanvasId: string;
  /** The canvas ID we're transitioning TO */
  toCanvasId: string;
  /** Callback to finalize the transition (called on animation end) */
  onComplete: () => void;
}

const TRANSITION_DURATION = 350; // ms

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useNavigationTransition() {
  const reactFlow = useReactFlow();
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [transitionData, setTransitionData] = useState<TransitionData | null>(null);
  const transitioningRef = useRef(false);

  // -----------------------------------------------------------------------
  // Helpers
  // -----------------------------------------------------------------------

  /** Read current screen rect for a ReactFlow node element */
  const getNodeRect = (nodeId: string): DOMRect | null => {
    const el = document.querySelector(`[data-id="${nodeId}"]`);
    return el ? el.getBoundingClientRect() : null;
  };

  /** Capture all visible node positions from the DOM */
  const captureVisibleNodes = (): CapturedNode[] => {
    const nodes: CapturedNode[] = [];
    document.querySelectorAll('.react-flow__node').forEach((el) => {
      const id = el.getAttribute('data-id');
      if (!id || id.startsWith('__ghost__')) return;
      const rect = el.getBoundingClientRect();
      const nameEl = el.querySelector('.arch-node-header-name');
      nodes.push({
        id,
        rect,
        label: nameEl?.textContent ?? id,
        color: 'var(--color-node-border)',
      });
    });
    return nodes;
  };

  /** Capture visible edges */
  const captureVisibleEdges = (): CapturedEdge[] => {
    const edges: CapturedEdge[] = [];
    document.querySelectorAll('.react-flow__edge').forEach((el) => {
      const id = el.getAttribute('data-testid') ?? el.id ?? '';
      const parts = id.replace('rf__edge-', '').split('-');
      if (parts.length >= 2) {
        edges.push({ sourceId: parts[0], targetId: parts[1] });
      }
    });
    return edges;
  };

  /** Capture mini-node screen positions from a SubsystemPreview SVG */
  const captureMiniNodes = (refNodeId: string): CapturedNode[] => {
    const container = document.querySelector(`[data-id="${refNodeId}"]`);
    const svg = container?.querySelector('.subsystem-preview');
    if (!svg) return [];

    const nodes: CapturedNode[] = [];
    svg.querySelectorAll('g[data-node-id]').forEach((g) => {
      const id = g.getAttribute('data-node-id')!;
      const rect = g.querySelector('rect');
      if (!rect) return;
      const screenRect = rect.getBoundingClientRect();
      const text = g.querySelector('text')?.textContent ?? id;
      const fill = rect.getAttribute('fill') ?? '';
      nodes.push({ id, rect: screenRect, label: text, color: fill });
    });
    return nodes;
  };

  /** Shared finalize callback */
  const finalize = useCallback(() => {
    setTransitionData(null);
    setIsTransitioning(false);
    transitioningRef.current = false;
    requestAnimationFrame(() => {
      reactFlow.fitView({ duration: 300 });
    });
  }, [reactFlow]);

  // -----------------------------------------------------------------------
  // Dive In
  // -----------------------------------------------------------------------

  const diveIn = useCallback((refNodeId: string) => {
    if (transitioningRef.current) return;
    transitioningRef.current = true;

    const currentCanvasId = useNavigationStore.getState().currentCanvasId;
    const containerRect = getNodeRect(refNodeId);

    // Capture source positions: mini-nodes from the SubsystemPreview SVG
    const sourceNodes = captureMiniNodes(refNodeId);

    // Capture siblings (all nodes except the target container)
    const allNodes = captureVisibleNodes();
    const siblings = allNodes.filter((n) => n.id !== refNodeId);

    // Phase 1: Mount overlay with clones at mini-node positions
    setIsTransitioning(true);
    setTransitionData({
      direction: 'in',
      sourceNodes,
      targetNodes: [],
      edges: [],
      containerRect: containerRect ?? null,
      targetContainerRect: null,
      siblings,
      fromCanvasId: currentCanvasId,
      toCanvasId: refNodeId,
      onComplete: finalize,
    });

    // Switch canvas behind the overlay (batched with above in same React commit)
    useNavigationStore.getState().diveIn(refNodeId);

    // Phase 2: After ReactFlow renders the new canvas, capture target positions
    requestAnimationFrame(() => {
      const targetNodes = captureVisibleNodes();
      const edges = captureVisibleEdges();

      setTransitionData((prev) =>
        prev ? { ...prev, targetNodes, edges } : null,
      );
    });
  }, [finalize]);

  // -----------------------------------------------------------------------
  // Go Up (reverse morph)
  // -----------------------------------------------------------------------

  const goUp = useCallback(() => {
    if (transitioningRef.current) return;
    const nav = useNavigationStore.getState();
    if (nav.breadcrumb.length <= 1) return;
    transitioningRef.current = true;

    const fromCanvasId = nav.currentCanvasId;

    // Capture source positions: full-size nodes from the current canvas
    const sourceNodes = captureVisibleNodes();
    const edges = captureVisibleEdges();

    // Phase 1: Mount overlay with full-size clones
    setIsTransitioning(true);
    setTransitionData({
      direction: 'out',
      sourceNodes,
      targetNodes: [],
      edges,
      containerRect: null,
      targetContainerRect: null,
      siblings: [],
      fromCanvasId,
      toCanvasId: '',
      onComplete: finalize,
    });

    // Switch canvas behind the overlay
    nav.goUp();

    // Phase 2: After parent canvas renders, capture target positions
    requestAnimationFrame(() => {
      const toCanvasId = useNavigationStore.getState().currentCanvasId;
      const targetContainerRect = getNodeRect(fromCanvasId);
      const targetNodes = captureMiniNodes(fromCanvasId);
      const parentNodes = captureVisibleNodes();
      const siblings = parentNodes.filter((n) => n.id !== fromCanvasId);

      setTransitionData((prev) =>
        prev
          ? { ...prev, targetNodes, targetContainerRect: targetContainerRect ?? null, siblings, toCanvasId }
          : null,
      );
    });
  }, [finalize]);

  // -----------------------------------------------------------------------
  // Breadcrumb Jump (dissolve) — unchanged logic, updated field names
  // -----------------------------------------------------------------------

  const goToBreadcrumb = useCallback((index: number) => {
    if (transitioningRef.current) return;
    const nav = useNavigationStore.getState();
    const fromCanvasId = nav.currentCanvasId;
    const target = nav.breadcrumb[index];
    if (!target) return;
    transitioningRef.current = true;

    setIsTransitioning(true);

    setTransitionData({
      direction: 'dissolve',
      sourceNodes: [],
      targetNodes: [],
      edges: [],
      containerRect: null,
      targetContainerRect: null,
      siblings: [],
      fromCanvasId,
      toCanvasId: target.canvasId,
      onComplete: finalize,
    });

    // Perform navigation after overlay renders
    requestAnimationFrame(() => {
      nav.goToBreadcrumb(index);
    });
  }, [finalize]);

  return {
    diveIn,
    goUp,
    goToBreadcrumb,
    isTransitioning,
    transitionData,
  };
}
```

- [ ] **Step 2: Verify typecheck passes**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: Errors only from `NavigationTransition.tsx` referencing `data.nodes` (old field). This is expected — Task 3 fixes it.

- [ ] **Step 3: Do NOT commit yet** — Task 3 must be done atomically with this task.

---

## Task 3: Rewrite NavigationTransition component

**Files:**
- Rewrite: `src/components/canvas/NavigationTransition.tsx`

**Context:**
- Must consume the new `TransitionData` shape (`sourceNodes`/`targetNodes` instead of `nodes`).
- Phase model changes from `initial | animate` to `source | animate`.
- Uses `currentTransitionRef` to detect "same transition, targets arrived" vs "new transition."
- Dissolve direction is unchanged in behavior.

- [ ] **Step 1: Rewrite the full component**

Replace the entire contents of `src/components/canvas/NavigationTransition.tsx` with:

```tsx
import { useEffect, useRef, useState } from 'react';
import type { TransitionData } from './hooks/useNavigationTransition';

interface NavigationTransitionProps {
  data: TransitionData | null;
}

const TRANSITION_DURATION = 350; // ms — must match hook

export function NavigationTransition({ data }: NavigationTransitionProps) {
  const [phase, setPhase] = useState<'source' | 'animate'>('source');
  const overlayRef = useRef<HTMLDivElement>(null);
  const completedRef = useRef(false);
  const currentTransitionRef = useRef<string | null>(null);

  // Phase management: distinguish "new transition" from "targets arrived"
  useEffect(() => {
    if (!data) {
      setPhase('source');
      currentTransitionRef.current = null;
      completedRef.current = false;
      return;
    }

    // New transition: reset to source phase
    if (data.fromCanvasId !== currentTransitionRef.current) {
      currentTransitionRef.current = data.fromCanvasId;
      setPhase('source');
      completedRef.current = false;
      return;
    }

    // Same transition, targets arrived: advance to animate (after one frame for layout)
    if (data.targetNodes.length > 0 && phase === 'source') {
      const raf = requestAnimationFrame(() => setPhase('animate'));
      return () => cancelAnimationFrame(raf);
    }
  }, [data, phase]);

  // Safety: call onComplete after duration if transitionend doesn't fire
  useEffect(() => {
    if (!data || phase !== 'animate') return;
    const timer = setTimeout(() => {
      if (!completedRef.current) {
        completedRef.current = true;
        data.onComplete();
      }
    }, TRANSITION_DURATION + 50);
    return () => clearTimeout(timer);
  }, [data, phase]);

  if (!data) return null;

  const handleTransitionEnd = () => {
    if (!completedRef.current) {
      completedRef.current = true;
      data.onComplete();
    }
  };

  // -------------------------------------------------------------------
  // Dissolve transition (breadcrumb jumps) — unchanged
  // -------------------------------------------------------------------
  if (data.direction === 'dissolve') {
    return (
      <div
        ref={overlayRef}
        className="navigation-transition-overlay"
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 50,
          backgroundColor: 'var(--color-background)',
          opacity: phase === 'animate' ? 0 : 1,
          transition: `opacity ${TRANSITION_DURATION}ms ease-out`,
          pointerEvents: 'none',
        }}
        onTransitionEnd={handleTransitionEnd}
      />
    );
  }

  // -------------------------------------------------------------------
  // Morph transition (dive-in / go-up)
  // -------------------------------------------------------------------
  const isIn = data.direction === 'in';

  // Build matched + unmatched node lists
  const matchedSource = data.sourceNodes.map((src) => ({
    src,
    tgt: data.targetNodes.find((t) => t.id === src.id) ?? null,
  }));
  const unmatchedTargets = data.targetNodes.filter(
    (tgt) => !data.sourceNodes.some((src) => src.id === tgt.id),
  );
  // For transitionend: pick the last rendered clone
  const totalClones = matchedSource.length + unmatchedTargets.length;
  let cloneIndex = 0;

  // Determine container rects for source/target
  const srcContainer = data.containerRect;
  const tgtContainer = data.targetContainerRect;

  return (
    <div
      ref={overlayRef}
      className="navigation-transition-overlay"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 50,
        pointerEvents: 'none',
        overflow: 'hidden',
      }}
    >
      {/* Opaque backdrop — covers canvas during source phase, fades on animate */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundColor: 'var(--color-background)',
          opacity: phase === 'animate' ? 0 : 0.95,
          transition: `opacity ${TRANSITION_DURATION}ms ease-in-out`,
        }}
      />

      {/* Container border morph — explicit per-direction rects */}
      {(() => {
        // Dive-in: container starts at containerRect, expands to viewport
        // Go-up: container starts at viewport, shrinks to targetContainerRect
        // Only render when we have the relevant rect
        const rect = isIn ? srcContainer : tgtContainer;
        if (!rect) return null;

        const startLeft = isIn ? rect.left : 0;
        const startTop = isIn ? rect.top : 0;
        const startWidth = isIn ? rect.width : '100vw';
        const startHeight = isIn ? rect.height : '100vh';
        const endLeft = isIn ? 0 : rect.left;
        const endTop = isIn ? 0 : rect.top;
        const endWidth = isIn ? '100vw' : rect.width;
        const endHeight = isIn ? '100vh' : rect.height;

        return (
          <div
            style={{
              position: 'fixed',
              left: phase === 'animate' ? endLeft : startLeft,
              top: phase === 'animate' ? endTop : startTop,
              width: phase === 'animate' ? endWidth : startWidth,
              height: phase === 'animate' ? endHeight : startHeight,
              border: '2px dashed var(--color-node-ref-border)',
              borderRadius: '8px',
              opacity: phase === 'animate' ? 0.3 : 1,
              transition: `all ${TRANSITION_DURATION}ms ease-in-out`,
              pointerEvents: 'none',
            }}
          />
        );
      })()}

      {/* Sibling nodes fade */}
      {data.siblings.map((sib) => (
        <div
          key={sib.id}
          style={{
            position: 'fixed',
            left: sib.rect.left,
            top: sib.rect.top,
            width: sib.rect.width,
            height: sib.rect.height,
            backgroundColor: 'var(--color-node-bg)',
            border: '1.5px solid var(--color-node-border)',
            borderRadius: '6px',
            opacity: isIn
              ? (phase === 'animate' ? 0 : 1)
              : (phase === 'animate' ? 1 : 0),
            transition: `opacity ${TRANSITION_DURATION * 0.6}ms ease-out`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '11px',
            color: 'var(--color-foreground)',
            pointerEvents: 'none',
          }}
        >
          {sib.label}
        </div>
      ))}

      {/* Matched clones: morph from source → target positions */}
      {matchedSource.map(({ src, tgt }) => {
        const idx = cloneIndex++;
        const isAnimating = phase === 'animate' && tgt;

        return (
          <div
            key={src.id}
            style={{
              position: 'fixed',
              left: isAnimating ? tgt.rect.left : src.rect.left,
              top: isAnimating ? tgt.rect.top : src.rect.top,
              width: isAnimating ? tgt.rect.width : src.rect.width,
              height: isAnimating ? tgt.rect.height : src.rect.height,
              backgroundColor: src.color
                ? `color-mix(in srgb, ${src.color} 15%, var(--color-node-bg))`
                : 'var(--color-node-bg)',
              border: `1.5px solid ${src.color || 'var(--color-node-border)'}`,
              borderRadius: '6px',
              opacity: phase === 'animate' && !tgt ? 0 : 1,
              transition: `all ${TRANSITION_DURATION}ms ease-in-out`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: isAnimating ? '12px' : '7px',
              color: 'var(--color-foreground)',
              pointerEvents: 'none',
              overflow: 'hidden',
            }}
            onTransitionEnd={idx === totalClones - 1 ? handleTransitionEnd : undefined}
          >
            {isAnimating ? tgt.label : src.label}
          </div>
        );
      })}

      {/* Unmatched target clones: fade in at target positions */}
      {unmatchedTargets.map((tgt) => {
        const idx = cloneIndex++;

        return (
          <div
            key={tgt.id}
            style={{
              position: 'fixed',
              left: tgt.rect.left,
              top: tgt.rect.top,
              width: tgt.rect.width,
              height: tgt.rect.height,
              backgroundColor: 'var(--color-node-bg)',
              border: '1.5px solid var(--color-node-border)',
              borderRadius: '6px',
              opacity: phase === 'animate' ? 1 : 0,
              transition: `opacity ${TRANSITION_DURATION}ms ease-in-out`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '12px',
              color: 'var(--color-foreground)',
              pointerEvents: 'none',
            }}
            onTransitionEnd={idx === totalClones - 1 ? handleTransitionEnd : undefined}
          >
            {tgt.label}
          </div>
        );
      })}

      {/* If no clones at all, use the backdrop to trigger end */}
      {totalClones === 0 && (
        <div
          style={{
            opacity: phase === 'animate' ? 0 : 1,
            transition: `opacity ${TRANSITION_DURATION}ms ease-out`,
          }}
          onTransitionEnd={handleTransitionEnd}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify typecheck passes**

Run: `npx tsc --noEmit`
Expected: No errors. Both the hook and component now agree on the `TransitionData` shape.

- [ ] **Step 3: Run unit tests**

Run: `npx vitest run`
Expected: All existing tests pass. (No unit tests for NavigationTransition — it's a visual component tested via E2E.)

- [ ] **Step 4: Commit Tasks 2 + 3 together**

```bash
git add src/components/canvas/hooks/useNavigationTransition.ts src/components/canvas/NavigationTransition.tsx
git commit -m "feat: fix navigation animation sequencing — overlay before canvas switch

Mount the transition overlay before calling navigationStore.diveIn()/goUp()
so the canvas switch happens behind the opaque overlay. Implements true
spatial morph: mini-nodes from SubsystemPreview expand into full-size nodes
(dive-in) and shrink back (go-up).

Key changes:
- TransitionData: sourceNodes + targetNodes replace single nodes array
- Two-phase setTransitionData: mount overlay, then provide targets
- currentTransitionRef avoids phase reset on second data update
- transitioningRef prevents rapid double-click re-entry
- Hook safety timeouts removed (component timeout is sole safety net)"
```

---

## Task 4: Resize handle CSS

**Files:**
- Modify: `src/components/nodes/nodeShapes.css:213`

- [ ] **Step 1: Add resize handle styles**

In `src/components/nodes/nodeShapes.css`, after the `.node-shape-container.selected` rule (after line 213), add:

```css

/* Resize handles for container nodes */
.node-shape-container .react-flow__resize-control.handle {
  width: 8px;
  height: 8px;
  background: var(--color-node-selected-border);
  border: 1.5px solid white;
  border-radius: 2px;
}

.node-shape-container .react-flow__resize-control.line {
  border-color: transparent;
}
```

- [ ] **Step 2: Verify build succeeds**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/nodes/nodeShapes.css
git commit -m "fix: make subsystem container resize handles visible"
```

---

## Task 5: Run full test suite + E2E verification

**Files:** None (verification only)

- [ ] **Step 1: Run unit tests**

Run: `npm test`
Expected: All unit tests pass.

- [ ] **Step 2: Run E2E tests (no-bridge)**

Run: `npm run test:e2e-no-bridge`
Expected: All E2E tests pass. The subsystem navigation animation tests (`subsystem.spec.ts`) verify the final state (breadcrumb text, node visibility) — they should pass since the animation doesn't change the observable end state.

- [ ] **Step 3: Manual video verification**

Use `playwright-cli` to record a video of the dive-in/go-up flow:

```bash
playwright-cli open http://localhost:5173
# Set up project with subsystem + nodes (same as before)
playwright-cli video-start
# Double-click subsystem → dive in
# Escape → go up
# Repeat
playwright-cli video-stop
```

Verify:
- No flash of destination canvas during dive-in or go-up
- Mini-nodes expand spatially into full-size nodes (dive-in)
- Full-size nodes shrink into mini-node positions (go-up)
- Resize handles visible as corner squares when container is selected

- [ ] **Step 4: Commit any fixes if needed**

If E2E tests fail, fix the issue and create a new commit. Do not amend.
