# Task 1: Infrastructure — Context, Vite Plugin, System Prompt

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:writing-plans to plan
> the implementation steps for this task.

**Scope:** CLI context infrastructure, Vite plugin relay routes, system prompt
**Parent feature:** [./2026-03-14-ephemeral-bridge-index.md](./2026-03-14-ephemeral-bridge-index.md)

## Write Set

- Modify: `src/cli/context.ts` (~50 lines)
- Modify: `src/core/ai/vitePlugin.ts` (~20 lines)
- Modify: `src/core/ai/systemPrompt.ts` (~10 lines)

## Read Set (context needed)

- `docs/specs/2026-03-14-ephemeral-bridge-operations-design.md` — design spec (sections 2, 6, 7, 10)
- `src/platform/fileSystem.ts` — FileSystem interface (for nullable type)
- `src/store/fileStore.ts` — fileStore API shape
- `src/store/registryStore.ts` — registryStore API shape
- `src/cli/commands/add-node.ts` — reference for how write commands call loadContext/bridgeMutate (to understand downstream impact)

## Dependencies

- **Blocked by:** None (foundation task)
- **Blocks:** Tasks 2, 3, 4

## Description

This task establishes the infrastructure that all other tasks depend on.

### 1. Reorder `loadContext()` (spec §2)

Currently, `loadContext()` always creates a filesystem, opens the project, and initializes the registry before probing the bridge. When bridge is detected, this is wasteful — the browser already has all that state.

Reorder to detect bridge early. When bridge is found, return `{ fs: null, bridgeUrl }` immediately, skipping filesystem creation, project loading, and registry initialization.

**Type change:** `CLIContext.fs` becomes `FileSystem | null`. Write commands already guard with `if (ctx.bridgeUrl)` before touching `ctx.fs`, so TypeScript narrowing handles it in the `else` branch. Each `saveAll(ctx.fs)` call is inside an `else` branch where `bridgeUrl` is null, guaranteeing `fs` is non-null. Add a `!` assertion at each call site (Tasks 3 and 4 handle the call site updates — this task only changes the type).

### 2. Rename `bridgeMutate` → `bridgeRequest` (spec §6)

The function is no longer mutation-only — it handles reads too. Rename the export in `context.ts`. Call site updates happen in Tasks 3 and 4 (those tasks own the command files).

### 3. Add read routes to Vite plugin (spec §3)

Add `list`, `describe`, `search`, `catalog` to `ROUTE_TO_ACTION`. The relay logic is already action-agnostic — no other changes needed for relaying.

### 4. Rename `pendingMutations` → `pendingRequests` (spec §10)

Rename `pendingMutations` → `pendingRequests`, `MUTATION_TIMEOUT_MS` → `REQUEST_TIMEOUT_MS`, `mutationTimeoutMs` → `requestTimeoutMs` in `vitePlugin.ts`. Also update the plugin options interface.

### 5. Update system prompt (spec §7)

Add a section after Guidelines explaining that changes are applied to in-memory canvas state only and are NOT auto-saved. The AI should say "applied" not "saved."

### Acceptance Criteria

- `loadContext()` returns early when bridge detected (fs is null)
- `CLIContext.fs` is `FileSystem | null`
- `bridgeRequest` is the exported function name (old name removed)
- Vite plugin routes `list`, `describe`, `search`, `catalog` to browser
- `pendingRequests` is the map name (old `pendingMutations` removed)
- System prompt includes "not auto-saved" guidance
- Existing tests pass (non-bridge path unchanged)
