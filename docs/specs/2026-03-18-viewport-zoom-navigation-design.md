# Viewport Zoom Navigation — Design Spec

> **Date**: 2026-03-18 | **Status**: Draft
> **Scope**: Replace clone-overlay morph transitions with Muse-style two-phase viewport zoom for dive-in and go-up navigation.

## Problem

The current navigation transitions use DOM clone rectangles on a fixed overlay, animated via CSS `left/top/width/height` transitions. The real canvas switches instantly behind the overlay. This creates three visible artifacts:

1. **Double-image ghosting** — The overlay backdrop is 0.95 opacity, so the real child/parent canvas bleeds through. Both clone rectangles and real ReactFlow nodes are visible simultaneously during the animation.

2. **Canvas switch is visible** — `diveIn()`/`goUp()` fires synchronously, flipping the real canvas before the overlay fully covers it. The breadcrumb updates instantly, and the new canvas nodes are visible underneath the semi-transparent clones.

3. **Clone/real mismatch** — Clones are plain rectangles with text labels. Real nodes have icons, ports, type badges, and shaped borders. The visual difference between clone and real is jarring during the ~200ms morph.

Additionally for go-up: the parent canvas appears at the child's zoom level initially, then jumps to the fitted viewport — a visible scale discontinuity.

### Reference: Muse

Muse (museapp.com) uses a continuous zoomable canvas where all boards exist in a single infinite space. Navigating into a board is purely a camera/viewport animation — no canvas switching, no overlays, no clones. The result is a seamless spatial zoom.

ArchCanvas cannot share a single coordinate space (ReactFlow manages parent and child as separate datasets), but can achieve the same **visual effect** by animating the real viewport in two phases with an imperceptible canvas swap at the midpoint.

## Solution

### Two-Phase Viewport Zoom

Every dive-in and go-up is a two-phase viewport animation with an instant canvas swap at the midpoint.

**Dive-In:**

| Phase | Canvas | Duration | What happens |
|-------|--------|----------|-------------|
| Phase 1 | Parent | ~200ms | Viewport zooms into the subsystem container. Container grows to fill the screen. Sibling nodes fly off edges. |
| Switch | — | ~16ms (1 frame) | Canvas data swaps to child. Viewport set to matched position. Background-colored cover div shown for 1 frame. |
| Phase 2 | Child | ~250ms | Viewport zooms out to fitted view. Child nodes spread to their natural positions. |

**Go-Up (exact reverse):**

| Phase | Canvas | Duration | What happens |
|-------|--------|----------|-------------|
| Phase 1 | Child | ~200ms | Viewport zooms in (compresses nodes toward the scale they'd appear in the parent's mini-preview). |
| Switch | — | ~16ms (1 frame) | Canvas data swaps to parent. Viewport set to zoom-into-container position. Cover div shown for 1 frame. |
| Phase 2 | Parent | ~250ms | Viewport zooms out to fitted view. Sibling nodes slide back into view. Container shrinks to its position. |

**Dissolve (breadcrumb multi-level jump):** Unchanged — uses existing crossfade. Viewport zoom only applies to single-level transitions where the spatial relationship is clear.

### The Seamless Switch Point

The switch is imperceptible because both canvases look visually identical at the midpoint:

- **Parent side**: Viewport is zoomed so the subsystem container fills the screen. Only the container and its mini-preview content are visible; siblings are off-screen.
- **Child side**: Viewport is set so child nodes appear at the same screen positions as the mini-preview content.

The mini-ReactFlow preview (from milestone 23) renders child nodes with the same `NodeRenderer`, shapes, icons, and CSS variables as the main canvas. This visual fidelity is what makes the switch imperceptible — the preview IS what the child canvas looks like at that zoom level.

### Matched Viewport Math

At the switch point, the container fills the screen. The mini-preview renders child nodes fitted within the container's **content area** (container bounds minus header and padding).

The matched child viewport must place child nodes at those same screen positions. All viewport values use ReactFlow's `{ x, y, zoom }` convention (where `x`/`y` are the translation of the canvas origin in screen pixels).

**Computing the matched viewport (pure math, no DOM reads needed):**

