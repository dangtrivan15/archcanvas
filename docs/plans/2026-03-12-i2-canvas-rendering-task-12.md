# Task 12: Context Menus

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:writing-plans to plan
> the implementation steps for this task.

**Scope:** Right-click context menus for canvas, nodes, and edges
**Parent feature:** [I2 Canvas Rendering](./2026-03-12-i2-canvas-rendering-index.md)

## Write Set

- Create: `src/components/shared/ContextMenu.tsx` (~100 lines) — context menu component + handlers
- Modify: `src/components/canvas/Canvas.tsx` (~10 lines) — wire context menu events

## Read Set (context needed)

- `src/components/canvas/Canvas.tsx` — current state after Tasks 5, 8, 9
- `src/store/canvasStore.ts` — `deleteSelection`, `selectNodes` (Task 8)
- `src/store/graphStore.ts` — `removeEdge` (Task 4)
- `src/store/uiStore.ts` — `toggleRightPanel` (for "Edit Properties" action)
- `src/components/canvas/hooks/useCanvasNavigation.ts` — `diveIn` (Task 9)
- `src/types/schema.ts` — `Node`, `InlineNode`, `RefNode`
- `docs/specs/2026-03-12-i2-canvas-rendering-design.md` — Layer 9: Context Menus

## Dependencies

- **Blocked by:** Task 8 (canvasStore for deleteSelection), Task 9 (navigation for RefNode dive-in)
- **Blocks:** None

## Description

Right-click menus for three contexts. Menu state is **component-local** (React state) — not in a store, since only the ContextMenu component reads it.

### Three menu types

**Canvas context menu** (right-click empty space):
- Add Node... → opens command palette with `@` prefix (or placeholder until Task 14)
- Auto Layout → placeholder until Task 15
- Fit View → `reactFlow.fitView()`

**InlineNode context menu**:
- Edit Properties → open right panel, focus Properties tab
- Add Note → open right panel, focus Notes tab
- Delete → `canvasStore.deleteSelection()`

**RefNode context menu**:
- Dive In → `useCanvasNavigation.diveIn()`
- Delete → `canvasStore.deleteSelection()`

**Edge context menu**:
- Edit → open right panel with edge detail
- Delete → `graphStore.removeEdge()`

### Implementation approach

Single `<ContextMenu>` component that:
1. Renders an absolutely positioned menu at cursor location
2. Receives a `target` (canvas | node | edge) and `targetData` (the node/edge data)
3. Renders different menu items based on target type
4. Closes on click outside, menu item click, or Escape

Wire into Canvas.tsx via `onContextMenu` handler that determines the target and opens the menu.

### Acceptance Criteria

- Right-click on canvas/node/edge shows appropriate menu
- Menu items execute correct actions
- Menu closes after action or click-outside
- RefNode shows "Dive In" instead of "Edit Properties"
- `tsc --noEmit` passes
