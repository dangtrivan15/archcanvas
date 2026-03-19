# Overlay Navigation — Task 3: Overlay Navigation System Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create CanvasOverlay component, rewrite useNavigationTransition to use overlay-based clip-path animations, and update Canvas.tsx to render backdrop/overlay layers.

**Architecture:** CanvasOverlay is a dual-purpose component (backdrop + transition). The transition hook orchestrates: mount overlay → get RF instance → animate clip-path + viewport → swap canvas → unmount overlay. Canvas.tsx renders backdrop + overlay as React state driven by the hook.

**Tech Stack:** React, ReactFlow, TypeScript, Vitest, Playwright

---

### Task 3.1: Create CanvasOverlay component

**Files:**
- Create: `src/components/canvas/CanvasOverlay.tsx`
- Create: `test/unit/components/canvas/CanvasOverlay.test.tsx`

- [ ] **Step 1: Write failing test for CanvasOverlay**

Read these files for context first:
- `src/components/nodes/SubsystemPreview.tsx` — pattern for separate ReactFlowProvider
- `src/components/canvas/mapCanvasData.ts` — mapCanvasNodes, mapCanvasEdges
- `src/components/canvas/hooks/useCanvasRenderer.ts` — how canvas data feeds ReactFlow

Create the test file:

```ts
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { CanvasOverlay } from '@/components/canvas/CanvasOverlay';

// Mock ReactFlow and related
vi.mock('@xyflow/react', () => ({
  ReactFlow: ({ children }: any) => <div data-testid="reactflow">{children}</div>,
  ReactFlowProvider: ({ children }: any) => <div>{children}</div>,
  Background: () => null,
  BackgroundVariant: { Dots: 'dots' },
  useReactFlow: () => ({ setViewport: vi.fn(), getViewport: () => ({ x: 0, y: 0, zoom: 1 }) }),
}));

vi.mock('@/store/fileStore', () => ({
  useFileStore: vi.fn((selector: any) => {
    const state = {
      project: { canvases: new Map() },
      getCanvas: () => ({
        data: { nodes: [{ id: 'n1', type: 'compute/service', displayName: 'Test', position: { x: 0, y: 0 } }], edges: [] },
      }),
    };
    return selector(state);
  }),
}));

vi.mock('@/store/registryStore', () => ({
  useRegistryStore: vi.fn((sel: any) => sel({ resolve: () => undefined })),
}));

describe('CanvasOverlay', () => {
  it('renders with fixed positioning', () => {
    const { container } = render(<CanvasOverlay canvasId="test" />);
    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper.style.position).toBe('fixed');
  });

  it('applies clipPath prop to wrapper', () => {
    const { container } = render(
      <CanvasOverlay canvasId="test" clipPath="inset(10px 20px 30px 40px)" />
    );
    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper.style.clipPath).toBe('inset(10px 20px 30px 40px)');
  });

  it('sets pointer-events none when backdrop', () => {
    const { container } = render(<CanvasOverlay canvasId="test" backdrop />);
    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper.style.pointerEvents).toBe('none');
  });

  it('calls onReactFlowReady with RF instance', async () => {
    const onReady = vi.fn();
    render(<CanvasOverlay canvasId="test" onReactFlowReady={onReady} />);
    // useEffect fires synchronously in test, useReactFlow mock returns the mock instance
    expect(onReady).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:unit -- --reporter=verbose test/unit/components/canvas/CanvasOverlay.test.tsx`
Expected: FAIL — module not found

- [ ] **Step 3: Implement CanvasOverlay**

