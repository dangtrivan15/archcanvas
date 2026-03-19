# Overlay Navigation — Task 2: SubsystemPreview Viewport Alignment Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Switch SubsystemPreview from ReactFlow's built-in `fitView` prop to `computeFitViewport` so preview and overlay use identical viewport math.

**Architecture:** Remove `fitView` prop, add an inner component that calls `useReactFlow().setViewport()` with values from `computeFitViewport`. Recompute on canvas data change and container resize.

**Tech Stack:** React, ReactFlow, Vitest

---

### Task 2.1: Write failing test for computeFitViewport usage

**Files:**
- Modify: `test/unit/components/SubsystemPreview.test.tsx`

- [ ] **Step 1: Read current test file for context**

Read: `test/unit/components/SubsystemPreview.test.tsx`
Read: `src/components/nodes/SubsystemPreview.tsx`

- [ ] **Step 2: Add test verifying computeFitViewport is used instead of fitView**

Add a new test to the existing describe block. The test verifies that the `<ReactFlow>` rendered by SubsystemPreview does NOT receive a `fitView` prop. **Do not assert on `setViewport` being called** — jsdom's `getBoundingClientRect()` always returns `{ width: 0, height: 0 }`, so the ViewportSetter's early-return guard will skip the call in tests. Instead, assert prop absence:

```ts
it('does not pass fitView prop to ReactFlow', () => {
  // Render SubsystemPreview with mock canvas data
  // Assert: the ReactFlow mock was called WITHOUT a fitView prop
  // (check the mock's received props via vi.fn() mock.calls)
});
```

The exact implementation depends on the existing mock setup in the test file — read it first (Step 1) and adapt.

- [ ] **Step 3: Run test to verify it fails**

Run: `npm run test:unit -- --reporter=verbose test/unit/components/SubsystemPreview.test.tsx`
Expected: New test FAIL (fitView prop is still present)

### Task 2.2: Modify SubsystemPreview to use computeFitViewport

**Files:**
- Modify: `src/components/nodes/SubsystemPreview.tsx`

- [ ] **Step 4: Remove fitView prop and add viewport setter inner component**

The key changes to `SubsystemPreview.tsx`:

1. Remove `fitView` prop from `<ReactFlow>`
2. Add a `ViewportSetter` inner component that:
   - Calls `useReactFlow()` to get the RF instance
   - Takes `nodes` as a prop (the rfNodes mapped from canvas data)
   - In a `useEffect`, reads its container dimensions and calls `computeFitViewport`, then `reactFlow.setViewport()`
   - Re-runs when nodes change

```tsx
import { computeFitViewport } from '@/lib/computeFitViewport';

function ViewportSetter({ nodes }: { nodes: readonly { position: { x: number; y: number }; width?: number | null; height?: number | null }[] }) {
  const reactFlow = useReactFlow();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current?.closest('.subsystem-preview');
    if (!el || nodes.length === 0) return;

    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    const fitNodes = nodes.map((n) => ({
      x: n.position.x,
      y: n.position.y,
      width: n.width ?? 150,
      height: n.height ?? 40,
    }));

    const vp = computeFitViewport({
      nodes: fitNodes,
      viewportWidth: rect.width,
      viewportHeight: rect.height,
    });

    reactFlow.setViewport({ x: vp.offsetX, y: vp.offsetY, zoom: vp.zoom });
  }, [nodes, reactFlow]);

  return <div ref={containerRef} style={{ display: 'none' }} />;
}
```

Then in the JSX, replace `fitView` with the `ViewportSetter`:

```tsx
<ReactFlow
  nodes={rfNodes}
  edges={rfEdges}
  nodeTypes={previewNodeTypes}
  edgeTypes={previewEdgeTypes}
  // fitView  ← REMOVED
  nodesDraggable={false}
  // ... other props unchanged
>
  <ViewportSetter nodes={rfNodes} />
</ReactFlow>
```

Also add `data-canvas-id={canvasId}` to the wrapper div for Task 3's element lookup:

```tsx
<div className="subsystem-preview" data-canvas-id={canvasId} style={{ width: '100%', flex: 1, minHeight: 0 }}>
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm run test:unit -- --reporter=verbose test/unit/components/SubsystemPreview.test.tsx`
Expected: All tests PASS

- [ ] **Step 6: Run typecheck**

Run: `npm run typecheck`
Expected: No errors

- [ ] **Step 7: Run full unit test suite to check for regressions**

Run: `npm run test:unit`
Expected: All tests PASS

- [ ] **Step 8: Commit**

```bash
git add src/components/nodes/SubsystemPreview.tsx test/unit/components/SubsystemPreview.test.tsx
git commit -m "feat: switch SubsystemPreview to computeFitViewport for pixel-perfect overlay matching"
```
