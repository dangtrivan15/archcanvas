# Feature: I5 CLI & Persistence UI — Task Index

> **For Claude:** Invoke superpowers:writing-plans on each task file listed below.

**Goal:** Deliver a standalone CLI (`archcanvas`) with 9 subcommands sharing the same stores/engine as the UI, plus wire persistence UI (Open/Save/SaveAs, dirty tracking, save-on-close, keyboard shortcuts, recent files).

**Total tasks:** 10
**Estimated scope:** ~55 source files, ~1,200 source lines across all tasks (plus ~700 lines of mechanical builtin data conversions)

## Dependency Graph

```
Task 1: Builtins → TS + Registry Wiring     → blocks: [3]
Task 2: NodeFileSystem + Factory Update      → blocks: [3, 8]
Task 3: CLI Infrastructure                   → blockedBy: [1, 2], blocks: [4, 5, 6]
Task 4: CLI init + Build Config              → blockedBy: [3], blocks: [7]
Task 5: CLI Mutation Commands                → blockedBy: [3], blocks: [7]
Task 6: CLI Read + Import Commands           → blockedBy: [3], blocks: [7]
Task 7: CLI Integration Tests                → blockedBy: [4, 5, 6]
Task 8: Persistence UI — Store + Picker      → blockedBy: [2], blocks: [9]
Task 9: Persistence UI — Components          → blockedBy: [8], blocks: [10]
Task 10: E2E Tests — File Operations         → blockedBy: [9]
```

## Execution Strategy

- **Parallel group 1:** Task 1, Task 2 (no dependencies — fully parallel)
- **Parallel group 2:** Task 3, Task 8 (T3 after T1+T2; T8 after T2 — can overlap if T2 finishes first)
- **Parallel group 3:** Task 4, Task 5, Task 6, Task 9 (all after their respective deps — fully parallel)
- **Parallel group 4:** Task 7, Task 10 (after their respective deps — parallel)

## Tasks

| # | File | Scope | Write Files | Source LOC | Config LOC |
|---|------|-------|-------------|------------|------------|
| 1 | ./2026-03-13-i5-task-1.md | Builtin NodeDefs → TS objects | ~40 (mechanical) | ~60 logic + ~700 data | ~0 |
| 2 | ./2026-03-13-i5-task-2.md | NodeFileSystem + factory | 4 | ~80 | ~0 |
| 3 | ./2026-03-13-i5-task-3.md | CLI infrastructure | 7 | ~230 | ~20 |
| 4 | ./2026-03-13-i5-task-4.md | CLI init + build config | 4 | ~110 | ~50 |
| 5 | ./2026-03-13-i5-task-5.md | CLI mutation commands | 8 | ~200 | ~0 |
| 6 | ./2026-03-13-i5-task-6.md | CLI read + import commands | 8 | ~240 | ~0 |
| 7 | ./2026-03-13-i5-task-7.md | CLI integration tests | 1 | ~0 | ~0 |
| 8 | ./2026-03-13-i5-task-8.md | Persistence store + picker | 3 | ~110 | ~0 |
| 9 | ./2026-03-13-i5-task-9.md | Persistence UI components | 4 | ~140 | ~0 |
| 10 | ./2026-03-13-i5-task-10.md | E2E file operations tests | 1 | ~0 | ~0 |

## Notes

- **Task 1** exceeds the 10-file hard cap by design: 32 YAML→TS conversions are mechanical data literals (not logic). Subagent should parallelize by namespace.
- **CLI commands** call store methods directly (same Zustand stores as UI) — no separate data layer.
- **Persistence UI** is independent of CLI — they share only the `createFileSystem` factory and `fileStore`.
- **Spec reference:** `docs/specs/2026-03-13-i5-cli-persistence-ui-design.md`
