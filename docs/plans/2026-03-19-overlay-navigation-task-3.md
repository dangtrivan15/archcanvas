# Task 3: Overlay Navigation System

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:writing-plans to plan
> the implementation steps for this task.

**Scope:** CanvasOverlay component + transition hook rewrite + Canvas.tsx integration
**Parent feature:** [./2026-03-19-overlay-navigation-index.md](2026-03-19-overlay-navigation-index.md)
**Spec:** [docs/specs/2026-03-19-overlay-navigation-design.md](../specs/2026-03-19-overlay-navigation-design.md)

## Write Set

- Create: `src/components/canvas/CanvasOverlay.tsx` (~80 lines)
- Modify: `src/components/canvas/hooks/useNavigationTransition.ts` (~200 lines — full rewrite)
- Modify: `src/components/canvas/Canvas.tsx` (~70 lines changed)
- Create: `test/unit/components/canvas/CanvasOverlay.test.tsx` (test, unlimited)

## Read Set (context needed)

- `src/components/canvas/hooks/useNavigationTransition.ts` — current implementation (being rewritten)
- `src/components/canvas/Canvas.tsx` — current integration point
- `src/components/nodes/SubsystemPreview.tsx` — preview component (Task 2 modifies this, read the post-Task-2 version)
- `src/store/navigationStore.ts` — `diveIn()`, `goUp()`, `goToBreadcrumb()` interfaces
- `src/components/canvas/hooks/useCanvasRenderer.ts` — how canvas data feeds into ReactFlow
- `src/components/canvas/mapCanvasData.ts` — `mapCanvasNodes`, `mapCanvasEdges`
- `src/lib/computeFitViewport.ts` — viewport math
- `src/lib/animateOverlayTransition.ts` — Task 1 output, the animation driver
- `src/components/nodes/PreviewModeContext.ts` — recursion guard context
- `src/store/fileStore.ts` — `getCanvas()` for reading canvas data
- `src/store/registryStore.ts` — `resolve` for node def lookup
- `test/e2e/subsystem.spec.ts` — E2E tests that exercise dive-in/go-up

## Dependencies

- **Blocked by:** Task 1 (animation utility), Task 2 (SubsystemPreview alignment)
- **Blocks:** Task 4 (cleanup — old files can only be deleted after this removes their imports)

## Description

This is the main integration task. It creates the `CanvasOverlay` component, rewrites `useNavigationTransition` to use overlay-based animations, and updates `Canvas.tsx` to render backdrop layers and the transition overlay.

### CanvasOverlay component

A dual-purpose component used for both transition overlays and parent backdrops:

```tsx
interface CanvasOverlayProps {
  canvasId: string;
  backdrop?: boolean;            // true = no clip-path, pointer-events:none, fitted viewport
  clipPath?: string;             // CSS clip-path value for transitions
  onReactFlowReady?: (rf: ReactFlowInstance) => void;  // forwards overlay's RF instance
}
```

- Wraps content in its own `ReactFlowProvider` + `<ReactFlow>` (non-interactive)
- Uses `mapCanvasNodes`/`mapCanvasEdges` to get RF nodes/edges from store (same as `useCanvasRenderer` but simpler — no inherited edges, no ghost nodes)
- Inner component calls `useReactFlow()` and forwards instance via `onReactFlowReady` callback in `useEffect`
- Renders theme background (Background component from ReactFlow)
- When `backdrop={true}`: `position: fixed; inset: 0; pointer-events: none; z-index: 1` with fitted viewport
- When used as transition overlay: `position: fixed; inset: 0; z-index: 50` with dynamic clip-path

### useNavigationTransition rewrite

Replace the 4-state state machine with simpler `idle | animating` state:

**State:**
- `stateRef: 'idle' | 'animating'` (ref, not state — avoids re-renders during animation)
- `overlayConfig: { canvasId, clipPath, ... } | null` (React state, drives overlay rendering)
- `backdropCanvasId: string | null` (React state, drives backdrop rendering)
- `lastPreviewRectRef: DOMRect | null` (ref — stores SubsystemPreview rect from dive-in for go-up)
- `overlayRfRef: ReactFlowInstance | null` (ref — forwarded from CanvasOverlay via `onReactFlowReady`)
- `cancelRef: (() => void) | null` (ref — cancel function from `animateOverlayTransition`)

