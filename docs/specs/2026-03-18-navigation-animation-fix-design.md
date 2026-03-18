# Navigation Animation Fix + Resize Handle Visibility

**Date:** 2026-03-18
**Status:** Draft
**Scope:** Fix two post-implementation issues in the subsystem enhancements feature.

## Problem

Two issues emerged after the subsystem enhancements shipped:

1. **Animation flash** — The dive-in and go-up navigation transitions flash the destination canvas for one frame before the animation overlay appears. The canvas switches *before* the overlay mounts, violating the intended capture → animate → swap sequence.

2. **Resize handles invisible** — `NodeResizer` handles are present in the DOM (8 handles — 4 corners, 4 edges) but visually indistinguishable from the selection border. No cursor feedback on hover. Users cannot discover the resize affordance.

## Goals

1. Eliminate the one-frame flash by mounting the overlay *before* the canvas switch.
2. Implement a true spatial morph — mini-nodes from `SubsystemPreview` expand into full-size nodes (dive-in) and shrink back (go-up), maintaining spatial continuity.
3. Make resize handles visually distinct with corner indicators and cursor hints.

## Non-goals

- Changing the dissolve transition (breadcrumb jumps) — it works correctly.
- Adding new animation easing or duration — keep existing 350ms / ease-in-out.
- Animating edges during the morph (current fade approach is acceptable for now).
- Theme-aware mini-node colors (remains a v1 limitation from the original spec).

---

## Design

### 1. SubsystemPreview — `data-node-id` attribute

**File:** `src/components/nodes/SubsystemPreview.tsx`

Add `data-node-id={n.id}` to each `<g>` element wrapping a mini-node. This allows the transition hook to match SVG mini-nodes to their corresponding full-size canvas nodes by querying `g[data-node-id]`.

```tsx
// Before
<g key={n.id}>

// After
<g key={n.id} data-node-id={n.id}>
```

No other changes to `SubsystemPreview`.

### 2. TransitionData — source + target positions

**File:** `src/components/canvas/hooks/useNavigationTransition.ts`

#### Type changes

Replace the single `nodes` array with `sourceNodes` and `targetNodes`:

```ts
export interface TransitionData {
  direction: 'in' | 'out' | 'dissolve';
  /** Where clones START (mini-node rects for dive-in, full-size rects for go-up) */
  sourceNodes: CapturedNode[];
  /** Where clones END (full-size rects for dive-in, mini-node rects for go-up) */
  targetNodes: CapturedNode[];
  edges: CapturedEdge[];
  /** Container rect at source phase (the ref-node border before dive-in) */
  containerRect: DOMRect | null;
  /** Container rect at target phase (for go-up: where nodes shrink to) */
  targetContainerRect: DOMRect | null;
  siblings: CapturedNode[];
  fromCanvasId: string;
  toCanvasId: string;
  onComplete: () => void;
}
```

#### New helper: `captureMiniNodes`

Reads mini-node screen positions from the `SubsystemPreview` SVG inside a container RefNode:

```ts
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
```

`getBoundingClientRect()` on SVG `<rect>` elements returns screen coordinates with the SVG's scaling already applied — no manual math needed.

#### `finalize` function

Unchanged from the current implementation:

```ts
const finalize = () => {
  setTransitionData(null);
  setIsTransitioning(false);
  transitioningRef.current = false;
  requestAnimationFrame(() => {
    reactFlow.fitView({ duration: 300 });
  });
};
```

#### Dive-in sequence (corrected)

