# Subsystem Enhancements: Resizable Containers, Structure Preview, Navigation Animation

**Date:** 2026-03-18
**Status:** Draft

## Problem

Subsystem RefNodes currently render as small, opaque dashed rectangles — indistinguishable from regular nodes at a glance. Users cannot see what's inside a subsystem without navigating into it, and the navigation transition (a simple zoom + swap) provides no spatial continuity between parent and child canvases.

## Goals

1. **Resizable container nodes** — RefNodes should be larger by default, visually distinct as containers, and resizable via drag handles.
2. **Reactive structure preview** — Show a miniature node map of the subsystem's internal structure inside the container, updating as content changes.
3. **Morphing navigation animation** — Diving into a subsystem should expand the container's mini-nodes into full-sized nodes with smooth spatial continuity.

## Non-goals

- Interaction with mini-nodes in the preview (clicking, selecting, editing)
- Nested ReactFlow instances for preview rendering
- Animation library dependencies (Framer Motion, React Spring)
- Theme-aware mini-node colors (colors use a deterministic hash, not palette CSS variables — acceptable for v1)

---

## Design

### 1. Schema Changes

**`Position` schema (`src/types/schema.ts`):**

```ts
export const Position = z.object({
  x: z.number(),
  y: z.number(),
  width: z.number().optional(),
  height: z.number().optional(),
  autoSize: z.boolean().optional(), // NEW — default true for RefNodes
});
```

- `autoSize` unset or `true`: container auto-sizes to fit child content (clamped to min 180×120, max 400×300).
- `autoSize: false`: user has manually resized; `width`/`height` are authoritative.
- Context menu "Fit to content" resets to `autoSize: true` and clears `width`/`height`.
- No changes to `RefNode` or `InlineNode` schemas.

### 2. Container Rendering

**NodeRenderer changes (`src/components/nodes/NodeRenderer.tsx`):**

When `isRef` is true, the node switches to container mode:

- CSS class: `node-shape-container ref-node` (container shape already exists in `nodeShapes.css`, currently unused by RefNodes).
- Renders `<NodeResizer>` from `@xyflow/react` (already bundled in v12.10.1), conditionally for RefNodes only.
- Renders `<SubsystemPreview>` below the header.

Conceptual structure:

```tsx
<div className="arch-node node-shape-container ref-node">
  <NodeResizer
    minWidth={180}
    minHeight={120}
    isVisible={isSelected}
    onResizeEnd={handleResize}
  />
  <Handle type="target" ... />
  <div className="arch-node-header">↗ Order Service</div>
  <SubsystemPreview canvasId={node.id} />
  <Handle type="source" ... />
</div>
```

**`NodeResizer` integration requirements:**

- `isVisible` must be gated on `isSelected` — resize handles only appear when the node is selected (standard ReactFlow UX convention).
- The RFNode built in `useCanvasRenderer.ts` must have `width` and `height` as **top-level fields** on the RFNode object (not nested in `data`). ReactFlow uses these to measure and lay out the node. Without them, `NodeResizer` produces a zero-size node.
- On resize end, the handler commits the new dimensions to the engine via `updateNodePosition`.

**Resize handler (`handleResize`):**

`handleResize` reads `canvasId` from `useNavigationStore.getState().currentCanvasId` (established pattern — same as `Canvas.tsx:53` for position updates). It calls `graphStore.updateNodePosition(canvasId, nodeId, { ...existingPosition, width, height, autoSize: false })`.

**No separate `updateNodeSize` action.** The existing `updateNodePosition` already accepts a full `Position` object including `width`/`height`, and the spec adds `autoSize` to `Position`. Creating a separate action would duplicate engine surface area. The resize handler simply calls `updateNodePosition` with the extended position fields.

**CSS changes (`nodeShapes.css`):**

The `.ref-node` class gains container-specific overrides:

- Remove `min-width: 120px; min-height: 52px` for RefNodes (container shape already has `min-width: 180px; min-height: 80px`).
- The container shape's existing double-border (border + outline) provides visual distinction.

### 3. SubsystemPreview Component

**New file: `src/components/nodes/SubsystemPreview.tsx` (~80–100 lines)**

A lightweight, non-interactive SVG component that renders a miniature node map.

**Props:**

