# Task 2: fileStore Write-Back + Doc Clearing

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:writing-plans to plan
> the implementation steps for this task.

**Scope:** fileStore write-back mechanism
**Parent feature:** [I2 Canvas Rendering](./2026-03-12-i2-canvas-rendering-index.md)

## Write Set

- Modify: `src/storage/fileResolver.ts` (~2 lines) — widen `LoadedCanvas.doc` from `Document` to `Document | undefined`
- Modify: `src/store/fileStore.ts` (~25 lines) — add `updateCanvasData(canvasId, data)` method
- Test: Extend `test/unit/store/fileStore.test.ts` — new `describe('updateCanvasData')` block

## Read Set (context needed)

- `src/storage/fileResolver.ts` — `LoadedCanvas` interface (filePath, data, doc), `saveCanvas` function
- `src/store/fileStore.ts` — current interface, `getCanvas`, `markDirty`, Zustand store shape
- `src/storage/yamlCodec.ts` — `serializeCanvasFile(data, doc?)` — when `doc` is undefined, falls back to plain `stringify()`
- `test/unit/store/fileStore.test.ts` — existing 130-line test suite, test patterns
- `docs/specs/2026-03-12-i2-canvas-rendering-design.md` — "fileStore write-back: updateCanvasData" section

## Dependencies

- **Blocked by:** None (first task)
- **Blocks:** Task 4 (graphStore writes back via updateCanvasData), Task 13 (historyStore undo writes back via updateCanvasData)

## Description

The current `fileStore` (from I10) provides `getCanvas()` for reading but has no method to write mutated data back. This task adds the minimal write-back path needed by graphStore and historyStore.

### fileResolver.ts change

Widen `LoadedCanvas.doc` from `Document` to `Document | undefined`. This is a one-line type change but it's necessary because `updateCanvasData` will set `doc = undefined` to invalidate the stale YAML AST after engine mutations.

The `saveCanvas` function already handles `doc` being falsy — it passes `canvas.doc` to `serializeCanvasFile(data, doc?)` which falls back to plain `stringify()` when `doc` is `undefined`. No change needed in `saveCanvas`.

### fileStore.ts change

Add `updateCanvasData` to the `FileStoreState` interface and implementation:

```typescript
updateCanvasData(canvasId: string, data: CanvasFile): void;
```

Implementation:
1. Look up the canvas in `project.canvases.get(canvasId)` (or `project.root` if `canvasId === ROOT_CANVAS_KEY`)
2. If not found, return silently (defensive — caller should have validated)
3. Replace `canvas.data` with the new `CanvasFile`
4. Set `canvas.doc = undefined` — the YAML Document AST is now stale relative to the engine-mutated data
5. Call `markDirty(canvasId)`
6. Trigger Zustand re-render via `set()` — this is critical so `useCanvasRenderer` reacts to the updated data

**Important**: Step 6 must create a new `project` reference (or at minimum a new `canvases` Map reference) for Zustand's shallow equality check to trigger re-renders. A simple approach: clone the canvases Map and set `project` to a new object.

### Critical test: doc AST clearing (spec review finding #2)

This test validates that after `updateCanvasData`, the YAML `doc` AST is cleared, preventing stale AST from corrupting saves:

```typescript
it('clears doc after updateCanvasData so saves use plain stringify', async () => {
  await useFileStore.getState().openProject(fs);
  const canvas = useFileStore.getState().getCanvas('svc-api')!;

  // Verify doc exists after initial load
  expect(canvas.doc).toBeDefined();

  // Mutate data via updateCanvasData
  const mutatedData = { ...canvas.data, displayName: 'Modified Service' };
  useFileStore.getState().updateCanvasData('svc-api', mutatedData);

  // Verify doc is cleared
  const updated = useFileStore.getState().getCanvas('svc-api')!;
  expect(updated.doc).toBeUndefined();
  expect(updated.data.displayName).toBe('Modified Service');

  // Verify save still works (uses plain stringify, not stale doc)
  await useFileStore.getState().saveCanvas(fs, 'svc-api');
  const written = await fs.readFile('.archcanvas/svc-api.yaml');
  expect(written).toContain('Modified Service');
});
```

### Additional tests

- `updateCanvasData` replaces data and marks dirty
- `updateCanvasData` triggers Zustand re-render (new project reference)
- `updateCanvasData` with root canvas (ROOT_CANVAS_KEY)
- `updateCanvasData` with unknown canvasId is a no-op

### Acceptance Criteria

- `updateCanvasData` method added to fileStore
- `LoadedCanvas.doc` widened to `Document | undefined`
- After `updateCanvasData`, `canvas.doc` is `undefined`
- After `updateCanvasData`, `canvas.data` reflects the new data
- After `updateCanvasData`, canvas is marked dirty
- `saveCanvas` after `updateCanvasData` writes the correct (mutated) data, not the original
- All existing fileStore tests still pass
- `tsc --noEmit` passes
