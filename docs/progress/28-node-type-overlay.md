# 28: Node Type Overlay

> **Date**: 2026-03-19 | **Status**: Complete
> **Scope**: Hover overlay on Add Node button for visual type browsing + drag-to-canvas, plus `+` prefix in CommandPalette for keyboard-first node type search

## Recap

The "Add Node" toolbar button previously dispatched `archcanvas:open-palette` with the `@` prefix, which routed to `NodeSearchProvider` — listing *existing* canvas nodes, not node *types* for creation. The `NodeTypeProvider` was only reachable via the unprefixed palette or subsystem mode. Beyond the routing bug, the command palette isn't ideal for browsing 32+ node types across 9 namespaces.

This milestone added two complementary paths to node creation:

1. **Visual overlay** — hovering or clicking the "Add Node" button opens a `NodeTypeOverlay` panel showing all NodeDef types grouped by namespace in a 2-column grid. Types can be clicked to add at a default position, or dragged directly onto the canvas to place at the drop location. The overlay supports a filter input, pin/unpin state, and `motion/react` animations gated by `useReducedMotion()`.

2. **Keyboard-first palette** — pressing `N` (or typing `+` in the command palette) routes to `NodeTypeProvider`, enabling quick type search and selection. This intentionally opens the *palette* (not the overlay) since keyboard users benefit from search-first interaction.

A shared `createNodeFromType` helper was extracted from `NodeTypeProvider.onSelect` to ensure consistent naming/positioning logic across all three creation paths (palette, overlay click, canvas drop).

**Test coverage**: 1447 unit tests (67 files, +8 new tests), 7 new E2E tests — zero regressions from this work.

## Decisions

| Decision | Chose | Over | Why |
|----------|-------|------|-----|
| Overlay positioning | HTML5 absolute positioning relative to toolbar | Radix Popover | Hover-to-peek + drag interactions conflict with Radix's focus-trap model |
| Drag API | Native HTML5 drag-and-drop with custom MIME type | React DnD library | Drop target is a native DOM handler on the canvas wrapper div, not a ReactFlow prop — no library needed |
| `N` shortcut target | Opens CommandPalette with `+` prefix | Opens overlay | Keyboard users benefit from search-first; toolbar hover opens the visual overlay — two paths optimized for different input methods |
| Shared helper extraction | `src/lib/createNodeFromType.ts` | Inline logic in each call site | Three call sites (palette, overlay click, canvas drop) need identical naming/positioning — DRY |
| Overlay dismiss | Escape key (capture phase), click-outside, button toggle | Only button toggle | Multiple dismiss paths match expected popover UX conventions |

## Retrospective

- **What went well** — The plan was precise enough to execute all 7 tasks without blockers. TDD cycle (write failing test → implement → verify) caught the `createNodeFromType` mock issue in CommandPalette tests early. All 7 E2E tests passed on first run, including the drag-to-canvas test which often has flaky timing.

- **Lessons** — When extracting a helper that replaces inline store calls, existing tests that mock the store directly need updating to mock the helper instead. The CommandPalette test had to switch from asserting `mockGraphState.addNode` to asserting `createNodeFromType` was called — the unit test for the helper itself covers the `addNode` call.

- **Notes for future** — The overlay currently uses `registryStore.getState()` inside `useMemo` (not a subscription). This works because the registry is static after load, but if dynamic NodeDef registration is added later, the overlay would need to subscribe reactively. The `SlidingNumber` component from animate-ui breaks E2E text assertions that use `getByText` — existing E2E tests need updating for the new animated digit rendering.
