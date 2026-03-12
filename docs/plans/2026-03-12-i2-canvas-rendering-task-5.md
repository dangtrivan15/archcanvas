# Task 5: Rendering Pipeline — Types + Hook + Canvas Wiring

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:writing-plans to plan
> the implementation steps for this task.

**Scope:** Canvas rendering pipeline
**Parent feature:** [I2 Canvas Rendering](./2026-03-12-i2-canvas-rendering-index.md)

## Write Set

- Create: `src/components/canvas/types.ts` (~25 lines) — CanvasNodeData, CanvasEdgeData interfaces
- Create: `src/components/canvas/hooks/useCanvasRenderer.ts` (~80 lines) — core graph → ReactFlow data
- Modify: `src/components/canvas/Canvas.tsx` (~30 lines) — wire hook, register custom node/edge types
- Modify: `src/App.tsx` (~10 lines) — add `enablePatches()` init and `registryStore.initialize()`
- Test: Create `test/unit/components/canvas/useCanvasRenderer.test.ts`

## Read Set (context needed)

- `src/store/fileStore.ts` — `getCanvas`, `getRootCanvas`
- `src/store/registryStore.ts` — `resolve` (Task 3)
- `src/store/graphStore.ts` — exists but not used directly by this hook
- `src/components/canvas/Canvas.tsx` — current bare ReactFlow container (16 lines)
- `src/App.tsx` — current app shell (51 lines)
- `src/types/schema.ts` — `Node`, `InlineNode`, `RefNode`, `Edge`, `CanvasFile`
- `src/types/nodeDefSchema.ts` — `NodeDef` type (for CanvasNodeData)
- `docs/specs/2026-03-12-i2-canvas-rendering-design.md` — Layer 2: Canvas Rendering Pipeline

## Dependencies

- **Blocked by:** Task 3 (registryStore), Task 4 (graphStore)
- **Blocks:** Task 6 (NodeRenderer consumes CanvasNodeData), Task 7 (EdgeRenderer consumes CanvasEdgeData), Task 8 (Canvas.tsx modified here first)

## Description

This task creates the data bridge between Zustand stores and ReactFlow. The `useCanvasRenderer` hook reads from stores and produces ReactFlow-compatible `nodes[]` and `edges[]` arrays.

### types.ts

```typescript
interface CanvasNodeData {
  node: Node;
  nodeDef: NodeDef | undefined;
  isSelected: boolean;   // hardcoded false until Task 8 (canvasStore)
  isRef: boolean;
}

interface CanvasEdgeData {
  edge: Edge;
  styleCategory: 'sync' | 'async' | 'default';
}
```

### useCanvasRenderer hook

1. Read `currentCanvasId` from navigationStore (doesn't exist yet — use `ROOT_CANVAS_KEY` as default until Task 9)
2. Get canvas from `fileStore.getCanvas(canvasId)`
3. For each node: resolve NodeDef from registryStore → build `CanvasNodeData`
4. For each edge: map `edge.protocol` → style category via `PROTOCOL_STYLES` lookup → build `CanvasEdgeData`
5. Memoize with `useMemo` — recompute only when canvas data or registry changes

Protocol style mapping (also used by EdgeRenderer in Task 7):
```typescript
const PROTOCOL_STYLES: Record<string, 'sync' | 'async'> = {
  HTTP: 'sync', HTTPS: 'sync', gRPC: 'sync', SQL: 'sync',
  Kafka: 'async', SQS: 'async', RabbitMQ: 'async', NATS: 'async',
};
```
Export this from `types.ts` so EdgeRenderer can import it.

### Canvas.tsx changes

- Import `useCanvasRenderer` and pass `nodes`/`edges` to `<ReactFlow>`
- Register custom node types: `{ archNode: NodeRenderer }` (placeholder import — actual component in Task 6)
- Register custom edge types: `{ archEdge: EdgeRenderer }` (placeholder import — actual component in Task 7)
- For now, use ReactFlow's default node/edge types until Tasks 6/7 deliver the custom renderers

### App.tsx changes

- Add `enablePatches()` call from immer at module level (before any component renders)
- Add `useEffect` to call `registryStore.initialize()` on mount

### Cross-slice note

`isSelected` in `CanvasNodeData` is hardcoded to `false` in this task. Task 8 (canvasStore) will wire it to `canvasStore.selectedNodeIds`. Similarly, `currentCanvasId` defaults to `ROOT_CANVAS_KEY` until Task 9 (navigationStore).

### Tests (hook test using renderHook)

- Returns empty arrays when fileStore has no project
- Returns correct nodes when canvas has nodes
- Resolves NodeDef for InlineNode type
- Returns undefined nodeDef for unknown type
- Sets isRef=true for RefNodes, isRef=false for InlineNodes
- Maps edge protocols to correct style categories
- Unmapped protocols get 'default' category
- Memoization: same data → same reference (referential stability)

### Acceptance Criteria

- `useCanvasRenderer` hook derives ReactFlow data from stores
- `Canvas.tsx` renders nodes and edges from the hook
- `enablePatches()` called before any engine usage
- registryStore initialized on app mount
- `tsc --noEmit` passes
