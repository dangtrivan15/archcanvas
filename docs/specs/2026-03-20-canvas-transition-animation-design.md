# Canvas Transition Animation — Design Spec

> **Date**: 2026-03-20 | **Status**: Draft
> **Branch**: `feat/canvas-transition-animation`
> **Demo**: `.superpowers/brainstorm/13487-1773993504/animation-demo-v6.html` (primary), `animation-demo-v4.html` (fallback)

## Problem

Navigating between canvases (dive-in to subsystem, go-up to parent) has two issues:

1. **Rendering inconsistency**: `SubsystemPreview` uses estimated node sizes (`width: 150, height: 40`), different viewport math, and no edge detail. The preview inside a RefNode looks different from the actual canvas — positions, zoom, edges, and node shapes don't match.

2. **No spatial animation**: Navigation is an instant data swap (`setViewport` + `setTimeout` + `fitView`). Four prior animation approaches (milestones 22–25) all failed due to fighting ReactFlow's viewport model. See `docs/progress/26-animation-rollback.md`.

## Solution

Replace `SubsystemPreview` with a **recursive `CanvasView` component** that renders identically at every nesting level. Use **detached container reparenting** to maintain a single ReactFlow instance per canvas, and animate navigation with an **expanding frame** that grows from the RefNode to fill the shell.

## Architecture

### Component Split

`Canvas.tsx` (408 lines) splits into four pieces:

| Component | Location | Responsibility |
|-----------|----------|----------------|
| `CanvasShell.tsx` | `src/components/canvas/` | Chrome: keyboard, context menu, palette, breadcrumb, dialogs, drag-drop. Contains ShellSlot div. Replaces `Canvas.tsx` in `App.tsx`. Does NOT contain a `ReactFlowProvider` — it is outside all providers. |
| `CanvasView.tsx` | `src/components/canvas/` | Pure ReactFlow renderer. Props: `canvasId`, `focused`, `level`. Own `ReactFlowProvider` (each instance is isolated). Exposes an imperative handle via `forwardRef`/`useImperativeHandle` for `fitView()` and `getBoundingClientRect()` on the container. When `focused=false`: all interaction disabled. |
| `CanvasHost.tsx` | `src/components/canvas/` | Creates stable detached `HTMLDivElement` on mount. Registers with `canvasHostManager`. Renders `<CanvasView>` into detached div via `createPortal`. Forwards the `CanvasView` imperative ref to callers. |
| `canvasHostManager.ts` | `src/core/canvas/` | Plain TS module. Two registries: `containers: Map<canvasId, HTMLDivElement>` for detached divs, `slots: Map<canvasId, HTMLDivElement>` for RefNodeSlot refs. API: `register/unregister`, `registerSlot/unregisterSlot`, `getContainer()`, `getSlot()`, `attachToSlot()`. |

`SubsystemPreview.tsx` and `PreviewModeContext.ts` are deleted.

### ReactFlowProvider Placement

The top-level `<ReactFlowProvider>` in `App.tsx` (line 104) is **removed**. Each `CanvasView` creates its own provider — there is no shared provider.

`CanvasShell` is outside all providers and cannot call `useReactFlow()` directly. Instead, `CanvasShell` holds refs to `CanvasHost` instances. Each `CanvasHost` forwards the `CanvasView`'s imperative handle, which exposes:
- `fitView(options)` — delegates to the inner `useReactFlow().fitView()`
- `getContainerRect()` — returns `getBoundingClientRect()` on the detached div

The animation hook (`useCanvasNavigation`) receives these refs and calls `fitView` on the correct canvas instance at the right time.

### Slot-Ref Registry

`canvasHostManager` maintains a second registry for RefNodeSlot refs:
- `NodeRenderer` calls `canvasHostManager.registerSlot(canvasId, slotDiv)` in a ref callback when a RefNode mounts, and `unregisterSlot(canvasId)` on unmount.
- The animation hook calls `canvasHostManager.getSlot(canvasId)` to measure the RefNode's screen position via `getBoundingClientRect()`.
- This decouples the animation hook from the ReactFlow node tree — it doesn't need to traverse the DOM or hold refs to ReactFlow-internal elements.

### Data Flow