```ts
interface SubsystemPreviewProps {
  canvasId: string;
}
```

**Behavior:**

- Reads child canvas data reactively (see Reactivity Model below).
- Computes a bounding box from child node positions.
- Scales all coordinates to fit the SVG viewport with padding.
- Renders:
  - `<rect>` per child node — rounded corners, fill colored by node type (deterministic hash-to-hue).
  - `<text>` per child node — truncated `displayName`, ~7–8px scaled font.
  - `<line>` per child edge — thin stroke from source center to target center.
- `pointer-events: none` on the SVG root — fully non-interactive.
- Empty state: renders nothing when the child canvas has no nodes.

**Reactivity model:**

`useFileStore(s => s.getCanvas(canvasId))` returns a `LoadedCanvas` from a `Map`. Zustand only triggers re-renders when the selected slice changes by reference. If `fileStore` mutates the `Map` in-place, the selector will never fire.

The correct subscription pattern is:

```ts
// Subscribe to the canvases version counter (bumped on any canvas mutation)
const childCanvas = useFileStore((s) => {
  // Touch the version to subscribe to changes
  void s.canvasVersion;
  return s.getCanvas(canvasId);
});
```

If `fileStore` does not currently expose a `canvasVersion` counter, one must be added: a simple integer incremented in `updateCanvasData`, `registerCanvas`, and `markDirty`. This is the lightest mechanism to make canvas map reads reactive without replacing the entire `Map` reference on every mutation.

**Alternative:** If `fileStore` already replaces the `Map` reference on mutations (via `set({...})` spreading), then `useFileStore(s => s.getCanvas(canvasId))` works directly. The implementation must verify which pattern `fileStore` uses and choose accordingly.

**Color mapping:**

A pure function `typeToColor(type: string): string` in `src/lib/typeToColor.ts` that returns an HSL color. Uses a deterministic hash of the type string to pick a hue, with fixed saturation/lightness. Colors are not theme-aware (acceptable for v1 — called out in Non-goals). Produces consistent colors across renders without requiring a palette registry.

### 4. Auto-fit Sizing

**New utility: `src/lib/computeAutoSize.ts`**

Pure function extracted for testability (follows project convention: `deriveId.ts`, `addNodeValidation.ts`).

```ts
export function computeAutoSize(
  childCanvas: LoadedCanvas | undefined
): { width: number; height: number }
```

Reads child node positions, computes bounding box, adds padding for header (~32px) + margins (~24px per side). Returns `{ width, height }`.

**In `useCanvasRenderer.ts`:**

When building RFNodes for RefNodes, compute dimensions:

```ts
if (isRef) {
  const childCanvas = fileStore.getCanvas(node.id);
  const pos = node.position ?? { x: 0, y: 0 };

  if (pos.autoSize !== false) {
    const { width, height } = computeAutoSize(childCanvas);
    rfNode.width = clamp(width, 180, 400);
    rfNode.height = clamp(height, 120, 300);
  } else {
    rfNode.width = pos.width ?? 240;
    rfNode.height = pos.height ?? 160;
  }
}
```

**Dependency tracking:** The existing `useMemo` for node building depends on `[canvas, resolve, selectedNodeIds]`. Child canvas changes do not appear in this dependency array. To make auto-fit sizing reactive, the memo must also depend on child canvas data. The approach:

- Subscribe to `canvasVersion` (same counter as SubsystemPreview) as an additional `useMemo` dependency.
- This causes the memo to re-run when any canvas changes, which recomputes auto-fit sizes for all RefNodes on the current canvas.
- This is acceptable because the computation is cheap (bounding box math per RefNode) and RefNode count per canvas is typically small (<20).

### 5. Navigation Morph Animation

#### New component: `NavigationTransition`

**New file: `src/components/canvas/NavigationTransition.tsx` (~150–200 lines)**

A `position: fixed` overlay that renders during dive-in/go-up transitions. Uses `position: fixed` (not `absolute`) so that `getBoundingClientRect` values map directly to CSS `left`/`top` without needing to account for the Canvas wrapper's offset within the app layout (sidebar, header, etc.).

Sits as a sibling of `<ReactFlow>` inside the Canvas wrapper div.

#### Dive-in flow (expand morph)

