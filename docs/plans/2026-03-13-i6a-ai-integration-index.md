# Feature: I6a AI Integration — Task Index

> **For Claude:** Invoke superpowers:writing-plans on each task file listed below.

**Goal:** Deliver AI-powered architecture editing via Claude Code chat, with reactive canvas updates through HTTP mutation API
**Spec:** `docs/specs/2026-03-13-i6a-ai-integration-design.md`
**Total tasks:** 7
**Estimated scope:** 24 files, ~1,350 source lines across all tasks

## Dependency Graph

Task 1: Types, System Prompt & Mock SDK     → blocks: [2, 3, 4, 5, 6, 7]
Task 2: Claude Code Bridge & Vite Plugin    → blockedBy: [1], blocks: [6, 7]
Task 3: WebSocket Provider & chatStore      → blockedBy: [1], blocks: [4, 5, 7]
Task 4: Chat Panel UI Components            → blockedBy: [3], blocks: [5, 7]
Task 5: UI Integration (Toggle & Keyboard)  → blockedBy: [4], blocks: [7]
Task 6: CLI Bridge Detection & HTTP Client  → blockedBy: [2], blocks: [7]
Task 7: Integration & E2E Tests             → blockedBy: [2, 3, 4, 5, 6]

## Execution Strategy

- **Parallel group 1:** Task 1 (foundation — all others depend on it)
- **Parallel group 2:** Task 2, Task 3 (server-side and browser-side, independent)
- **Parallel group 3:** Task 4, Task 6 (UI components and CLI changes, independent)
- **Sequential:** Task 5 (after Task 4)
- **Sequential:** Task 7 (after all others — cross-cutting integration tests)

## Tasks

| # | File | Scope | Write Files | Source LOC | Config LOC |
|---|------|-------|-------------|------------|------------|
| 1 | ./2026-03-13-i6a-task-1.md | Types, system prompt, mock SDK | 3 | ~240 | 0 |
| 2 | ./2026-03-13-i6a-task-2.md | Claude Code bridge & Vite plugin | 4 | ~350 | ~18 |
| 3 | ./2026-03-13-i6a-task-3.md | WebSocket provider & chatStore | 2 | ~230 | 0 |
| 4 | ./2026-03-13-i6a-task-4.md | Chat panel UI components | 5 | ~330 | 0 |
| 5 | ./2026-03-13-i6a-task-5.md | UI integration (toggle, toolbar, keyboard) | 4 | ~50 | 0 |
| 6 | ./2026-03-13-i6a-task-6.md | CLI bridge detection & HTTP client | 6 | ~100 | 0 |
| 7 | ./2026-03-13-i6a-task-7.md | Integration & E2E tests | 3+ | ~0 (test only) | 0 |
