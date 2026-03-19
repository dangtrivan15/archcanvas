# 24: Viewport Zoom Navigation

> **Date**: 2026-03-18 | **Status**: Complete
> **Scope**: Replace clone-overlay morph transitions with Muse-style two-phase viewport zoom for subsystem dive-in/go-up navigation.

## Recap

The navigation transition system was rewritten from the ground up. The previous approach (milestones 21-23) used DOM clone rectangles on a fixed overlay, animated via CSS `left/top/width/height` transitions. While functional, it produced three visible artifacts: double-image ghosting from the semi-transparent overlay, a visible canvas switch (breadcrumb and real nodes updating behind the clones), and a jarring mismatch between plain-rectangle clones and the real shaped nodes.

The new system takes inspiration from Muse's spatial navigation: it animates the *actual ReactFlow viewport* in two phases with a seamless canvas swap at the midpoint. Phase 1 zooms the current canvas toward (dive-in) or away from (go-up) the subsystem container. At the switch point — when the container fills the screen — the canvas data swaps and the viewport is mathematically matched so child nodes appear at the same screen positions as the mini-preview content. Phase 2 then zooms to the fitted view. A single opaque cover div is shown for exactly one frame at the switch point, making the swap imperceptible.

Three pure utility functions were built first via TDD:
- **`computeZoomToRect`** — centers and fills the screen with a given canvas-space rectangle
- **`animateViewport`** — RAF-based viewport interpolation with logarithmic zoom (perceptually constant speed) and an easing function
- **`computeMatchedViewport`** — the critical switch-point math: fits child nodes within the container's content area (minus header and padding) and offsets for screen centering

The hook rewrite was a net deletion of 272 lines (519 removed, 247 added). `NavigationTransition.tsx` (the 270-line clone overlay component) was deleted entirely. The `fitView` prop was removed from `<ReactFlow>` to prevent a race condition where ReactFlow's built-in fitView would overwrite the precisely-set viewport during canvas switch.

Visual verification via Playwright confirmed: no double-image ghosting, no visible canvas switch, smooth continuous zoom for both dive-in and go-up. Dissolve transitions (breadcrumb jumps) continue to use crossfade unchanged.

**What's next**: fix `bun` PATH for `beforeBuildCommand`, final release testing.

## Decisions

| Decision | Chose | Over | Why |
|----------|-------|------|-----|
| Zoom interpolation | Logarithmic (`from * (to/from)^t`) | Linear (`from + (to-from)*t`) | Linear zoom feels like it accelerates: 1→2 feels the same magnitude as 2→4. Log interpolation keeps perceptual speed constant because zoom is multiplicative — see [animateViewport.ts:L21-L23](../src/lib/animateViewport.ts) |
| Switch-point cover | 1-frame opaque div (z-index 50) | Semi-transparent overlay (old: 0.95 opacity) | The old 0.95 opacity was the root cause of ghosting — real nodes bled through. An opaque cover for exactly one frame is invisible to the eye but completely hides the canvas swap |
| Viewport control | `setViewport()` calls in RAF loop | `fitView({ duration })` for Phase 2 | `fitView` races with the manually-set switch-point viewport — ReactFlow's internal animation overwrites our precisely-computed position. Direct `setViewport` gives frame-precise control |
| State machine | Ref-based (`stateRef`) | React state | Animation state changes per-frame during RAF. React state would cause unnecessary re-renders and lag. Only `overlayStyle` and `isTransitioning` use React state (they affect rendering) |
| Container rect storage | `lastContainerRectRef` persists across dive-in/go-up | Re-measure from DOM on go-up | After `goUp()`, the parent canvas re-renders and the container's measured dimensions may not be available on the first frame. Storing the rect from dive-in guarantees it's available for the reverse animation |
| Dissolve fallback | Used for unmeasured containers and breadcrumb jumps | Force viewport zoom for all cases | If `containerNode.width` is null (unmeasured by ReactFlow), the zoom math would produce NaN. Dissolve is a safe fallback. Breadcrumb multi-level jumps lack a clear spatial relationship, so dissolve is also more appropriate there |

## Retrospective

- **What went well** — TDD was effective here. The three pure utility functions were independently verifiable with exact math, and having them proven correct before wiring into the hook meant the integration was straightforward. Parallel implementation of Tasks 1-3 via subagents saved significant time. The Playwright frame-by-frame visual verification caught the animation quality immediately — much faster than manual testing.

- **What went well** — The mini ReactFlow preview (milestone 23) was the key enabler. Because the preview renders child nodes with the *same* `NodeRenderer`, shapes, icons, and CSS variables as the main canvas, the switch-point visual fidelity is inherent. Without this, the "matched viewport" math would produce correct positions but the visual content would differ, making the switch noticeable.

- **Lessons** — Imperative animation (RAF loop + `setViewport`) is better than declarative animation (React state → CSS transitions) for viewport control. The old system fought against React's rendering model — setting state to trigger clone rendering, then waiting for layout, then transitioning CSS properties. The new system sidesteps React entirely during the animation: it calls `setViewport()` directly in a RAF loop, only touching React state at the start (show overlay) and end (reset). This is ~470ms of pure imperative code bracketed by two React state changes.

- **Notes for future** — The `computeMatchedViewport` function hardcodes container layout constants (`CONTAINER_HEADER_H = 17`, `CONTAINER_PAD_X = 16`, `CONTAINER_PAD_Y = 14`) that must match `nodeShapes.css`. If the container styling changes, these constants need updating. A future improvement could read them from the DOM at runtime, but the current approach is simpler and avoids layout-dependent timing issues.
