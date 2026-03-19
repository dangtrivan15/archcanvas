# 22: Navigation Animation Fix

> **Date**: 2026-03-18 | **Status**: Complete
> **Scope**: Fix one-frame flash in dive-in/go-up transitions, implement true spatial morph, make resize handles visible.

## Recap

This was a targeted bugfix for two issues that emerged immediately after the subsystem enhancements ([`docs/progress/21-subsystem-enhancements.md`](21-subsystem-enhancements.md)) shipped. The morph navigation animations were flashing the destination canvas for one frame before the overlay appeared, and the `NodeResizer` handles on container nodes were invisible.

The flash was caused by a sequencing error in `useNavigationTransition`: the hook called `navigationStore.diveIn()` *before* mounting the overlay, so React painted one frame of the new canvas before the overlay covered it. The fix reorders this — mount the overlay first with `sourceNodes` (captured from the SubsystemPreview SVG mini-nodes), then switch the canvas behind the opaque overlay, then provide `targetNodes` in a second `setTransitionData` call after ReactFlow renders the new canvas. The `NavigationTransition` component uses a `currentTransitionRef` tracking `fromCanvasId` to distinguish "new transition (reset phase)" from "same transition, targets arrived (advance to animate)."

A subtlety emerged during E2E testing: the plan's phase-advance condition (`targetNodes.length > 0`) broke both dissolve transitions (which never provide targets) and go-up from empty subsystems (both source and target arrays empty). This was fixed by adding an explicit `targetsReady` boolean to `TransitionData` — the hook sets it to `false` on the initial mount and `true` when the second phase data arrives (or immediately for dissolve). The component checks `targetsReady` instead of array length.

For the SVG mini-node capture to work, `SubsystemPreview` needed `data-node-id` attributes on each `<g>` element (Task 1, TDD). The `captureMiniNodes` helper in the hook then queries `g[data-node-id]` and reads `getBoundingClientRect()` from the child `<rect>` to get screen positions.

Resize handles were made visible with two CSS rules: `.react-flow__resize-control.handle` gets a solid fill with white border for corner squares, and `.react-flow__resize-control.line` gets transparent borders so only cursor change signals edge resizing.

**Spec:** [`docs/specs/2026-03-18-navigation-animation-fix-design.md`](../specs/2026-03-18-navigation-animation-fix-design.md)
**Plan:** [`docs/plans/2026-03-18-navigation-animation-fix.md`](../plans/2026-03-18-navigation-animation-fix.md)

**Tests:** 1426 unit (up from 1425, 1 new SubsystemPreview test), 65 test files; 87 E2E unchanged count (4 subsystem navigation tests now pass correctly).

**What's next**: fix `bun` PATH for `beforeBuildCommand`, final release testing.

## Decisions

| Decision | Chose | Over | Why |
|----------|-------|------|-----|
| Phase-advance signal | Explicit `targetsReady` boolean in TransitionData | `targetNodes.length > 0` check | Empty-canvas morphs and dissolve transitions have zero targets — array length is not a reliable "ready" signal |
| Ref guard for double-click | Synchronous `transitioningRef` (useRef) | React state `isTransitioning` | React state is stale in event handler closures between batched renders; a ref is synchronously consistent |
| Component phase tracking | `currentTransitionRef` comparing `fromCanvasId` | Reset-on-every-data-change (old approach) | Two `setTransitionData` calls per morph transition — the component must distinguish "new transition" from "targets arrived for same transition" |

## Retrospective

- **What went well** — The plan was precise: exact file paths, line numbers, code blocks, test commands. Execution was nearly mechanical for 4 out of 5 tasks. TDD for Task 1 caught a typo in the first pass. The E2E test suite caught the `targetsReady` bug that unit tests couldn't — the dissolve flow exercises the full hook→component→navigation pipeline.

- **What didn't** — The plan's phase-advance condition (`targetNodes.length > 0`) had a gap for dissolve and empty-canvas cases. This wasn't caught during spec review because the spec focused on the morph (dive-in/go-up) flow and treated dissolve as "unchanged." The fix was small (adding one boolean field), but the diagnosis required tracing the full React render cycle to understand why the overlay stayed opaque.

- **Lessons** — When rewriting a component's state machine, enumerate all state transitions including the "no-op" paths (empty arrays, unchanged fields). The plan correctly identified that dissolve's "unchanged logic" needed "updated field names" but didn't account for the *phase management* change affecting dissolve's flow. A `targetsReady`-style explicit signal is more robust than inferring readiness from data shape — it decouples "I have data" from "I'm done collecting data."
