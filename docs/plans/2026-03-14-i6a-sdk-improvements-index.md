# Feature: I6a SDK Improvements — Task Index

> **For Claude:** Invoke superpowers:writing-plans on each task file listed below.

**Goal:** Align the ClaudeCodeProvider bridge with the full Claude Agent SDK capabilities — adding missing tools, safety guards, richer message handling, permission UX, streaming, UI controls, and hooks.

**Total tasks:** 5
**Estimated scope:** 12 files, ~520 source lines across all tasks

## Dependency Graph

Task 1: Types & bridge core options    → blocks: [2, 3, 4, 5]
Task 2: Permission card UX             → blockedBy: [1]
Task 3: Streaming & SDK message types  → blockedBy: [1]
Task 4: UI controls (mode + effort)    → blockedBy: [1]
Task 5: Question previews & hooks      → blockedBy: [1]

## Execution Strategy

- **Sequential first:** Task 1 (foundation — types, bridge options, SDK plumbing)
- **Parallel group:** Tasks 2, 3, 4, 5 (after Task 1; no shared write files)

> **Note:** Tasks 2 and 4 both modify `chatStore.ts`, but they touch completely
> different methods (T2: respondToPermission; T4: new permissionMode/effort state).
> They can safely run in parallel as long as they don't rebase onto each other's
> changes until both are complete.

## Tasks

| # | File | Scope | Write Files | Source LOC | Config LOC |
|---|------|-------|-------------|------------|------------|
| 1 | ./2026-03-14-i6a-sdk-task-1.md | Types + bridge core | 4 | ~200 | ~80 |
| 2 | ./2026-03-14-i6a-sdk-task-2.md | Permission card UX | 2 | ~80 | ~0 |
| 3 | ./2026-03-14-i6a-sdk-task-3.md | Streaming + message types | 3 | ~120 | ~10 |
| 4 | ./2026-03-14-i6a-sdk-task-4.md | UI controls (mode + effort) | 3 | ~100 | ~0 |
| 5 | ./2026-03-14-i6a-sdk-task-5.md | Question previews + hooks | 2 | ~60 | ~10 |

## Improvement → Task Mapping

| # | Improvement | Task |
|---|---|---|
| 1 | Add Write/Edit to allowedTools | T1 |
| 2 | Add maxTurns guard | T1 |
| 3 | Expose blockedPath/decisionReason | T1 (types + bridge), T2 (UI) |
| 4 | Enable partial messages (streaming) | T3 |
| 5 | Permission mode selector | T1 (types + bridge), T4 (UI) |
| 6 | updatedPermissions ("Always allow") | T2 |
| 7 | Surface more SDK message types | T3 |
| 8 | interrupt on deny | T1 (types + bridge), T2 (UI) |
| 9 | toolConfig previews | T5 |
| 10 | systemPrompt preset option | T1 |
| 11 | Hooks (auto-approve read-only) | T5 |
| 12 | effort option | T1 (types + bridge), T4 (UI) |
