# Task 2: CanvasNodeData + useCanvasRenderer Params

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `canvasId` to `CanvasNodeData` and parameterize `useCanvasRenderer` to accept `canvasId` + `focused` instead of reading from `navigationStore` internally.

**Files:**
- Modify: `src/components/canvas/types.ts` — add `canvasId` field to `CanvasNodeData`
- Modify: `src/components/canvas/mapCanvasData.ts` — pass `canvasId` into node data
- Modify: `src/components/canvas/hooks/useCanvasRenderer.ts` — accept `canvasId` and `focused` params, gate inherited edges by `focused`
- Modify: `test/unit/components/canvas/useCanvasRenderer.test.ts` — update calls to pass params

**Spec reference:** "`useCanvasRenderer` change" and "`NodeRenderer` change" in Architecture > Data Flow.

---

### Step 1: Add `canvasId` to `CanvasNodeData`

- [ ] In `src/components/canvas/types.ts`, add `canvasId: string` to the `CanvasNodeData` interface:

```typescript
export interface CanvasNodeData extends Record<string, unknown> {
  node: Node;
  nodeDef: NodeDef | undefined;
  isSelected: boolean;
  isRef: boolean;
  canvasId: string; // ← NEW: which canvas this node belongs to
}
```

- [ ] In `src/components/canvas/mapCanvasData.ts`, update `MapNodesOptions` to accept `canvasId`:

```typescript
interface MapNodesOptions {
  canvas: Canvas | undefined;
  canvasId: string; // ← NEW
  resolve: (type: string) => NodeDef | undefined;
  selectedNodeIds: ReadonlySet<string>;
  canvasesRef: Map<string, { data: Canvas }> | undefined;
}
```

And set it on each node's data:

```typescript
const data: CanvasNodeData = {
  node,
  nodeDef,
  isSelected: selectedNodeIds.has(node.id),
  isRef,
  canvasId: opts.canvasId, // ← NEW
};
```

- [ ] **Before running tests**, fix all callers of `mapCanvasNodes` to include the new `canvasId` field. There are exactly two callers — fix both before running anything:

**Caller 1:** `useCanvasRenderer.ts` — add `canvasId` to the options:

```typescript
() => mapCanvasNodes({ canvas: canvas?.data, canvasId, resolve, selectedNodeIds, canvasesRef }),
```

**Caller 2:** `SubsystemPreview.tsx` — add a temporary `canvasId` field (this file will be deleted in Task 6, but must compile now):

```typescript
() => mapCanvasNodes({
  canvas: canvas?.data,
  canvasId, // already a prop of SubsystemPreview
  resolve,
  selectedNodeIds: emptySet,
  canvasesRef,
}),
```

### Step 2: Parameterize `useCanvasRenderer`

- [ ] Change the function signature from no params to accepting `canvasId` and `focused`:

```typescript
export function useCanvasRenderer(canvasId: string, focused: boolean): {
  nodes: RFNode<CanvasNodeData>[];
  edges: RFEdge<CanvasEdgeData>[];
}
```

- [ ] Remove the internal `useNavigationStore((s) => s.currentCanvasId)` selector. Use the `canvasId` parameter instead.

- [ ] Gate the inherited-edges block: wrap the existing inherited-edges `useMemo` (lines 39–99) in a condition — only compute when `focused` is `true`. When `focused` is `false`, return empty arrays:

```typescript
const { inheritedRFEdges, ghostNodes } = useMemo(() => {
  if (!focused) {
    return { inheritedRFEdges: [] as RFEdge<CanvasEdgeData>[], ghostNodes: [] as RFNode<CanvasNodeData>[] };
  }
  // ... existing inherited edges logic unchanged
}, [focused, breadcrumb, parentEdges, canvasId]);
```

- [ ] **Critical:** Update the ghost node `data` literal inside the inherited-edges block. After adding `canvasId` to `CanvasNodeData`, the ghost node construction (around line 58–72 of the original) must include `canvasId`:

```typescript
const ghostNode: RFNode<CanvasNodeData> = {
  // ... existing fields ...
  data: {
    node: { id: ghostId, type: 'ghost', displayName: ie.ghostEndpoint },
    nodeDef: undefined,
    isSelected: false,
    isRef: false,
    canvasId, // ← MUST ADD — uses the canvasId parameter
  },
  // ...
};
```

Without this, TypeScript will error because `canvasId` is required on `CanvasNodeData`.

- [ ] The `breadcrumb` and `parentEdges` selectors from `useNavigationStore` are still needed when `focused=true`. Keep them.

### Step 3: Update the caller in Canvas.tsx

- [ ] In `src/components/canvas/Canvas.tsx`, update the call:

```typescript
// Before:
const { nodes: storeNodes, edges } = useCanvasRenderer();

// After:
const currentCanvasId = useNavigationStore((s) => s.currentCanvasId);
const { nodes: storeNodes, edges } = useCanvasRenderer(currentCanvasId, true);
```

Add the `useNavigationStore` import if not already present (it is — line 29).

### Step 4: Update tests

- [ ] In `test/unit/components/canvas/useCanvasRenderer.test.ts`, update all `renderHook(() => useCanvasRenderer())` calls to pass the required params:

```typescript
// Before:
renderHook(() => useCanvasRenderer())

// After:
renderHook(() => useCanvasRenderer('__root__', true))
```

For any tests that test the inherited-edges behavior, keep `focused: true`. Add one new test:

```typescript
it('returns no inherited edges when focused is false', () => {
  // Setup with breadcrumb.length > 1 and parentEdges
  // ...
  const { result } = renderHook(() => useCanvasRenderer('child-canvas', false));
  // Should have no ghost nodes even though parent edges exist
  expect(result.current.nodes.every(n => !n.id.startsWith('__ghost__'))).toBe(true);
});
```

- [ ] Run: `npm run test:unit -- --run`
- [ ] Expected: ALL PASS

### Step 5: Commit

- [ ] `git add src/components/canvas/types.ts src/components/canvas/mapCanvasData.ts src/components/canvas/hooks/useCanvasRenderer.ts src/components/canvas/Canvas.tsx src/components/nodes/SubsystemPreview.tsx test/unit/components/canvas/useCanvasRenderer.test.ts`
- [ ] `git commit -m "refactor: parameterize useCanvasRenderer with canvasId and focused"`
