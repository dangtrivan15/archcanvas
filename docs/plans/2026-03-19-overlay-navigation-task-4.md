# Task 4: Clean Deletion of Old Code

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:writing-plans to plan
> the implementation steps for this task.

**Scope:** Delete replaced files and verify zero remaining references
**Parent feature:** [./2026-03-19-overlay-navigation-index.md](2026-03-19-overlay-navigation-index.md)
**Spec:** [docs/specs/2026-03-19-overlay-navigation-design.md](../specs/2026-03-19-overlay-navigation-design.md#deleted-files)

## Write Set

- Delete: `src/lib/animateViewport.ts`
- Delete: `src/lib/computeZoomToRect.ts`
- Delete: `src/lib/computeMatchedViewport.ts`
- Delete: `test/unit/lib/animateViewport.test.ts`
- Delete: `test/unit/lib/computeZoomToRect.test.ts`
- Delete: `test/unit/lib/computeMatchedViewport.test.ts`
- Delete: `prototype-nav-animation.html`

## Read Set (context needed)

- Full codebase grep results for each deleted symbol (to verify zero remaining references)

## Dependencies

- **Blocked by:** Task 3 (must complete first — Task 3 removes the imports from `useNavigationTransition.ts`)
- **Blocks:** none

## Description

Delete the three viewport-zoom utilities and their tests, plus the prototype HTML file. The goal is clean deletion with zero traces — no orphaned imports, no dead re-exports, no "removed" comments anywhere.

### Deletion checklist

For each file, before deleting:

1. **Grep for all exported symbols** from the file across the entire `src/` and `test/` directories
2. **Verify zero matches** in source code (docs references are OK — they describe history)
3. **Delete the source file**
4. **Delete the corresponding test file**

### Symbols to verify are unused

| File | Exported symbols |
|------|-----------------|
| `animateViewport.ts` | `animateViewport`, `easeInOut` |
| `computeZoomToRect.ts` | `computeZoomToRect`, `Rect` (type) |
| `computeMatchedViewport.ts` | `computeMatchedViewport`, `CONTAINER_HEADER_H`, `CONTAINER_PAD_X`, `CONTAINER_PAD_Y` |

**Note:** Task 1 creates a new `easeInOut` in `animateOverlayTransition.ts`. The old `easeInOut` from `animateViewport.ts` is a different export — verify no file still imports from the old path.

### Post-deletion verification

1. Run `npm run typecheck` — zero errors
2. Run `npm run test:unit` — zero failures (deleted test files should not be discovered)
3. Run `npm run test:e2e` — zero regressions
4. Grep for each deleted filename across the codebase — should only appear in `docs/` (progress/specs/plans history)

### Prototype cleanup

Delete `prototype-nav-animation.html` from the project root. It was a design validation artifact, not production code. Verify it's not referenced in any build config or gitignore entry that would need updating.

### Acceptance criteria

- All 7 files deleted
- `npm run typecheck` passes
- `npm run test:unit` passes
- `npm run test:e2e` passes
- Grep for `animateViewport`, `computeZoomToRect`, `computeMatchedViewport`, `CONTAINER_HEADER_H`, `CONTAINER_PAD_X`, `CONTAINER_PAD_Y` returns zero matches in `src/` and `test/`
- No dead imports, no re-exports, no "removed" comments left behind
