# Phase 13: Refactor, Cleanup & Test Hardening — Task Index

> **For Claude:** Invoke superpowers:writing-plans on each task file listed below.

**Goal:** Eliminate accumulated tech debt, DRY up duplicated code, fix remaining bugs, and add missing test coverage before the Onboarding Wizard (I6b).

**Total tasks:** 7
**Estimated scope:** ~50 files, ~500 source lines + unlimited test code across all tasks

## Dependency Graph

```
Task 1: Extract addNode validation      → (independent)
Task 2: chatStore type-safe + warning    → (independent)
Task 3: saveAll partial-failure          → (independent)
Task 4: U4 menu-deselect + radix dep    → blocks: [7]
Task 5: CanvasFile → Canvas rename      → ✅ DONE (also renamed parseCanvasFile/serializeCanvasFile)
Task 6: Split bridge.test.ts + SDK tests → (independent — unblocked by Task 5)
Task 7: E2E test coverage               → blockedBy: [4]
```

## Execution Strategy

- **Parallel group 1:** Tasks 1, 2, 3, 4, 6 (all independent now that Task 5 is done)
- **Sequential:** Task 7 (after Task 4)

## Tasks

| # | File | Scope | Write Files | Source LOC | Config LOC |
|---|------|-------|-------------|------------|------------|
| 1 | [task-1.md](./2026-03-15-refactor-cleanup-task-1.md) | Extract shared addNode validation | 4 | ~120 | 0 |
| 2 | [task-2.md](./2026-03-15-refactor-cleanup-task-2.md) | chatStore type-safe provider + rate-limit warning | 5 | ~100 | 0 |
| 3 | [task-3.md](./2026-03-15-refactor-cleanup-task-3.md) | saveAll partial-failure handling | 3 | ~40 | 0 |
| 4 | [task-4.md](./2026-03-15-refactor-cleanup-task-4.md) | U4 menu-deselect bug + @radix-ui dep | 3 | ~30 | ~5 |
| 5 | [task-5.md](./2026-03-15-refactor-cleanup-task-5.md) | ~~CanvasFile → Canvas rename~~ **DONE** | 32 | ~50 | 0 |
| 6 | [task-6.md](./2026-03-15-refactor-cleanup-task-6.md) | Split bridge.test.ts + SDK regression tests | 6 | ~30 | 0 |
| 7 | [task-7.md](./2026-03-15-refactor-cleanup-task-7.md) | E2E test coverage for UI polish | 2 | tests only | 0 |

## Known Gaps Resolved by This Phase

| Gap | First Mentioned | Task |
|-----|----------------|------|
| addNode validation duplication | Ephemeral Bridge (progress 11) | 1 |
| chatStore `as any` duck-typing (×4) | SDK Tasks 2–5 (progress 10) | 2 |
| Rate-limit / error field overlap | SDK Tasks 2–5 (progress 10) | 2 |
| `saveAll` no partial-failure handling | I10 (progress 02), 5 docs total | 3 |
| U4 menu click deselects node | UI Bugs (progress 06) | 4 |
| `@radix-ui/react-visually-hidden` transitive dep | UI Bugs (progress 06) | 4 |
| `CanvasFile` → `Canvas` rename | I4 (progress 04), 2 docs total | 5 |
| `bridge.test.ts` 1227 lines, needs split | SDK Tasks 2–5 (progress 10) | 6 |
| SDK type fix regression tests | Interrupt & SDK (progress 12) | 6 |
| E2E tests for UI polish fixes | UI Bugs (progress 06), Task 14 | 7 |

## Post-Phase Validation

After all 7 tasks complete, run the full validation suite:

```bash
npx vitest run                    # all unit/integration tests
npx playwright test               # all E2E tests
npx tsc --noEmit                  # type-check (critical after Task 5 rename)
npx eslint src/ test/             # lint
```

All must pass green before marking Phase 13 complete.
