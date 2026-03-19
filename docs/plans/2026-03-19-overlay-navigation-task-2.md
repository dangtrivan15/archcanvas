# Task 2: SubsystemPreview Viewport Alignment

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:writing-plans to plan
> the implementation steps for this task.

**Scope:** Switch SubsystemPreview from ReactFlow's `fitView` to `computeFitViewport`
**Parent feature:** [./2026-03-19-overlay-navigation-index.md](2026-03-19-overlay-navigation-index.md)
**Spec:** [docs/specs/2026-03-19-overlay-navigation-design.md](../specs/2026-03-19-overlay-navigation-design.md#pixel-perfect-matching)

## Write Set

- Modify: `src/components/nodes/SubsystemPreview.tsx` (~30 lines changed)
- Modify: `test/unit/components/SubsystemPreview.test.tsx` (test, unlimited)

## Read Set (context needed)

- `src/components/nodes/SubsystemPreview.tsx` — current implementation using `fitView` prop
- `src/lib/computeFitViewport.ts` — the pure utility to use instead
- `src/components/canvas/mapCanvasData.ts` — `mapCanvasNodes` for understanding node data shape
- `test/unit/components/SubsystemPreview.test.tsx` — existing tests to update

## Dependencies

- **Blocked by:** none
- **Blocks:** Task 3 (overlay viewport matching depends on identical math)

## Description

The SubsystemPreview currently uses ReactFlow's built-in `fitView` prop to auto-fit content on mount. The overlay navigation system needs the preview to use `computeFitViewport` (our pure utility) so that the overlay's starting viewport can be computed with identical math, guaranteeing pixel-perfect matching at animation start.

**Changes to `SubsystemPreview.tsx`:**

1. Remove `fitView` prop from `<ReactFlow>`.
2. Add an inner component (inside the `ReactFlowProvider`) that calls `useReactFlow()` to get the instance.
3. In a `useEffect`, compute the viewport via `computeFitViewport` using the container's measured dimensions (from a ref + `ResizeObserver` or `getBoundingClientRect` after mount), then call `reactFlow.setViewport()`.
4. The viewport must be recomputed when canvas data changes (nodes added/removed).

**Key concern:** The `computeFitViewport` call needs the container's pixel dimensions. The preview container's size comes from the RefNode's CSS (`height: 100% - header`). Use a ref on the wrapper div + `useEffect` to read `getBoundingClientRect()` after mount.

**Edge cases:**
- Empty canvas (0 nodes) — `SubsystemPreview` already returns `null`, so no viewport to set
- Container not yet measured (width/height = 0) — skip `setViewport` until valid dimensions available
- Canvas data changes while preview is mounted — recompute viewport

**Acceptance criteria:**
- SubsystemPreview renders content at the same visual positions as before (no visible regression)
- Uses `computeFitViewport` instead of ReactFlow's `fitView`
- Existing tests pass (with necessary mock updates)
- Preview content matches what `computeFitViewport(containerW, containerH, nodes)` would produce