```
1. Capture containerRect (getBoundingClientRect on RefNode DOM element)
2. Capture sourceNodes via captureMiniNodes(refNodeId)
3. Capture siblings (all visible nodes except the RefNode)
4. setIsTransitioning(true)
5. setTransitionData({
     direction: 'in',
     sourceNodes,          ← mini-node rects
     targetNodes: [],      ← empty; overlay starts opaque
     edges: [],            ← populated in step 7
     containerRect,
     targetContainerRect: null,
     siblings,
     fromCanvasId: currentCanvasId,
     toCanvasId: refNodeId,
     onComplete: finalize,
   })
   → Overlay mounts immediately, fully covering the canvas.
   → Clones appear at mini-node positions inside the container.
6. navigationStore.diveIn(refNodeId) — canvas swaps behind overlay
7. requestAnimationFrame → capture full-size node rects + edges from new canvas
   → setTransitionData with targetNodes and edges populated
   → NavigationTransition detects targetNodes and triggers animate phase
```

**Why this eliminates the flash:** Steps 4–6 are batched by React into a single synchronous render commit. In that commit, both the overlay (`zIndex: 50`, `position: fixed`) and the new canvas content render simultaneously. The overlay paints on top of the canvas, so the switch is never visible to the user. The fix relies on z-index layering within a single batched commit, not on the overlay rendering "before" the canvas switch.

#### Go-up sequence (corrected)

```
1. Capture sourceNodes via captureVisibleNodes() (full-size rects)
2. Capture edges
3. setIsTransitioning(true)
4. setTransitionData({
     direction: 'out',
     sourceNodes,          ← full-size rects
     targetNodes: [],      ← empty; overlay starts opaque
     edges,
     containerRect: null,
     targetContainerRect: null,
     siblings: [],
     fromCanvasId,
     toCanvasId: '',       ← not yet known; populated in step 6
     onComplete: finalize,
   })
   → Overlay mounts with full-size clones covering the canvas.
5. navigationStore.goUp() — canvas swaps behind overlay
6. requestAnimationFrame →
   - Read toCanvasId from fresh useNavigationStore.getState().currentCanvasId
   - Read targetContainerRect (the RefNode in the parent canvas)
   - Capture targetNodes via captureMiniNodes(fromCanvasId)
   - Capture siblings from parent canvas (excluding the container)
   → Update transitionData with targets, toCanvasId, siblings
   → NavigationTransition triggers animate phase
```

**Stale state note:** The `nav` variable captured from `useNavigationStore.getState()` before `goUp()` holds pre-navigation values. After `goUp()`, `toCanvasId` must be read from a fresh `useNavigationStore.getState()` call, not from the stale snapshot.

#### Edge case: empty subsystem

When the child canvas has no nodes, `SubsystemPreview` returns `null` and `captureMiniNodes` returns `[]`. Both `sourceNodes` (dive-in) or `targetNodes` (go-up) will be empty. In this case, only the container border morph and sibling fade/appear animations play — a degraded but acceptable experience.

#### Edge case: rapid double-click re-entry

The `isTransitioning` guard is a React `useState` value. Between the user's click and React's commit, a second click could enter `diveIn` because `isTransitioning` is still `false` in the closure. Add a `useRef<boolean>` (`transitioningRef`) checked synchronously at the top of `diveIn`/`goUp`/`goToBreadcrumb`, set to `true` before any state updates. This prevents re-entry regardless of React's batching.

#### Dissolve — unchanged

The dissolve transition already mounts the overlay before switching. No changes needed.

### 3. NavigationTransition — source→target morph rendering

**File:** `src/components/canvas/NavigationTransition.tsx`

#### Phase model

Replace `'initial' | 'animate'` with `'source' | 'animate'`:

- **`source`**: Clones rendered at `sourceNodes` positions, opaque backdrop covers canvas. This is the initial render when `targetNodes` is empty.
- **`animate`**: Triggered when `targetNodes` becomes non-empty. CSS transitions move each clone from source → target positions over `TRANSITION_DURATION` ms.

The phase transition is driven by `targetNodes.length > 0`, not by `requestAnimationFrame` — this is a data-driven trigger, not a timing-based one.

#### Two-phase data flow — avoiding component reset

The hook calls `setTransitionData` twice: once with empty `targetNodes` (to mount the overlay), then again with populated `targetNodes` (to trigger animation). The current component's `useEffect` resets phase on every `data` change, which would snap the overlay back to `'source'` on the second update instead of animating.

