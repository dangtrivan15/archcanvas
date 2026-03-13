---
name: task-decomposition
description: |
  Use when planning any feature, task, or implementation work before invoking writing-plans. MUST be activated before
  writing-plans for any multi-file feature. Trigger phrases: "plan this feature", "break this down", "decompose this
  task", "split into tasks", or any planning request that precedes implementation.
---

# Task Decomposition

## Overview

Decompose features into small, isolated tasks that each fit within a single context
window. Every planning request passes through this skill before `writing-plans`.
If the feature already fits in one task, pass through directly.

**Announce at start:** "Using task-decomposition to scope and split this feature."

## Why This Exists

Large features that touch many files cause context bloat and reduce precision.
Each task must be small enough that an implementer can hold the entire scope —
write set, read set, tests, and context — in a single session without degradation.

## Task Constraints (Hard Caps)

| Category | Limit |
|----------|-------|
| Files written (create + modify) | 10 |
| Source code lines changed | 400 |
| Config/types lines changed | 100 |
| Test code lines | Unlimited |

### Soft Constraints (Prioritize)

- **Single test scope** — prefer tasks verifiable by 1-2 test files
- **No shared writes** — parallel tasks should not write the same files; when unavoidable, add an explicit dependency edge

### Structural Requirements

- **Single concern** — each task addresses one explicit scope: one API or set of APIs, one interface, one data model, one component
- **Pre-scoped read set** — explicitly list every file the implementer needs to read for context; the implementer should not need to read beyond this list

## The Process

```
1. Analyze scope
2. Check: fits in one task?
   → Yes: pass through to writing-plans
   → No: decompose
3. Define tasks with write sets, read sets, concerns
4. Build dependency graph
5. Validate constraints (no shared writes, caps respected)
6. Produce index + per-task files
7. Hand off to writing-plans
```

### Step 1: Analyze Scope

Read the design doc (from brainstorming) or user description. Identify:

- All files that would be created or modified
- Estimated source lines per file
- Logical concerns (data models, APIs, UI components, etc.)
- Dependencies between concerns

### Step 2: Fits in One Task?

Check against constraints. If ALL of the following are true, skip decomposition:

- Total files written 10 or fewer
- Total source lines 400 or fewer
- Total config/types lines 100 or fewer
- Single logical concern

If yes: produce a single task file and invoke `superpowers:writing-plans`.

### Step 3: Decompose

Split along concern boundaries. Each task gets:

- **Scope label** — what concern it addresses (e.g., "User authentication API")
- **Write set** — files to create or modify, with line estimates
- **Read set** — files needed for context (not modified)
- **Dependencies** — which tasks must complete first

Splitting heuristics (in priority order):

1. **By data layer** — separate data models, APIs, and UI
2. **By domain boundary** — separate unrelated domains
3. **By interface** — if components share an interface, extract the interface as its own task first
4. **By read independence** — tasks that need different read sets are good split candidates

### Step 4: Build Dependency Graph

For each task, determine:

- `blocks`: tasks that cannot start until this one completes
- `blockedBy`: tasks that must complete before this one can start

Tasks with no `blockedBy` are immediately executable in parallel.

### Step 5: Validate

Before producing output, verify:

- Every task respects all hard caps
- No two parallel-eligible tasks share write files (if they do: restructure or add dependency edge)
- Every task has a pre-scoped read set
- Every task has a single concern label
- The dependency graph has no cycles

### Step 6: Produce Output

Generate two types of files:

**Index file:** `docs/plans/YYYY-MM-DD-<feature>-index.md`
**Per-task files:** `docs/plans/YYYY-MM-DD-<feature>-task-N.md`

### Step 7: Hand Off

Invoke `superpowers:writing-plans` for each task file. The task file provides
all context needed for `writing-plans` to produce detailed implementation steps.

## Output Formats

### Index File

```markdown
# Feature: <Name> — Task Index

> **For Claude:** Invoke superpowers:writing-plans on each task file listed below.

**Goal:** One sentence describing the feature
**Total tasks:** N
**Estimated scope:** X files, Y source lines across all tasks

## Dependency Graph

Task 1: <Name>              → blocks: [3, 4]
Task 2: <Name>              → blocks: [4]
Task 3: <Name>              → blockedBy: [1], blocks: [5]
Task 4: <Name>              → blockedBy: [1, 2]
Task 5: <Name>              → blockedBy: [3, 4]

## Execution Strategy

- **Parallel group 1:** Task 1, Task 2 (no dependencies)
- **Parallel group 2:** Task 3, Task 4 (after group 1)
- **Sequential:** Task 5 (after group 2)

## Tasks

| # | File | Scope | Write Files | Source LOC | Config LOC |
|---|------|-------|-------------|------------|------------|
| 1 | ./task-1.md | Data model | 3 | ~150 | ~20 |
| 2 | ./task-2.md | Validation | 2 | ~100 | ~30 |
| 3 | ./task-3.md | API layer | 4 | ~200 | ~10 |
```

### Per-Task File

```markdown
# Task N: <Name>

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:writing-plans to plan
> the implementation steps for this task.

**Scope:** <single concern label>
**Parent feature:** <link to index file>

## Write Set

- Create: `src/models/user.ts` (~80 lines)
- Create: `src/models/user.test.ts` (test, unlimited)
- Modify: `src/models/index.ts:12-15` (~5 lines)

## Read Set (context needed)

- `src/types/common.ts` — shared type definitions
- `src/middleware/auth.ts` — authentication interface

## Dependencies

- **Blocked by:** Task 1 (database schema must exist)
- **Blocks:** Task 4 (UI needs this model)

## Description

<2-5 paragraphs describing what this task accomplishes, the approach,
edge cases to consider, and acceptance criteria. Enough detail for
writing-plans to produce step-by-step implementation instructions.>
```

## Integration

**Invoked by:** `superpowers:brainstorming` (after design approval) or directly for any planning request

**Invokes:** `superpowers:writing-plans` (for each task produced)

**Downstream:** `writing-plans` produces detailed steps, then `executing-plans` or `subagent-driven-development` executes them

## When a Feature is Already Small

If analysis shows the feature fits within constraints, announce:

> "This feature fits within a single task (N files, ~M source lines). Passing through to writing-plans directly."

Produce a single task file (same format) and invoke `superpowers:writing-plans`.

## Common Decomposition Patterns

**Vertical slice:** Data model → API → UI. Each layer is a task with dependency on the previous.

**Horizontal slice:** Independent features that happen to be part of the same epic. Each is a task with no dependencies.

**Interface-first:** Extract shared interfaces/types as Task 1, then implement consumers in parallel tasks that depend on Task 1.

**Test infrastructure:** If multiple tasks need shared test utilities (fixtures, helpers, mocks), extract those as a dependency task.
