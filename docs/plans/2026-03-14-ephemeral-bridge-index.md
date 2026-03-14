# Feature: Ephemeral Bridge Operations — Task Index

> **For Claude:** Invoke superpowers:writing-plans on each task file listed below.

**Goal:** Make the CLI a thin transport layer when bridge is detected — all logic happens in the browser's in-memory stores, no auto-save
**Total tasks:** 4
**Estimated scope:** 14 files, ~405 source lines across all tasks

## Dependency Graph

Task 1: Infrastructure (context, relay, prompt)   → blocks: [2, 3, 4]
Task 2: Browser dispatcher expansion              → blockedBy: [1]
Task 3: CLI write commands bridge routing          → blockedBy: [1]
Task 4: CLI read commands + import + index wiring  → blockedBy: [1]

## Execution Strategy

- **Sequential:** Task 1 (infrastructure foundation)
- **Parallel group:** Tasks 2, 3, 4 (after Task 1 — no shared writes)

## Tasks

| # | File | Scope | Write Files | Source LOC | Config LOC |
|---|------|-------|-------------|------------|------------|
| 1 | ./2026-03-14-ephemeral-bridge-task-1.md | Infrastructure | 3 | ~80 | ~0 |
| 2 | ./2026-03-14-ephemeral-bridge-task-2.md | Browser dispatcher | 1 | ~150 | ~0 |
| 3 | ./2026-03-14-ephemeral-bridge-task-3.md | CLI write commands | 4 | ~45 | ~0 |
| 4 | ./2026-03-14-ephemeral-bridge-task-4.md | CLI read commands + import + index | 6 | ~130 | ~0 |
