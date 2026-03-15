# Task 3: saveAll Partial-Failure Handling

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:writing-plans to plan
> the implementation steps for this task.

**Scope:** Add error handling to fileStore.saveAll so one failed canvas doesn't skip remaining saves
**Parent feature:** [Phase 13 Index](./2026-03-15-refactor-cleanup-index.md)

## Write Set

- Modify: `src/store/fileStore.ts:186-191` (~+20 lines — wrap in try-catch, collect errors)
- Modify: `src/platform/inMemoryFileSystem.ts` (~+10 lines — add `failOnWrite` injection for testing)
- Modify: `test/unit/store/fileStore.test.ts` (~+60 lines — partial-failure tests)

## Read Set (context needed)

- `src/store/fileStore.ts` — current `saveAll` implementation (lines 186–191)
- `src/store/fileStore.ts:175-184` — `saveCanvas` implementation (what can throw)
- `src/storage/fileResolver.ts` — `saveCanvas` function (the actual file writer)
- `src/platform/inMemoryFileSystem.ts` — test helper (for injecting failures)
- `test/unit/store/fileStore.test.ts` — existing `saveAll` tests (lines 142–152)

## Dependencies

- **Blocked by:** Nothing (independent)
- **Blocks:** Task 5 (rename will touch fileStore.ts)

## Description

`saveAll` is the most frequently cited gap in the project (mentioned in 5 progress docs). The current implementation:

```typescript
saveAll: async (fs) => {
  const { dirtyCanvases } = get();
  for (const canvasId of dirtyCanvases) {
    await get().saveCanvas(fs, canvasId);
  }
},
```

If `saveCanvas` throws for the first canvas, the loop exits and remaining dirty canvases are never saved. Additionally, the successfully-saved canvas has its dirty flag cleared, but the caller has no visibility into the partial failure.

### Implementation approach

Change `saveAll` to continue on failure, collect errors, and report them:

```typescript
saveAll: async (fs) => {
  const { dirtyCanvases } = get();
  const errors: Array<{ canvasId: string; error: string }> = [];

  for (const canvasId of dirtyCanvases) {
    try {
      await get().saveCanvas(fs, canvasId);
    } catch (err) {
      errors.push({
        canvasId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  if (errors.length > 0) {
    // Set store error with summary (UI can display this)
    const summary = errors.map((e) => `${e.canvasId}: ${e.error}`).join('; ');
    set({ error: `Failed to save: ${summary}` });
  }
},
```

Key behaviors:
- Successfully saved canvases still have their dirty flags cleared (done inside `saveCanvas`)
- Failed canvases remain dirty (their `saveCanvas` threw before clearing the flag)
- The store's `error` field is set with a summary of failures
- The `error` is NOT set when all saves succeed (no false positives)
- CLI callers (via `fileStore.saveAll`) can check `fileStore.getState().error` after the call

### Testing strategy

The InMemoryFileSystem does NOT currently support injecting write failures. Add a `failOnWrite(path: string)` method that causes `writeFile` to throw for matching paths. This is added to the write set above (`src/platform/inMemoryFileSystem.ts`).

**Tests:**
1. All saves succeed → dirty set empty, no error
2. First canvas fails → second still saved, first remains dirty, error set
3. Second canvas fails → first still saved, second remains dirty, error set
4. All canvases fail → all remain dirty, error set with both IDs
5. Error message includes failing canvas IDs

### Acceptance criteria

- [ ] `saveAll` catches per-canvas errors and continues to next canvas
- [ ] Successfully saved canvases have dirty flag cleared
- [ ] Failed canvases remain in dirty set
- [ ] `error` field set with summary on partial failure
- [ ] `error` field NOT set when all saves succeed
- [ ] 5 new tests cover all failure scenarios
- [ ] Existing `saveAll` test (happy path) still passes
