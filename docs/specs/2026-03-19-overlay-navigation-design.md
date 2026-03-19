# Overlay Navigation Animation — Design Spec

> **Date**: 2026-03-19 | **Status**: Draft
> **Replaces**: [docs/specs/2026-03-18-viewport-zoom-navigation-design.md](2026-03-18-viewport-zoom-navigation-design.md) (two-phase viewport zoom)
> **Prototype**: `prototype-nav-animation.html` (validated, will be deleted after implementation)

## Problem

The current navigation transition (milestone 24) uses a single ReactFlow instance with viewport animation and a 1-frame opaque cover to hide the canvas swap at the midpoint. While functional, it has inherent limitations:

1. **The parent canvas disappears during transition** — the camera flies past the container edges, so the parent is never visible. This breaks the spatial metaphor.
2. **The opaque cover is a sleight-of-hand** — the swap is hidden rather than eliminated. Any timing issue makes it visible.
3. **No spatial relationship** — the transition doesn't communicate "this subsystem lives inside the parent canvas."

The goal is Muse-style navigation: the subsystem expands from its position on the parent canvas (dive-in) and collapses back into it (go-up), with the parent always visible behind.

## Design

### Core idea: clip-path + viewport animation on a temporary overlay

Two synchronized primitives in a single RAF loop:

- **`clip-path: inset(...)`** on a fixed-position overlay div — controls the expanding/collapsing "window" that reveals the child canvas
- **Viewport interpolation** via `reactFlowInstance.setViewport()` — controls how content is positioned and zoomed inside the overlay

The parent canvas is always rendered underneath. The overlay sits on top (z-index). No canvas swap happens mid-animation — the swap happens at the end, after the overlay fully covers (dive-in) or reveals (go-up) the parent.

### Why clip-path, not CSS transform

CSS `transform: scale(sx, sy)` can be non-uniform when the subsystem aspect ratio differs from the screen. ReactFlow's zoom is isotropic (single number), so no viewport can satisfy both axes through a non-uniform scale. `clip-path: inset()` avoids this entirely — the content is always rendered at native resolution, and the clip handles spatial framing. Both `clip-path: inset()` and `setViewport()` are GPU-friendly operations.

### Why not per-frame container resize

Changing the overlay's `width`/`height` each frame would trigger ReactFlow's internal `ResizeObserver`, causing layout reflow and conflicting viewport recalculations. The overlay is always full-screen; only the visible area (clip) and the viewport change.

## Architecture

### Layer model

At navigation depth N:

| Layer | Mounted? | Component | Interactive? |
|-------|----------|-----------|-------------|
| Root (0) | Always | Backdrop ReactFlow | No |
| Parent (N-1) | When N > 0 | Backdrop ReactFlow | No |
| Current (N) | Always | Main `<ReactFlow>` in `Canvas.tsx` | Yes |
| Levels 1..N-2 | No | Unmounted for performance | — |
| Children of N | Via SubsystemPreview | Mini ReactFlow inside RefNodes | No |

The main interactive `<ReactFlow>` in `Canvas.tsx` is unchanged — it renders the current canvas with full event handling (drag, context menu, keyboard, etc.). Parent/root canvases are rendered as non-interactive backdrops using `CanvasOverlay` in backdrop mode (no clip-path, `pointerEvents: 'none'`, fitted viewport). No separate `CanvasBackdrop` component — `CanvasOverlay` serves both roles.

**Lazy mounting**: When going up from N to N-1, the new parent (N-2) is mounted after the animation completes. It has until the next go-up to be ready.

### Transition overlay

A temporary component that exists only during the ~350ms animation. It contains:
- A `ReactFlowProvider` + `<ReactFlow>` (non-interactive, no event handlers)
- A fixed-position container with `clip-path: inset(...)` and `z-index` above the main canvas
- Canvas background matching the theme

The overlay is created at animation start and destroyed at animation end.

### Steady-state DOM (depth 1)

