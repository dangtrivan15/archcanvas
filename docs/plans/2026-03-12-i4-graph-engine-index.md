# Feature: I4 Graph Engine — Task Index

> **For Claude:** Invoke superpowers:writing-plans on each task file listed below.

**Goal:** Build the graph engine Core Layer: scope-local CRUD via Immer, NodeDef-aware validation, single-canvas + cross-scope queries, entity CRUD
**Total tasks:** 3
**Estimated scope:** 11 files, ~585 source lines across all tasks

## Dependency Graph

Task 1: Types + Validation       → blocks: [2, 3]
Task 2: Engine                   → blockedBy: [1]
Task 3: Query                    → blockedBy: [1]

## Execution Strategy

- **Sequential:** Task 1 (foundation)
- **Parallel group:** Task 2, Task 3 (after Task 1, independent of each other)

## Tasks

| # | File | Scope | Write Files | Source LOC |
|---|------|-------|-------------|------------|
| 1 | [./2026-03-12-i4-graph-engine-task-1.md](./2026-03-12-i4-graph-engine-task-1.md) | Result types, validation, test helpers, barrel | 5 | ~205 |
| 2 | [./2026-03-12-i4-graph-engine-task-2.md](./2026-03-12-i4-graph-engine-task-2.md) | CRUD engine via Immer | 2 | ~220 |
| 3 | [./2026-03-12-i4-graph-engine-task-3.md](./2026-03-12-i4-graph-engine-task-3.md) | Single-canvas + cross-scope queries | 2 | ~160 |
