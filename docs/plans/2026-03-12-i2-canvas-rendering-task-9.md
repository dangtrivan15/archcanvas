# Task 9: Navigation — navigationStore + Breadcrumb + Animation

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:writing-plans to plan
> the implementation steps for this task.

**Scope:** Canvas navigation (dive-in / go-up)
**Parent feature:** [I2 Canvas Rendering](./2026-03-12-i2-canvas-rendering-index.md)

## Write Set

- Create: `src/store/navigationStore.ts` (~80 lines)
- Create: `src/components/shared/Breadcrumb.tsx` (~60 lines)
- Create: `src/components/canvas/hooks/useCanvasNavigation.ts` (~50 lines) — dive animation
- Modify: `src/components/canvas/Canvas.tsx` (~10 lines) — add Breadcrumb overlay, wire navigation
- Test: Create `test/unit/store/navigationStore.test.ts`

## Read Set (context needed)

- `src/store/fileStore.ts` — `getCanvas` (resolve refNodeId → canvasId, resolve displayName)
- `src/storage/fileResolver.ts` — `ROOT_CANVAS_KEY`
- `src/components/canvas/Canvas.tsx` — current state after Tasks 5 and 8
- `src/components/canvas/hooks/useCanvasInteractions.ts` — `onNodeClick` needs to call diveIn for RefNodes
- `src/components/canvas/hooks/useCanvasRenderer.ts` — reads `navigationStore.currentCanvasId`
- `src/types/schema.ts` — `RefNode`, `Position`
- `docs/specs/2026-03-12-i2-canvas-rendering-design.md` — Layer 3: Navigation, animation section

## Dependencies

- **Blocked by:** Task 8 (Canvas.tsx modified, useCanvasInteractions exists for onNodeClick wiring)
- **Blocks:** Task 12 (context menus: RefNode "Dive In"), Task 14 (command palette ScopeProvider needs navigateTo)

## Description

### navigationStore

```typescript
interface NavigationStoreState {
  currentCanvasId: string;          // ROOT_CANVAS_KEY initially
  breadcrumb: Array<{ canvasId: string; displayName: string }>;

  diveIn(refNodeId: string): void;
  goUp(): void;
  goToRoot(): void;
  goToBreadcrumb(index: number): void;
  navigateTo(canvasId: string): void;
}
```

**diveIn resolution**: Looks up the RefNode in the current canvas via `fileStore.getCanvas(currentCanvasId)`, finds the node with matching `id`, reads `.ref` → that's the target canvasId. Breadcrumb displayName resolved from `fileStore.getCanvas(targetCanvasId)?.data.displayName ?? refNode.ref`. No-op if target canvas doesn't exist.

**navigateTo vs diveIn**: `diveIn` resolves through a RefNode (click handler). `navigateTo` jumps directly by canvasId (ScopeProvider, breadcrumb). Both update `currentCanvasId` and rebuild `breadcrumb`.

### useCanvasNavigation hook

Coordinates viewport animation with navigationStore state changes:

**Dive-in (300ms):**
1. Add CSS class to trigger fade-out on current nodes
2. `reactFlow.setViewport({ x: -pos.x * 2, y: -pos.y * 2, zoom: 2 }, { duration: 300 })`
3. After data swap: incoming nodes fade in via CSS entrance transition

**Go-up (300ms):** Inverse animation — zoom out, child nodes shrink, parent nodes fade in.

Uses `useReactFlow()` for viewport control.

### Breadcrumb component

- Absolute positioned at top-left of canvas, semi-transparent background
- Renders: `Root > Segment > Segment > Current`
- Each segment clickable except the last (current scope)
- Click calls `navigationStore.goToBreadcrumb(index)`

### Canvas.tsx changes

- Render `<Breadcrumb>` as an overlay inside the canvas container
- Wire `useCanvasNavigation` hook

### Update useCanvasInteractions

Wire `onNodeClick` for RefNodes: instead of selecting, call `useCanvasNavigation.diveIn(refNodeId, position)`.

### Update useCanvasRenderer

Change the hardcoded `ROOT_CANVAS_KEY` to read from `navigationStore.currentCanvasId`.

### Tests

- `diveIn` resolves RefNode → updates currentCanvasId and pushes breadcrumb
- `diveIn` with non-existent ref is a no-op
- `goUp` pops breadcrumb and restores parent canvasId
- `goUp` at root is a no-op
- `goToRoot` clears breadcrumb, sets ROOT_CANVAS_KEY
- `goToBreadcrumb(index)` truncates to that index
- `navigateTo` jumps directly and rebuilds breadcrumb
- Breadcrumb displayName resolved from fileStore

### Acceptance Criteria

- Dive-in/go-up state transitions work correctly
- Breadcrumb renders and is clickable
- Animation on viewport transitions (300ms)
- RefNode click → dive in (not select)
- useCanvasRenderer reacts to canvas switches
- `tsc --noEmit` passes
