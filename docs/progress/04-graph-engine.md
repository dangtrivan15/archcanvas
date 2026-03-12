# 04: Graph Engine

> **Date**: 2026-03-12 | **Status**: Complete
> **Scope**: Core Layer graph engine — scope-local CRUD via Immer, NodeDef-aware validation, single-canvas + cross-scope queries, entity CRUD

## Recap

I4 builds the graph engine — the central business logic layer between the data model (I10) and the future state/presentation layers. When a user adds a node, connects an edge, or defines an entity, the graph engine validates the operation, transforms the canvas data immutably, and returns a structured result.

The implementation followed the [design spec](../specs/2026-03-12-i4-graph-engine-design.md) and [task plan](../plans/2026-03-12-i4-graph-engine-index.md) closely. Three tasks executed bottom-up: types + validation (T1, sequential), then engine + query (T2 + T3, parallel via subagents). The final result: 5 source files in `src/core/graph/`, 98 new tests across 3 test files, 254 total tests passing. One new dependency: `immer`.

The Core Layer is now feature-complete per the design doc's module architecture. The next consumer is the `graphStore` (Zustand, State Layer) which will wrap engine functions for reactive use in the presentation layer. The engine's pure-function API (`(canvas, params) → EngineResult`) was designed to make that integration straightforward.

## Decisions

| Decision | Chose | Over | Why |
|----------|-------|------|-----|
| Warning dedup strategy | Canonical key builder (`warningKey()` with exhaustive switch) | `JSON.stringify` | Explicit about which fields constitute identity; TS catches missing cases when new warning codes are added |
| Self-loop check for `@root/` | Raw string comparison only | Normalizing `@root/` prefix before comparison | `@root/svc-a` and `svc-a` are different nodes in different scopes (root vs local) — not a self-loop. Cross-scope self-loop detection is a store/query concern |
| RefNode in `searchGraph` | Excluded | Including ref node `id` at low weight | RefNodes are navigation portals, not content. The [command palette design](../archcanvas-v2-design.md#9-command-palette) has a separate "Scopes" category for canvas navigation — that's where ref nodes surface, not in content search |
| Shared test fixtures | `serviceNodeDef` + `registryWith` in `test/core/graph/helpers.ts` | Duplicated per test file | DRY — both engine and validation tests need the same NodeDef fixture |

## Retrospective

- **What went well** — The bottom-up build order (types → validation → engine + query) meant each layer was testable before the next. Parallel execution of T2 + T3 via subagents cut wall-clock time significantly. The spec was detailed enough that subagents produced correct implementations on the first pass. Code review (via `superpowers:code-reviewer`) caught the `JSON.stringify` dedup issue and sparked useful design discussions on `@root/` semantics and RefNode searchability.

- **What didn't** — The subagents installed `immer` in the worktree's `node_modules` but main needed a separate `npm install` after the merge. This caused a brief test failure on main until the dependency was installed. Worktrees with different `node_modules` states are a known friction point.

- **Lessons** — Code review after subagent work is valuable even when tests pass — it caught a fragile dedup pattern and prompted design clarifications that improved the codebase. Subagent prompts should include "run `npm install` on the main branch" as a post-merge step when new dependencies are introduced. The `@root/` naming question (root vs relative parent) was surfaced during review and is worth revisiting in a future design discussion.

- **Notes for future** — The `@root/` prefix always means global root, not relative parent. If relative parent references are needed later, a different prefix (e.g., `@parent/`) would be required. The `CanvasFile` → `Canvas` rename is still deferred. `saveAll` partial-failure handling (noted in I10) is still unaddressed.