```
<div class="canvas-stack">
  <CanvasOverlay canvasId="root" backdrop />  <!-- root, non-interactive, no clip-path -->
  <div class="main-canvas">
    <ReactFlow ... />                          <!-- current canvas, interactive -->
  </div>
</div>
```

During dive-in transition (depth 0 → 1):

```
<div class="canvas-stack">
  <div class="main-canvas">
    <ReactFlow ... />                        <!-- still showing parent (root) -->
  </div>
  <TransitionOverlay                         <!-- temporary, clip-path animated -->
    canvasId={childId}
    clipPath="inset(t r b l)"
    viewport={interpolatedVp}
  />
</div>
```

After animation completes → `navigationStore.diveIn()` → main ReactFlow swaps to child → overlay removed → root backdrop mounted.

## Flows

### Dive-in

```
1. User clicks subsystem RefNode
2. Measure SubsystemPreview screen rect: pr = getBoundingClientRect()
3. Compute starting viewport (matches preview):
     pvVp = computeFitViewport(pr.width, pr.height, childNodes, padding)
     startVp = { x: pvVp.x + pr.left, y: pvVp.y + pr.top, zoom: pvVp.zoom }
4. Compute ending viewport:
     endVp = computeFitViewport(screenW, screenH, childNodes, padding)
5. Compute starting clip inset from pr:
     startInset = { top: pr.top, right: screenW - pr.right,
                    bottom: screenH - pr.bottom, left: pr.left }
6. Mount overlay with child canvas, set initial clip + viewport
7. RAF loop (~350ms, ease-in-out):
     clip: lerp each inset from startInset → 0
     viewport.x: lerp(startVp.x, endVp.x, t)
     viewport.y: lerp(startVp.y, endVp.y, t)
     viewport.zoom: startVp.zoom * (endVp.zoom / startVp.zoom)^t  [log interpolation]
8. Animation ends:
     - navigationStore.diveIn(refNodeId)       [main ReactFlow swaps to child]
     - Set main ReactFlow viewport = endVp
     - Remove overlay
     - Mount parent as backdrop (if not already)
```

### Go-up

The go-up flow reuses the SubsystemPreview screen rect captured during the preceding dive-in (stored in `lastPreviewRectRef`). This avoids measuring the preview DOM after the parent canvas swap — a single `requestAnimationFrame` is not sufficient to guarantee React has committed the parent canvas AND ReactFlow has completed its layout pass, especially under React 19 concurrent rendering.

```
1. User triggers go-up (breadcrumb click, Escape key)
2. Read lastPreviewRectRef (stored at dive-in step 2)
     If null → dissolve fallback (navigated via breadcrumb, no spatial reference)
3. Mount overlay with CURRENT canvas data at full-screen (clip: inset(0))
4. Compute overlay starting viewport:
     startVp = computeFitViewport(screenW, screenH, currentChildNodes)
5. Compute ending viewport (matches preview, same math as dive-in step 3):
     pvVp = computeFitViewport(lastRect.width, lastRect.height, currentChildNodes)
     endVp = { x: pvVp.offsetX + lastRect.left, y: pvVp.offsetY + lastRect.top, zoom: pvVp.zoom }
6. Compute ending clip inset from lastRect
7. Call navigationStore.goUp()                 [main ReactFlow swaps to parent]
8. Set main ReactFlow viewport = computeFitViewport(screenW, screenH, parentNodes)
9. RAF loop (~300ms, ease-in-out):
     clip: lerp each inset from 0 → endInset
     viewport (on overlay's ReactFlow): x/y lerp, zoom log interpolation
10. Animation ends:
     - Remove overlay
     - Clear lastPreviewRectRef
     - Parent canvas fully visible and interactive
```

### Breadcrumb jump (multi-level)

Falls back to dissolve transition (crossfade) since there's no clear spatial relationship for arbitrary-depth jumps. This is unchanged from the current implementation.

### Dissolve fallback