```
// 1. Compute the zoom level that fills the screen with the container
zoomedViewport = computeZoomToRect(containerCanvasRect, vpW, vpH)

// 2. Derive the content area dimensions at that zoom level
//    The container's content area = container minus header (~30px) and padding (~8px)
//    At the zoomed viewport, these map to screen pixels:
contentW = containerCanvasRect.width * zoomedViewport.zoom - (2 * PADDING)
contentH = containerCanvasRect.height * zoomedViewport.zoom - HEADER_HEIGHT - (2 * PADDING)

// 3. Fit child nodes within the content area dimensions
fit = computeFitViewport({ nodes: childNodes, viewportWidth: contentW, viewportHeight: contentH })

// 4. Convert to { x, y, zoom } and offset for content area position
//    The content area's top-left in screen coords:
contentLeft = (vpW - contentW) / 2  // centered horizontally
contentTop = (vpH - contentH) / 2 + HEADER_HEIGHT / 2  // shifted down for header
matchedViewport = {
  x: fit.offsetX + contentLeft,
  y: fit.offsetY + contentTop,
  zoom: fit.zoom,
}
```

This computation works for both dive-in (setting the child viewport after the switch) and go-up Phase 1 (the target to compress child nodes toward). It depends only on: child node positions, the container's canvas-space rect (readable from parent canvas data via `fileStore`), and the main viewport dimensions — no DOM measurements required.

Phase 2 then animates from this content-area-fitted viewport to the true full-viewport-fitted viewport — a subtle shift as nodes settle into the full screen space.

## Components

### New Files

#### `src/lib/animateViewport.ts`

RAF-based viewport interpolation utility. ReactFlow's `setViewport({ duration })` does not provide a completion callback, which we need to trigger the switch between phases.

```typescript
function animateViewport(
  reactFlow: ReactFlowInstance,
  from: { x: number; y: number; zoom: number },
  to: { x: number; y: number; zoom: number },
  duration: number,
  easing: (t: number) => number,
  onComplete: () => void,
): () => void // returns cancel function
```

Each RAF frame:
1. Compute progress `t = clamp(elapsed / duration, 0, 1)`
2. Apply easing
3. Interpolate x, y linearly; **zoom logarithmically**
4. Call `reactFlow.setViewport({ x, y, zoom })`
5. If `t >= 1`, call `onComplete`

**Logarithmic zoom interpolation** is essential for natural feel:
```
zoom = from.zoom * Math.pow(to.zoom / from.zoom, easedT)
```
Linear zoom interpolation makes the zoom speed accelerate perceptually (1→2 is as big a jump as 2→4). Log interpolation keeps the zoom rate constant.

#### `src/lib/computeZoomToRect.ts`

Pure function. Given a rectangle in canvas coordinates and viewport dimensions, returns the viewport `{ x, y, zoom }` that centers and fills the screen with that rectangle.

```typescript
function computeZoomToRect(
  rect: { x: number; y: number; width: number; height: number },
  viewportWidth: number,
  viewportHeight: number,
  padding?: number, // 0-1, default 0
): { x: number; y: number; zoom: number }
```

```
zoom = min(vpW / rect.width, vpH / rect.height) * (1 - padding)
x = vpW/2 - (rect.centerX * zoom)
y = vpH/2 - (rect.centerY * zoom)
```

**`padding` defaults to 0 intentionally** — at the switch point, the container must fill the screen edge-to-edge for the seamless swap to work. This differs from `computeFitViewport` which uses a 0.1 default for comfortable viewing. Callers should not override the default for switch-point viewports.

### Modified Files

#### `src/components/canvas/hooks/useNavigationTransition.ts` — Full Rewrite

Same public API, completely new internals. Replaces clone-based morph with two-phase viewport zoom.

**State machine:**
```
idle → zooming_in → switching → zooming_out → idle
```

**Exports:**
```typescript
{
  diveIn: (refNodeId: string) => void,
  goUp: () => void,
  goToBreadcrumb: (index: number) => void,
  isTransitioning: boolean,
  overlayStyle: React.CSSProperties | null,  // for switch cover + dissolve
  onOverlayTransitionEnd: () => void,         // dissolve cleanup
}
```

