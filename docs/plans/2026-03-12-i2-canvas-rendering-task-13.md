# Task 13: historyStore + Undo/Redo

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:writing-plans to plan
> the implementation steps for this task.

**Scope:** Patch-based undo/redo system
**Parent feature:** [I2 Canvas Rendering](./2026-03-12-i2-canvas-rendering-index.md)

## Write Set

- Create: `src/store/historyStore.ts` (~90 lines) — undo/redo stacks with Immer patches
- Create: `src/components/canvas/hooks/useCanvasKeyboard.ts` (~50 lines) — Cmd+Z, Cmd+Shift+Z
- Modify: `src/store/graphStore.ts` (~15 lines) — wire pushPatches calls after successful mutations
- Test: Create `test/unit/store/historyStore.test.ts`

## Read Set (context needed)

- `src/store/graphStore.ts` — current implementation (Task 4), needs patch push wiring
- `src/store/fileStore.ts` — `getCanvas`, `updateCanvasData` (Task 2) — used by undo/redo
- `src/core/graph/types.ts` — `EngineResult` with `patches`/`inversePatches` (Task 1)
- `src/components/canvas/Canvas.tsx` — wire keyboard hook
- `docs/specs/2026-03-12-i2-canvas-rendering-design.md` — historyStore, Layer 8 Undo/Redo

## Dependencies

- **Blocked by:** Task 2 (fileStore.updateCanvasData for undo write-back), Task 4 (graphStore to wire patches)
- **Blocks:** Task 15 (useCanvasKeyboard extended with more shortcuts)

## Description

### historyStore

```typescript
interface HistoryEntry {
  canvasId: string;
  patches: Patch[];
  inversePatches: Patch[];
}

interface HistoryStoreState {
  undoStack: HistoryEntry[];
  redoStack: HistoryEntry[];
  canUndo: boolean;
  canRedo: boolean;

  pushPatches(canvasId: string, patches: Patch[], inversePatches: Patch[]): void;
  undo(): void;
  redo(): void;
  clear(): void;
}
```

### Undo flow (critical — spec review finding #1)

```typescript
undo(): void {
  const entry = undoStack.pop();
  const canvas = useFileStore.getState().getCanvas(entry.canvasId);
  // CRITICAL: applyPatches returns a NEW object, does NOT mutate in place
  const patched = applyPatches(canvas.data, entry.inversePatches);
  useFileStore.getState().updateCanvasData(entry.canvasId, patched);
  redoStack.push(entry);
}
```

**The `applyPatches` return value MUST be captured.** If you write `applyPatches(canvas.data, inversePatches)` without capturing the return value, undo silently does nothing — the original data is unchanged and `updateCanvasData` receives the unmodified object. This was caught during spec review as a critical bug pattern.

### Redo flow

Same pattern but applies `entry.patches` (forward direction) and moves entry back to undoStack.

### Stack behavior

- Max depth: 50 entries. When exceeded, drop oldest (shift from front).
- Clear on canvas switch — call `clear()` when `navigationStore.currentCanvasId` changes.
- `canUndo` / `canRedo` are derived from stack lengths (computed in setter).

### graphStore wiring

After each successful mutation in graphStore (where `result.ok === true`), add:
```typescript
useHistoryStore.getState().pushPatches(canvasId, result.patches, result.inversePatches);
```

This is ~1 line per mutation method, ~10 lines total.

### useCanvasKeyboard (initial version)

Handles two shortcuts for now:
- `Cmd+Z` → `historyStore.undo()`
- `Cmd+Shift+Z` → `historyStore.redo()`

Uses `useEffect` with `keydown` event listener. Checks `metaKey`/`ctrlKey` for cross-platform. Wire into Canvas.tsx.

Task 15 will extend this hook with remaining shortcuts (Delete, Cmd+K, Cmd+Shift+L, Cmd+A, Escape).

### Critical test: applyPatches return value capture (spec review finding #1)

```typescript
it('undo actually mutates fileStore data, not silently no-ops', async () => {
  // Setup: seed fileStore with a canvas
  await useFileStore.getState().openProject(fs);
  const canvasId = ROOT_CANVAS_KEY;

  // Act: add a node via graphStore (which pushes patches to historyStore)
  const node = { id: 'new-node', type: 'compute/service' };
  const result = useGraphStore.getState().addNode(canvasId, node);
  expect(result.ok).toBe(true);

  // Verify node exists
  const canvasAfterAdd = useFileStore.getState().getCanvas(canvasId)!;
  expect(canvasAfterAdd.data.nodes).toContainEqual(expect.objectContaining({ id: 'new-node' }));

  // Undo
  useHistoryStore.getState().undo();

  // CRITICAL ASSERTION: node must be gone from fileStore
  const canvasAfterUndo = useFileStore.getState().getCanvas(canvasId)!;
  expect(canvasAfterUndo.data.nodes ?? []).not.toContainEqual(
    expect.objectContaining({ id: 'new-node' })
  );
});
```

### Additional tests

- `pushPatches` adds entry to undoStack
- `undo` pops from undoStack and pushes to redoStack
- `undo` when empty is a no-op
- `redo` pops from redoStack and pushes to undoStack
- `redo` when empty is a no-op
- New push clears redoStack (standard undo behavior)
- Max depth: 51st entry drops the oldest
- `clear` empties both stacks
- `canUndo` / `canRedo` reflect stack state
- Redo after undo restores the added node
- Multiple undo/redo cycles work correctly

### Acceptance Criteria

- Undo reverses mutations in fileStore (not just in-memory)
- Redo re-applies mutations in fileStore
- graphStore pushes patches on every successful mutation
- Keyboard shortcuts Cmd+Z and Cmd+Shift+Z work
- Stack depth limited to 50
- Critical regression test for applyPatches capture passes
- `tsc --noEmit` passes
