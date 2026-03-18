# 25: Overlay Navigation Animation

> **Date**: 2026-03-19 | **Status**: Complete
> **Scope**: Replace viewport-zoom navigation with Muse-style clip-path overlay animations for subsystem dive-in/go-up

## Recap

This milestone replaces the two-phase viewport zoom navigation (milestone 24) with clip-path overlay animations. The previous approach flew the camera past container edges and used a 1-frame opaque cover to hide the canvas swap — functional but lacking spatial context. The new approach mounts a temporary `CanvasOverlay` component containing a non-interactive ReactFlow, animates `clip-path: inset()` to expand/collapse a window revealing the child canvas, and swaps the main canvas only after the animation completes. The parent canvas remains visible around the edges during dive-in; during go-up, the overlay shrinks back to the preview position.

The implementation followed a 4-task plan: (1) `animateOverlayTransition` RAF utility with clip-path + viewport interpolation, (2) SubsystemPreview switch from ReactFlow's `fitView` prop to `computeFitViewport` for pixel-perfect viewport matching, (3) `CanvasOverlay` component + full rewrite of `useNavigationTransition` + Canvas.tsx integration, (4) clean deletion of 3 replaced utilities. Tasks 1 and 2 ran in parallel via subagents; tasks 3 and 4 were sequential.

The hook was simplified from a 4-state machine (`idle → zooming_in → switching → zooming_out`) to a 2-state flag (`idle | animating`). Dissolve fallback (breadcrumb jumps, unmeasured nodes) was preserved unchanged. E2E selectors were updated to scope `.react-flow__node` queries to `[data-testid="main-canvas"]` to exclude backdrop/overlay ReactFlow instances.

**Spec**: [docs/specs/2026-03-19-overlay-navigation-design.md](../specs/2026-03-19-overlay-navigation-design.md)
**Plan**: [docs/plans/2026-03-19-overlay-navigation-index.md](../plans/2026-03-19-overlay-navigation-index.md)

## Decisions

| Decision | Chose | Over | Why |
|----------|-------|------|-----|
| Overlay positioning | `position: absolute` inside canvas wrapper | `position: fixed` (spec default) | App has resizable panels — fixed would cover the full viewport and break viewport math. Absolute matches the ReactFlow container dimensions naturally. |
| Backdrop rendering | Opaque main canvas background (`bg-[var(--color-background)]`) hides backdrop | Always-visible backdrop behind main canvas | Backdrop bleeds through transparent ReactFlow background at steady state, causing duplicate node rendering. Opaque main canvas is simpler and the backdrop is redundant (main canvas already shows parent/current content during transitions). |
| Overlay RF instance forwarding | Callback ref pattern (`onRfReadyCallbackRef`) | Direct DOM query or forwardRef | The hook sets a callback before mounting the overlay; when `onReactFlowReady` fires, it executes the stored callback. Clean separation between state setup and animation start. |
| State machine simplification | `idle \| animating` flag | Keep 4-state machine from milestone 24 | The overlay approach doesn't need `zooming_in → switching → zooming_out` phases — the clip-path animation is a single continuous motion with canvas swap at the end (dive-in) or beginning (go-up). |

## Retrospective

- **What went well** — Tasks 1 and 2 parallelized cleanly via subagents with no merge conflicts. The TDD cycle for `animateOverlayTransition` caught the edge case of same start/end zoom early. The `containerRef` prop on CanvasOverlay avoided fragile DOM queries for the animation target element.

- **What didn't** — E2E failures took multiple iterations to diagnose. The root cause was backdrop bleed-through (transparent ReactFlow background), which manifested as duplicate nodes in selectors. The fix was straightforward (opaque background + scoped selectors) but required visual inspection of Playwright screenshots to identify. The spec's `position: fixed` assumption also didn't account for the app's panel layout.

- **Lessons** — When adding new ReactFlow instances (backdrop, overlay), all E2E selectors that use `.react-flow__node` or `.react-flow__pane` need scoping. A `data-testid` on the main canvas wrapper is a reliable scope boundary. Visual regression testing (screenshots) was essential for diagnosing the backdrop bleed-through — error context alone didn't make the issue obvious.

- **Notes for future** — The `backdropCanvasId` state is still maintained in the hook but not rendered in Canvas.tsx. If a future design needs a visible parent canvas behind the main canvas (e.g., for depth context at steady state), the backdrop can be re-enabled by adding a solid background to the ReactFlow container itself rather than the wrapper div. The `CanvasOverlay` component already supports backdrop mode (`backdrop` prop with z-index 0).
