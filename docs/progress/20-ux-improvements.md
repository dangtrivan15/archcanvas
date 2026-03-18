# 20: UX Improvements — Scroll, Collapse, Project Info

> **Date**: 2026-03-18 | **Status**: Complete
> **Scope**: Three independent UX improvements to the ArchCanvas shell — Figma-style scroll-to-pan, collapsible right panel with expand strip, and project info display in menubar/status bar.

## Recap

This milestone delivered three small, self-contained UX improvements that make the ArchCanvas editor feel more polished and discoverable.

**Scroll = Pan** switches the canvas viewport from ReactFlow's default scroll-to-zoom to Figma-style scroll-to-pan. Three props on the `<ReactFlow>` element (`panOnScroll`, `zoomOnScroll={false}`, `zoomOnPinch`) handle all the work — scroll pans, Cmd+Scroll zooms, and trackpad pinch zooms. No custom event handlers needed; ReactFlow supports this natively.

**Collapsible right panel** changes the collapse behavior from fully disappearing (0px) to showing a thin 28px strip with a `ChevronLeft` icon. Clicking the strip re-expands the panel. This required a new `rightPanelCollapsed` boolean in `uiStore` (synced via both `toggleRightPanel` and an `onResize` callback), plus an early-return guard in `RightPanel.tsx` that renders only the strip when collapsed. Existing E2E tests that expected a 0px collapsed width were updated to `toBeLessThanOrEqual(28)`.

**Project info display** adds the project name between the logo and File menu in `TopMenubar`, and the root canvas filename after the version string in `StatusBar`. Both use existing `fileStore` selectors with conditional rendering — nothing displays when no project is open or when `filePath` is empty (as in E2E tests using `initializeEmptyProject`).

The work touched 6 source files and 4 test files, adding 140 lines across 5 commits. All 1402 unit tests and 83 E2E tests pass.

**Spec**: `docs/specs/2026-03-19-ux-improvements-design.md`
**Plan**: `docs/plans/2026-03-19-ux-improvements.md`

## Decisions

| Decision | Chose | Over | Why |
|----------|-------|------|-----|
| Collapsed panel width | 28px strip with chevron | 0px (fully hidden) | Provides a persistent, discoverable affordance to re-expand without needing the View menu or toolbar |
| Collapse state tracking | Zustand boolean + onResize sync | Reading `isCollapsed()` directly | Panel library updates `isCollapsed()` asynchronously via React setState — a Zustand boolean gives synchronous, reliable state for conditional rendering |
| Scroll behavior scope | Always active regardless of tool mode | Only in pan mode | Matches Figma — scroll-panning is viewport navigation independent of the editing tool |

## Retrospective

- **What went well** — The three features were genuinely independent, making implementation straightforward. ReactFlow's built-in `panOnScroll` support meant zero custom code for the scroll change. TDD on the uiStore caught the toggle logic issue immediately.
- **Lessons** — Changing `collapsedSize` from `0px` to `28px` broke 3 existing E2E tests that asserted `toBe(0)`. Small layout constant changes can cascade through E2E assertions — worth checking related tests proactively rather than discovering failures after a full suite run.