**Dive-in sequence:**
1. **Capture state before anything changes**: `currentViewport = reactFlow.getViewport()`. Get the container node's canvas-space rect from `reactFlow.getNode(refNodeId)` (position + measured width/height).
2. Compute Phase 1 target via `computeZoomToRect(containerRect, vpW, vpH)`
3. `animateViewport(currentViewport → zoomedViewport, 200ms)` — Phase 1
4. On Phase 1 complete: show 1-frame cover, call `navigationStore.diveIn()` — this changes `currentCanvasId` and causes React to re-render with child canvas nodes
5. Next RAF: child nodes are now rendered. Read `childNodes = reactFlow.getNodes()`. Compute matched viewport. Call `reactFlow.setViewport(matchedViewport)`. Hide cover.
6. Compute fitted viewport via `computeFitViewport(childNodes, vpW, vpH)`
7. `animateViewport(matchedViewport → fittedViewport, 250ms)` — Phase 2
8. On Phase 2 complete: state → `idle`

**Go-up sequence:**
1. **Capture state before anything changes**: read `currentViewport = reactFlow.getViewport()`, `childNodes = reactFlow.getNodes()`
2. Pre-read the container's canvas-space rect from parent canvas data: `containerRect = getContainerRect(fromCanvasId, parentCanvasId)` — reads the RefNode's position and dimensions from the parent canvas in `fileStore` (no DOM query needed)
3. Compute Phase 1 target using the matched viewport formula from "Matched Viewport Math" section: `matchedViewport = computeMatchedViewport(childNodes, containerRect, vpW, vpH)`. This compresses child nodes to the scale and position they'd have in the parent's mini-preview.
4. `animateViewport(currentViewport → matchedViewport, 200ms)` — Phase 1
5. On Phase 1 complete: show cover, call `navigationStore.goUp()`
6. Next RAF: compute `zoomedViewport = computeZoomToRect(containerRect, vpW, vpH)`, call `reactFlow.setViewport(zoomedViewport)`, hide cover
7. Compute parent fitted viewport from `reactFlow.getNodes()`
8. `animateViewport(zoomedViewport → fittedViewport, 250ms)` — Phase 2
9. On Phase 2 complete: state → `idle`

**Interruption:** If navigation is triggered during a transition, cancel the active `animateViewport`, call `fitView()` to snap clean, reset state to `idle`.

**Dissolve (breadcrumb jump):** Kept as inline logic. Mounts a simple opacity-transitioning div, switches canvas behind it, fades out. No viewport animation.

#### `src/components/canvas/Canvas.tsx` — Simplify

- Remove `transitionData` from destructured hook return
- Remove `<NavigationTransition data={transitionData} />`
- Remove import of `NavigationTransition`
- **Remove `fitView` prop from `<ReactFlow>`** — The `fitView` prop triggers on every `nodes` change. When `diveIn()`/`goUp()` switches the canvas, ReactFlow receives new nodes and `fitView` would fire, overriding the matched viewport that the hook just set via `setViewport()`. Without removing `fitView`, there's a race condition where `fitView` wins and causes a visible viewport jump. Initial fit-on-load is handled by the existing `useEffect` that calls `reactFlow.fitView({ duration: 400 })` on layout completion — this is unaffected.
- Add a `<div>` for the 1-frame switch cover and dissolve overlay, controlled by state from the hook (see Cover Div section below)

### Cover Div & Dissolve Overlay

The hook needs to render two kinds of overlays:

1. **Switch cover** — A `position: fixed; inset: 0` div with `backgroundColor: var(--color-background)` shown for exactly 1 frame during the canvas swap. Prevents a flash frame while React re-renders new nodes.

2. **Dissolve overlay** — Same div, but with a CSS opacity transition for breadcrumb jumps.

**Mechanism**: The hook exposes `overlayStyle: CSSProperties | null` in its return value. `Canvas.tsx` renders a `<div>` with this style (or nothing when `null`). This keeps the hook in control of timing while Canvas.tsx owns the DOM element — standard React patterns, no portals or imperative DOM insertion.

