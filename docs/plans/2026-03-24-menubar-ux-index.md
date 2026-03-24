# Feature: MenuBar UX Overhaul — Task Index

> **For Claude:** Invoke superpowers:writing-plans on each task file listed below.

**Goal:** Merge New/Open into single "Open..." action, wire Open Recent with IndexedDB on web, and configure minimal native macOS menu for Tauri
**Total tasks:** 3
**Estimated scope:** 9 files, ~205 source lines across all tasks

## Dependency Graph

Task 1: Merge New/Open + UI cleanup    → blocks: [2, 3]
Task 2: IndexedDB Open Recent           → blockedBy: [1]
Task 3: Tauri multi-window + native menu → blockedBy: [1]

## Execution Strategy

- **Sequential start:** Task 1 (foundation — changes fileStore, TopMenubar, ProjectGate)
- **Parallel group:** Task 2, Task 3 (after Task 1, no shared writes)

## Tasks

| # | File | Scope | Write Files | Source LOC | Config LOC |
|---|------|-------|-------------|------------|------------|
| 1 | ./2026-03-24-menubar-ux-task-1.md | Merge New/Open UI | 5 + tests | ~100 | ~0 |
| 2 | ./2026-03-24-menubar-ux-task-2.md | IndexedDB Open Recent | 3 + tests | ~80 | ~0 |
| 3 | ./2026-03-24-menubar-ux-task-3.md | Tauri multi-window + native menu | 3 | ~80 | ~10 |
