# Task 3: CLI Write Commands Bridge Routing

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:writing-plans to plan
> the implementation steps for this task.

**Scope:** CLI write command bridge routing (add-node, add-edge, remove-node, remove-edge)
**Parent feature:** [./2026-03-14-ephemeral-bridge-index.md](./2026-03-14-ephemeral-bridge-index.md)

## Write Set

- Modify: `src/cli/commands/add-node.ts` (~20 lines)
- Modify: `src/cli/commands/add-edge.ts` (~5 lines)
- Modify: `src/cli/commands/remove-node.ts` (~5 lines)
- Modify: `src/cli/commands/remove-edge.ts` (~5 lines)

## Read Set (context needed)

- `docs/specs/2026-03-14-ephemeral-bridge-operations-design.md` — design spec (sections 4, 5)
- `src/cli/context.ts` — `bridgeRequest` (renamed from `bridgeMutate`), `loadContext` (returns nullable `fs`)
- `src/store/fileStore.ts` — `saveAll()` signature (takes `FileSystem`)

## Dependencies

- **Blocked by:** Task 1 (bridgeRequest export, loadContext nullable fs)
- **Blocks:** None

## Description

This task updates the four write CLI commands to use the renamed `bridgeRequest` and, for `add-node`, to move the bridge guard before validation so the browser handles all enrichment.

### 1. `add-node.ts` — Move bridge guard before validation (spec §5)

Currently: loadContext → registry validation → fuzzy matching → displayName resolution → args parsing → construct InlineNode → bridge or local.

New bridge path: loadContext → if `ctx.bridgeUrl` → send raw args `{ canvasId, id, type, name?, args? }` via `bridgeRequest` → print → return. The non-bridge path remains unchanged (it still does local validation + mutation + save).

Also:
- Rename `bridgeMutate` → `bridgeRequest` in import
- Add `!` assertion on `ctx.fs` in the `saveAll(ctx.fs!)` call (fs is guaranteed non-null in else branch, but TS needs help since the type is now `FileSystem | null`)

### 2. `add-edge.ts`, `remove-node.ts`, `remove-edge.ts` — Rename only

These commands already have correct bridge guard placement. Changes:
- Rename `bridgeMutate` → `bridgeRequest` in import and call site
- Add `!` assertion on `ctx.fs` in the `saveAll(ctx.fs!)` call

### Acceptance Criteria

- `add-node` sends raw args `{ canvasId, id, type, name?, args? }` through bridge (no local validation in bridge path)
- All four commands import and call `bridgeRequest` (not `bridgeMutate`)
- `saveAll(ctx.fs!)` has non-null assertion in all four commands
- Non-bridge path unchanged (still does local validation + mutation + save)
- TypeScript compiles without errors