```typescript
// Hook returns:
{ diveIn, goUp, goToBreadcrumb, isTransitioning, overlayStyle }

// Canvas.tsx renders:
{overlayStyle && (
  <div style={overlayStyle} onTransitionEnd={...} />
)}
```

For the switch cover: `overlayStyle` is set to `{ opacity: 1, ... }` on the switch frame, then set to `null` on the next RAF (after React has rendered the new nodes and viewport is set).

For dissolve: `overlayStyle` starts at `{ opacity: 1, transition: 'opacity 350ms' }`, then updated to `{ opacity: 0, transition: 'opacity 350ms' }` on the next frame. `onTransitionEnd` resets to `null`.

### Deleted Files

| File | Why |
|------|-----|
| `src/components/canvas/NavigationTransition.tsx` | Entire clone overlay component. Replaced by viewport zoom — no overlay needed. |

### Deleted Code (within `useNavigationTransition.ts`)

All of these are replaced by the new viewport-zoom orchestration:

| Symbol | What it was |
|--------|-------------|
| `CapturedNode` interface | DOM rect + label for a clone rectangle |
| `CapturedEdge` interface | Source/target IDs for edge clones |
| `TransitionData` interface (exported) | Full clone state passed to `NavigationTransition` |
| `getNodeRect()` | Read screen rect for a ReactFlow node element |
| `getMainFlowContainer()` | Find main `.react-flow` excluding mini-previews |
| `captureVisibleNodes()` | Query DOM for all visible node positions |
| `captureVisibleEdges()` | Query DOM for all visible edge connections |
| `computeTargetRects()` | Pre-compute fitted screen positions for target nodes |
| `setFittedViewport()` | Set viewport to fitted position during overlay |

### Unchanged Files

| File | Why it stays |
|------|-------------|
| `src/lib/computeFitViewport.ts` | Reused for Phase 2 targets |
| `src/components/nodes/PreviewModeContext.ts` | Prevents recursive mini-ReactFlow nesting |
| `src/components/canvas/mapCanvasData.ts` | Used by SubsystemPreview for node/edge mapping |
| `src/components/nodes/SubsystemPreview.tsx` | Mini-preview rendering — unrelated to animation |

## Edge Cases

| Scenario | Behavior |
|----------|----------|
| Empty subsystem | Phase 1 zooms into container. At switch, no child nodes → `computeFitViewport` returns default viewport. Phase 2 animates to default center. |
| Container off-screen | Phase 1 pans + zooms from current position — travels further, looks like a dramatic swoop. |
| Very small container | Large zoom ratio. Logarithmic interpolation keeps it feeling smooth. |
| Rapid double-click | Guard: `if (state !== 'idle') return`. Second click is ignored. |
| Navigate during animation | Cancel current animation, `fitView()` to snap, reset to `idle`. |
| Container unmeasured | If `containerNode.width` is undefined, fall back to dissolve. |
| Breadcrumb multi-level jump | Uses dissolve (crossfade), not viewport zoom. |

## Testing

| Layer | What to test |
|-------|-------------|
| Unit: `computeZoomToRect` | Rect + viewport dims → correct viewport. Center alignment. Aspect ratio. Padding. |
| Unit: `animateViewport` | Mock RAF. Interpolation at t=0, 0.5, 1. Logarithmic zoom. Cancel mid-animation. Completion callback. |
| Unit: matched viewport | Child viewport positions match expected content-area fit. Single node, many nodes. |
| Integration: state machine | idle→zooming_in→switching→zooming_out→idle. Interruption. Double-trigger guard. |
| E2E | Dive-in: breadcrumb updates, child nodes visible after animation. Go-up: returns to parent. Viewport stability. |

Existing E2E navigation tests should pass unchanged — the end-state (active canvas, breadcrumb text, visible nodes) is identical. Only the animation path changes.

## Timing Summary

| Segment | Duration | Easing |
|---------|----------|--------|
| Phase 1 | 200ms | ease-in-out |
| Switch | ~16ms (1 frame) | — |
| Phase 2 | 250ms | ease-in-out |
| **Total** | **~470ms** | |
