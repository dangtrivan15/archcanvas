# Mini Viewport Subsystem Preview — Design Spec

> **Date**: 2026-03-18 | **Status**: Draft
> **Scope**: Replace SVG-based SubsystemPreview with a non-interactive mini ReactFlow instance; fix two-phase zoom in navigation transitions; clean up dead code.

## Problem

Two issues with the current subsystem navigation UX:

1. **Visual mismatch**: SubsystemPreview renders nodes as uniform 44×16px rectangles with HSL-hashed colors (`typeToColor`), 7px text, and no icons. The actual canvas uses ReactFlow with variable shapes (cylinder, hexagon, etc.), CSS variable theming, Lucide icons, and 12px text. The preview looks like a separate system, not a miniature of the real canvas.

2. **Two-phase zoom**: When diving in, the transition morphs nodes to their absolute canvas positions. But the canvas content typically occupies only a portion of the viewport, so after the morph overlay fades, ReactFlow's `fitView` kicks in as a second visible zoom step — jarring.

Both problems stem from the same root cause: SubsystemPreview is an independent rendering system with its own coordinate space, shapes, and colors.

## Solution

### 1. Mini ReactFlow Instance

Replace the SVG-based SubsystemPreview with a non-interactive `<ReactFlow>` instance embedded inside each container RefNode.

**What it does:**
- Renders the subsystem's child nodes and edges using the same `NodeRenderer`, `EdgeRenderer`, and `nodeShapes.css` as the full canvas
- Uses `fitView` to auto-scale content to fit within the container bounds
- Disables all interactivity: `nodesDraggable={false}`, `nodesConnectable={false}`, `elementsSelectable={false}`, `panOnDrag={false}`, `zoomOnScroll={false}`, `zoomOnPinch={false}`, `zoomOnDoubleClick={false}`, `preventScrolling={true}`, `nodesFocusable={false}`

**ReactFlowProvider isolation:** Each mini `<ReactFlow>` must be wrapped in its own `<ReactFlowProvider>`. ReactFlow v12 requires each instance to have its own provider — without this, the mini instance would share the parent canvas's internal store, causing viewport state conflicts and broken rendering. The `SubsystemPreview` component owns this wrapper.

**Recursion guard:** Nested RefNodes inside the mini ReactFlow must NOT render their own SubsystemPreview (that would cause recursive ReactFlow instances). A `PreviewModeContext` (React context, default `false`) is set to `true` by the `SubsystemPreview` wrapper. `NodeRenderer` checks this context and skips rendering `<SubsystemPreview>` when in preview mode. This is cleaner than a prop — it avoids leaking preview concerns into `CanvasNodeData`.

**Reactivity:** Same subscription pattern as current SubsystemPreview — touches `s.project?.canvases` Map ref for Zustand reactivity. When child canvas content changes, the mini ReactFlow re-renders.

**Inherited edges exclusion:** The mini ReactFlow renders only the canvas's own nodes and edges — NOT inherited edges or ghost nodes. Those belong to the parent scope's navigation context. The shared node/edge mapping function (extracted from `useCanvasRenderer`) returns only own-canvas data.

### 2. Viewport-Aware Transition

Fix the morph animation to land directly at the fitted viewport, eliminating the two-phase zoom.

**Dive-in flow (new):**
1. Capture source node screen rects from the mini ReactFlow (now `.react-flow__node` elements — same as full canvas)
2. Mount overlay with source clones at captured positions (opaque backdrop)
3. Switch canvas behind overlay via `navigationStore.diveIn()`
4. Compute fitted viewport from target node data (using `reactFlow.getNodes()` for measured dimensions) → zoom factor → center offset → per-node screen positions
5. Call `reactFlow.setViewport({ x, y, zoom })` instantly (while overlay is still opaque) so the canvas behind matches
6. Set target clones at the computed fitted screen positions
7. Phase advance: morph source → target, backdrop fades
8. Overlay removed — canvas is already at the correct viewport

**Go-up flow (new):**
Same logic in reverse. Source rects captured from full canvas. Target rects captured from the parent's mini ReactFlow (which is now also `.react-flow__node` elements). `setViewport()` positions the parent canvas while overlay is opaque.

**Dissolve flow:** Unchanged — breadcrumb jumps use a cross-fade, no node morphing.

**Key insight:** Since both mini-canvas and full canvas use the same DOM structure (`.react-flow__node` with `.arch-node-header-name`), the existing `captureVisibleNodes()` function works for both source and target capture. The dedicated `captureMiniNodes()` function (which read SVG `<rect>` elements) is no longer needed.

**`finalize` simplification:** After transition completes, `finalize` only clears state (`setTransitionData(null)`, `setIsTransitioning(false)`, `transitioningRef.current = false`). No `fitView` call — the viewport was already set during the opaque overlay phase.

### 3. fitView Computation

To compute where nodes will appear after fitView without waiting for ReactFlow to render:

```
contentBBox = boundingBox(allNodePositions, accounting for node width/height)
zoom = min(viewportW / contentBBoxW, viewportH / contentBBoxH) * (1 - padding)
zoom = clamp(zoom, minZoom, maxZoom)
offsetX = (viewportW - contentBBoxW * zoom) / 2 - contentBBox.minX * zoom
offsetY = (viewportH - contentBBoxH * zoom) / 2 - contentBBox.minY * zoom
```

Each node's fitted screen position:
```
screenX = node.x * zoom + offsetX
screenY = node.y * zoom + offsetY
screenW = node.width * zoom
screenH = node.height * zoom
```

