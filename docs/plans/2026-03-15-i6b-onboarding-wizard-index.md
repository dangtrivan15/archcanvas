# Feature: I6b Onboarding Wizard — Task Index

> **For Claude:** Invoke superpowers:writing-plans on each task file listed below.

**Goal:** Add a guided onboarding wizard for new/empty projects with optional AI-powered architecture initialization
**Total tasks:** 4
**Estimated scope:** 15 files, ~565 source lines across all tasks
**Spec:** `docs/specs/2026-03-15-i6b-onboarding-wizard-design.md`

## Dependency Graph

```
Task 1: FileSystem getName()              → blocks: [2]
Task 2: Store: needs_onboarding + complete → blockedBy: [1], blocks: [3, 4]
Task 3: Core + UI: initPrompt + wizard    → blockedBy: [2], blocks: [4]
Task 4: Integration: routing + E2E        → blockedBy: [2, 3]
```

## Execution Strategy

- **Sequential:** Task 1 → Task 2 → Task 3 → Task 4
- Each layer depends on the one below (platform → store → core+UI → integration)

## Tasks

| # | File | Scope | Write Files | Source LOC | Config LOC |
|---|------|-------|-------------|------------|------------|
| 1 | [task-1.md](./2026-03-15-i6b-task-1.md) | Platform: `getName()` on FileSystem interface | 6 | ~35 | ~5 |
| 2 | [task-2.md](./2026-03-15-i6b-task-2.md) | Store: `needs_onboarding` status + `completeOnboarding` action | 3 | ~150 | 0 |
| 3 | [task-3.md](./2026-03-15-i6b-task-3.md) | Core + UI: `initPrompt.ts` + 3 wizard components | 5 | ~320 | 0 |
| 4 | [task-4.md](./2026-03-15-i6b-task-4.md) | Integration: App.tsx routing + E2E tests | 3 | ~60 | 0 |

## Spec Compliance Notes

Each task plan includes a spec review checklist to verify:
- Implementation matches the parent spec (`docs/specs/2026-03-15-i6b-onboarding-wizard-design.md`)
- No conflicts with other tasks' write sets
- Edge cases from spec §7 are covered at the appropriate layer