**Steady state:**
1. `CanvasShell` renders a ShellSlot div (ref) and reads `currentCanvasId` from `navigationStore`.
2. `CanvasShell` creates a `CanvasHost` for `currentCanvasId` (focused) and one `CanvasHost` per RefNode child (embedded, level 1).
3. Each `CanvasHost` creates a detached div, renders `<CanvasView>` into it via `createPortal`, registers with `canvasHostManager`.
4. `canvasHostManager.attachToSlot(canvasId, slotRef)` physically `appendChild`s the detached div to the appropriate slot — ShellSlot for focused, RefNodeSlot for embedded.

**`useCanvasRenderer` change:** Accepts `canvasId` and `focused` parameters instead of reading from `navigationStore` internally. The inherited-edges/ghost-nodes logic (lines 38–99 of current `useCanvasRenderer.ts`) only activates when `focused=true`. Embedded canvases (`focused=false`) render their own nodes and edges but never render inherited edges or ghost nodes — they are previews, not the active editing context.

**`NodeRenderer` change:** RefNodes render an empty `RefNodeSlot` div instead of `<SubsystemPreview>`. The slot registers with `canvasHostManager` via a ref callback: `registerSlot(node.id, el)` on mount, `unregisterSlot(node.id)` on unmount. The `handleResize` callback in `NodeRenderer` currently reads `useNavigationStore.getState().currentCanvasId` — this must be replaced with a `canvasId` prop passed through `CanvasNodeData` (already available as the canvas being rendered). At level 1 (non-interactive), resize handlers are never triggered (NodeResizer is not visible when `isSelected=false` and nodes are not selectable), but the correct `canvasId` must be wired for safety.

### DOM Mount Ordering for Slot Refs

`CanvasHost` calls `canvasHostManager.attachToSlot(canvasId, slotRef)` in a `useEffect`. The slot it targets is a `RefNodeSlot` inside a `NodeRenderer` in a sibling `CanvasView`. React mount order: parent renders all children, then `useEffect`s fire bottom-up. Since `NodeRenderer` is deeper in the tree than `CanvasHost`, the slot ref callback fires before `CanvasHost`'s `useEffect`. This means the slot is registered before `attachToSlot` is called — correct ordering.

For the focused canvas's ShellSlot, the slot is in `CanvasShell` (parent of `CanvasHost`), so it's available even earlier. No ordering issue.

### Recursion Depth

- **Level 0** (focused): Full interactivity — draggable, connectable, selectable.
- **Level 1** (direct children): Full rendering fidelity (same `NodeRenderer`, `EdgeRenderer`), all interaction disabled. Same flags SubsystemPreview uses today.
- **Level 2+**: Not rendered. RefNodes at level 1 show an empty container. Content appears when that level becomes focused.

### Detached Container Reparenting

React Portals with a stable container perform true DOM reparenting — no unmount/remount. Each `CanvasHost` creates a detached div once (`document.createElement('div')`), renders into it via `createPortal(content, detachedDiv)`, and registers it with `canvasHostManager`.

The detached div is physically moved between slots using `appendChild`:
- React manages what's INSIDE the detached div (ReactFlow, nodes, edges)
- React doesn't track WHERE the detached div lives in the DOM
- `appendChild` moves the DOM node without destroying the React tree inside
- ReactFlow's `ResizeObserver` fires when container dimensions change, triggering one viewport recalculation

**Key invariant**: One ReactFlow instance per canvas. Not destroyed during a single navigation transition (dive-in or go-up). However, `CanvasHost` instances ARE unmounted when their parent canvas is no longer current or adjacent — see lifecycle below.

### CanvasHost Lifecycle

`CanvasShell` creates `CanvasHost` instances for exactly:
1. The focused canvas (`currentCanvasId`)
2. Direct RefNode children of the focused canvas (level 1)

