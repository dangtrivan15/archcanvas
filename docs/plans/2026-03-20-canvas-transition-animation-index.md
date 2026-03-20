# Canvas Transition Animation — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace SubsystemPreview with recursive CanvasView + detached container reparenting, and add expanding-frame animation for canvas navigation.

**Architecture:** Split Canvas.tsx monolith into CanvasShell (chrome) + CanvasView (pure ReactFlow renderer) + CanvasHost (portal + detached div). A plain TS module `canvasHostManager` manages DOM registries for detached divs and RefNodeSlots. Navigation animation uses an expanding frame with `clip-path`/`transform` CSS transitions.

**Tech Stack:** React 19, ReactFlow 12, Zustand 5, motion v12, Vitest (happy-dom), Playwright

**Spec:** [docs/specs/2026-03-20-canvas-transition-animation-design.md](../specs/2026-03-20-canvas-transition-animation-design.md)

---

## Dependency Graph

```
Task 1: canvasHostManager (TDD)                → blocks: [3, 5]
Task 2: types + useCanvasRenderer params        → blocks: [3, 4]
Task 3: CanvasView (pure renderer)              → blockedBy: [1, 2], blocks: [5]
Task 4: NodeRenderer (RefNodeSlot + slot reg)   → blockedBy: [2], blocks: [5]
Task 5: CanvasHost (portal + registration)      → blockedBy: [1, 3, 4], blocks: [6]
Task 6: CanvasShell + App.tsx integration       → blockedBy: [5], blocks: [7]
Task 7: useCanvasNavigation (animation)         → blockedBy: [6], blocks: [8]
Task 8: E2E tests + cleanup                     → blockedBy: [7]
```

## Execution Strategy

- **Parallel group 1:** Task 1, Task 2 (no dependencies)
- **Parallel group 2:** Task 3 (needs 1+2), Task 4 (needs 2)
- **Sequential:** Task 5 → Task 6 → Task 7 → Task 8

## Tasks

| # | File | Scope | New Files | Modified Files | Deleted Files |
|---|------|-------|-----------|----------------|---------------|
| 1 | [task-1](./2026-03-20-canvas-transition-task-1.md) | canvasHostManager — DOM registry | 1 src + 1 test | 0 | 0 |
| 2 | [task-2](./2026-03-20-canvas-transition-task-2.md) | CanvasNodeData + useCanvasRenderer params | 0 | 3 src + 1 test | 0 |
| 3 | [task-3](./2026-03-20-canvas-transition-task-3.md) | CanvasView — pure ReactFlow renderer | 1 src + 1 test | 0 | 0 |
| 4 | [task-4](./2026-03-20-canvas-transition-task-4.md) | NodeRenderer — RefNodeSlot + slot registration | 0 | 2 src + 1 test | 0 |
| 5 | [task-5](./2026-03-20-canvas-transition-task-5.md) | CanvasHost — portal + detached div | 1 src + 1 test | 0 | 0 |
| 6 | [task-6](./2026-03-20-canvas-transition-task-6.md) | CanvasShell + App.tsx integration | 1 src | 1 src | 3 src + 1 test |
| 7 | [task-7](./2026-03-20-canvas-transition-task-7.md) | useCanvasNavigation — animation orchestration | 0 | 3 src (navigation + keyboard + breadcrumb) | 0 |
| 8 | [task-8](./2026-03-20-canvas-transition-task-8.md) | E2E tests + verification | 1 e2e spec | varies | 0 |

## Critical Path Notes

- **Tasks 1–5 build the shared architecture** used by both animation variants (primary expanding frame and fallback clip-path). If the primary animation hits ReactFlow issues in Task 7, the fallback can be swapped in with changes only to `useCanvasNavigation.ts`.
- **Task 6 is the big bang** — it deletes `Canvas.tsx` and `SubsystemPreview.tsx`, replacing them with CanvasShell. All existing unit tests that import Canvas must be updated. Run the full test suite after this task.
- **Task 7 is the riskiest** — animation sequencing with ReactFlow. Start with reduced-motion (instant swap) to verify reparenting works, then add animation.
- **Feature branch**: `feat/canvas-transition-animation`. Create before starting Task 1.
