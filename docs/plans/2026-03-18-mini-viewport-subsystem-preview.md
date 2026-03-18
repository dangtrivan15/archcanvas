# Mini Viewport Subsystem Preview — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace SVG-based SubsystemPreview with a non-interactive mini ReactFlow instance and fix the two-phase zoom in navigation transitions.

**Architecture:** SubsystemPreview becomes a `<ReactFlowProvider>`-wrapped `<ReactFlow>` that reuses the same `NodeRenderer` and `EdgeRenderer` as the main canvas. A `PreviewModeContext` prevents recursive preview rendering. The transition hook pre-computes fitted viewport positions via `computeFitViewport` and calls `setViewport()` during the opaque overlay phase, eliminating the post-transition `fitView` step.

**Tech Stack:** React 19, ReactFlow 12, Zustand 5, Vitest 4, Playwright 1.58

**Spec:** `docs/specs/2026-03-18-mini-viewport-subsystem-preview-design.md`

---

### Task 1: Create `computeFitViewport` utility (TDD)

Pure function with no dependencies on React or ReactFlow. Computes where nodes will appear after a fitView operation.

**Files:**
- Create: `src/lib/computeFitViewport.ts`
- Create: `test/unit/lib/computeFitViewport.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
// test/unit/lib/computeFitViewport.test.ts
import { describe, it, expect } from 'vitest';
import { computeFitViewport } from '@/lib/computeFitViewport';

describe('computeFitViewport', () => {
  it('returns identity viewport for single node centered in viewport', () => {
    const result = computeFitViewport({
      nodes: [{ x: 0, y: 0, width: 100, height: 50 }],
      viewportWidth: 800,
      viewportHeight: 600,
    });
    expect(result.zoom).toBeGreaterThan(0);
    expect(result.zoom).toBeLessThanOrEqual(1);
    expect(result.offsetX).toBeGreaterThan(0); // centered
    expect(result.offsetY).toBeGreaterThan(0); // centered
  });

  it('computes correct zoom for content larger than viewport', () => {
    const result = computeFitViewport({
      nodes: [
        { x: 0, y: 0, width: 100, height: 50 },
        { x: 1600, y: 1200, width: 100, height: 50 },
      ],
      viewportWidth: 800,
      viewportHeight: 600,
    });
    // Content is 1700×1250, viewport is 800×600 → zoom < 1
    expect(result.zoom).toBeLessThan(1);
  });

  it('clamps zoom to maxZoom', () => {
    const result = computeFitViewport({
      nodes: [{ x: 0, y: 0, width: 10, height: 10 }],
      viewportWidth: 800,
      viewportHeight: 600,
      maxZoom: 2,
    });
    expect(result.zoom).toBeLessThanOrEqual(2);
  });

  it('clamps zoom to minZoom', () => {
    const result = computeFitViewport({
      nodes: [
        { x: 0, y: 0, width: 100, height: 100 },
        { x: 100000, y: 100000, width: 100, height: 100 },
      ],
      viewportWidth: 100,
      viewportHeight: 100,
      minZoom: 0.1,
    });
    expect(result.zoom).toBeGreaterThanOrEqual(0.1);
  });

  it('applies padding factor', () => {
    const withPadding = computeFitViewport({
      nodes: [{ x: 0, y: 0, width: 100, height: 50 }],
      viewportWidth: 800,
      viewportHeight: 600,
      padding: 0.2,
    });
    const withoutPadding = computeFitViewport({
      nodes: [{ x: 0, y: 0, width: 100, height: 50 }],
      viewportWidth: 800,
      viewportHeight: 600,
      padding: 0,
    });
    expect(withPadding.zoom).toBeLessThan(withoutPadding.zoom);
  });

  it('returns per-node screen positions', () => {
    const result = computeFitViewport({
      nodes: [
        { x: 0, y: 0, width: 100, height: 50 },
        { x: 200, y: 100, width: 100, height: 50 },
      ],
      viewportWidth: 800,
      viewportHeight: 600,
    });
    expect(result.nodeScreenRects).toHaveLength(2);
    for (const rect of result.nodeScreenRects) {
      expect(rect).toHaveProperty('x');
      expect(rect).toHaveProperty('y');
      expect(rect).toHaveProperty('width');
      expect(rect).toHaveProperty('height');
    }
  });

  it('returns empty results for no nodes', () => {
    const result = computeFitViewport({
      nodes: [],
      viewportWidth: 800,
      viewportHeight: 600,
    });
    expect(result.zoom).toBe(1);
    expect(result.offsetX).toBe(0);
    expect(result.offsetY).toBe(0);
    expect(result.nodeScreenRects).toHaveLength(0);
  });

  it('centers content in viewport', () => {
    // Single node 100x50 in an 800x600 viewport — should be centered
    const result = computeFitViewport({
      nodes: [{ x: 0, y: 0, width: 100, height: 50 }],
      viewportWidth: 800,
      viewportHeight: 600,
      padding: 0,
      maxZoom: 1, // clamp so node doesn't scale up
    });
    const rect = result.nodeScreenRects[0];
    // Horizontal center: (800 - 100) / 2 = 350
    expect(rect.x).toBeCloseTo(350, 0);
    // Vertical center: (600 - 50) / 2 = 275
    expect(rect.y).toBeCloseTo(275, 0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run test/unit/lib/computeFitViewport.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement `computeFitViewport`**

```ts
// src/lib/computeFitViewport.ts

