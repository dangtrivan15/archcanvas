# Pointer-Based Drag-to-Canvas & Viewport-Center Placement

**Date:** 2026-03-24
**Status:** Approved

## Problem

Two issues prevent reliable node creation in the Tauri desktop app:

1. **HTML5 DnD broken in Tauri/WKWebView**: Tauri's native drag-drop handler intercepts drag events at the OS level before they reach JavaScript. `dragover`/`drop` never fire. The web version works because browsers handle HTML5 DnD natively.

2. **Default node position is off-screen**: When no drop position is provided (Command Palette, click-to-add, MCP tools), `createNodeFromType` uses an absolute stagger formula (`existingCount % 2 * 300`, `floor(existingCount / 2) * 200`) that places nodes far from the current viewport.

## Solution

### Fix 1: ReactFlow Instance Ref

Expose the ReactFlowInstance outside the React context via a module-level ref so any code can convert screen ↔ flow coordinates.

**New file: `src-web/lib/reactFlowRef.ts`**

```typescript
import type { ReactFlowInstance } from '@xyflow/react';

let instance: ReactFlowInstance | null = null;

export function setReactFlowInstance(rf: ReactFlowInstance) {
  instance = rf;
}

export function getReactFlowInstance(): ReactFlowInstance | null {
  return instance;
}
```

`Canvas.tsx` calls `setReactFlowInstance(reactFlow)` in a `useEffect`.

### Fix 2: Viewport-Center Default Position

Replace the absolute stagger formula in `createNodeFromType` with viewport-center placement plus a small random offset.

**Modified: `src-web/lib/createNodeFromType.ts`**

When `position` is not provided:
1. Get the ReactFlow instance from the ref
2. Get the canvas wrapper's bounding rect (via `document.querySelector('[data-testid="main-canvas"]')`)
3. Compute screen center of the canvas area
4. Convert screen center to flow coordinates via `screenToFlowPosition`
5. Add a small random offset (±30px) so rapid adds don't stack exactly
6. Fall back to `{ x: 0, y: 0 }` if the instance is unavailable (e.g., tests)

### Fix 3: Pointer-Based Drag-to-Canvas

Replace HTML5 DnD (`draggable`, `onDragStart`, `onDragOver`, `onDrop`) with pointer events.

**Architecture**: The overlay owns the entire drag lifecycle. Canvas has no drag-related code.

**State**: Module-level (no Zustand store needed — drag state is transient and single-consumer).

**New file: `src-web/lib/pointerDrag.ts`**

Module-level drag state and ghost element management:

```typescript
interface DragState {
  typeKey: string;
  ghost: HTMLElement;
  onMove: (e: PointerEvent) => void;
  onUp: (e: PointerEvent) => void;
}

let active: DragState | null = null;
```

Exported functions:
- `startDrag(typeKey: string, e: React.PointerEvent, icon?: string)` — creates ghost element, attaches global `pointermove`/`pointerup` listeners, calls `setPointerCapture` on the source element
- `cancelDrag()` — cleanup (for Escape key handling)

On `pointermove`: update ghost element position (`left`/`top` from `clientX`/`clientY`).

On `pointerup`:
1. Remove ghost element and global listeners
2. Use `document.elementFromPoint(clientX, clientY)` to check if the cursor is over an element inside `[data-testid="main-canvas"]`
3. If yes: get ReactFlowInstance from ref, convert `(clientX, clientY)` to flow position via `screenToFlowPosition`, get `canvasId` from `navigationStore`, call `createNodeFromType(canvasId, typeKey, position)`
4. If no: discard (drag ended outside the canvas)

**Modified: `src-web/components/layout/NodeTypeOverlay.tsx`**

- Remove `draggable` attribute and `onDragStart` handler
- Add `onPointerDown` handler that calls `startDrag(typeKey, e, iconName)`
- Keep `onClick` as-is (unchanged)
- CSS: keep `cursor-grab`/`active:cursor-grabbing` classes

**Modified: `src-web/components/canvas/Canvas.tsx`**

- Remove `handleDragOver`, `handleDrop` callbacks
- Remove `onDragOver`, `onDrop` props from the wrapper div
- Add `useEffect` calling `setReactFlowInstance(reactFlow)` on mount
- No other changes — the pointer drag doesn't need Canvas cooperation

### Ghost Element

A minimal floating div appended to `document.body`:
- Fixed positioning at cursor location
- Shows type icon + display name
- Semi-transparent, small (matches overlay item size)
- `pointer-events: none` so it doesn't interfere with `elementFromPoint`
- `z-index: 9999` to float above everything
- Cleaned up on `pointerup` or `pointercancel`

### Edge Cases

- **Escape during drag**: `cancelDrag()` on keydown listener (added/removed with drag lifecycle)
- **Pointer leaves window**: `pointerup` fires on release wherever the pointer is; if outside the canvas, drag is discarded
- **Scroll during drag**: ghost follows `clientX`/`clientY` which are viewport-relative — correct regardless of scroll
- **Touch devices**: pointer events unify mouse and touch — works on iPad (future)
- **Overlay closes during drag**: overlay pins on pointer down (same as current behavior with `onPin(true)`). Ghost is on `document.body`, independent of overlay lifecycle.

## Files Changed

| File | Change |
|------|--------|
| `src-web/lib/reactFlowRef.ts` | **New** — module-level ReactFlowInstance ref |
| `src-web/lib/pointerDrag.ts` | **New** — pointer drag state, ghost rendering, drop detection |
| `src-web/lib/createNodeFromType.ts` | **Modified** — viewport-center default position |
| `src-web/components/layout/NodeTypeOverlay.tsx` | **Modified** — `onPointerDown` replaces `draggable`/`onDragStart` |
| `src-web/components/canvas/Canvas.tsx` | **Modified** — remove DnD handlers, add `setReactFlowInstance` |
| `test/unit/lib/createNodeFromType.test.ts` | **Modified** — update for viewport-center logic |
| `test/unit/lib/pointerDrag.test.ts` | **New** — unit tests for pointer drag module |
| `test/e2e/node-type-overlay.spec.ts` | **Modified** — update drag test for pointer-based simulation |

## Testing

- **Unit**: `pointerDrag.ts` (start/move/drop/cancel lifecycle, ghost creation/cleanup, drop detection)
- **Unit**: `createNodeFromType.ts` (viewport-center fallback, random offset, graceful fallback when no instance)
- **E2E**: Update drag test to use `page.mouse.down()` / `page.mouse.move()` / `page.mouse.up()` instead of `dragTo()`
- **Manual**: Verify in Tauri desktop app on macOS

## Not In Scope

- Tauri native file drop from Finder (can be added later via JS `drop` event if needed)
- Custom drag preview images (the ghost is a simple styled div)
- Drag reordering within the overlay