The fix: the `useEffect` must distinguish "new transition started" from "existing transition received targets." Track this via a ref that stores the `fromCanvasId` of the current transition:

```tsx
const currentTransitionRef = useRef<string | null>(null);

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
```

This ensures the overlay stays mounted at source positions until targets arrive, then smoothly transitions.

#### Safety timeouts

The hook's safety timeout (`setTimeout(finalize, TRANSITION_DURATION + 100)`) is removed. Only the component's safety timeout remains (fires `TRANSITION_DURATION + 50ms` after phase enters `'animate'`). This prevents duplicate finalize calls.

#### Clone rendering

Each clone in `sourceNodes` is paired with its match in `targetNodes` by node ID:

```tsx
{data.sourceNodes.map((src, i) => {
  const tgt = data.targetNodes.find(t => t.id === src.id);
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
        backgroundColor: src.color || 'var(--color-node-bg)',
        border: '1.5px solid var(--color-node-border)',
        borderRadius: '6px',
        opacity: 1,
        transition: `all ${TRANSITION_DURATION}ms ease-in-out`,
        // ...
      }}
    >
      {isAnimating ? (tgt.label) : src.label}
    </div>
  );
})}
```

**Unmatched target nodes** (nodes in `targetNodes` with no corresponding `sourceNodes` entry) fade in from transparent. This handles the case where the child canvas has nodes that weren't visible in the mini-preview (e.g., the preview was empty when the subsystem had no nodes yet).

**Unmatched source nodes** (mini-nodes with no corresponding full-size node) fade out.

#### Container border morph

For dive-in: container border starts at `containerRect`, expands toward viewport edges, then fades.
For go-up: container border appears at viewport edges, contracts to `targetContainerRect`, then the overlay is removed.

This part stays conceptually the same as the current implementation, just using the correct source/target rects.

#### Sibling handling

For dive-in: siblings are captured before the switch. They render at their positions and fade out during the animation.
For go-up: siblings are captured after the switch (from the parent canvas). They start transparent and fade in.

The sibling update happens in the same `setTransitionData` call that provides `targetNodes`, so they appear/animate in sync.

### 4. Resize handle CSS

**File:** `src/components/nodes/nodeShapes.css`

Add visible corner/edge styling for resize handles on container nodes:

```css
/* Resize handle visibility for container nodes */
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

The corner handles become visible 8×8 squares with the selection color. Edge (line) handles remain invisible — the cursor change on hover provides the resize affordance for edges.

---

## Files Changed

| File | Change |
|------|--------|
| `src/components/nodes/SubsystemPreview.tsx` | Add `data-node-id` to `<g>` elements |
| `src/components/canvas/hooks/useNavigationTransition.ts` | Rewrite `TransitionData`, fix sequencing, add `captureMiniNodes` |
| `src/components/canvas/NavigationTransition.tsx` | Source→target morph rendering with ID-based pairing |
| `src/components/nodes/nodeShapes.css` | Resize handle corner visibility |

## Testing Strategy

**Unit tests:**

- `captureMiniNodes` helper: mock DOM with SVG elements, verify correct screen rect extraction and ID matching.
- `TransitionData` shape: verify `sourceNodes`/`targetNodes` are populated at the correct phases.

**E2E tests:**

Existing E2E tests (`subsystem.spec.ts`) cover dive-in, go-up, and dissolve flows. These tests wait for the transition to complete and verify the final state (breadcrumb text, node visibility). The animation fix does not change observable final state, so existing tests should pass without modification.

**Manual verification:**

Record a video via `playwright-cli video-start` / `video-stop` to confirm:
- No flash of destination canvas during dive-in or go-up
- Mini-nodes expand spatially into full-size nodes (dive-in)
- Full-size nodes shrink into mini-node positions (go-up)
- Resize handles visible as corner squares when container is selected