interface FitNode {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface FitViewportInput {
  nodes: FitNode[];
  viewportWidth: number;
  viewportHeight: number;
  padding?: number;   // 0-1, default 0.1
  minZoom?: number;    // default 0.1
  maxZoom?: number;    // default 2
}

interface ScreenRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface FitViewportResult {
  zoom: number;
  offsetX: number;
  offsetY: number;
  nodeScreenRects: ScreenRect[];
}

export function computeFitViewport(input: FitViewportInput): FitViewportResult {
  const {
    nodes,
    viewportWidth,
    viewportHeight,
    padding = 0.1,
    minZoom = 0.1,
    maxZoom = 2,
  } = input;

  if (nodes.length === 0) {
    return { zoom: 1, offsetX: 0, offsetY: 0, nodeScreenRects: [] };
  }

  // Compute bounding box
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const n of nodes) {
    if (n.x < minX) minX = n.x;
    if (n.y < minY) minY = n.y;
    if (n.x + n.width > maxX) maxX = n.x + n.width;
    if (n.y + n.height > maxY) maxY = n.y + n.height;
  }

  const contentW = maxX - minX;
  const contentH = maxY - minY;

  // Compute zoom to fit content in viewport with padding
  const scaleX = viewportWidth / contentW;
  const scaleY = viewportHeight / contentH;
  let zoom = Math.min(scaleX, scaleY) * (1 - padding);
  zoom = Math.max(minZoom, Math.min(maxZoom, zoom));

  // Center content in viewport
  const offsetX = (viewportWidth - contentW * zoom) / 2 - minX * zoom;
  const offsetY = (viewportHeight - contentH * zoom) / 2 - minY * zoom;

  // Compute per-node screen positions
  const nodeScreenRects: ScreenRect[] = nodes.map((n) => ({
    x: n.x * zoom + offsetX,
    y: n.y * zoom + offsetY,
    width: n.width * zoom,
    height: n.height * zoom,
  }));

