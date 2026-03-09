# Architecture Improvement Proposals

## Parallel Execution Guide

These proposals are designed for concurrent implementation by independent agents.

### Dependency Graph

```
            ┌─────────────────────────────────────────────────┐
            │           SAFE TO RUN IN PARALLEL               │
            │                                                 │
            │  P04 (NodeDefs)    P06 (Platform)               │
            │  P09 (Dead Code)   P10 (Undo)                   │
            │  P07 (Canvas)                                   │
            └─────────────────────────────────────────────────┘

            ┌─────────────────────────────────────────────────┐
            │       SEQUENCE: P02 → P01 → P03 → P05          │
            │                                                 │
            │  P02 (State) must finish before P01 (God Comp)  │
            │  P01 must finish before P03 (AI Integration)    │
            │  P02 must finish before P05 (Fractal Nav)       │
            │  P08 (Storage) can start after P06 (Platform)   │
            └─────────────────────────────────────────────────┘
```

### Parallel Batches

| Batch | Proposals | Can Start |
|-------|-----------|-----------|
| **Batch 1** | P04, P06, P09, P10, P07 | Immediately (all independent) |
| **Batch 2** | P02 | After reviewing Batch 1 results |
| **Batch 3** | P01, P05, P08 | After P02 completes |
| **Batch 4** | P03 | After P01 completes |

### File Conflict Matrix

Each proposal lists the files it touches. Two proposals conflict if they modify the same file.

| Proposal | Primary Files Modified |
|----------|----------------------|
| P01 | `App.tsx`, new `src/dialogs/` dir, `src/components/canvas/` splits |
| P02 | `src/store/coreStore.ts` → split into 5 stores, new `src/events/` |
| P03 | New `src/ai/` dir, `src/bridge/`, new `AIChatPanel` |
| P04 | `src/core/registry/` files, new `src/core/registry/loaders/` |
| P05 | `src/store/navigationStore.ts`, `src/store/nestedCanvasStore.ts` → merge |
| P06 | `src/core/platform/` files only |
| P07 | `src/components/canvas/Canvas.tsx` → split + adapter |
| P08 | `src/core/storage/` files, new `src/core/storage/backends/` |
| P09 | `src/core/storage/fileIO.ts` (AI sections), `src/services/bridgeConnection.ts` |
| P10 | `src/core/history/undoManager.ts` only |

### Proposals

- [P01: Break Up God Components](./P01-break-up-god-components.md)
- [P02: Restructure State Management](./P02-restructure-state-management.md)
- [P03: AI Integration Layer](./P03-ai-integration-layer.md)
- [P04: Extensible NodeDef System](./P04-extensible-nodedef-system.md)
- [P05: Fractal Canvas Navigation](./P05-fractal-canvas-navigation.md)
- [P06: Platform Abstraction](./P06-platform-abstraction.md)
- [P07: Decouple Canvas from React Flow](./P07-decouple-canvas-react-flow.md)
- [P08: Storage Backend Abstraction](./P08-storage-backend-abstraction.md)
- [P09: Clean Dead Code](./P09-clean-dead-code.md)
- [P10: Undo System Optimization](./P10-undo-optimization.md)
