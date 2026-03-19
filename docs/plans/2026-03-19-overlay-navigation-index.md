# Feature: Overlay Navigation Animation — Task Index

> **For Claude:** Invoke superpowers:writing-plans on each task file listed below.

**Goal:** Replace viewport-zoom navigation transitions with Muse-style clip-path overlay animations for subsystem dive-in/go-up.
**Spec:** [docs/specs/2026-03-19-overlay-navigation-design.md](../specs/2026-03-19-overlay-navigation-design.md)
**Total tasks:** 4
**Estimated scope:** 8 source files, ~460 source lines across all tasks

## Dependency Graph

Task 1: Animation utility (TDD)          → blocks: [3]
Task 2: SubsystemPreview alignment        → blocks: [3]
Task 3: Overlay navigation system         → blockedBy: [1, 2], blocks: [4]
Task 4: Clean deletion of old code        → blockedBy: [3]

## Execution Strategy

- **Parallel group 1:** Task 1, Task 2 (no dependencies)
- **Sequential:** Task 3 (after group 1)
- **Sequential:** Task 4 (after Task 3)

## Tasks

| # | File | Scope | Write Files | Source LOC | Config LOC |
|---|------|-------|-------------|------------|------------|
| 1 | [./2026-03-19-overlay-navigation-task-1.md](2026-03-19-overlay-navigation-task-1.md) | Animation utility | 1 create | ~70 | 0 |
| 2 | [./2026-03-19-overlay-navigation-task-2.md](2026-03-19-overlay-navigation-task-2.md) | SubsystemPreview viewport | 1 modify | ~30 | 0 |
| 3 | [./2026-03-19-overlay-navigation-task-3.md](2026-03-19-overlay-navigation-task-3.md) | Overlay + transition rewrite | 3 create/modify | ~350 | 0 |
| 4 | [./2026-03-19-overlay-navigation-task-4.md](2026-03-19-overlay-navigation-task-4.md) | Clean deletion | 0 (all deletes) | 0 | 0 |
