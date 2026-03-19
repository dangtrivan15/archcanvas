# Feature: Animate UI Integration — Task Index

> **For Claude:** Invoke superpowers:writing-plans on each task file listed below.

**Goal:** Integrate Animate UI library to add tasteful, functional animations across all UI surfaces of the ArchCanvas app
**Total tasks:** 8
**Estimated scope:** ~40 files, ~2,500 source lines across all tasks

## Context

- **Library:** [Animate UI](https://animate-ui.com/) — copy-paste animated components built on Motion + Radix + Tailwind v4
- **Animation engine:** `motion` (successor to framer-motion, GPU-accelerated)
- **Integration model:** Same as shadcn/ui — `npx shadcn add` or manual copy into `src/components/ui/`
- **Current stack:** React 19, Tailwind 4 (`@theme` in CSS), shadcn/ui (new-york), Radix UI, 7 existing UI primitives

## Dependency Graph

```
Task 1: Foundation & Dependencies       → blocks: [2]
Task 2: Upgrade Existing UI Primitives  → blockedBy: [1], blocks: [3, 4, 8]
Task 3: Add New UI Primitives           → blockedBy: [2], blocks: [5, 6, 7]
Task 4: Layout & Navigation Polish      → blockedBy: [2]
Task 5: Onboarding & Dialogs            → blockedBy: [3]
Task 6: Detail Panels & Entity Views    → blockedBy: [3]
Task 7: Chat Panel Enhancements         → blockedBy: [3]
Task 8: Shared Components Polish        → blockedBy: [2]
```

## Execution Strategy

- **Sequential:** Task 1 → Task 2 → Task 3 (foundation pipeline, shared write target `src/components/ui/`)
- **Parallel group A:** Tasks 4, 8 (after Task 2, no shared writes)
- **Parallel group B:** Tasks 5, 6, 7 (after Task 3, no shared writes)

```
Phase 1:  [Task 1]
Phase 2:  [Task 2]
Phase 3:  [Task 3]  ║  [Task 4]  ║  [Task 8]
Phase 4:  [Task 5]  ║  [Task 6]  ║  [Task 7]
```

Note: Tasks 4 and 8 can start as soon as Task 2 completes (they don't need Task 3's new primitives). Tasks 5, 6, 7 need the new primitives from Task 3.

## Tasks

| # | File | Scope | Write Files | Source LOC | Config LOC |
|---|------|-------|-------------|------------|------------|
| 1 | [task-1.md](./2026-03-19-animate-ui-task-1.md) | Foundation & deps | 3 | ~20 | ~80 |
| 2 | [task-2.md](./2026-03-19-animate-ui-task-2.md) | Upgrade existing primitives | 5 | ~400 | ~0 |
| 3 | [task-3.md](./2026-03-19-animate-ui-task-3.md) | Add new primitives | 6 | ~400 | ~0 |
| 4 | [task-4.md](./2026-03-19-animate-ui-task-4.md) | Layout & navigation | 5 | ~300 | ~0 |
| 5 | [task-5.md](./2026-03-19-animate-ui-task-5.md) | Onboarding & dialogs | 5 | ~300 | ~0 |
| 6 | [task-6.md](./2026-03-19-animate-ui-task-6.md) | Detail panels | 6 | ~350 | ~0 |
| 7 | [task-7.md](./2026-03-19-animate-ui-task-7.md) | Chat panel | 6 | ~350 | ~0 |
| 8 | [task-8.md](./2026-03-19-animate-ui-task-8.md) | Shared components | 2 | ~200 | ~0 |

## Design Principles

1. **API compatibility** — Upgraded primitives must maintain the same export API so consumers don't break. Add animation as an enhancement, not a rewrite.
2. **Theme integration** — All animations must respect the existing CSS variable theme system (`--color-*` tokens in `src/index.css`, runtime overrides in `applyTheme.ts`).
3. **Reduced motion** — Respect `prefers-reduced-motion` media query. Motion components should gracefully degrade.
4. **Performance** — Canvas rendering (ReactFlow) must not be affected. Animations are for chrome/UI only, not for nodes/edges inside ReactFlow.
5. **Incremental adoption** — Each task produces a working app. No task leaves the UI in a broken intermediate state.
