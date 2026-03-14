# 11: Ephemeral Bridge Operations

> **Date**: 2026-03-15 | **Status**: Complete
> **Scope**: Make the CLI a thin transport layer when bridge detected — all logic happens in browser stores, no auto-save

## Recap

This milestone redesigned how the CLI interacts with the browser when the dev-server bridge is active. Previously, every CLI mutation triggered an auto-save to disk, removing user agency — the system decided when to persist, not the user. Additionally, read commands (`list`, `describe`, `search`, `catalog`) bypassed the bridge entirely, reading stale data from disk even when the browser held newer in-memory state.

The core design principle: **when bridge is detected, the CLI is a thin transport layer.** All logic — validation, enrichment, reads, writes — happens in the browser's in-memory stores. No auto-save. The user saves via Cmd+S when ready. When no bridge is detected, the CLI continues to operate standalone as before.

The work decomposed into 4 tasks across 14 source files and 8 test files (22 total). Task 1 (infrastructure) established the foundation: early bridge detection in `loadContext()`, nullable `CLIContext.fs`, the `bridgeMutate→bridgeRequest` rename, read routes in the Vite plugin, and the system prompt update. Tasks 2-4 built on that: the browser-side dispatcher expansion (read actions + addNode enrichment + import handler), CLI write command routing, and CLI read command + import wire format changes. A code review pass then fixed 4 issues: stale vitePlugin header, missing `childRefs` in describe, stale import wire format test, and missing `addEntity` mock. A final round added 22 dispatcher tests and fixed 2 "pre-existing" bridge.test.ts failures that were actually caused by test environment pollution (stale `/tmp/.archcanvas/permissions.json`), resolved by using isolated `mkdtemp` dirs per test. The bridge test file was then refactored with a `setupSession` helper, reducing it by 167 lines.

**Spec**: `docs/specs/2026-03-14-ephemeral-bridge-operations-design.md`
**Plans**: `docs/plans/2026-03-14-ephemeral-bridge-index.md` (4-task index)
**Tests**: 976 total (up from 895), all passing. 22 files changed, +1405/-657 lines.

## Decisions

| Decision | Chose | Over | Why |
|----------|-------|------|-----|
| Read dispatcher return shape | Raw payload (`{ nodes, edges }`) | Wrapped (`{ ok: true, data: { nodes } }`) | `handleStoreAction` already wraps in `{ ok: true, data: result }` — double-wrapping caused `r.data.data.nodes` access pattern. Raw returns keep the wire format clean. Errors still use `{ ok: false, error }` which the error check intercepts. |
| CLI read command pattern | Self-contained async (internal `loadContext`) | External `loadContext` in `index.ts` | Unifies all commands — writes already did this. `index.ts` becomes pure wiring with no business logic. Trade-off: tests need a `loadContext` mock. |
| Bridge test isolation | `mkdtemp` per test | Shared `/tmp` with cleanup | Previous `/tmp` approach caused cross-test pollution via persisted permissions. Per-test temp dirs guarantee isolation regardless of test ordering or parallel execution. |
| Bridge test dedup | `setupSession` helper factory | Leave each test fully inline | 28 of 41 tests shared identical boilerplate (mock queryFn, session creation, canUseTool capture). Helper reduced file by 167 lines (~12%). 8 tests with unique patterns (abort gate, error-throwing queryFn, multi-message) left as-is. |

## Retrospective

- **What went well** — Task decomposition worked cleanly. The 4-task split with dependency graph (Task 1 blocks 2/3/4, then parallel) matched the actual implementation order. The code review catch of double-wrapping in dispatcher returns saved a subtle bug that would have surfaced when the AI chat actually used read commands through the bridge.

- **What didn't** — The `bridgeMutate→bridgeRequest` rename broke the CLI build immediately, cascading to test failures before downstream tasks could fix call sites. In hindsight, a backward-compat re-export during the transition would have kept tests green between tasks. The bridge.test.ts "pre-existing" failures wasted investigation time — they looked like SDK issues but were actually test pollution from a stale permissions file.

- **Lessons** — (1) When renaming exports across task boundaries, either do all call sites in one task or add a temporary alias. (2) Tests using shared filesystem paths (`/tmp`) are a pollution vector — always use isolated temp dirs for tests that touch the permission store. (3) Code review against the spec caught 4 real issues — the review loop pays for itself.

- **Notes for future** — The `addNode` enrichment logic now exists in two places: `src/cli/commands/add-node.ts` (non-bridge path) and `src/core/ai/webSocketProvider.ts` (bridge path). If validation rules change, both must be updated. A future refactor could extract shared validation into `src/core/validation/` to DRY this up.
