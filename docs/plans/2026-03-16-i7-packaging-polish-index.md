# Feature: I7 Packaging & Polish — Task Index

> **For Claude:** Invoke superpowers:writing-plans on each task file listed below.

**Goal:** Ship ArchCanvas v1 with cross-scope ref redesign, entity panel, protocol compatibility, AI bridge extraction, and Tauri desktop packaging.
**Spec:** `docs/specs/2026-03-16-i7-packaging-and-polish-design.md`
**Total tasks:** 10
**Estimated scope:** ~35 files modified/created, ~1200 source lines across all tasks

## Dependency Graph

```
Task 1: Types + Storage Foundation     → blocks: [2, 3, 4]
Task 2: Engine + Query + Validation    → blockedBy: [1], blocks: [4, 5]
Task 3: Inherited Edges UI             → blockedBy: [1], blocks: [4, 8]
Task 4: @root/ Cleanup Sweep           → blockedBy: [1, 2, 3]
Task 5: Protocol Compatibility         → blockedBy: [2]
Task 6: Entity Resolver                → blocks: [7]
Task 7: EntityPanel UI                 → blockedBy: [6], blocks: [8]
Task 8: Entity Integration             → blockedBy: [3, 7]
Task 9: Bridge Extraction              → blocks: [10]
Task 10: Tauri Sidecar + Packaging     → blockedBy: [9]
```

## Execution Strategy

- **Parallel group 1:** Task 1, Task 6, Task 9 (no dependencies between them)
- **Parallel group 2:** Task 2, Task 3, Task 7 (after group 1 deps resolve)
- **Parallel group 3:** Task 4, Task 5, Task 8 (after group 2 deps resolve)
- **Sequential tail:** Task 10 (after Task 9)

## Tasks

| # | File | Scope | Write Files | Source LOC | Config LOC |
|---|------|-------|-------------|------------|------------|
| 1 | ./2026-03-16-i7-task-1.md | Schema + fileResolver (ref suffix, map key, cross-scope validation) | 2 | ~80 | ~10 |
| 2 | ./2026-03-16-i7-task-2.md | Engine + query + validation (@ syntax, removeNode cascade) | 3 | ~90 | 0 |
| 3 | ./2026-03-16-i7-task-3.md | Inherited edges UI (ghost nodes, EdgeRenderer, navigationStore) | 5 | ~160 | 0 |
| 4 | ./2026-03-16-i7-task-4.md | @root/ cleanup sweep (stores, AI, CLI, tests) | 8 | ~80 | 0 |
| 5 | ./2026-03-16-i7-task-5.md | Protocol compatibility (port intersection, engine rejection) | 3 | ~70 | 0 |
| 6 | ./2026-03-16-i7-task-6.md | Entity resolver (pure functions) | 1 | ~100 | 0 |
| 7 | ./2026-03-16-i7-task-7.md | EntityPanel UI (component, RightPanel tab, uiStore) | 3 | ~150 | 0 |
| 8 | ./2026-03-16-i7-task-8.md | Entity integration (command palette #, highlight, tab-switch) | 4 | ~100 | 0 |
| 9 | ./2026-03-16-i7-task-9.md | Bridge extraction + standalone server | 4 | ~250 | ~20 |
| 10 | ./2026-03-16-i7-task-10.md | Tauri sidecar + packaging | 4 | ~100 | ~50 |