**Phase 1 — Capture (0ms):**

Before switching canvas:

- Set `isTransitioning = true` immediately. This flag must be checked by `useCanvasKeyboard` to suppress all keyboard shortcuts and by `onNodesChange`/`onConnect` to block edits during the transition.
- Read the subsystem container's screen rect (`getBoundingClientRect` on the ReactFlow node DOM element).
- Read mini-node positions from the `SubsystemPreview` SVG, converted to screen coordinates.
- Read sibling node positions (all other visible ReactFlow nodes).
- Parent edge positions.

**Phase 2 — Animate (~600–700ms, `cubic-bezier(0.25, 0.1, 0.25, 1)`):**

Mount the overlay with:

- Sibling nodes at their screen positions → animate `opacity: 0` (fade out).
- Container border at its screen rect → animate to viewport bounds, then fade.
- Mini-nodes at their screen positions → animate to target full-size positions. Target positions computed from child canvas node data, scaled to fill the viewport.
- Labels grow from truncated (7px) to full (12px), colors intensify.
- Edges: SVG `<line>` elements whose endpoints are recomputed each frame via `requestAnimationFrame`, tracking the animated node positions (see Edge Interpolation below). This prevents edges from lagging behind nodes.

**Phase 3 — Swap (on `transitionend`):**

- Call `navigationStore.diveIn(refNodeId)` to switch the canvas. Note: `diveIn()` calls `historyStore.clear()` and `canvasStore.clearHighlight()` synchronously — this is safe because `isTransitioning` blocked all user actions since Phase 1, so no undo entries exist to lose.
- ReactFlow renders the child canvas underneath the overlay.
- `reactFlow.fitView({ duration: 0 })` to align with overlay positions.
- Remove overlay → seamless handoff.
- Set `isTransitioning = false`.

#### Go-up flow

**One-level up: reverse morph.**

1. Set `isTransitioning = true`.
2. Capture current full-node positions.
3. Mount overlay with full-sized nodes.
4. Determine the target RefNode in the parent canvas. **Key architectural detail:** the canvas map is keyed by `node.id`, so `currentCanvasId` equals the RefNode's ID in the parent. The breadcrumb entry's `canvasId` is the RefNode ID — no additional lookup needed.
5. Switch to parent canvas (hidden behind overlay) via `navigationStore.goUp()`.
6. Read the parent canvas to find the RefNode's position (screen rect of the container where nodes must shrink back to).
7. Animate: nodes shrink to mini positions within the container rect, container border appears and collapses, siblings fade in.
8. Remove overlay. Set `isTransitioning = false`.

**Multi-level breadcrumb jump: dissolve.**

1. Set `isTransitioning = true`.
2. Mount overlay as a snapshot of the current canvas (clone current viewport or capture element).
3. Switch canvas via `navigationStore.goToBreadcrumb(index)`.
4. Fade overlay out over ~300ms.
5. Remove overlay. Set `isTransitioning = false`.

#### New hook: `useNavigationTransition`

**New file: `src/components/canvas/hooks/useNavigationTransition.ts`**

Replaces `useCanvasNavigation`. Manages:

- `isTransitioning: boolean` — locks interaction during animation. Must be readable by `useCanvasKeyboard` and `Canvas.tsx` event handlers.
- `transitionData` — captured positions, target positions, direction (in/out/dissolve).
- `diveIn(refNodeId)` — triggers capture → animate → swap.
- `goUp()` — reverse morph for one level, dissolve for deeper.
- `goToBreadcrumb(index)` — dissolve.

**Breadcrumb wiring:** `Breadcrumb.tsx` currently calls `navigationStore.goToBreadcrumb()` directly (it does not use `useCanvasNavigation`). To wire the transition-aware navigation, `Breadcrumb` will dispatch custom events via the `archcanvas:*` event bus (established pattern in the codebase — see `Canvas.tsx:127–143`):

- `archcanvas:navigate-up` — fired by Breadcrumb, handled by `useNavigationTransition` in Canvas.
- `archcanvas:navigate-to-breadcrumb` with `detail: { index }` — fired by Breadcrumb, handled by `useNavigationTransition`.

This avoids prop drilling or adding a React context. Follows the existing event bus pattern used for `archcanvas:fit-view`, `archcanvas:auto-layout`, and `archcanvas:open-palette`.