Used when:
- Container node is unmeasured (no `width`/`height` from ReactFlow)
- SubsystemPreview renders null (empty subsystem with no child nodes) — no preview element to measure
- `lastPreviewRectRef` is null during go-up (navigated to current level via breadcrumb, no stored rect)
- Breadcrumb multi-level jumps
- Any error during transition setup

The dissolve shows an opaque cover, swaps the canvas, then fades out. Same as current behavior.

## Pixel-perfect matching

The overlay's starting viewport must produce identical node screen positions as the SubsystemPreview. This requires both to use the same viewport math.

**Change**: `SubsystemPreview` switches from ReactFlow's built-in `fitView` prop to `computeFitViewport` (our pure utility), setting the viewport imperatively via `useReactFlow().setViewport()`.

**Math**: For a preview at screen rect `pr`, the overlay starting viewport is:

```
pvVp = computeFitViewport(pr.width, pr.height, childNodes, padding)
startVp.zoom = pvVp.zoom                  // same zoom
startVp.x    = pvVp.offsetX + pr.left     // offset by screen position
startVp.y    = pvVp.offsetY + pr.top
```

The SubsystemPreview's ReactFlow renders into a container that is `pr.width x pr.height` screen pixels. Its `computeFitViewport` call with those dimensions produces a zoom that already accounts for the parent canvas zoom (because the container's pixel size reflects the parent zoom). So `pvVp.zoom` is the screen-space zoom directly — no parent zoom multiplication needed. The overlay uses the same zoom and offsets by the preview's screen position.

## New files

### `src/lib/animateOverlayTransition.ts` (~70 LOC)

Pure animation utility. RAF loop that drives both clip-path and viewport per frame.

**Interface**:
```ts
interface OverlayAnimationConfig {
  overlayEl: HTMLElement;
  reactFlow: { setViewport(vp: { x: number; y: number; zoom: number }): void };
  startInset: { top: number; right: number; bottom: number; left: number };
  endInset: { top: number; right: number; bottom: number; left: number };
  startVp: { x: number; y: number; zoom: number };
  endVp: { x: number; y: number; zoom: number };
  startRadius?: number;  // border-radius for clip-path, default 8
  endRadius?: number;     // default 0
  duration: number;
  onComplete: () => void;
}

function animateOverlayTransition(config: OverlayAnimationConfig): () => void;
// Returns cancel function
```

Each frame:
1. Compute eased `t`
2. Lerp clip inset values + border-radius
3. Apply `clip-path: inset(${top}px ${right}px ${bottom}px ${left}px round ${rad}px)`
4. Lerp viewport x, y (linear) and zoom (logarithmic)
5. Call `reactFlow.setViewport({ x, y, zoom })`

### `src/components/canvas/CanvasOverlay.tsx` (~80 LOC)

Overlay component used for both transition animations and parent backdrops.

- Wraps content in `ReactFlowProvider` + `<ReactFlow>` (non-interactive: `nodesDraggable={false}`, `panOnDrag={false}`, etc.)
- Fixed-position container with clip-path support
- Receives canvas data (nodes/edges) as props
- **ReactFlow instance forwarding**: Accepts `onReactFlowReady: (rf: ReactFlowInstance) => void` callback prop. An inner component calls `useReactFlow()` inside the overlay's own `ReactFlowProvider` and passes the instance to the callback via `useEffect`. This gives `useNavigationTransition` a ref to the overlay's ReactFlow for calling `setViewport()` during animation — separate from the main canvas's `useReactFlow()`.
- Renders theme-matched canvas background
- When used as a backdrop (no clip-path, `pointerEvents: 'none'`), the same component serves as `CanvasBackdrop` — no separate component needed.

## Deleted files

All deleted without trace — no re-exports, no "removed" comments, no dead references:

