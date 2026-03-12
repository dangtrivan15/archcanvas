# Task 4: graphStore

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:writing-plans to plan
> the implementation steps for this task.

**Scope:** Graph mutation orchestration store
**Parent feature:** [I2 Canvas Rendering](./2026-03-12-i2-canvas-rendering-index.md)

## Write Set

- Create: `src/store/graphStore.ts` (~130 lines)
- Test: Create `test/unit/store/graphStore.test.ts`

## Read Set (context needed)

- `src/core/graph/engine.ts` — 9 mutation functions (addNode, removeNode, updateNode, etc.)
- `src/core/graph/types.ts` — `EngineResult` (with patches after Task 1), `EngineError`
- `src/store/fileStore.ts` — `getCanvas`, `updateCanvasData` (after Task 2), `markDirty`
- `src/store/registryStore.ts` — `resolve` (after Task 3)
- `src/types/schema.ts` — `Node`, `InlineNode`, `Edge`, `Entity`, `Position`, `CanvasFile`
- `docs/specs/2026-03-12-i2-canvas-rendering-design.md` — graphStore interface + mutation flow

## Dependencies

- **Blocked by:** Task 1 (engine emits patches), Task 2 (fileStore.updateCanvasData), Task 3 (registryStore)
- **Blocks:** Task 5 (rendering pipeline), Task 8 (canvasStore delegates here), Task 13 (historyStore wires into graphStore)

## Description

graphStore is the orchestration layer between UI and the core engine. It has **no state of its own** — it's pure methods that read from fileStore, call engine functions, write back to fileStore, and (later, Task 13) push patches to historyStore.

### Interface

```typescript
interface GraphStoreState {
  addNode(canvasId: string, node: Node): EngineResult;
  removeNode(canvasId: string, nodeId: string): EngineResult;
  updateNode(canvasId: string, nodeId: string, updates: InlineNodeUpdates): EngineResult;
  updateNodePosition(canvasId: string, nodeId: string, position: Position): EngineResult;
  addEdge(canvasId: string, edge: Edge): EngineResult;
  removeEdge(canvasId: string, from: string, to: string): EngineResult;
  updateEdge(canvasId: string, from: string, to: string, updates: EdgeUpdates): EngineResult;
  addEntity(canvasId: string, entity: Entity): EngineResult;
  removeEntity(canvasId: string, entityName: string): EngineResult;
  updateEntity(canvasId: string, entityName: string, updates: EntityUpdates): EngineResult;
}
```

### Mutation flow (same for all 10 methods)

1. `const canvas = useFileStore.getState().getCanvas(canvasId)`
2. If `undefined` → return `{ ok: false, error: { code: 'CANVAS_NOT_FOUND', canvasId } }`
3. `const registry = useRegistryStore.getState().registry`
4. Call the corresponding engine function: `engineFn(canvas.data, ...args, registry)`
5. If `result.ok`:
   - `useFileStore.getState().updateCanvasData(canvasId, result.data)`
   - (Patch push to historyStore is wired in Task 13, not here — for now, patches are produced but not consumed)
6. Return `result`

### Design decision: no state

graphStore uses `create()` but stores no state fields — only methods. This is intentional: canvas data lives in fileStore, registry in registryStore. graphStore is a pure coordinator. This avoids the #1 footgun of state management: data duplication between stores.

### Tests

Test graphStore methods using real Zustand stores (fileStore seeded with test data, registryStore initialized). Verify:

- `addNode` writes updated data back to fileStore
- `removeNode` removes node and connected edges from fileStore data
- `updateNode` with valid args updates fileStore data
- `updateNodePosition` updates position in fileStore data
- `addEdge` writes edge to fileStore
- `removeEdge` removes edge from fileStore
- All mutations mark canvas as dirty
- Returns `CANVAS_NOT_FOUND` for invalid canvasId
- Returns engine errors (DUPLICATE_NODE_ID, etc.) without modifying fileStore
- Engine result includes patches and inversePatches

### Acceptance Criteria

- All 10 graphStore methods implemented
- Each method reads from fileStore, calls engine, writes back on success
- CANVAS_NOT_FOUND guard on all methods
- No state duplication — graphStore has no data fields
- `tsc --noEmit` passes