#### Edge interpolation

During the morph, a `requestAnimationFrame` loop runs alongside CSS transitions:

```ts
function updateEdges() {
  for (const edge of transitionEdges) {
    const sourceRect = sourceNodeEl.getBoundingClientRect();
    const targetRect = targetNodeEl.getBoundingClientRect();
    edgeLine.setAttribute('x1', String(sourceRect.x + sourceRect.width / 2));
    edgeLine.setAttribute('y1', String(sourceRect.y + sourceRect.height / 2));
    edgeLine.setAttribute('x2', String(targetRect.x + targetRect.width / 2));
    edgeLine.setAttribute('y2', String(targetRect.y + targetRect.height / 2));
  }
  if (stillAnimating) requestAnimationFrame(updateEdges);
}
```

This ensures edges track node positions every frame rather than transitioning independently.

#### Escape key

Pressing Escape during a transition cancels the animation and snaps to the final state immediately (skip to Phase 3).

### 6. Context Menu Changes

**New item for RefNodes (when `autoSize` is `false`):**

- **"Fit to content"** — Calls `graphStore.updateNodePosition(canvasId, nodeId, { ...existingPosition, autoSize: true, width: undefined, height: undefined })`.

The `autoSize` state is accessible via `nodeData.node` in the `ContextMenuTarget` — `CanvasNodeData.node` is a `Node` union, and for RefNodes, `node.position?.autoSize` provides the current value. No changes to `ContextMenuTarget` types needed.

No menu item needed for "resize manually" — drag handles provide this directly and auto-switch to manual mode.

---

## Files Changed

| File | Change |
|------|--------|
| `src/types/schema.ts` | Add `autoSize` to `Position` |
| `src/components/nodes/NodeRenderer.tsx` | Container mode for RefNodes, mount `NodeResizer` + `SubsystemPreview` |
| `src/components/nodes/SubsystemPreview.tsx` | **New** — SVG mini-node map |
| `src/components/nodes/nodeShapes.css` | Adjust ref-node to use container shape |
| `src/components/canvas/hooks/useCanvasRenderer.ts` | Auto-fit size computation for RefNodes, `canvasVersion` dependency |
| `src/store/fileStore.ts` | Add `canvasVersion` counter (if needed for reactivity) |
| `src/components/canvas/NavigationTransition.tsx` | **New** — morph animation overlay (`position: fixed`) |
| `src/components/canvas/hooks/useNavigationTransition.ts` | **New** — replaces `useCanvasNavigation` |
| `src/components/canvas/hooks/useCanvasNavigation.ts` | **Removed** — replaced by `useNavigationTransition`. Import at `Canvas.tsx:7` and destructuring at `Canvas.tsx:32` must be updated atomically. |
| `src/components/canvas/Canvas.tsx` | Mount `NavigationTransition`, use new hook, add `archcanvas:navigate-*` event listeners |
| `src/components/shared/Breadcrumb.tsx` | Dispatch `archcanvas:navigate-up` and `archcanvas:navigate-to-breadcrumb` events |
| `src/components/shared/ContextMenu.tsx` | Add "Fit to content" item for RefNodes |
| `src/lib/computeAutoSize.ts` | **New** — pure function for bounding box computation |
| `src/lib/typeToColor.ts` | **New** — deterministic type-to-HSL mapping |

## Testing Strategy

**Unit tests:**

- `Position` schema: `autoSize` field parsing, defaults, round-trip
- `SubsystemPreview`: renders correct number of rects/lines for given canvas data
- `computeAutoSize`: bounding box computation, clamping behavior, empty canvas, single node
- `typeToColor`: deterministic, consistent output, different types produce different colors
- `updateNodePosition` with size fields: produces correct patches including `width`/`height`/`autoSize`, undo/redo works

**E2E tests:**

- Create subsystem → verify container appearance (larger, dashed border, preview visible)
- Add nodes to subsystem → verify preview updates reactively
- Resize subsystem container via drag → verify manual size persists after save/reload
- Context menu "Fit to content" → verify auto-size restores
- Double-click subsystem → verify morph animation completes and child canvas renders
- Breadcrumb go-up → verify reverse morph (one level) and dissolve (multi-level)