```tsx
import { useMemo, useEffect } from 'react';
import { ReactFlow, ReactFlowProvider, Background, BackgroundVariant, useReactFlow } from '@xyflow/react';
import type { ReactFlowInstance } from '@xyflow/react';
import { useFileStore } from '@/store/fileStore';
import { useRegistryStore } from '@/store/registryStore';
import { NodeRenderer } from '../nodes/NodeRenderer';
import { EdgeRenderer } from '../edges/EdgeRenderer';
import { PreviewModeContext } from '../nodes/PreviewModeContext';
import { mapCanvasNodes, mapCanvasEdges } from './mapCanvasData';

interface CanvasOverlayProps {
  canvasId: string;
  backdrop?: boolean;
  clipPath?: string;
  onReactFlowReady?: (rf: ReactFlowInstance) => void;
}

const overlayNodeTypes = { archNode: NodeRenderer };
const overlayEdgeTypes = { archEdge: EdgeRenderer };
const emptySet = new Set<string>();

function OverlayInner({ canvasId, onReactFlowReady }: {
  canvasId: string;
  onReactFlowReady?: (rf: ReactFlowInstance) => void;
}) {
  const reactFlow = useReactFlow();
  const canvas = useFileStore((s) => {
    void s.project?.canvases;
    return s.getCanvas(canvasId);
  });
  const canvasesRef = useFileStore((s) => s.project?.canvases);
  const resolve = useRegistryStore((s) => s.resolve);

  const rfNodes = useMemo(
    () => mapCanvasNodes({ canvas: canvas?.data, resolve, selectedNodeIds: emptySet, canvasesRef }),
    [canvas, resolve, canvasesRef],
  );
  const rfEdges = useMemo(() => mapCanvasEdges(canvas?.data), [canvas]);

  useEffect(() => {
    if (onReactFlowReady) onReactFlowReady(reactFlow as unknown as ReactFlowInstance);
  }, [reactFlow, onReactFlowReady]);

  return (
    <PreviewModeContext.Provider value={true}>
      <ReactFlow
        nodes={rfNodes}
        edges={rfEdges}
        nodeTypes={overlayNodeTypes}
        edgeTypes={overlayEdgeTypes}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        panOnDrag={false}
        zoomOnScroll={false}
        zoomOnPinch={false}
        zoomOnDoubleClick={false}
        preventScrolling={false}
        nodesFocusable={false}
        edgesFocusable={false}
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={16} size={1} />
      </ReactFlow>
    </PreviewModeContext.Provider>
  );
}

export function CanvasOverlay({ canvasId, backdrop, clipPath, onReactFlowReady }: CanvasOverlayProps) {
  return (
    <div
      className="canvas-overlay"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: backdrop ? 1 : 50,
        pointerEvents: backdrop ? 'none' : 'none',
        clipPath: clipPath ?? undefined,
        overflow: 'hidden',
      }}
    >
      <ReactFlowProvider>
        <OverlayInner canvasId={canvasId} onReactFlowReady={onReactFlowReady} />
      </ReactFlowProvider>
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test:unit -- --reporter=verbose test/unit/components/canvas/CanvasOverlay.test.tsx`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/canvas/CanvasOverlay.tsx test/unit/components/canvas/CanvasOverlay.test.tsx
git commit -m "feat: add CanvasOverlay component for backdrop and transition layers"
```

### Task 3.2: Rewrite useNavigationTransition

**Files:**
- Modify: `src/components/canvas/hooks/useNavigationTransition.ts` (full rewrite)

- [ ] **Step 6: Read context files**

Read these for context:
- `src/components/canvas/hooks/useNavigationTransition.ts` — current implementation
- `src/store/navigationStore.ts` — diveIn/goUp/goToBreadcrumb interfaces
- `src/lib/animateOverlayTransition.ts` — Task 1 output
- `src/lib/computeFitViewport.ts` — viewport math
- `src/store/fileStore.ts` — getCanvas()
- `src/components/canvas/CanvasOverlay.tsx` — Task 3.1 output

- [ ] **Step 7: Rewrite the hook**

Replace the entire file contents. The new hook:

1. **State**: `stateRef` (`idle | animating`), `overlayConfig` (React state for rendering), `backdropCanvasId` (React state), `lastPreviewRectRef` (DOMRect), `overlayRfRef` (ReactFlowInstance), `cancelRef`

2. **diveIn(refNodeId)**:
   - Guard `stateRef !== 'idle'`
   - Find preview element via `document.querySelector('.subsystem-preview[data-canvas-id="' + refNodeId + '"]')`
   - If not found → dissolve fallback
   - Measure and store preview rect in `lastPreviewRectRef`
   - Read child nodes from fileStore
   - Compute `startVp` and `endVp` via `computeFitViewport`
   - Compute `startInset` from preview rect
   - Set `overlayConfig` → React renders CanvasOverlay
   - Wait for `onReactFlowReady` → store RF instance, start `animateOverlayTransition`
   - On complete: `navigationStore.diveIn()`, set main viewport to endVp, clear overlay, set backdrop

3. **goUp()**:
   - Guard `stateRef !== 'idle'`, guard breadcrumb depth > 1
   - Read `lastPreviewRectRef` → if null, dissolve fallback
   - Compute startVp and endVp
   - Set `overlayConfig` with current canvasId at full-screen clip
   - Call `navigationStore.goUp()` → main RF swaps to parent
   - Set main viewport to fitted parent
   - Wait for `onReactFlowReady` → start `animateOverlayTransition` (shrinking)
   - On complete: clear overlay, clear lastPreviewRectRef

4. **goToBreadcrumb(index)**: Dissolve — same as current

5. **Return**: `{ diveIn, goUp, goToBreadcrumb, isTransitioning, overlayConfig, backdropCanvasId, onOverlayReactFlowReady, onOverlayTransitionEnd }`

The full implementation is ~200 lines. Write it following the patterns from the current file (useCallback for each action, refs for animation state, React state for rendering triggers). Import `animateOverlayTransition` and `easeInOut` from `@/lib/animateOverlayTransition`, import `computeFitViewport` from `@/lib/computeFitViewport`.

Do NOT import `animateViewport`, `computeZoomToRect`, or `computeMatchedViewport` — these are being deleted in Task 4.

- [ ] **Step 8: Run typecheck**

Run: `npm run typecheck`
Expected: No errors

- [ ] **Step 9: Commit**

```bash
git add src/components/canvas/hooks/useNavigationTransition.ts
git commit -m "feat: rewrite useNavigationTransition with overlay clip-path animation"
```

### Task 3.3: Update Canvas.tsx

**Files:**
- Modify: `src/components/canvas/Canvas.tsx`

- [ ] **Step 10: Read Canvas.tsx for current structure**

Read: `src/components/canvas/Canvas.tsx`

- [ ] **Step 11: Update Canvas.tsx**

Changes:
1. Import `CanvasOverlay` from `./CanvasOverlay`
2. Destructure new return values from `useNavigationTransition`: `overlayConfig`, `backdropCanvasId`, `onOverlayReactFlowReady`
3. Remove the old overlay div (`navigation-transition-overlay` + `overlayStyle` + `onOverlayTransitionEnd`)
4. Add backdrop rendering before the main ReactFlow
5. Add overlay rendering after the main ReactFlow

In the JSX, replace the old overlay div at the bottom with:

```tsx
{/* Parent canvas backdrop — always rendered when inside a subsystem */}
{backdropCanvasId && <CanvasOverlay canvasId={backdropCanvasId} backdrop />}