**Node dimensions source:** Inline nodes (non-RefNodes) don't store explicit width/height in the data model — their dimensions come from DOM measurement. For `computeFitViewport`, we use `reactFlow.getNodes()` which returns ReactFlow's internal node objects with measured `width`/`height` (populated after first render). For the pre-render case (target canvas just mounted), we wait one `requestAnimationFrame` for ReactFlow to measure, then read from `getNodes()`.

This is extracted into a pure utility function (`computeFitViewport`) that both the transition hook and tests can use.

## Code Changes

### Files to Delete
| File | Reason |
|------|--------|
| `src/lib/typeToColor.ts` | Only consumer was SubsystemPreview SVG rendering. The SVG `fill` attributes set by `typeToColor` were also read back by `captureMiniNodes` as `CapturedNode.color` — both are removed together. |
| `test/unit/lib/typeToColor.test.ts` | Tests for deleted utility |

### Files to Rewrite
| File | Change |
|------|--------|
| `src/components/nodes/SubsystemPreview.tsx` | SVG → non-interactive mini ReactFlow with own `ReactFlowProvider`, `PreviewModeContext` provider |
| `test/unit/components/SubsystemPreview.test.tsx` | Test mini ReactFlow rendering instead of SVG elements |

### Files to Modify
| File | Change |
|------|--------|
| `src/components/nodes/NodeRenderer.tsx` | Check `PreviewModeContext` to conditionally skip SubsystemPreview for RefNodes in mini-canvas mode |
| `src/components/canvas/hooks/useNavigationTransition.ts` | Remove `captureMiniNodes()`, add `computeFitViewport()` usage, replace `fitView` in `finalize` with early `setViewport()`, scope `captureVisibleNodes` to specific ReactFlow container |
| `src/components/canvas/NavigationTransition.tsx` | Remove font-size morphing (7→12px), remove `color-mix` hacks — both sides now use same rendering |
| `src/components/canvas/hooks/useCanvasRenderer.ts` | Extract node/edge mapping into shared function reusable by mini-canvas (own-canvas data only, no inherited edges) |

### Files to Create
| File | Purpose |
|------|---------|
| `src/lib/computeFitViewport.ts` | Pure utility: node positions + viewport dims → `{ zoom, offsetX, offsetY }` + per-node screen rects |
| `test/unit/lib/computeFitViewport.test.ts` | Unit tests for viewport computation |

### Files Unchanged
| File | Reason |
|------|--------|
| `src/lib/computeAutoSize.ts` | Still used by `useCanvasRenderer` for container RefNode sizing. Note: its fixed `NODE_WIDTH=60, NODE_HEIGHT=30` estimates may cause container sizing to be slightly off now that real ReactFlow nodes render inside — but `fitView` in the mini ReactFlow auto-scales regardless. Can be improved separately. |
| `src/components/edges/EdgeRenderer.tsx` | Reused as-is in mini ReactFlow |
| `src/components/nodes/nodeShapes.css` | Reused as-is in mini ReactFlow |
| Dissolve transition logic | No node morphing involved |

## Scoping the Mini ReactFlow Capture

When `captureVisibleNodes()` queries `.react-flow__node`, it must distinguish between the main canvas and mini ReactFlow instances inside container nodes.

**Approach: Scoped DOM query.** `captureVisibleNodes` accepts an optional `container` element to scope the query. For the main canvas, pass the main `.react-flow` wrapper (available via ref in `Canvas`). For mini-canvases during transition capture, use a targeted DOM query: `document.querySelector('[data-id="<refNodeId>"] .react-flow')` to find the mini ReactFlow inside a specific container node.

**Wiring for each direction:**
- **Dive-in:** Source capture needs the mini ReactFlow inside the RefNode being dived into. The hook knows the `refNodeId`, so: `document.querySelector('[data-id="${refNodeId}"] .react-flow')`.
- **Go-up:** Target capture needs the mini ReactFlow inside the parent canvas's RefNode. After `nav.goUp()` and one rAF (parent renders), the hook queries `document.querySelector('[data-id="${fromCanvasId}"] .react-flow')` — `fromCanvasId` is the child canvas ID, which equals the RefNode ID in the parent.

**`useReactFlow()` scope:** The `useNavigationTransition` hook calls `useReactFlow()` within `Canvas`, which is a child of the app-level `ReactFlowProvider`. Each mini ReactFlow has its own provider, so `useReactFlow()` in the hook always resolves to the main canvas instance. This is correct and should be documented as an invariant.

## Performance Considerations

Each visible subsystem container spawns a non-interactive ReactFlow instance. For typical architecture diagrams (5–15 subsystems visible), this is expected to be fine — ReactFlow with interactions disabled is lightweight. If performance becomes an issue with many visible subsystems:

- **Lazy mounting**: Only render mini ReactFlow when the container is in the viewport (IntersectionObserver)
- **Fallback**: Swap to a simpler preview at a threshold (e.g., >20 visible containers)
- **Virtualization**: ReactFlow already virtualizes nodes outside the viewport

These are future optimizations — not in scope for this change. The modular design (SubsystemPreview as a swappable component) means any of these can be added without touching the rest of the system.

## Testing Strategy

- **Unit tests**: `computeFitViewport` pure function (bounding box, zoom clamping, offset centering)
- **Component tests**: SubsystemPreview renders a ReactFlow instance with correct nodes/edges, respects recursion guard (`PreviewModeContext`)
- **E2E tests**: Existing subsystem navigation tests (`test/e2e/subsystem.spec.ts`) should pass with visual consistency — no shape/color mismatch between preview and canvas
- **E2E viewport stability**: Add a focused test that captures viewport state after morph transition completes and asserts it does not change within 500ms (verifies no second zoom step)
