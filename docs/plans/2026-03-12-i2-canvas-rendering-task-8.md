# Task 8: canvasStore + useCanvasInteractions

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:writing-plans to plan
> the implementation steps for this task.

**Scope:** Selection, drag, and canvas interactions
**Parent feature:** [I2 Canvas Rendering](./2026-03-12-i2-canvas-rendering-index.md)

## Write Set

- Create: `src/store/canvasStore.ts` (~80 lines)
- Create: `src/components/canvas/hooks/useCanvasInteractions.ts` (~60 lines)
- Modify: `src/components/canvas/Canvas.tsx` (~20 lines) — wire interaction handlers
- Test: Create `test/unit/store/canvasStore.test.ts`

## Read Set (context needed)

- `src/store/graphStore.ts` — `addEdge`, `removeNode`, `removeEdge`, `updateNodePosition` (Task 4)
- `src/store/fileStore.ts` — `getCanvas` (for reading current canvas)
- `src/components/canvas/Canvas.tsx` — current state after Task 5 wiring
- `src/components/canvas/types.ts` — `CanvasNodeData` (Task 5)
- `src/components/canvas/hooks/useCanvasRenderer.ts` — needs to wire `isSelected` from canvasStore
- `src/types/schema.ts` — `EdgeEndpoint`, `Node`
- `docs/specs/2026-03-12-i2-canvas-rendering-design.md` — canvasStore interface, useCanvasInteractions

## Dependencies

- **Blocked by:** Task 4 (graphStore for mutation delegation), Task 5 (Canvas.tsx, useCanvasRenderer)
- **Blocks:** Task 9 (navigation, needs Canvas.tsx), Task 10 (panel reads selection), Task 12 (context menus use deleteSelection), Task 14 (command palette reads selection)

## Description

### canvasStore

UI-only state for selection and interaction orchestration. Not persisted.

```typescript
interface CanvasStoreState {
  selectedNodeIds: Set<string>;
  selectedEdgeKeys: Set<string>;   // "from→to" format
  draftEdge: { from: EdgeEndpoint } | null;

  selectNodes(ids: string[]): void;
  selectEdge(from: string, to: string): void;
  clearSelection(): void;
  startDraftEdge(from: EdgeEndpoint): void;
  completeDraftEdge(to: EdgeEndpoint): EngineResult;
  cancelDraftEdge(): void;
  deleteSelection(): EngineResult | null;
}
```

**Error handling**: `completeDraftEdge` and `deleteSelection` clear their respective state (draft/selection) on both success and failure. They return `EngineResult` so the hook can surface errors.

### useCanvasInteractions hook

Returns ReactFlow event handlers:
- `onNodesChange` — handle drag (position changes) → `graphStore.updateNodePosition`
- `onNodeClick` — InlineNode → `canvasStore.selectNodes([id])`; RefNode → defer to Task 9 (diveIn)
- `onEdgeClick` — `canvasStore.selectEdge(from, to)`
- `onConnect` — `canvasStore.completeDraftEdge(to)`
- `onConnectStart` — `canvasStore.startDraftEdge(from)`
- `onConnectEnd` — `canvasStore.cancelDraftEdge()` (if not completed)
- `onPaneClick` — `canvasStore.clearSelection()`

### Wire isSelected in useCanvasRenderer

Update `useCanvasRenderer` (created in Task 5) to read `canvasStore.selectedNodeIds` and set `isSelected` correctly instead of hardcoded `false`.

### Canvas.tsx changes

Pass all event handlers from `useCanvasInteractions` to `<ReactFlow>`.

### Tests

- `selectNodes` sets selectedNodeIds, clears prior selection
- `selectEdge` sets selectedEdgeKeys
- `clearSelection` empties both sets
- `startDraftEdge` sets draftEdge
- `completeDraftEdge` calls graphStore.addEdge and clears draftEdge
- `completeDraftEdge` clears draftEdge even on failure
- `cancelDraftEdge` clears draftEdge
- `deleteSelection` removes selected nodes and edges via graphStore
- `deleteSelection` clears selection after operation
- `deleteSelection` returns first failure if any operation fails

### Acceptance Criteria

- Selection state management works (select, clear, multi-select via selectNodes)
- Draft edge lifecycle (start → complete/cancel)
- deleteSelection orchestrates graphStore calls
- useCanvasRenderer reflects selection state
- Canvas.tsx wired with interaction handlers
- `tsc --noEmit` passes