**diveIn(refNodeId):**
1. Guard `stateRef !== 'idle'`
2. Find SubsystemPreview element: `document.querySelector(\`.subsystem-preview[data-canvas-id="${refNodeId}"]\`)` — if not found, dissolve fallback
3. Measure preview rect, store in `lastPreviewRectRef`
4. Read child canvas nodes from `fileStore.getCanvas(refNodeId)`
5. Compute `startVp` and `endVp` using `computeFitViewport`
6. Set overlay config (canvasId, initial clip-path) → React renders `CanvasOverlay`
7. Wait for `onReactFlowReady` callback → store overlay RF instance
8. Start `animateOverlayTransition` with overlay element + overlay RF instance
9. On complete: call `navigationStore.diveIn(refNodeId)`, set main viewport to `endVp`, clear overlay config, set backdrop

**goUp():**
1. Guard `stateRef !== 'idle'`, guard breadcrumb depth > 1
2. Read `lastPreviewRectRef` — if null, dissolve fallback
3. Read current canvas nodes for `startVp` computation
4. Set overlay config (current canvasId, full-screen clip) → React renders `CanvasOverlay`
5. Call `navigationStore.goUp()` → main ReactFlow swaps to parent
6. Set main viewport to fitted parent view
7. Wait for `onReactFlowReady` → start `animateOverlayTransition` (shrinking)
8. On complete: clear overlay config, clear `lastPreviewRectRef`

**goToBreadcrumb(index):** Dissolve — unchanged from current implementation.

**Dissolve fallback:** Kept for unmeasured containers, empty subsystems, missing preview rects. Same opaque-cover + fade-out pattern.

### Canvas.tsx changes

- Remove old `overlayStyle` div and `onOverlayTransitionEnd`
- Add `CanvasOverlay` rendering controlled by `useNavigationTransition`:
  - Backdrop: `{backdropCanvasId && <CanvasOverlay canvasId={backdropCanvasId} backdrop />}`
  - Transition: `{overlayConfig && <CanvasOverlay {...overlayConfig} />}`
- The hook returns `{ diveIn, goUp, goToBreadcrumb, isTransitioning, backdropCanvasId, overlayConfig, onOverlayReactFlowReady }`
- `isTransitioning` still used to block double-click during animation

### SubsystemPreview data attribute

Add `data-canvas-id={canvasId}` to the SubsystemPreview wrapper div so `diveIn` can find the correct preview element to measure. This is a 1-line change to `SubsystemPreview.tsx` but is done in this task (not Task 2) to avoid shared writes.

### Edge cases

- Double-click during active transition → guarded by `stateRef !== 'idle'`
- Go-up when no dive-in happened (navigated via `navigateTo`) → `lastPreviewRectRef` is null → dissolve
- Window resize between dive-in and go-up → stored rect may be stale. Accept minor visual mismatch (the animation still works, just the start/end positions are slightly off). The alternative (re-measure on go-up) is fragile (spec review issue #3).
- CanvasOverlay `onReactFlowReady` fires asynchronously → animation must not start until the callback fires. Use a Promise or effect-based sequencing.

### E2E tests

`test/e2e/subsystem.spec.ts` may need selector updates if the transition overlay changes detectable DOM structure. Run full E2E suite after integration.

### Acceptance criteria

- Dive-in: clip-path expands from SubsystemPreview rect to full screen, content zooms out
- Go-up: clip-path shrinks from full screen to SubsystemPreview rect, content zooms in
- Parent canvas visible behind overlay during both transitions
- No opaque cover during spatial transitions (dissolve fallback still uses cover)
- Breadcrumb jumps use dissolve (unchanged behavior)
- All existing E2E subsystem tests pass
- No imports of `animateViewport`, `computeZoomToRect`, or `computeMatchedViewport` remain in modified files
