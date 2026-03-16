# 15: Packaging & Polish (I7)

> **Date**: 2026-03-16 | **Status**: Complete
> **Scope**: Cross-scope ref redesign, entity system, protocol compatibility, AI bridge extraction, Tauri desktop packaging

## Recap

I7 was the final pre-release initiative — a wide-ranging set of changes that touched every layer of ArchCanvas from the YAML storage model up through the Tauri desktop shell. The work was structured as 10 tasks in 4 parallel execution groups, following the spec at `docs/specs/2026-03-16-i7-packaging-and-polish-design.md` and the implementation plan at `docs/plans/2026-03-16-i7-implementation-plan.md`.

**Cross-scope reference redesign (§1, Tasks 1–4)** replaced the limited `@root/` syntax with `@<ref-node-id>/<node-id>`, enabling edges to reference nodes inside any sibling subsystem. This required changes across the full stack: schema (SubsystemCanvas no longer requires `id`), fileResolver (refs now include `.yaml` suffix, canvases keyed by node.id, cycle detection by file path), engine (addEdge validates ref-node exists, removeNode cascades cross-scope edges), query/validation layers, and a sweep of all `@root/` references. The inherited edges UI renders parent-scope cross-scope edges as dashed ghost connections when diving into a child canvas.

**Entity system (§2, Tasks 6–8)** built the full entity pipeline: a pure resolver layer (`findEntityUsages`, `listAllEntities`, `getEntitiesForCanvas`), the EntityPanel UI with search/filter and expandable cross-scope usages, command palette `#` prefix for entity search, edge highlighting when clicking entity rows, and the `detailPanelTab` API for external tab switching.

**Protocol compatibility (§3, Task 5)** added `arePortsCompatible()` with port protocol intersection checking, integrated into `addEdge()` as a `PROTOCOL_MISMATCH` hard error.

**Bridge extraction and Tauri packaging (§4, Tasks 9–10)** extracted the AI bridge from `vitePlugin.ts` into a standalone `bridgeServer.ts` (reducing vitePlugin from 415 to 113 lines), added `configurePreviewServer` for `vite preview` support, created the standalone CLI entry point, and wired up Tauri sidecar management with Rust port discovery and frontend `resolveBridgeUrl()`.

**14 commits, 61 files changed, ~4200 lines added.** Test count grew from 1087 to 1111. Three code review cycles caught 8 issues (4 critical) — all fixed before proceeding.

## Decisions

### Data Model

| Decision | Chose | Over | Why |
|----------|-------|------|-----|
| Canvas map key | `node.id` (ref-node identity) | `node.ref` (filename) | Separates identity from file path; prevents ambiguity when ref includes `.yaml` suffix |
| Cycle detection key | Resolved file path (`.archcanvas/foo.yaml`) | `node.id` | Two different ref-nodes can point to same file; file path is the true dedup identity |
| Subsystem identity | Derives from parent ref-node `id` | Self-declared `id` field in subsystem file | Eliminates redundant identity; parent owns the mapping |

### Architecture

| Decision | Chose | Over | Why |
|----------|-------|------|-----|
| Bridge extraction pattern | `handleRequest` returns boolean + `handleConnection` exposed | Separate HTTP/WS server classes | Single `createBridgeServer()` works both standalone and embedded in Vite middleware |
| canvasStore↔navigationStore cycle | Refactored `deleteSelection`/`completeDraftEdge` to accept `canvasId` param | Lazy `import()` workaround | Eliminates the circular dependency entirely rather than working around it; 5 call sites, mechanical change |
| Ghost nodes in ReactFlow | `__ghost__` prefix ID, `connectable: false`, render-only | Store-level ghost nodes | Ghost nodes are ephemeral render artifacts — they should never enter the data model or be saved |
| Tauri sidecar strategy | Script fallback (copy `bridge-server.js`) | `bun build --compile` binary | Fallback is safer — binary compile needs verification with Claude SDK native deps; script works immediately |

## Retrospective

- **What went well** — The 4-group parallel execution structure was highly effective. Groups 1–3 each had 3 independent tasks that could run as parallel worktree agents, with review after each group. Code reviews caught real bugs (entity resolver double-iteration, cycle detection key mismatch, missing highlight lifecycle) before they could propagate.

- **What didn't** — Worktree agents branching from pre-change state made cherry-picks painful. Every Group 2+ agent produced diffs that included "deletions" of earlier groups' work. Manual file extraction was needed instead of clean cherry-picks. The `canvasStore` → `navigationStore` circular dependency was only discovered at integration time (Group 3 review), requiring a refactor that touched 10 files.

- **Lessons** — (1) When changing a map key convention (`ref` → `node.id`), grep for ALL lookup sites in the same commit — the plan listed 2 files but the actual cascade was 14. (2) Test helpers must mirror production data shapes exactly — the entity resolver's `makeProject` helper silently diverged from `loadProject`'s behavior, hiding a double-iteration bug. (3) Code reviews after each group (not just at the end) caught issues early when the blast radius was small.

- **Notes for future** — The pre-existing flaky `fileStore-onboarding` test (timing-sensitive `setTimeout` + mock interaction) appeared in nearly every test run. Worth stabilizing. The `@tauri-apps/plugin-fs` npm package is still not installed (custom `.d.ts` workaround remains); Task 10 deferred this. `bun build --compile` for the bridge binary should be validated when the SDK stabilizes.