{/* Transition overlay — temporary, only during animations */}
{overlayConfig && (
  <CanvasOverlay
    canvasId={overlayConfig.canvasId}
    clipPath={overlayConfig.clipPath}
    onReactFlowReady={onOverlayReactFlowReady}
  />
)}
```

Remove from the hook destructure: `overlayStyle`, `onOverlayTransitionEnd`
Remove the old overlay JSX:
```tsx
{overlayStyle && (
  <div
    className="navigation-transition-overlay"
    style={overlayStyle}
    onTransitionEnd={onOverlayTransitionEnd}
  />
)}
```

- [ ] **Step 12: Run typecheck**

Run: `npm run typecheck`
Expected: No errors

- [ ] **Step 13: Run unit tests**

Run: `npm run test:unit`
Expected: All tests PASS

- [ ] **Step 14: Commit**

```bash
git add src/components/canvas/Canvas.tsx
git commit -m "feat: integrate CanvasOverlay backdrop and transition layers into Canvas"
```

### Task 3.4: Visual verification and E2E

- [ ] **Step 15: Start dev server and visually verify**

Run: `npm run dev`

Manual verification checklist:
1. Open a project with subsystems
2. Double-click a subsystem → clip-path expands from preview rect, parent visible behind
3. Click "Root" in breadcrumb → overlay collapses back to preview position
4. Press Escape to go up → same collapse animation
5. Multi-level breadcrumb jump → dissolve (crossfade) transition
6. Rapidly double-click during transition → no crash (guarded by stateRef)

- [ ] **Step 16: Run E2E tests**

Run: `npm run test:e2e`
Expected: All tests PASS. If subsystem navigation tests fail due to DOM selector changes (overlay div class names), update selectors.

- [ ] **Step 17: Commit any E2E fixes**

```bash
git add -A
git commit -m "fix: update E2E selectors for overlay navigation DOM structure"
```
(Skip if no E2E changes needed)