  return { zoom, offsetX, offsetY, nodeScreenRects };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run test/unit/lib/computeFitViewport.test.ts`
Expected: All 8 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/computeFitViewport.ts test/unit/lib/computeFitViewport.test.ts
git commit -m "feat: add computeFitViewport utility for viewport-aware transitions"
```

---

### Task 2: Create `PreviewModeContext` and update `NodeRenderer`

Add a React context that signals "we're inside a mini ReactFlow preview" so `NodeRenderer` can skip rendering nested `SubsystemPreview` components.

**Files:**
- Create: `src/components/nodes/PreviewModeContext.ts`
- Modify: `src/components/nodes/NodeRenderer.tsx:9,108`
- Test: `test/unit/components/nodes/NodeRenderer.test.tsx` (existing, add test)

- [ ] **Step 1: Write failing test**

Add to the existing `test/unit/components/nodes/NodeRenderer.test.tsx`.

The existing test file mocks `@xyflow/react` (line 10), `@/store/fileStore` (line 31), `@/store/graphStore` (line 50), `@/store/navigationStore` (line 53), and has helpers `makeRefNode()` and `makeProps()`. Add this import near the top (after other imports):

```ts
import { PreviewModeContext } from '@/components/nodes/PreviewModeContext';
```

Add this test inside the existing `describe('NodeRenderer', ...)` block:

```ts
it('skips SubsystemPreview when PreviewModeContext is true', () => {
  const data: CanvasNodeData = {
    node: makeRefNode({ id: 'sub-1' }) as any,
    nodeDef: undefined,
    isSelected: false,
    isRef: true,
  };

  const { container } = render(
    <PreviewModeContext.Provider value={true}>
      <NodeRenderer {...makeProps(data)} />
    </PreviewModeContext.Provider>
  );

  // Should render the node header but NOT SubsystemPreview
  expect(container.querySelector('.arch-node-header')).toBeTruthy();
  // SubsystemPreview is mocked away by the @xyflow/react mock, but we verify
  // the conditional: with preview=true, the SubsystemPreview JSX is not reached.
  // The node should still have the container shape class.
  expect(container.querySelector('.node-shape-container')).toBeTruthy();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/unit/components/nodes/NodeRenderer.test.tsx -t "skips SubsystemPreview"`
Expected: FAIL — `PreviewModeContext` not found

- [ ] **Step 3: Create `PreviewModeContext`**

```ts
// src/components/nodes/PreviewModeContext.ts
import { createContext } from 'react';

/**
 * When true, NodeRenderer skips rendering SubsystemPreview inside RefNodes.
 * Used by the mini ReactFlow preview to prevent recursive ReactFlow instances.
 */
export const PreviewModeContext = createContext(false);
```

- [ ] **Step 4: Update `NodeRenderer` to consume context**

In `src/components/nodes/NodeRenderer.tsx`:

1. Add import (after line 8):
   ```ts
   import { useContext } from 'react';
   import { PreviewModeContext } from './PreviewModeContext';
   ```

2. Inside the component (after line 14):
   ```ts
   const isPreview = useContext(PreviewModeContext);
   ```

3. Change line 108 from:
   ```tsx
   {isRef && <SubsystemPreview canvasId={node.id} />}
   ```
   to:
   ```tsx
   {isRef && !isPreview && <SubsystemPreview canvasId={node.id} />}
   ```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run test/unit/components/nodes/NodeRenderer.test.tsx`
Expected: All tests PASS (existing + new)

- [ ] **Step 6: Run full test suite to verify no regressions**

Run: `npm test`
Expected: All tests PASS

- [ ] **Step 7: Commit**

```bash
git add src/components/nodes/PreviewModeContext.ts src/components/nodes/NodeRenderer.tsx test/unit/components/nodes/NodeRenderer.test.tsx
git commit -m "feat: add PreviewModeContext to control SubsystemPreview recursion"
```

---

### Task 3: Extract shared node/edge mapping from `useCanvasRenderer`

Extract the pure node-mapping and edge-mapping logic into reusable functions that both the main canvas renderer and the mini-canvas can call. The mini-canvas version excludes inherited edges and ghost nodes.

**Files:**
- Create: `src/components/canvas/mapCanvasData.ts`
- Modify: `src/components/canvas/hooks/useCanvasRenderer.ts:28-84`

- [ ] **Step 1: Create `mapCanvasData.ts`**

Extract the mapping logic from `useCanvasRenderer.ts` lines 28-84 into pure functions:

```ts
// src/components/canvas/mapCanvasData.ts
import type { Node as RFNode, Edge as RFEdge } from '@xyflow/react';
import type { Canvas } from '@/types';
import type { CanvasNodeData, CanvasEdgeData } from './types';
import { PROTOCOL_STYLES } from './types';
import { computeAutoSize } from '@/lib/computeAutoSize';

interface MapNodesOptions {
  canvas: Canvas | undefined;
  resolve: (type: string) => import('@/types/nodeDefSchema').NodeDef | undefined;
  selectedNodeIds: ReadonlySet<string>;
  canvasesRef: Map<string, { data: Canvas }> | undefined;
}

export function mapCanvasNodes(opts: MapNodesOptions): RFNode<CanvasNodeData>[] {
  const { canvas, resolve, selectedNodeIds, canvasesRef } = opts;
  const rawNodes = canvas?.nodes ?? [];
  return rawNodes.map((node) => {
    const isRef = 'ref' in node;
    const nodeDef = isRef ? undefined : resolve((node as { type: string }).type);
    const data: CanvasNodeData = {
      node,
      nodeDef,
      isSelected: selectedNodeIds.has(node.id),
      isRef,
    };
    const rfNode: RFNode<CanvasNodeData> = {
      id: node.id,
      type: 'archNode',
      position: node.position ?? { x: 0, y: 0 },
      data,
    };

    if (isRef) {
      const childCanvas = canvasesRef?.get(node.id);
      const pos = node.position;
      if (pos?.autoSize === false) {
        rfNode.width = pos.width ?? 240;
        rfNode.height = pos.height ?? 160;
      } else {
        const { width, height } = computeAutoSize(childCanvas?.data);
        rfNode.width = width;
        rfNode.height = height;
      }
    }

    return rfNode;
  });
}

export function mapCanvasEdges(canvas: Canvas | undefined): RFEdge<CanvasEdgeData>[] {
  const rawEdges = canvas?.edges ?? [];
  return rawEdges.map((edge) => {
    const protocol = edge.protocol;
    const styleCategory: 'sync' | 'async' | 'default' =
      protocol !== undefined
        ? (PROTOCOL_STYLES[protocol] ?? 'default')
        : 'default';
    const data: CanvasEdgeData = { edge, styleCategory };
    return {
      id: `${edge.from.node}-${edge.to.node}`,
      source: edge.from.node,
      target: edge.to.node,
      type: 'archEdge',
      data,
    };
  });
}
```

- [ ] **Step 2: Update `useCanvasRenderer` to use extracted functions**

In `src/components/canvas/hooks/useCanvasRenderer.ts`, replace the inline mapping logic (lines 28-84) with calls to `mapCanvasNodes` and `mapCanvasEdges`:

```ts
import { mapCanvasNodes, mapCanvasEdges } from '../mapCanvasData';

// ... inside the hook:

const nodes = useMemo<RFNode<CanvasNodeData>[]>(
  () => mapCanvasNodes({ canvas: canvas?.data, resolve, selectedNodeIds, canvasesRef }),
  [canvas, resolve, selectedNodeIds, canvasesRef],
);

const edges = useMemo<RFEdge<CanvasEdgeData>[]>(
  () => mapCanvasEdges(canvas?.data),
  [canvas],
);
```

The inherited edges / ghost nodes logic (lines 86-158) stays in `useCanvasRenderer` — it's specific to the main canvas.

- [ ] **Step 3: Run full test suite**

Run: `npm test`
Expected: All tests PASS — this is a pure refactor with no behavior change.

- [ ] **Step 4: Commit**

```bash
git add src/components/canvas/mapCanvasData.ts src/components/canvas/hooks/useCanvasRenderer.ts
git commit -m "refactor: extract mapCanvasNodes/mapCanvasEdges for reuse"
```

---

### Task 4: Rewrite `SubsystemPreview` as mini ReactFlow

Replace the SVG implementation with a non-interactive ReactFlow instance wrapped in its own `ReactFlowProvider`.

**Files:**
- Rewrite: `src/components/nodes/SubsystemPreview.tsx`
- Rewrite: `test/unit/components/SubsystemPreview.test.tsx`

- [ ] **Step 1: Write failing tests for the new implementation**

**Important:** ReactFlow v12 requires `ResizeObserver` which jsdom doesn't provide. Add a polyfill at the top of the test file before any imports. Also mock `@/store/registryStore` since the new SubsystemPreview uses it.

```ts
// test/unit/components/SubsystemPreview.test.tsx
import { describe, it, expect, beforeEach, vi } from 'vitest';

// Polyfill ResizeObserver for jsdom (ReactFlow requires it)
if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as any;
}

