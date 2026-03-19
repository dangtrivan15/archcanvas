# 26: Animation Rollback — Keep Features, Remove Transitions

> **Date**: 2026-03-19 | **Status**: Complete
> **Scope**: Remove all subsystem dive-in/go-up animation experiments (milestones 22–25) while preserving unrelated improvements shipped in the same commit range.

## Recap

Over milestones 21–25 we attempted four different approaches to animating subsystem navigation transitions — morph clones with CSS transitions (21), two-phase setTransitionData with targetsReady (22), viewport zoom with logarithmic interpolation (24), and clip-path overlay with RAF (25). None produced a satisfactory result. This milestone removes all animation code and restores the original simple navigation, which switches canvases with a brief `setViewport` zoom + `fitView`.

The key challenge was surgical: the animation experiments were interleaved with genuine feature improvements. A careful triage identified three categories of changes since commit `5b7584f`:

**Kept intact** — UX improvements (scroll-to-pan, collapsible right panel, project info display), layout quality (ELK spacing tuning, edge label wrapping, edge route extraction), subsystem container rendering (NodeResizer, SubsystemPreview mini ReactFlow, computeAutoSize, computeFitViewport, mapCanvasData extraction, "Fit to content" context menu, autoSize schema field, PreviewModeContext), and config improvements (jsdom→happy-dom, Playwright workers, @vitest-environment node).

**Removed** — 5 animation-only files (`CanvasOverlay.tsx`, `useNavigationTransition.ts`, `animateOverlayTransition.ts` + their tests), the "subsystem navigation animation" E2E test section (4 tests), and animation-specific wiring in Canvas.tsx, Breadcrumb.tsx, and useCanvasKeyboard.ts.

**Restored** — `useCanvasNavigation.ts`, the original simple hook that uses `setViewport` + `setTimeout` + `fitView` for dive-in/go-up. Breadcrumb and keyboard handler reverted from custom event dispatch back to direct store calls.

After cleanup: 1431 unit tests (65 files), all passing. E2E count drops by 4 (animation tests removed).

**What's next**: fix `bun` PATH for `beforeBuildCommand`, final release testing, potentially revisit navigation animation with a simpler approach in the future.

## Decisions

| Decision | Chose | Over | Why |
|----------|-------|------|-----|
| Cleanup scope | Remove animation only, keep all other improvements | Full revert to `5b7584f` | UX improvements, layout quality, and subsystem container rendering are valuable features independent of animation |
| Navigation routing | Direct store calls from Breadcrumb/keyboard | Keep event dispatch pattern | Event dispatch was introduced solely to route navigation through the transition hook. Without animation, direct calls are simpler and more debuggable |
| `data-testid="main-canvas"` wrapper | Keep on Canvas.tsx | Remove entirely | Still needed because SubsystemPreview's mini ReactFlow creates nested `.react-flow__node` elements that pollute E2E node counts |
| E2E animation tests | Delete entirely | Convert to non-animated navigation tests | The remaining subsystem creation/container tests already exercise navigation via context menu "Dive In" and breadcrumb clicks — duplicating without animation adds no value |

## Retrospective

- **What went well** — The triage was systematic: `git diff --name-status` + per-file diffs clearly separated animation wiring (3 coordination layers: Canvas hosting, event routing, E2E scoping) from feature work. Unit tests passed on first run after cleanup, confirming the cuts were clean.

- **What didn't** — Four successive animation approaches across 4 milestones consumed significant effort without a shippable result. Each approach solved one problem but introduced others (morph: DOM capture fragility; viewport zoom: camera overshoot past container edges; overlay: complexity of a 3-ReactFlow-instance architecture). The fundamental tension — ReactFlow's viewport is not designed for cross-canvas transitions — was apparent from milestone 22 but we kept iterating instead of pausing to re-evaluate.

- **Lessons** — When an approach requires fighting the framework (ReactFlow viewport for cross-canvas animation), step back earlier rather than iterating on workarounds. The non-animation features (container rendering, mini preview, auto-sizing) were independently valuable and should have been shipped separately from the animation experiments. Coupling features with animations made the eventual rollback more surgical than it needed to be.

- **Notes for future** — If revisiting navigation animation, consider approaches that don't involve multiple ReactFlow instances or viewport manipulation: (1) a CSS-only fade/scale transition on the canvas wrapper div, (2) a static screenshot overlay during the swap, or (3) a single shared ReactFlow instance that hot-swaps its node/edge data. The `useCanvasNavigation` hook's `setViewport` + `fitView` approach works reliably as a baseline.
