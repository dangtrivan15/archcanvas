# Task 1: Engine Upgrade — produce → produceWithPatches

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:writing-plans to plan
> the implementation steps for this task.

**Scope:** Engine patch upgrade
**Parent feature:** [I2 Canvas Rendering](./2026-03-12-i2-canvas-rendering-index.md)

## Write Set

- Modify: `src/core/graph/types.ts` (~15 lines) — add `Patch` import, extend `EngineResult`, add `CANVAS_NOT_FOUND` to `EngineError`
- Modify: `src/core/graph/engine.ts` (~50 lines) — switch all 9 mutation functions from `produce()` to `produceWithPatches()`
- Modify: `src/core/graph/index.ts` (~2 lines) — re-export `Patch` type
- Test: Extend `test/core/graph/engine.test.ts` — add `patches`/`inversePatches` assertions to all mutation tests

## Read Set (context needed)

- `src/core/graph/types.ts` — current EngineResult, EngineError, EngineWarning types
- `src/core/graph/engine.ts` — 9 mutation functions using `produce()`
- `src/core/graph/index.ts` — current barrel exports
- `test/core/graph/engine.test.ts` — existing 569-line test suite (43 tests), understand structure
- `test/core/graph/helpers.ts` — `makeCanvas`, `makeNode`, `makeEdge`, `makeEntity`, `registryWith`
- `docs/specs/2026-03-12-i2-canvas-rendering-design.md` — Layer 8: Undo/Redo section

## Dependencies

- **Blocked by:** None (first task)
- **Blocks:** Task 4 (graphStore needs extended EngineResult)

## Description

This task upgrades the I4 graph engine to emit Immer patches alongside mutated data. Every engine mutation function (9 total: `addNode`, `removeNode`, `updateNode`, `updateNodePosition`, `addEdge`, `removeEdge`, `updateEdge`, `addEntity`, `removeEntity`, `updateEntity`) currently uses `produce()` and returns `{ ok: true, data, warnings }`. Each must switch to `produceWithPatches()` which returns `[data, patches, inversePatches]`, and include both patch arrays in the result.

### Changes to types.ts

1. Add `import type { Patch } from 'immer'` — this is `types.ts`'s first external library dependency, but it's type-only so no runtime coupling.
2. Add `| { code: 'CANVAS_NOT_FOUND'; canvasId: string }` to the `EngineError` union — this is needed by graphStore (Task 4) when `fileStore.getCanvas()` returns `undefined`.
3. Extend the success branch of `EngineResult` with `patches: Patch[]` and `inversePatches: Patch[]`.

### Changes to engine.ts

1. Change `import { produce } from 'immer'` to `import { produceWithPatches } from 'immer'`.
2. In each of the 9 mutation functions, change:
   ```typescript
   const data = produce(canvas, draft => { ... });
   return { ok: true, data, warnings };
   ```
   to:
   ```typescript
   const [data, patches, inversePatches] = produceWithPatches(canvas, draft => { ... });
   return { ok: true, data, patches, inversePatches, warnings };
   ```
3. **Important**: `enablePatches()` must be called before `produceWithPatches` works. For tests, add `enablePatches()` call in the test file's top-level setup (before any `describe`). For the app, this will be handled in Task 5 (App.tsx init).

### Test changes

For each existing mutation test that checks `result.ok === true`, add assertions:
- `expect(result.patches).toBeInstanceOf(Array)`
- `expect(result.inversePatches).toBeInstanceOf(Array)`
- `expect(result.patches.length).toBeGreaterThan(0)` (mutations always produce at least one patch)

Add one focused test per operation type (node/edge/entity) verifying that applying `inversePatches` to `result.data` via `applyPatches()` produces the original canvas — this validates the round-trip correctness that undo will rely on.

### Acceptance Criteria

- All 9 engine functions return `patches` and `inversePatches` on success
- All existing 43 tests still pass (non-breaking change)
- New patch presence assertions added to all mutation tests
- Round-trip tests (apply inverse → get original) pass for addNode, addEdge, addEntity
- `CANVAS_NOT_FOUND` error code added to `EngineError`
- `tsc --noEmit` passes
