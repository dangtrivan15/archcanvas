# Feature: I2 Canvas Rendering — Task Index

> **For Claude:** Invoke superpowers:writing-plans on each task file listed below.

**Goal:** Build the full Presentation + State layer — Zustand stores, custom ReactFlow renderers, navigation, panels, command palette, auto-layout, and undo/redo
**Total tasks:** 15
**Estimated scope:** ~30 files, ~2100 source lines across all tasks
**Spec:** `docs/specs/2026-03-12-i2-canvas-rendering-design.md`

## Dependency Graph

```
Task 1:  Engine upgrade           → blocks: [4]
Task 2:  fileStore write-back     → blocks: [4, 13]
Task 3:  registryStore            → blocks: [4, 14]
Task 4:  graphStore               → blocks: [5, 8, 13]    blockedBy: [1, 2, 3]
Task 5:  Rendering pipeline       → blocks: [6, 7, 8]     blockedBy: [3, 4]
Task 6:  NodeRenderer             →                        blockedBy: [5]
Task 7:  EdgeRenderer             →                        blockedBy: [5]
Task 8:  canvasStore + interact.  → blocks: [9, 10, 12, 14] blockedBy: [4, 5]
Task 9:  Navigation               → blocks: [12, 14]      blockedBy: [8]
Task 10: Right panel (skeleton)   → blocks: [11]           blockedBy: [8]
Task 11: Right panel (tabs+edge)  →                        blockedBy: [10]
Task 12: Context menus            →                        blockedBy: [8, 9]
Task 13: historyStore + undo/redo → blocks: [15]           blockedBy: [2, 4]
Task 14: Command palette          → blocks: [15]           blockedBy: [3, 8, 9]
Task 15: Auto-layout + wiring     →                        blockedBy: [13, 14]
```

## Execution Strategy

- **Parallel group 1:** Tasks 1, 2, 3 (no dependencies)
- **Sequential:** Task 4 (after group 1)
- **Parallel group 2:** Tasks 5, 13 (5 needs 3+4; 13 needs 2+4)
- **Parallel group 3:** Tasks 6, 7, 8 (6+7 need 5; 8 needs 4+5)
- **Parallel group 4:** Tasks 9, 10 (both need 8)
- **Parallel group 5:** Tasks 11, 12, 14 (11 needs 10; 12 needs 8+9; 14 needs 3+8+9)
- **Sequential:** Task 15 (after 13+14)

## Tasks

| # | File | Scope | Write Files | Source LOC | Config LOC |
|---|------|-------|-------------|------------|------------|
| 1 | [task-1](./2026-03-12-i2-canvas-rendering-task-1.md) | Engine upgrade (produceWithPatches) | 3 | ~70 | ~15 |
| 2 | [task-2](./2026-03-12-i2-canvas-rendering-task-2.md) | fileStore write-back + doc clearing | 2 | ~30 | ~0 |
| 3 | [task-3](./2026-03-12-i2-canvas-rendering-task-3.md) | registryStore | 1 | ~60 | ~0 |
| 4 | [task-4](./2026-03-12-i2-canvas-rendering-task-4.md) | graphStore | 1 | ~130 | ~0 |
| 5 | [task-5](./2026-03-12-i2-canvas-rendering-task-5.md) | Rendering pipeline (types + hook + wiring) | 4 | ~145 | ~0 |
| 6 | [task-6](./2026-03-12-i2-canvas-rendering-task-6.md) | NodeRenderer + CSS shapes | 2 | ~120 | ~100 |
| 7 | [task-7](./2026-03-12-i2-canvas-rendering-task-7.md) | EdgeRenderer | 1 | ~80 | ~0 |
| 8 | [task-8](./2026-03-12-i2-canvas-rendering-task-8.md) | canvasStore + useCanvasInteractions | 3 | ~160 | ~0 |
| 9 | [task-9](./2026-03-12-i2-canvas-rendering-task-9.md) | navigationStore + breadcrumb + animation | 4 | ~200 | ~0 |
| 10 | [task-10](./2026-03-12-i2-canvas-rendering-task-10.md) | Right panel skeleton + PropertiesTab | 3 | ~210 | ~0 |
| 11 | [task-11](./2026-03-12-i2-canvas-rendering-task-11.md) | NotesTab + CodeRefsTab + EdgeDetailPanel | 5 | ~230 | ~0 |
| 12 | [task-12](./2026-03-12-i2-canvas-rendering-task-12.md) | Context menus | 2 | ~110 | ~0 |
| 13 | [task-13](./2026-03-12-i2-canvas-rendering-task-13.md) | historyStore + undo/redo | 3 | ~155 | ~0 |
| 14 | [task-14](./2026-03-12-i2-canvas-rendering-task-14.md) | Command palette (cmdk) | 1 | ~190 | ~0 |
| 15 | [task-15](./2026-03-12-i2-canvas-rendering-task-15.md) | Auto-layout + keyboard shortcuts + wiring | 5 | ~155 | ~0 |

## Critical Test Requirements

Two spec review findings require dedicated regression tests:

1. **Task 2** must test that `updateCanvasData` clears `LoadedCanvas.doc` to `undefined`, and that a subsequent `saveCanvas` call serializes via plain `stringify()` (not the stale `doc` AST)
2. **Task 13** must test that `undo()` actually mutates fileStore data — specifically that `applyPatches` return value is captured and written back, not silently discarded
