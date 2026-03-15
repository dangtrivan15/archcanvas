# Task 5: CanvasFile → Canvas Rename

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:writing-plans to plan
> the implementation steps for this task.

**Scope:** Rename `CanvasFile` type to `Canvas` across the entire codebase
**Parent feature:** [Phase 13 Index](./2026-03-15-refactor-cleanup-index.md)

## Write Set

**Hard cap exception:** This task modifies ~33 files but is purely mechanical find-replace with zero logic changes. Each file change is a simple identifier rename.

**Source files (10):**
- Modify: `src/types/schema.ts` — rename schema + type export (4 occurrences)
- Modify: `src/store/fileStore.ts` — import + usage (3 occurrences)
- Modify: `src/store/graphStore.ts` — import + usage (2 occurrences)
- Modify: `src/storage/yamlCodec.ts` — import + usage (8 occurrences)
- Modify: `src/storage/fileResolver.ts` — import + usage (6 occurrences)
- Modify: `src/core/graph/engine.ts` — import + usage (11 occurrences)
- Modify: `src/core/graph/query.ts` — import + usage (6 occurrences)
- Modify: `src/core/graph/types.ts` — import + usage (2 occurrences)
- Modify: `src/core/graph/validation.ts` — import + usage (3 occurrences)
- Modify: `src/core/layout/elk.ts` — import + usage (3 occurrences)

**Files that do NOT need changes:**
- `src/types/index.ts` — uses `export * from './schema'` (wildcard re-export, no named reference to `CanvasFile`)
- `src/storage/index.ts` — exports function names `parseCanvasFile`/`serializeCanvasFile`, NOT the type. See "What NOT to rename" below.

**Test files (22):**
- Modify: `test/unit/types/schema.test.ts` (14 occurrences)
- Modify: `test/unit/storage/yamlCodec.test.ts` (17 occurrences)
- Modify: `test/unit/storage/fileResolver.test.ts` (2)
- Modify: `test/unit/store/fileStore.test.ts` (2)
- Modify: `test/unit/store/graphStore.test.ts` (2)
- Modify: `test/unit/store/canvasStore.test.ts` (2)
- Modify: `test/unit/store/navigationStore.test.ts` (2)
- Modify: `test/unit/store/historyStore.test.ts` (2)
- Modify: `test/unit/core/layout/elk.test.ts` (2)
- Modify: `test/core/graph/query.test.ts` (2)
- Modify: `test/core/graph/helpers.ts` (2)
- Modify: `test/unit/components/canvas/useCanvasRenderer.test.ts` (2)
- Modify: `test/unit/cli/commands/add-node.test.ts` (3)
- Modify: `test/unit/cli/commands/add-edge.test.ts` (3)
- Modify: `test/unit/cli/commands/remove-node.test.ts` (3)
- Modify: `test/unit/cli/commands/remove-edge.test.ts` (3)
- Modify: `test/unit/cli/commands/list.test.ts` (4)
- Modify: `test/unit/cli/commands/describe.test.ts` (6)
- Modify: `test/unit/cli/commands/search.test.ts` (7)
- Modify: `test/unit/cli/commands/import.test.ts` (4)
- Modify: `test/unit/cli/context.test.ts` (3)
- Modify: `test/store/fileStore-newProject.test.ts` (2)

## Read Set (context needed)

- `src/types/schema.ts` — current `CanvasFile` definition (line 99)
- Any file from the write set — to verify exact occurrences before replacing

## Dependencies

- **Blocked by:** Tasks 1, 2, 3 (they modify files that also contain `CanvasFile`)
- **Blocks:** Task 6 (bridge test split should happen after rename to avoid conflicts)

## Description

The type `CanvasFile` has been flagged for rename since I4 (progress doc 04). The name implies a file when it actually represents canvas data. The correct name is `Canvas`.

### Rename scope

The rename covers:
- The Zod schema: `export const CanvasFile = z.object({...})` → `export const Canvas = z.object({...})`
- The TypeScript type: `export type CanvasFile = z.infer<typeof CanvasFile>` → `export type Canvas = z.infer<typeof Canvas>`
- The refinements: `RootCanvasFile` → `RootCanvas`, `SubsystemCanvasFile` → `SubsystemCanvas`
- All imports and usages across source + test files

### What NOT to rename

- `CanvasFile` occurrences in `bak/` (archived v1 codebase — reference only, not active code)
- `CanvasFile` occurrences in `docs/` (specs and plans refer to the old name — updating docs is optional and low priority)
- The file names themselves (e.g., `schema.ts` stays `schema.ts` — the type name changes, not the module)
- **Function names `parseCanvasFile` / `serializeCanvasFile`** — these describe the operation (parsing a canvas file from YAML), not the type. Renaming them would add 60 more occurrences across 21 files with zero functional benefit. The functions parse/serialize canvas files — that's literally what they do.

### Implementation approach

This is a mechanical find-replace operation. The recommended approach:

1. Start with `src/types/schema.ts` — rename the schema and type definitions
2. Run `npx tsc --noEmit` — TypeScript will report every file that imports the old name
3. Fix each import/usage — the rename is 1:1 (no logic changes)
4. Run `npx vitest run` to verify all tests pass
5. Run `npx tsc --noEmit` again to verify zero type errors

### Risks

- The refinement types `RootCanvasFile` and `SubsystemCanvasFile` should also be renamed to `RootCanvas` and `SubsystemCanvas` for consistency
- The `bak/` directory has 77 occurrences — do NOT touch these
- Some docs reference `CanvasFile` — optionally update, but not required

### Acceptance criteria

- [ ] `CanvasFile` renamed to `Canvas` in `src/types/schema.ts`
- [ ] `RootCanvasFile` → `RootCanvas` in `src/types/schema.ts`
- [ ] `SubsystemCanvasFile` → `SubsystemCanvas` in `src/types/schema.ts`
- [ ] All source files updated (0 occurrences of `CanvasFile` in `src/`)
- [ ] All test files updated (0 occurrences of `CanvasFile` in `test/`)
- [ ] `npx tsc --noEmit` passes with zero errors
- [ ] `npx vitest run` passes (all 976+ tests green)
- [ ] `bak/` directory untouched