| File | Test file | Why deleted |
|------|-----------|-------------|
| `src/lib/animateViewport.ts` | `test/unit/lib/animateViewport.test.ts` | Replaced by `animateOverlayTransition` |
| `src/lib/computeZoomToRect.ts` | `test/unit/lib/computeZoomToRect.test.ts` | Only used by old viewport zoom approach |
| `src/lib/computeMatchedViewport.ts` | `test/unit/lib/computeMatchedViewport.test.ts` | Only used by old viewport zoom approach |
| `prototype-nav-animation.html` | — | Prototype served its purpose |

**Kept**: `src/lib/computeFitViewport.ts` — still the core viewport math for both SubsystemPreview and overlay.

**Also dropped**: The `CONTAINER_HEADER_H`, `CONTAINER_PAD_X`, `CONTAINER_PAD_Y` constants exported from `computeMatchedViewport.ts` are intentionally not relocated. The clip-path overlay approach does not need container interior geometry math — the overlay is full-screen and the clip-path handles framing.

## Modified files

### `src/components/canvas/hooks/useNavigationTransition.ts` — full rewrite

The viewport zoom state machine (`idle → zooming_in → switching → zooming_out`) is replaced with overlay orchestration:

- **State**: `idle | animating` (simpler — no multi-phase state machine)
- **diveIn(refNodeId)**: measure preview → mount overlay → animate → swap canvas → unmount overlay
- **goUp()**: mount overlay with current canvas → swap canvas to parent → animate overlay shrinking → unmount overlay
- **goToBreadcrumb(index)**: dissolve (unchanged)
- Renamed: `lastContainerRectRef` → `lastPreviewRectRef` (stores SubsystemPreview screen rect from dive-in for go-up reuse)
- Removed: `COVER_STYLE`, `dissolveStyle`, `getViewportDimensions`, `toFitNodes`
- Removed: all imports of `computeZoomToRect`, `computeMatchedViewport`, `animateViewport`

### `src/components/canvas/Canvas.tsx`

- Add backdrop layer rendering for parent canvas when at depth > 0
- Remove the old overlay div (`navigation-transition-overlay`)
- Remove `onOverlayTransitionEnd` handler
- Add transition overlay rendering (controlled by `useNavigationTransition`)

### `src/components/nodes/SubsystemPreview.tsx`

- Remove `fitView` prop from `<ReactFlow>`
- Add `useEffect` with `computeFitViewport` + `reactFlow.setViewport()` after mount
- Ensures identical viewport math between preview and overlay

## Testing

### Unit tests

- `animateOverlayTransition.test.ts` — verify clip-path string generation, viewport interpolation (log zoom), cancel behavior, edge cases (same zoom, zero duration)
- `SubsystemPreview.test.tsx` — update for `computeFitViewport` usage instead of `fitView`

### E2E tests

- `test/e2e/subsystem.spec.ts` — existing dive-in/go-up tests should still pass (user-facing behavior unchanged). May need selector updates if DOM structure changes (overlay div class names).

## Decisions

| Decision | Chose | Over | Why |
|----------|-------|------|-----|
| Animation primitive | `clip-path: inset()` + viewport | CSS `transform: scale()` | Transform causes non-uniform scaling when aspect ratios differ; clip-path is GPU-composited and keeps native resolution |
| Overlay lifecycle | Temporary (animation only) | Persistent (always mounted) | Steady-state DOM is identical to today; no performance cost when not transitioning |
| Parent rendering | Always-mounted backdrop | Snapshot/image | Real ReactFlow backdrop enables future interactions (e.g., seeing parent context) and doesn't need screenshot timing |
| Canvas swap timing | End of animation | Mid-animation (old approach) | No cover needed — overlay fully covers parent at end of dive-in, or is removed at end of go-up |
| Viewport matching | Shared `computeFitViewport` | Read SubsystemPreview's internal viewport | Recomputing is simpler than cross-component state sharing, and guarantees identical math |
| Layer retention | Root + parent + current | Full stack of N overlays | 3 ReactFlow instances max at any depth; lazy-mount N-2 after go-up |
