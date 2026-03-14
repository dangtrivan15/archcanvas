# Feature: AI Chat Bugfixes — Task Index

> **For Claude:** Invoke superpowers:writing-plans on each task file listed below.

**Goal:** Fix three bugs discovered during AI chat usage: missing node type catalog, undocumented type format with poor errors, and bridge failure when no project is open.

**Total tasks:** 2
**Estimated scope:** 7 files, ~245 source lines across all tasks

## Bug Summary

| Bug | Title | Root Cause |
|-----|-------|------------|
| 1 | No catalog/discovery command for node types | Registry has `list()` but no CLI command exposes it |
| 2 | Node type format `namespace/name` undocumented | Only hint is a parenthetical in `--help`; error message gives no guidance |
| 3 | Bridge fails with `NO_FILESYSTEM` when no project open | `initializeEmptyProject()` creates in-memory project with `fs=null`; bridge assumes browser has filesystem |

## Dependency Graph

```
Task 1: CLI Node Type Discovery    → blocks: []
Task 2: Global Project Gate        → blocks: []
```

## Execution Strategy

- **Parallel group 1:** Task 1, Task 2 (fully independent, no shared write files)

## Tasks

| # | File | Scope | Bugs | Write Files | Source LOC | Config LOC |
|---|------|-------|------|-------------|------------|------------|
| 1 | [task-1.md](./2026-03-14-ai-chat-bugfixes-task-1.md) | CLI node type discovery | 1, 2 | 4 | ~110 | 0 |
| 2 | [task-2.md](./2026-03-14-ai-chat-bugfixes-task-2.md) | Global project gate | 3 | 3 | ~135 | 0 |

## Downstream Impact

- **E2E tests**: Task 2 changes the app's initial state from "empty project loaded" to "gate screen shown." E2E tests that assume an immediate canvas will need a project-open step in their setup. This is handled within Task 2.
- **I6b (Onboarding Wizard)**: Task 2 establishes the "is a project open?" gate. I6b only needs to add the "is the project empty?" check after the gate, without re-checking project-open state. The `initializeEmptyProject()` method remains in fileStore (not deleted) for potential use by I6b's "blank canvas" option, but is no longer called at app startup.
