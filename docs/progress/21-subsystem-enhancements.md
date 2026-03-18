# 21: Subsystem Enhancements

> **Date**: 2026-03-18 | **Status**: Complete
> **Scope**: Make subsystem RefNodes visually rich — resizable containers with reactive mini-node previews and morphing navigation animations.

## Recap

This milestone transforms subsystem RefNodes from simple dashed rectangles into container nodes that reveal their internal structure. Before this work, RefNodes looked identical to regular nodes except for a dashed border — users had to dive in to discover what was inside. Now RefNodes render as larger containers showing an SVG mini-map of their child nodes, with edges and color-coded types visible at a glance.

The work had three layers: **data** (schema + utilities), **rendering** (container mode + preview), and **navigation** (morph transitions).

On the data side, the `Position` schema gained an `autoSize` boolean to distinguish auto-fitted containers from manually resized ones. Two pure utilities were added: `computeAutoSize` computes bounding-box dimensions from child canvas nodes (clamped 180×120 to 400×300), and `typeToColor` maps node type strings to deterministic HSL colors via a djb2-like hash.

For rendering, `NodeRenderer` now switches RefNodes to a `node-shape-container` CSS class and mounts ReactFlow's `NodeResizer` (visible when selected) plus a new `SubsystemPreview` SVG component. The preview reactively reads child canvas data from `fileStore`, rendering color-coded mini rectangles with truncated labels and edge lines. `useCanvasRenderer` computes auto-fit dimensions for each RefNode on every render, subscribing to the canvases Map reference so sizes update when child content changes. A "Fit to content" context menu item lets users reset manual resizes back to auto-fit.

The navigation system was rebuilt around a `useNavigationTransition` hook that replaces the old `useCanvasNavigation`. All navigation paths — double-click dive-in, Escape go-up, breadcrumb clicks — now flow through this hook, which orchestrates a 3-phase morph animation: capture DOM positions → switch canvas behind an overlay → CSS-transition cloned nodes to target positions. Go-up uses a reverse morph, and multi-level breadcrumb jumps use a dissolve. The `Breadcrumb` component and `useCanvasKeyboard` hook now dispatch `archcanvas:navigate-up` and `archcanvas:navigate-to-breadcrumb` custom events instead of calling store methods directly.

**What's next**: fix `bun` PATH for `beforeBuildCommand`, final release testing.

## Decisions

| Decision | Chose | Over | Why |
|----------|-------|------|-----|
| Auto-fit sizing location | `useCanvasRenderer` (re-run on every canvases Map change) | Dedicated effect or store-level computation | RefNode count per canvas is small and bounding-box math is cheap; a separate subscription would add complexity for no measurable gain |
| Navigation event dispatch | Custom events (`archcanvas:navigate-up`) | Direct store calls from Breadcrumb/keyboard | All navigation must go through the transition hook for animations; events decouple the trigger from the orchestration |
| Transition overlay approach | Position-fixed div clones with CSS transitions | ReactFlow viewport manipulation (old approach) | CSS transitions over cloned DOM elements produce smoother, more predictable animations than fighting ReactFlow's internal viewport state |
| SubsystemPreview reactivity | Touch `s.project?.canvases` in selector + `getCanvas()` | Just `getCanvas(id)` | Zustand uses `Object.is` — same `LoadedCanvas` ref is returned when a *different* canvas mutates, so touching the Map ref (cloned on every mutation) ensures re-render |
| Container shape for RefNodes | Override shape to `'container'` in NodeRenderer | New node type registration | Container is a visual concern, not a schema concern — the node is still a RefNode in the data model |

## Retrospective

- **What went well** — Tasks 1–3 ran in parallel via subagents, cutting ~3 minutes off the critical path. The TDD cycle caught the existing `NodeRenderer.test.tsx` mock gap immediately — the `@xyflow/react` mock was missing `NodeResizer`, and the `fileStore` mock needed selector support for `SubsystemPreview`. Both were quick fixes because the test failures were specific.

- **What didn't** — The E2E Escape-key test failed initially because pressing Escape after navigating into an empty subsystem required the ReactFlow pane to have focus. The `diveIntoSubsystem` helper uses context menu → Dive In, which doesn't leave focus on the pane. Adding a pane click before the Escape fixed it, but this is a pattern to watch for in future E2E tests involving keyboard shortcuts after navigation.

- **Lessons** — `vi.mock()` factory functions are hoisted above all variable declarations in Vitest. You cannot reference `const` variables from the test file inside the mock factory — everything must be self-contained. This came up when updating the existing NodeRenderer test mocks to support both `getState()` and selector patterns.

- **Notes for future** — The morph animation captures node positions from the DOM via `getBoundingClientRect()`, which means it depends on ReactFlow having rendered the new canvas within a single `requestAnimationFrame`. This works reliably in practice but could be fragile under heavy load. If animation glitches appear, the safety timeout (TRANSITION_DURATION + 100ms) will catch them and skip to the final state. The `NavigationTransition` component has room for refinement — edge interpolation during the morph (tracking node div positions via rAF) was deferred as the current fade approach is visually acceptable.
