# 05: Canvas Rendering

> **Date**: 2026-03-12 | **Status**: Complete
> **Scope**: Full Presentation + State Layer — 6 Zustand stores, 12 React components, 2 core modules, wired into a working canvas UI

## Recap

I2 builds the entire presentation and state layer on top of the Core Layer (I3 + I4). Where I4 gave us pure-function graph operations, I2 wraps them in reactive Zustand stores and renders them through ReactFlow. The result is a working canvas application: nodes render with shape-aware CSS, edges show protocol-based styling, a breadcrumb tracks scope navigation, a right panel edits node/edge properties, context menus provide common actions, a command palette searches everything, and an ELK-based auto-layout arranges nodes.

The implementation followed the [design spec](../specs/2026-03-12-i2-canvas-rendering-design.md) and was decomposed into [15 tasks](../plans/2026-03-12-i2-canvas-rendering-index.md) via the task-decomposition skill. Execution used subagent-driven development: fresh implementation agents per task, spec compliance review, then code quality review. Tasks were grouped for parallel dispatch where write sets were disjoint (e.g., Tasks 11+12+14 ran simultaneously).

The branch adds **~8,300 lines across 66 files** (19 commits). Test count grew from 254 to 422 (+168 new tests across 11 test files). Two new npm dependencies: `cmdk` (command palette) and `elkjs` (auto-layout). The engine was upgraded from `produce()` to `produceWithPatches()` to enable patch-based undo/redo.

**What's next:** I5 (Collaboration/Export) per the [initiative roadmap](../../docs/archcanvas-v2-design.md). The canvas is now interactive but has no persistence UI — `fileStore.saveAll` needs a real `FileSystem` wired to the Save menu.

## Decisions

### State Architecture

| Decision | Chose | Over | Why |
|----------|-------|------|-----|
| graphStore pattern | Stateless orchestrator (no state of its own) with `resolveCanvas` / `applyResult` helpers | Store holding its own copy of canvas data | Engine operates on `CanvasFile` from fileStore — duplicating it would create sync issues. The `resolveCanvas` helper eliminated 10 non-null assertions found in code review |
| Undo/redo mechanism | Immer patch-based (`produceWithPatches` → `applyPatches`) | Command pattern or snapshot-based undo | Patches are structural diffs — smaller memory footprint than full snapshots, and Immer already powers the engine mutations. Critical subtlety: `applyPatches` returns a NEW object (does not mutate), so the return value must be captured |
| `updateCanvasData` doc clearing | Set `doc: undefined` on every mutation | Keep doc AST and merge | The YAML doc AST becomes stale after Immer mutations. Clearing forces `saveCanvas` to use plain stringify rather than merging into a stale AST, preventing data corruption |
| Cross-store communication | `getState()` calls between stores | Zustand middleware or pub/sub | Simple, explicit, debuggable. Each store function reads peer state at call time — no stale closures, no subscription overhead |

### Presentation Layer

| Decision | Chose | Over | Why |
|----------|-------|------|-----|
| Context menu state | Component-local `useState` in Canvas.tsx | Dedicated store | Menu state is ephemeral, only Canvas reads it, and it closes on every action. Store overhead adds nothing |
| Custom event bus for cross-component actions | `window.dispatchEvent(new CustomEvent('archcanvas:*'))` | Prop drilling or shared store | Toolbar, menubar, and command palette all need to trigger fit-view/auto-layout/open-palette, but live in different component trees. Events decouple without a shared store |
| Command palette filtering | `shouldFilter={false}` with per-provider custom search | cmdk's built-in filter | Prefix shortcuts (`>`, `@`, `#`) need to route to specific providers before filtering — cmdk's built-in filter doesn't support this |

## Retrospective

- **What went well** — Parallel subagent dispatch was highly effective. Tasks 11+12+14 (three completely disjoint write sets) ran simultaneously in ~6 minutes wall-clock. Spec compliance reviews caught real issues before they compounded: the stale `ROOT_CANVAS_KEY` in canvasStore, duplicated auto-layout logic in LeftToolbar, and a cross-platform keyboard `e.key` case issue. The `resolveCanvas` refactor (found in code quality review) eliminated all non-null assertions from graphStore.

- **What didn't** — Context compaction during long sessions caused loss of background agent results. Two agents completed work but their results were inaccessible after compaction. The workaround (agents commit to the working directory) meant changes persisted, but status tracking was lost. Also, LSP diagnostics were frequently stale — showing false-positive errors that `tsc --noEmit` didn't reproduce, requiring manual verification after each change.

- **Lessons** — (1) Always run `tsc --noEmit` rather than trusting LSP diagnostics in a multi-agent workflow where files change rapidly. (2) Spec compliance review is not optional — it caught issues in 3 of the first 8 tasks reviewed. (3) Background agents should commit frequently so work survives context compaction. (4) Write sets should be verified for disjointness before parallel dispatch — one shared file means sequential only.

- **Notes for future** — The `CanvasFile` naming issue (should be `Canvas`) persists from I4. The `fileStore.saveAll` still has no partial-failure handling. `useCanvasNavigation.diveIn` animation bypasses the hook when called from ContextMenu (uses `navigationStore.diveIn` + `fitView` directly). The `NodeDetailPanel` has no external API to switch tabs, so "Add Note" from context menu opens the right panel but defaults to Properties tab.