import { render } from '@testing-library/react';
import { SubsystemPreview } from '@/components/nodes/SubsystemPreview';
import { useFileStore } from '@/store/fileStore';

// Mock registryStore — SubsystemPreview uses it for node type resolution
vi.mock('@/store/registryStore', () => ({
  useRegistryStore: (selector: any) => selector({ resolve: () => undefined }),
}));

function setCanvas(canvasId: string, data: { nodes?: any[]; edges?: any[] }) {
  const store = useFileStore.getState();
  const canvases = new Map(store.project?.canvases ?? []);
  canvases.set(canvasId, { data, filePath: `${canvasId}.yaml`, doc: undefined } as any);
  useFileStore.setState({
    project: {
      ...(store.project ?? { root: { data: {}, path: 'root.yaml' } }),
      canvases,
    } as any,
  });
}

describe('SubsystemPreview', () => {
  beforeEach(() => {
    useFileStore.setState({ project: null } as any);
  });

  it('renders nothing when canvas has no nodes', () => {
    setCanvas('test-canvas', { nodes: [] });
    const { container } = render(<SubsystemPreview canvasId="test-canvas" />);
    expect(container.querySelector('.subsystem-preview')).toBeNull();
  });

  it('renders nothing when canvas does not exist', () => {
    const { container } = render(<SubsystemPreview canvasId="nonexistent" />);
    expect(container.querySelector('.subsystem-preview')).toBeNull();
  });

  it('renders a ReactFlow instance with nodes', () => {
    setCanvas('test-canvas', {
      nodes: [
        { id: 'a', type: 'service', position: { x: 0, y: 0 } },
        { id: 'b', type: 'database', position: { x: 100, y: 50 } },
      ],
    });
    const { container } = render(<SubsystemPreview canvasId="test-canvas" />);
    // Should have the preview wrapper with a ReactFlow instance inside
    expect(container.querySelector('.subsystem-preview')).toBeTruthy();
    expect(container.querySelector('.react-flow')).toBeTruthy();
  });

  it('wraps ReactFlow in its own ReactFlowProvider (no throw)', () => {
    setCanvas('test-canvas', {
      nodes: [
        { id: 'a', type: 'service', position: { x: 0, y: 0 } },
      ],
    });
    // If no provider, ReactFlow would throw. Rendering without error = provider present.
    expect(() => {
      render(<SubsystemPreview canvasId="test-canvas" />);
    }).not.toThrow();
  });

  it('has the subsystem-preview wrapper class', () => {
    setCanvas('test-canvas', {
      nodes: [
        { id: 'a', type: 'service', position: { x: 0, y: 0 } },
      ],
    });
    const { container } = render(<SubsystemPreview canvasId="test-canvas" />);
    expect(container.querySelector('.subsystem-preview')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run test/unit/components/SubsystemPreview.test.tsx`
Expected: FAIL — tests expect `.react-flow` elements but current impl renders SVG

- [ ] **Step 3: Rewrite `SubsystemPreview.tsx`**

```tsx
// src/components/nodes/SubsystemPreview.tsx
import { ReactFlow, ReactFlowProvider } from '@xyflow/react';
import type { Node as RFNode, Edge as RFEdge } from '@xyflow/react';
import { useMemo } from 'react';
import { useFileStore } from '@/store/fileStore';
import { useRegistryStore } from '@/store/registryStore';
import { PreviewModeContext } from './PreviewModeContext';
import { NodeRenderer } from './NodeRenderer';
import { EdgeRenderer } from '../edges/EdgeRenderer';
import { mapCanvasNodes, mapCanvasEdges } from '../canvas/mapCanvasData';

interface SubsystemPreviewProps {
  canvasId: string;
}

const previewNodeTypes = { archNode: NodeRenderer };
const previewEdgeTypes = { archEdge: EdgeRenderer };
const emptySet = new Set<string>();

export function SubsystemPreview({ canvasId }: SubsystemPreviewProps) {
  const canvas = useFileStore((s) => {
    void s.project?.canvases; // touch Map ref for subscription
    return s.getCanvas(canvasId);
  });
  const canvasesRef = useFileStore((s) => s.project?.canvases);
  const resolve = useRegistryStore((s) => s.resolve);

  const nodes = canvas?.data?.nodes ?? [];

  const rfNodes = useMemo(
    () => mapCanvasNodes({
      canvas: canvas?.data,
      resolve,
      selectedNodeIds: emptySet,
      canvasesRef,
    }),
    [canvas, resolve, canvasesRef],
  );

  const rfEdges = useMemo(
    () => mapCanvasEdges(canvas?.data),
    [canvas],
  );

  if (nodes.length === 0) return null;

  return (
    <div className="subsystem-preview" style={{ width: '100%', flex: 1, minHeight: 0 }}>
      <PreviewModeContext.Provider value={true}>
        <ReactFlowProvider>
          <ReactFlow
            nodes={rfNodes}
            edges={rfEdges}
            nodeTypes={previewNodeTypes}
            edgeTypes={previewEdgeTypes}
            fitView
            nodesDraggable={false}
            nodesConnectable={false}
            elementsSelectable={false}
            panOnDrag={false}
            zoomOnScroll={false}
            zoomOnPinch={false}
            zoomOnDoubleClick={false}
            preventScrolling={true}
            nodesFocusable={false}
            edgesFocusable={false}
            proOptions={{ hideAttribution: true }}
          />
        </ReactFlowProvider>
      </PreviewModeContext.Provider>
    </div>
  );
}
```

- [ ] **Step 4: Remove `typeToColor` import from old SubsystemPreview**

Verify no remaining imports of `typeToColor` in `SubsystemPreview.tsx` (the rewrite above does not import it).

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run test/unit/components/SubsystemPreview.test.tsx`
Expected: All tests PASS

- [ ] **Step 6: Run full test suite**

Run: `npm test`
Expected: All tests PASS

- [ ] **Step 7: Commit**

```bash
git add src/components/nodes/SubsystemPreview.tsx test/unit/components/SubsystemPreview.test.tsx
git commit -m "feat: replace SVG SubsystemPreview with mini ReactFlow instance"
```

---

### Task 5: Delete dead code

Remove `typeToColor` utility and its tests — no longer used after SubsystemPreview rewrite.

**Files:**
- Delete: `src/lib/typeToColor.ts`
- Delete: `test/unit/lib/typeToColor.test.ts`

- [ ] **Step 1: Verify no remaining imports**

Run: `grep -r 'typeToColor' src/ test/ --include='*.ts' --include='*.tsx'`
Expected: No matches (only docs/ references remain)

- [ ] **Step 2: Delete files**

```bash
rm src/lib/typeToColor.ts test/unit/lib/typeToColor.test.ts
```

- [ ] **Step 3: Run full test suite**

Run: `npm test`
Expected: All tests PASS

- [ ] **Step 4: Commit**

```bash
git add -u src/lib/typeToColor.ts test/unit/lib/typeToColor.test.ts
git commit -m "chore: remove typeToColor utility (replaced by mini ReactFlow)"
```

---

### Task 6: Update transition hook — viewport-aware morph

Remove `captureMiniNodes`, scope `captureVisibleNodes` to a container element, pre-compute fitted viewport with `computeFitViewport`, and replace `fitView` in `finalize` with early `setViewport`.

**Files:**
- Modify: `src/components/canvas/hooks/useNavigationTransition.ts`

- [ ] **Step 1: Remove `captureMiniNodes` function**

Delete lines 96-113 of `useNavigationTransition.ts` (the `captureMiniNodes` function).

- [ ] **Step 2: Scope `captureVisibleNodes` and `captureVisibleEdges` to accept a container parameter**

Both functions need scoping because mini ReactFlow instances inside container nodes also have `.react-flow__node` and `.react-flow__edge` elements. Without scoping, the transition would capture nodes/edges from preview instances too.

Change `captureVisibleNodes`:
```ts
const captureVisibleNodes = (container?: Element | null): CapturedNode[] => {
  const root = container ?? document;
  const nodes: CapturedNode[] = [];
  root.querySelectorAll('.react-flow__node').forEach((el) => {
    // ... rest unchanged
  });
  return nodes;
};
```

Change `captureVisibleEdges`:
```ts
const captureVisibleEdges = (container?: Element | null): CapturedEdge[] => {
  const root = container ?? document;
  const edges: CapturedEdge[] = [];
  root.querySelectorAll('.react-flow__edge').forEach((el) => {
    // ... rest unchanged
  });
  return edges;
};
```

- [ ] **Step 3: Add helper to find the main canvas ReactFlow container**

The main canvas's `.react-flow` wrapper must be distinguished from mini ReactFlow instances. Use the fact that mini ReactFlows live inside `.subsystem-preview` wrappers:

```ts
/** Find the main canvas ReactFlow container (excludes mini ReactFlow in previews) */
const getMainFlowContainer = (): Element | null => {
  // The main canvas ReactFlow is the one NOT inside a .subsystem-preview wrapper
  const allFlows = document.querySelectorAll('.react-flow');
  for (const flow of allFlows) {
    if (!flow.closest('.subsystem-preview')) return flow;
  }
  return null;
};
```

- [ ] **Step 4: Add `computeFitViewport` import and viewport helper**

At the top of the file:
```ts
import { computeFitViewport } from '@/lib/computeFitViewport';
```

Add a helper that computes target screen rects from ReactFlow node data. It uses `getMainFlowContainer` to scope the viewport measurement:

```ts
/** Compute fitted screen rects for target nodes using viewport math */
const computeTargetRects = (rfNodes: { id: string; position: { x: number; y: number }; width?: number; height?: number; data?: { node: { displayName?: string; id: string } } }[]): CapturedNode[] => {
  const mainFlow = getMainFlowContainer();
  if (!mainFlow) return [];
  const vpRect = mainFlow.getBoundingClientRect();

  const fitNodes = rfNodes.map((n) => ({
    x: n.position.x,
    y: n.position.y,
    width: n.width ?? 150,
    height: n.height ?? 40,
  }));

  const { zoom, offsetX, offsetY, nodeScreenRects } = computeFitViewport({
    nodes: fitNodes,
    viewportWidth: vpRect.width,
    viewportHeight: vpRect.height,
  });

  return rfNodes.map((n, i) => ({
    id: n.id,
    rect: new DOMRect(
      vpRect.left + nodeScreenRects[i].x,
      vpRect.top + nodeScreenRects[i].y,
      nodeScreenRects[i].width,
      nodeScreenRects[i].height,
    ),
    label: n.data?.node?.displayName ?? n.data?.node?.id ?? n.id,
    color: 'var(--color-node-border)',
  }));
};
```

- [ ] **Step 5: Update `finalize` — remove `fitView`**

Change `finalize` from:
```ts
const finalize = useCallback(() => {
  setTransitionData(null);
  setIsTransitioning(false);
  transitioningRef.current = false;
  requestAnimationFrame(() => {
    reactFlow.fitView({ duration: 300 });
  });
}, [reactFlow]);
```

To:
```ts
const finalize = useCallback(() => {
  setTransitionData(null);
  setIsTransitioning(false);
  transitioningRef.current = false;
}, []);
```

Note: `reactFlow` is removed from the dependency array since `fitView` is no longer called.

- [ ] **Step 6: Update `diveIn` — use scoped capture and `setViewport`**

The complete updated `diveIn` function:

```ts
const diveIn = useCallback((refNodeId: string) => {
  if (transitioningRef.current) return;
  transitioningRef.current = true;

  const currentCanvasId = useNavigationStore.getState().currentCanvasId;
  const containerRect = getNodeRect(refNodeId);

  // Capture source: mini-node rects from the RefNode's mini ReactFlow
  const miniContainer = document.querySelector(`[data-id="${refNodeId}"] .react-flow`);
  const sourceNodes = captureVisibleNodes(miniContainer);

  // Capture siblings (all main canvas nodes except the target container)
  const mainFlow = getMainFlowContainer();
  const allNodes = captureVisibleNodes(mainFlow);
  const siblings = allNodes.filter((n) => n.id !== refNodeId);

  // Phase 1: Mount overlay with clones at mini-node positions
  setIsTransitioning(true);
  setTransitionData({
    direction: 'in',
    sourceNodes,
    targetNodes: [],
    edges: [],
    containerRect: containerRect ?? null,
    targetContainerRect: null,
    siblings,
    fromCanvasId: currentCanvasId,
    toCanvasId: refNodeId,
    targetsReady: false,
    onComplete: finalize,
  });

  // Switch canvas behind the overlay
  useNavigationStore.getState().diveIn(refNodeId);

  // Phase 2: Compute fitted viewport and set target positions
  requestAnimationFrame(() => {
    const rfNodes = reactFlow.getNodes();
    const targetNodes = computeTargetRects(rfNodes);
    const edges = captureVisibleEdges(mainFlow);

    // Set viewport to fitted position while overlay is still opaque
    const mainFlowEl = getMainFlowContainer();
    if (mainFlowEl) {
      const vpRect = mainFlowEl.getBoundingClientRect();
      const fitNodes = rfNodes.map((n) => ({
        x: n.position.x,
        y: n.position.y,
        width: n.width ?? 150,
        height: n.height ?? 40,
      }));
      const { zoom, offsetX, offsetY } = computeFitViewport({
        nodes: fitNodes,
        viewportWidth: vpRect.width,
        viewportHeight: vpRect.height,
      });
      reactFlow.setViewport({ x: offsetX, y: offsetY, zoom });
    }

    setTransitionData((prev) =>
      prev ? { ...prev, targetNodes, edges, targetsReady: true } : null,
    );
  });
}, [finalize, reactFlow]);
```

- [ ] **Step 7: Update `goUp` — use scoped capture and `setViewport`**

The complete updated `goUp` function:

```ts
const goUp = useCallback(() => {
  if (transitioningRef.current) return;
  const nav = useNavigationStore.getState();
  if (nav.breadcrumb.length <= 1) return;
  transitioningRef.current = true;

  const fromCanvasId = nav.currentCanvasId;

  // Capture source: full-size nodes from the current (child) canvas
  const mainFlow = getMainFlowContainer();
  const sourceNodes = captureVisibleNodes(mainFlow);
  const edges = captureVisibleEdges(mainFlow);

  // Phase 1: Mount overlay with full-size clones
  setIsTransitioning(true);
  setTransitionData({
    direction: 'out',
    sourceNodes,
    targetNodes: [],
    edges,
    containerRect: null,
    targetContainerRect: null,
    siblings: [],
    fromCanvasId,
    toCanvasId: '',
    targetsReady: false,
    onComplete: finalize,
  });

  // Switch canvas behind the overlay
  nav.goUp();

  // Phase 2: After parent canvas renders, capture target positions
  requestAnimationFrame(() => {
    const toCanvasId = useNavigationStore.getState().currentCanvasId;
    const targetContainerRect = getNodeRect(fromCanvasId);

    // Target: mini-node rects from the parent's RefNode mini ReactFlow
    const miniContainer = document.querySelector(`[data-id="${fromCanvasId}"] .react-flow`);
    const targetNodes = captureVisibleNodes(miniContainer);

    // Siblings: all parent canvas nodes except the container we came from
    const mainFlowEl = getMainFlowContainer();
    const parentNodes = captureVisibleNodes(mainFlowEl);
    const siblings = parentNodes.filter((n) => n.id !== fromCanvasId);

    // Set viewport to fitted position for the parent canvas
    if (mainFlowEl) {
      const rfNodes = reactFlow.getNodes();
      const vpRect = mainFlowEl.getBoundingClientRect();
      const fitNodes = rfNodes.map((n) => ({
        x: n.position.x,
        y: n.position.y,
        width: n.width ?? 150,
        height: n.height ?? 40,
      }));
      const { zoom, offsetX, offsetY } = computeFitViewport({
        nodes: fitNodes,
        viewportWidth: vpRect.width,
        viewportHeight: vpRect.height,
      });
      reactFlow.setViewport({ x: offsetX, y: offsetY, zoom });
    }

    setTransitionData((prev) =>
      prev
        ? { ...prev, targetNodes, targetContainerRect: targetContainerRect ?? null, siblings, toCanvasId, targetsReady: true }
        : null,
    );
  });
}, [finalize, reactFlow]);
```

- [ ] **Step 8: Run full test suite**

Run: `npm test`
Expected: All tests PASS

- [ ] **Step 9: Commit**

```bash
git add src/components/canvas/hooks/useNavigationTransition.ts
git commit -m "feat: viewport-aware transition — remove captureMiniNodes, add setViewport"
```

---

### Task 7: Simplify `NavigationTransition` overlay

Remove visual hacks that existed because source and target used different rendering systems. Both sides now use the same ReactFlow node rendering.

**Files:**
- Modify: `src/components/canvas/NavigationTransition.tsx:206,215`

- [ ] **Step 1: Remove font-size morphing**

Change line 215 from:
```ts
fontSize: isAnimating ? '12px' : '7px',
```
To:
```ts
fontSize: '12px',
```

Both source and target now render at full size (the mini ReactFlow just scales them down via zoom, not font size).

- [ ] **Step 2: Remove `color-mix` hack**

Change lines 205-208 from:
```ts
backgroundColor: src.color
  ? `color-mix(in srgb, ${src.color} 15%, var(--color-node-bg))`
  : 'var(--color-node-bg)',
border: `1.5px solid ${src.color || 'var(--color-node-border)'}`,
```
To:
```ts
backgroundColor: 'var(--color-node-bg)',
border: '1.5px solid var(--color-node-border)',
```

Both source and target now use the same CSS variables.

- [ ] **Step 3: Run full test suite**

Run: `npm test`
Expected: All tests PASS

- [ ] **Step 4: Commit**

```bash
git add src/components/canvas/NavigationTransition.tsx
git commit -m "fix: simplify transition overlay — remove font-size and color-mix hacks"
```

---

### Task 8: E2E verification and viewport stability test

Run the existing E2E tests and add a focused test verifying no second zoom step after transition.

**Files:**
- Modify: `test/e2e/subsystem.spec.ts`

- [ ] **Step 1: Fix existing E2E test that asserts SVG preview**

The test at `test/e2e/subsystem.spec.ts` line 205-209 asserts `svg.subsystem-preview` with `rect` elements. After the rewrite, the preview is a `div.subsystem-preview` containing a ReactFlow instance. Update the assertion:

Change:
```ts
// SubsystemPreview should be present (SVG with mini-node rects)
const preview = refNode.locator('svg.subsystem-preview');
await expect(preview).toBeVisible();
const rects = preview.locator('rect');
await expect(rects).toHaveCount(2);
```

To:
```ts
// SubsystemPreview should be present (mini ReactFlow instance)
const preview = refNode.locator('.subsystem-preview');
await expect(preview).toBeVisible();
// The mini ReactFlow should render the same number of nodes as the subsystem has
const miniNodes = preview.locator('.react-flow__node');
await expect(miniNodes).toHaveCount(2);
```

- [ ] **Step 2: Run existing E2E tests**

Run: `npm run test:e2e-no-bridge`
Expected: All tests PASS — particularly the 4 subsystem navigation tests:
- "navigate into subsystem and back"
- "dive-in navigation works and shows child canvas"
- "go-up via breadcrumb navigates back"
- "Escape key navigates up from subsystem"

- [ ] **Step 3: Add viewport stability test**

Add to `test/e2e/subsystem.spec.ts` in the navigation describe block:

```ts
test('dive-in transition does not cause a second zoom step', async ({ page }) => {
  await createSubsystem(page, 'Test System', /Service compute\/service/);

  // Add a node inside the subsystem so it has content
  await diveIntoSubsystem(page, 'Test System');

  // Wait for navigation transition to complete
  await page.waitForTimeout(800);

  // Capture viewport state immediately after transition
  const viewportBefore = await page.evaluate(() => {
    const vp = document.querySelector('.react-flow__viewport') as HTMLElement;
    return vp?.style.transform ?? '';
  });

  // Wait to see if viewport changes (fitView would kick in)
  await page.waitForTimeout(500);

  const viewportAfter = await page.evaluate(() => {
    const vp = document.querySelector('.react-flow__viewport') as HTMLElement;
    return vp?.style.transform ?? '';
  });

  expect(viewportAfter).toBe(viewportBefore);
});
```

- [ ] **Step 4: Run E2E tests including new test**

Run: `npm run test:e2e-no-bridge`
Expected: All tests PASS including the new viewport stability test

- [ ] **Step 5: Commit**

```bash
git add test/e2e/subsystem.spec.ts
git commit -m "test: update E2E for mini ReactFlow preview, add viewport stability test"
```

---

### Task 9: Visual verification with Playwright CLI

Use the `playwright-cli` skill to visually verify the mini ReactFlow preview matches the actual canvas rendering.

- [ ] **Step 1: Open the app and create a subsystem with nodes**

Use `playwright-cli` to navigate to the app, create a subsystem, add nodes inside it, then go back to the parent canvas.

- [ ] **Step 2: Screenshot the parent canvas showing the subsystem preview**

Capture a screenshot showing the RefNode container with the mini ReactFlow preview inside.

- [ ] **Step 3: Screenshot the subsystem canvas after diving in**

Dive into the subsystem and capture a screenshot of the full canvas.

- [ ] **Step 4: Compare visual consistency**

Verify that:
- Node shapes in the preview match the canvas (e.g., Database shows as cylinder in both)
- Colors match (theme CSS variables, not HSL hash)
- Transition is a single smooth morph (no second zoom step)
