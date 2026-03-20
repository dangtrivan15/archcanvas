# Task 4: NodeRenderer — RefNodeSlot + Slot Registration

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Modify NodeRenderer to render RefNodeSlot instead of SubsystemPreview, register slots with canvasHostManager, and use canvasId from CanvasNodeData for resize handler.

**Files:**
- Modify: `src/components/nodes/NodeRenderer.tsx`
- Modify: `test/unit/components/nodes/NodeRenderer.test.tsx`

**Depends on:** Task 2 (canvasId in CanvasNodeData)

**Spec reference:** "`NodeRenderer` change" in Architecture > Data Flow and "Slot-Ref Registry" section.

---

### Step 1: Update NodeRenderer — replace SubsystemPreview with RefNodeSlot

- [ ] In `src/components/nodes/NodeRenderer.tsx`:

**Remove imports:**
```typescript
// DELETE these lines:
import { SubsystemPreview } from './SubsystemPreview';
import { PreviewModeContext } from './PreviewModeContext';
```

**Add import:**
```typescript
import { canvasHostManager } from '@/core/canvas/canvasHostManager';
```

**Remove the `isPreview` context read:**
```typescript
// DELETE:
const isPreview = useContext(PreviewModeContext);
```

**Replace the SubsystemPreview render with RefNodeSlot:**
```typescript
// REPLACE:
{isRef && !isPreview && <SubsystemPreview canvasId={node.id} />}

// WITH:
{isRef && (
  <div
    className="ref-node-slot"
    data-testid={`ref-node-slot-${node.id}`}
    ref={(el) => {
      if (el) {
        canvasHostManager.registerSlot(node.id, el);
      } else {
        canvasHostManager.unregisterSlot(node.id);
      }
    }}
    style={{ width: '100%', flex: 1, minHeight: 0 }}
  />
)}
```

**Replace `handleResize` to use `canvasId` from data prop instead of navigationStore:**
```typescript
// REPLACE:
const canvasId = useNavigationStore.getState().currentCanvasId;

// WITH:
const { canvasId } = data;
```

Remove the `useNavigationStore` import if no longer used elsewhere in the file. Check: `useNavigationStore` is currently only used in `handleResize` (line 35). Safe to remove.

### Step 2: Update NodeRenderer tests

- [ ] In `test/unit/components/nodes/NodeRenderer.test.tsx`:

**Remove SubsystemPreview mock** (if present). The test mocks ReactFlow Handle/Position but may not mock SubsystemPreview — check the file.

**Update test data** — the `makeProps` helper (or equivalent) that creates `CanvasNodeData` must include the new `canvasId` field:

```typescript
// In the helper that creates props, add:
canvasId: 'test-canvas',
```

**Add test for RefNodeSlot rendering:**
```typescript
it('renders a RefNodeSlot for RefNodes', () => {
  const props = makeRefNodeProps('auth-service'); // helper for ref-node data
  render(<NodeRenderer {...props} />);
  expect(screen.getByTestId('ref-node-slot-auth-service')).toBeDefined();
});
```

**Add test that no SubsystemPreview is rendered:**
```typescript
it('does not render SubsystemPreview', () => {
  const props = makeRefNodeProps('auth-service');
  render(<NodeRenderer {...props} />);
  expect(screen.queryByTestId('subsystem-preview')).toBeNull();
});
```

- [ ] Run: `npm run test:unit -- --run test/unit/components/nodes/NodeRenderer.test.tsx`
- [ ] Expected: PASS

### Step 3: Verify full unit test suite

- [ ] Run: `npm run test:unit -- --run`
- [ ] Expected: ALL PASS. Any test importing `PreviewModeContext` or `SubsystemPreview` should still pass because those files still exist (not deleted until Task 6). The SubsystemPreview test file tests SubsystemPreview directly, which still exists.

### Step 4: Commit

- [ ] `git add src/components/nodes/NodeRenderer.tsx test/unit/components/nodes/NodeRenderer.test.tsx`
- [ ] `git commit -m "refactor: NodeRenderer renders RefNodeSlot instead of SubsystemPreview"`
