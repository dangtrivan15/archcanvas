# Implementation Plan: Pointer-Based Drag & Viewport-Center Placement

**Spec:** `docs/specs/2026-03-24-pointer-drag-and-viewport-placement-design.md`
**Date:** 2026-03-24

## Task 1: ReactFlow Instance Ref

**New file:** `src-web/lib/reactFlowRef.ts`

Create module with `setReactFlowInstance` / `getReactFlowInstance` functions storing a module-level `ReactFlowInstance | null`.

**Modified:** `src-web/components/canvas/Canvas.tsx`

Add `useEffect` that calls `setReactFlowInstance(reactFlow)` after the `reactFlow` instance is available (line ~96 where `useReactFlow()` is called).

**Verify:** Import works, no circular deps.

---

## Task 2: Viewport-Center Default Position

**Modified:** `src-web/lib/createNodeFromType.ts`

Replace the stagger formula fallback:
1. Import `getReactFlowInstance` from `reactFlowRef`
2. When `position` is undefined:
   - Get canvas element via `document.querySelector('[data-testid="main-canvas"]')`
   - Compute screen center from its `getBoundingClientRect()`
   - Convert to flow coords via `instance.screenToFlowPosition()`
   - Add random offset: `x ± Math.random() * 60 - 30`, same for `y`
   - Fallback to `{ x: 0, y: 0 }` if instance or element unavailable

**Modified:** `test/unit/lib/createNodeFromType.test.ts`

Update existing tests for the new default position logic. Mock `getReactFlowInstance` and `document.querySelector`.

**Verify:** `npm run test -- createNodeFromType`

---

## Task 3: Pointer Drag Module

**New file:** `src-web/lib/pointerDrag.ts`

Implement:
- `DragState` interface: `{ typeKey, displayName, ghost, onMove, onUp, onKeyDown }`
- Module-level `active: DragState | null`
- `startDrag(typeKey, displayName, e: PointerEvent, iconHtml?: string)`:
  - Create ghost div, append to `document.body`
  - Set `pointer-events: none`, `position: fixed`, `z-index: 9999`
  - Style: semi-transparent, small label with icon
  - Attach `pointermove`, `pointerup`, `keydown` (Escape) listeners on `document`
  - Call `e.target.setPointerCapture(e.pointerId)` — no, actually DON'T capture because we need `elementFromPoint` to find the canvas. Instead just use global listeners.
- `onMove`: update ghost `left`/`top` from `clientX`/`clientY`
- `onUp`:
  - Remove ghost, remove listeners
  - `document.elementFromPoint(clientX, clientY)` → `.closest('[data-testid="main-canvas"]')`
  - If over canvas: get `ReactFlowInstance`, `screenToFlowPosition`, `createNodeFromType`
  - If not: discard
- `onKeyDown(Escape)`: call cleanup, discard
- `isDragging()`: returns `active !== null`
- `cancelDrag()`: cleanup if active

**New file:** `test/unit/lib/pointerDrag.test.ts`

Test:
- `startDrag` creates ghost element on body
- Ghost follows pointer position on move
- Drop over canvas element calls `createNodeFromType` with flow position
- Drop outside canvas discards
- Escape cancels drag and removes ghost
- Multiple rapid starts don't leak listeners/ghosts

**Verify:** `npm run test -- pointerDrag`

---

## Task 4: Wire Up NodeTypeOverlay

**Modified:** `src-web/components/layout/NodeTypeOverlay.tsx`

- Remove `import` of `createNodeFromType` (no longer needed here — `pointerDrag` handles it)
- Remove `handleDragStart` callback
- Remove `draggable` attribute from type item divs
- Add `onPointerDown` handler on each type item:
  ```tsx
  onPointerDown={(e) => {
    if (e.button !== 0) return; // left click only
    e.preventDefault(); // prevent text selection
    onPin(true);
    startDrag(typeKey, displayName, e.nativeEvent);
  }}
  ```
- Keep `onClick` handler (for simple click-to-add)
- Prevent click from firing after drag: in `onClick`, check `isDragging()` or track pointer movement distance

**Verify:** `npm run test -- NodeTypeOverlay`

---

## Task 5: Clean Up Canvas

**Modified:** `src-web/components/canvas/Canvas.tsx`

- Remove `handleDragOver` and `handleDrop` callbacks
- Remove `onDragOver={handleDragOver}` and `onDrop={handleDrop}` from the wrapper div
- Remove `createNodeFromType` import (no longer used here)
- The `setReactFlowInstance` useEffect was added in Task 1

**Verify:** `npm run test -- Canvas`

---

## Task 6: Update E2E Test

**Modified:** `test/e2e/node-type-overlay.spec.ts`

Update "drag type from overlay to canvas creates node at drop position" test:

Replace `serviceItem.dragTo(canvas, ...)` with manual pointer simulation:
```typescript
const box = await serviceItem.boundingBox();
const canvasBox = await canvas.boundingBox();
await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
await page.mouse.down();
await page.mouse.move(canvasBox.x + 400, canvasBox.y + 300, { steps: 5 });
await page.mouse.up();
```

**Verify:** `npm run test:e2e-no-bridge -- --grep "drag type"`

---

## Task 7: Full Test Suite

Run complete test suites to verify no regressions:
- `npm run test` (all unit tests)
- `npm run test:e2e-no-bridge` (all E2E tests)

---

## Build Order

Tasks 1 → 2 → 3 → 4+5 (parallel) → 6 → 7