When navigation changes `currentCanvasId`, React unmounts the old `CanvasHost` instances (old children, and the old focused canvas if it's not the new parent) and mounts new ones. This means:
- **Dive-in**: Old sibling CanvasHosts unmount. New children of the target canvas mount.
- **Go-up**: Child CanvasHosts unmount. Parent's sibling children mount (they were unmounted when we dove in).
- **Breadcrumb jump**: All current CanvasHosts unmount. Target canvas + its children mount fresh.

This bounds active ReactFlow instances to N+1 at any time (where N = RefNodes in the focused canvas). Canvases visited earlier are not kept alive — their ReactFlow instances are recreated on next visit. This is acceptable: ReactFlow mount is ~10ms, and the animation masks it.

### Animation Abort & Cleanup

The animation hook maintains an `animatingRef` (React ref, not state — avoids re-renders). During animation:
- All navigation triggers (double-click, Escape, breadcrumb click) check `animatingRef.current` and no-op if true.
- If the component unmounts mid-animation (project gate, onboarding), a cleanup function in `useEffect` sets `animatingRef.current = false`, removes CSS overrides from the frame and canvases, and moves any reparented detached divs back to their original slots.
- No `setTimeout` chains — animation timing uses CSS transitions with `transitionend` event listeners for sequencing. Cleanup cancels pending listeners.

### NavigationStore Changes

`navigationStore` actions (`diveIn`, `goUp`, `goToBreadcrumb`) remain the same. The `useCanvasNavigation` hook orchestrates animation *around* the store updates — measuring, reparenting, and animating before/after calling the store actions.

### fitView Sequencing

ReactFlow's `fitView` races with `setViewport` and container resize events. The design ensures they never overlap:

1. During animation, the detached div (ReactFlow container) is set to full shell size inside the expanding frame. ReactFlow sees full size immediately → one layout pass.
2. The `transform: scale()` on the content wrapper is visual-only — doesn't trigger ResizeObserver.
3. `fitView({ duration: 0 })` is called ONCE after animation completes and the detached div is in its final slot.
4. For go-up: the parent canvas is un-hidden (`display: block`), then we wait for **two `rAF` callbacks** (first rAF: browser paints the unhidden element; second rAF: ResizeObserver has fired and ReactFlow has recalculated its container). After the second rAF, call `fitView({ duration: 0 })` on the parent, then measure the RefNode rect. This ensures the parent's viewport is settled before we read positions.

**Rule: never call `fitView` during a container resize or animation. Always wait for ResizeObserver to settle (2 rAF cycles after a display change) before calling `fitView` or measuring positions.**

## Animation — Primary: Expanding Frame (v6)

The SubCanvas container (border + content) expands as one visual unit from the RefNode to fill the shell.

### Dive-In Sequence (~450ms)

| Step | Time | Action |
|------|------|--------|
| Measure | t=0 | `getBoundingClientRect()` on RefNodeSlot (via `canvasHostManager.getSlot(canvasId)`). Compute frame start rect and content scale (`frameW / shellW`). The target canvas's `CanvasHost` already exists — it's a level-1 embedded child of the currently focused canvas. Its detached div is currently attached to the RefNodeSlot. |
| Setup | t=1ms | Move the existing detached div from RefNodeSlot into the expanding frame's content div. Set frame to RefNode position/size with matching border (1.5px solid, 8px radius). Set content `transform: scale(startScale)` with `transform-origin: top left`. Frame has `overflow: hidden`. Hide actual RefNode (`opacity: 0`). The detached div is now inside the frame — it is no longer tracked by CanvasShell's React tree, so subsequent React re-renders from the store update will not touch it. |
| Fade parent | t=2ms | Parent canvas `opacity: 1 → 0` over 60% of duration (`ease-out`). Full fade — no ghost. |
| Update store | t=2ms | `navigationStore.diveIn(refNodeId)`. Breadcrumb updates. React re-renders `CanvasShell`, which creates new `CanvasHost` instances for the target canvas's children (level 1). The target canvas's own `CanvasHost` component unmounts (old level-1 embedded instance), but its detached div is safely inside the frame — React's Portal unmount does not destroy DOM nodes that have been reparented out of the portal's container. A new `CanvasHost` for the target canvas (now focused, level 0) mounts and adopts the same detached div via `canvasHostManager.getContainer(canvasId)`. |
| Animate | t=16ms–450ms | Frame: `top/left/width/height` → `0/0/shellW/shellH`. `border-radius` → `0`. `border-color` → `transparent` (fades in last 40%). Content: `transform: scale(1)`. Easing: `cubic-bezier(0.32, 0.72, 0, 1)`. |
| Finalize | t=450ms | Move detached div from frame to ShellSlot. Hide frame. Hide parent (`display: none`). `fitView({ duration: 0 })`. Restore RefNode opacity. |

### Go-Up Sequence (~450ms)

| Step | Time | Action |
|------|------|--------|
| Prepare parent | t=0 | Un-hide parent (`display: block`, `opacity: 0`). Start fade-in with 30% delay (`opacity → 1` over 60% of duration). |
| Settle | t=0–32ms | Wait 2 `rAF` cycles for ResizeObserver to fire and ReactFlow to recalculate parent viewport. |
| fitView parent | t=32ms | Call `fitView({ duration: 0 })` on parent canvas (via imperative ref). Parent viewport is now correct. |
| Measure | t=33ms | `getBoundingClientRect()` on RefNodeSlot (via `canvasHostManager.getSlot(canvasId)`). Compute target rect and end scale. Hide RefNode (`opacity: 0`). |
| Setup | t=33ms | Move detached div from ShellSlot into expanding frame's content div. The detached div is now inside the frame — safe from React re-renders. Frame starts at full shell size. Content at `scale(1)`. |
| Update store | t=34ms | `navigationStore.goUp()`. Breadcrumb updates. React re-renders `CanvasShell` — child `CanvasHost` instances unmount, but the focused canvas's detached div is safely in the frame. A new `CanvasHost` for the child (now level-1 embedded) mounts and adopts the same detached div via `canvasHostManager.getContainer()` after animation completes. |
| Animate | t=46ms–450ms | Frame collapses to RefNode rect. `border-radius → 8px`. `border-color` appears (delayed 40%). Content: `transform: scale(endScale)`. |
| Finalize | t=450ms | Move detached div back to RefNodeSlot. Hide frame. Restore RefNode opacity. Parent is now focused. `fitView({ duration: 0 })`. |

### Breadcrumb Jump (multi-level)

No spatial animation. Simple crossfade:
1. Current canvas `opacity → 0` (150ms).
2. Update `navigationStore.goToBreadcrumb(index)`. React re-renders `CanvasShell` — old `CanvasHost` instances unmount (React destroys their ReactFlow instances), new `CanvasHost` instances mount for the target canvas and its children.
3. Target canvas `opacity: 0 → 1` (150ms).

Total ~300ms. The ReactFlow instances for the target canvas are freshly created (not reused from cache). This is acceptable — ReactFlow mount is ~10ms, hidden behind the 150ms fade.

### Reduced Motion

When `useReducedMotion()` returns `true`, skip all animations. Reparenting still happens in the same order, transforms and opacity apply instantly (no transition). The sequence is: reparent → update store → finalize. No frame overlay needed.

### Performance Note

The expanding frame animates actual `width/height` (triggers layout reflow per frame), not `transform`. This is necessary to keep the border at correct thickness — `transform: scale()` on the frame would make the 1.5px border paper-thin at small scale. Since the frame is `position: absolute` with no layout-dependent children (content uses `transform: scale()`), reflow cost is minimal. Validate on complex canvases during implementation.

## Animation — Fallback: Clip-Path + Scale (v4)

If the expanding frame approach hits issues with ReactFlow (e.g., ResizeObserver storms from the frame's dimension changes, or the frame's `overflow: hidden` interfering with ReactFlow's internal measurements), fall back to this simpler approach.

**Demo**: `animation-demo-v4.html`

### Mechanism

No expanding frame. The detached div is reparented directly to the ShellSlot at full size. Animation uses `clip-path: inset(...)` + `transform: scale()` on the detached div itself:

- `clip-path` clips the canvas to the RefNode rect, then expands to `inset(0)`
- `transform: scale(previewSize/shellSize)` with `transform-origin` at RefNode center, animates to `scale(1)`
- Both animated simultaneously — content appears to grow from the RefNode outward
- Parent fades to `opacity: 0` during animation (same as primary)

### Differences from Primary

| Aspect | Primary (v6) | Fallback (v4) |
|--------|-------------|---------------|
| Frame border | Visible, expands with content | No border — content only |
| DOM structure | Canvas inside frame, frame in shell | Canvas directly in shell |
| CSS properties animated | Frame `width/height` (layout) + content `transform` (compositor) | `clip-path` + `transform` (both compositor) |
| Visual feel | SubCanvas container expanding | Content growing from RefNode point |
| Performance | Frame layout reflow per frame | Fully GPU-composited, no layout |
| ResizeObserver risk | Frame dimension changes near ReactFlow container | None — all visual-only |

### When to Fall Back

Switch to v4 if during implementation:
- ReactFlow's ResizeObserver fires during the frame animation (causing viewport jitter)
- The frame's `overflow: hidden` clips ReactFlow's internal overlays (handles, selection box)
- Layout reflow from frame dimension animation causes visible jank on canvases with 20+ nodes

The fallback shares all architecture (CanvasShell/CanvasView split, detached container reparenting, canvasHostManager, CanvasHost). Only `useCanvasNavigation` hook changes — it skips the frame and applies clip-path + scale directly to the detached div.

## Shared Architecture (Both Variants)

Both animation variants share:

- `CanvasShell.tsx` / `CanvasView.tsx` / `CanvasHost.tsx` component split
- `canvasHostManager.ts` registry module
- `useCanvasRenderer` accepting `canvasId` prop
- `NodeRenderer` rendering `RefNodeSlot` instead of `SubsystemPreview`
- Depth 1 recursion limit
- Full rendering fidelity at level 1
- `useReducedMotion()` gating
- Crossfade for multi-level breadcrumb jumps
- `fitView` sequencing rules
- Single ReactFlow instance per canvas, never destroyed

## Files Changed

### New Files
- `src/components/canvas/CanvasShell.tsx` — chrome (extracted from Canvas.tsx)
- `src/components/canvas/CanvasView.tsx` — pure ReactFlow renderer
- `src/components/canvas/CanvasHost.tsx` — portal + detached div registration
- `src/core/canvas/canvasHostManager.ts` — DOM registry + reparenting
- `test/unit/core/canvas/canvasHostManager.test.ts`
- `test/unit/components/canvas/CanvasView.test.tsx`
- `test/unit/components/canvas/CanvasHost.test.tsx`
- `test/e2e/canvas-transition.spec.ts`

### Modified Files
- `src/App.tsx` — import `CanvasShell` instead of `Canvas`, remove top-level `ReactFlowProvider`
- `src/components/canvas/hooks/useCanvasRenderer.ts` — accept `canvasId` and `focused` params, gate inherited-edges logic by `focused`
- `src/components/canvas/hooks/useCanvasNavigation.ts` — rewritten (animation orchestration with imperative refs)
- `src/components/nodes/NodeRenderer.tsx` — RefNodes render `RefNodeSlot` with slot-ref registration instead of `SubsystemPreview`, `canvasId` read from `CanvasNodeData` for resize handler
- `src/components/canvas/types.ts` — Add `canvasId` field to `CanvasNodeData` (set by `useCanvasRenderer`/`mapCanvasNodes`)

### Deleted Files
- `src/components/canvas/Canvas.tsx` — replaced by CanvasShell
- `src/components/nodes/SubsystemPreview.tsx` — replaced by CanvasView
- `src/components/nodes/PreviewModeContext.ts` — no longer needed (level prop replaces context)
- `test/unit/components/nodes/SubsystemPreview.test.tsx` (if exists)

## Testing Strategy

### Unit Tests
- `canvasHostManager`: register/unregister, attachToSlot (mock DOM), getContainer
- `CanvasView`: renders ReactFlow with correct props for focused vs embedded, level gating
- `CanvasHost`: creates detached div, registers on mount, unregisters on unmount, portal renders content

### E2E Tests
- Dive-in: double-click RefNode → child canvas visible, breadcrumb updated, nodes interactive
- Go-up: Escape → parent canvas visible, breadcrumb updated
- Breadcrumb jump: click root from depth 2+ → root canvas visible
- Rendering consistency: nodes visible in RefNode preview match nodes after dive-in (same count, same labels)
- Reduced motion: with `prefers-reduced-motion`, transitions are instant

### Existing Test Impact
- Tests using `data-testid="main-canvas"` selectors should continue working (CanvasShell keeps this testid)
- Tests that import `Canvas` directly need updating to `CanvasShell`
- SubsystemPreview tests are deleted
- Subsystem creation/navigation E2E tests should pass unchanged (they test outcomes, not animation)

## Decisions

| Decision | Chose | Over | Why |
|----------|-------|------|-----|
| Animation primary | Expanding frame (v6) | Clip-path only (v4) | SubCanvas container expanding feels more spatial and intentional |
| Animation fallback | Clip-path + scale (v4) | No fallback | Shares all architecture, only hook changes. Risk mitigation for ReactFlow compat issues |
| Parent fade | Full opacity → 0 | Dim to 0.12 | Ghost parent during animation is distracting |
| Recursion depth | Level 1 only | Deeper | Bounds ReactFlow instances to N+1, deeper content loads on navigate |
| Embedded rendering | Full fidelity, non-interactive | Detail trimming | Eliminates visual discontinuity on transition — whole point of the refactoring |
| Shell/View split | Clean separation | Chrome gated by `focused` flag | Each component has one job, CanvasView stays lightweight |
| State management | Hybrid (Zustand state + plain TS DOM module) | All Zustand or all Context | DOM manipulation doesn't belong in stores; standalone module is testable |
| Frame dimension animation | Actual `width/height` | `transform: scale()` on frame | Correct border thickness at all sizes |
