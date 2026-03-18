# Subsystem Enhancements Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make subsystem RefNodes visually rich — resizable containers with reactive mini-node previews and morphing navigation animations.

**Architecture:** RefNodes switch to container rendering with `NodeResizer` + an SVG `SubsystemPreview`. Navigation transitions use a `position: fixed` overlay that morphs mini-nodes into full-sized nodes via CSS transitions + rAF edge interpolation, then swaps for the real ReactFlow canvas.

**Tech Stack:** React 19, ReactFlow 12 (`NodeResizer`), Zustand 5, Zod 4, CSS transitions, `requestAnimationFrame`

**Spec:** `docs/specs/2026-03-18-subsystem-enhancements-design.md`

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `src/types/schema.ts` | Modify | Add `autoSize` to `Position` schema |
| `src/lib/computeAutoSize.ts` | Create | Pure bounding-box → dimensions function |
| `src/lib/typeToColor.ts` | Create | Deterministic type string → HSL color |
| `src/components/nodes/SubsystemPreview.tsx` | Create | SVG mini-node map for subsystem content |
| `src/components/nodes/NodeRenderer.tsx` | Modify | Container mode for RefNodes, mount NodeResizer + SubsystemPreview |
| `src/components/nodes/nodeShapes.css` | Modify | Container styling for ref-nodes |
| `src/components/canvas/hooks/useCanvasRenderer.ts` | Modify | Auto-fit sizing, `width`/`height` on RFNodes for RefNodes |
| `src/components/canvas/NavigationTransition.tsx` | Create | Morph animation overlay |
| `src/components/canvas/hooks/useNavigationTransition.ts` | Create | Transition orchestration hook (replaces useCanvasNavigation) |
| `src/components/canvas/hooks/useCanvasNavigation.ts` | Remove | Replaced by useNavigationTransition |
| `src/components/canvas/Canvas.tsx` | Modify | Mount NavigationTransition, use new hook, event listeners |
| `src/components/shared/Breadcrumb.tsx` | Modify | Dispatch navigation events instead of direct store calls |
| `src/components/canvas/hooks/useCanvasKeyboard.ts` | Modify | Dispatch navigate event instead of direct store call for go-up |
| `src/components/shared/ContextMenu.tsx` | Modify | Add "Fit to content" item for RefNodes |

---

## Task 1: Schema — Add `autoSize` to Position

**Files:**
- Modify: `src/types/schema.ts:29-35`
- Test: `test/unit/schema.test.ts`

- [ ] **Step 1: Write failing test for `autoSize` field**

```ts
// In test/unit/schema.test.ts — add to existing Position tests
describe('Position.autoSize', () => {
  it('accepts autoSize boolean', () => {
    const result = Position.safeParse({ x: 10, y: 20, autoSize: true });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.autoSize).toBe(true);
  });

  it('autoSize is optional (defaults to undefined)', () => {
    const result = Position.safeParse({ x: 10, y: 20 });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.autoSize).toBeUndefined();
  });

  it('round-trips with width, height, and autoSize', () => {
    const input = { x: 0, y: 0, width: 240, height: 160, autoSize: false };
    const result = Position.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toEqual(input);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --run test/unit/schema.test.ts`
Expected: FAIL — `autoSize` not recognized by schema

- [ ] **Step 3: Add `autoSize` to Position schema**

In `src/types/schema.ts`, update the Position schema:

```ts
export const Position = z.object({
  x: z.number(),
  y: z.number(),
  width: z.number().optional(),
  height: z.number().optional(),
  autoSize: z.boolean().optional(),
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- --run test/unit/schema.test.ts`
Expected: PASS

- [ ] **Step 5: Run full test suite to check for regressions**

Run: `npm test -- --run`
Expected: All tests pass. The `autoSize` field is optional and backward-compatible.

- [ ] **Step 6: Commit**

```bash
git add src/types/schema.ts test/unit/schema.test.ts
git commit -m "feat: add autoSize field to Position schema"
```

---

## Task 2: `computeAutoSize` Utility

**Files:**
- Create: `src/lib/computeAutoSize.ts`
- Test: `test/unit/lib/computeAutoSize.test.ts`

**Context:** This pure function computes the bounding box of a subsystem's child nodes and returns `{ width, height }` for the container. Used by `useCanvasRenderer` for auto-fit sizing.

- [ ] **Step 1: Write failing tests**

```ts
// test/unit/lib/computeAutoSize.test.ts
import { describe, it, expect } from 'vitest';
import { computeAutoSize } from '@/lib/computeAutoSize';
import type { Canvas } from '@/types';

describe('computeAutoSize', () => {
  it('returns minimum size for empty canvas', () => {
    const canvas: Canvas = { nodes: [] };
    const result = computeAutoSize(canvas);
    expect(result).toEqual({ width: 180, height: 120 });
  });

  it('returns minimum size for undefined canvas', () => {
    const result = computeAutoSize(undefined);
    expect(result).toEqual({ width: 180, height: 120 });
  });

  it('returns minimum size for single node at origin', () => {
    const canvas: Canvas = {
      nodes: [{ id: 'a', type: 'service', position: { x: 0, y: 0 } }],
    };
    const result = computeAutoSize(canvas);
    // Single node + padding should be at least minimum
    expect(result.width).toBeGreaterThanOrEqual(180);
    expect(result.height).toBeGreaterThanOrEqual(120);
  });

  it('grows with spread-out nodes', () => {
    const canvas: Canvas = {
      nodes: [
        { id: 'a', type: 'service', position: { x: 0, y: 0 } },
        { id: 'b', type: 'service', position: { x: 200, y: 0 } },
        { id: 'c', type: 'service', position: { x: 100, y: 150 } },
      ],
    };
    const result = computeAutoSize(canvas);
    // Bounding box is 200×150 + padding for node size (~60×30) + margins (~48×56)
    expect(result.width).toBeGreaterThan(200);
    expect(result.height).toBeGreaterThan(150);
  });

  it('clamps to maximum size', () => {
    const canvas: Canvas = {
      nodes: [
        { id: 'a', type: 'service', position: { x: 0, y: 0 } },
        { id: 'b', type: 'service', position: { x: 1000, y: 800 } },
      ],
    };
    const result = computeAutoSize(canvas);
    expect(result.width).toBeLessThanOrEqual(400);
    expect(result.height).toBeLessThanOrEqual(300);
  });

  it('handles nodes without positions', () => {
    const canvas: Canvas = {
      nodes: [
        { id: 'a', type: 'service' }, // no position
        { id: 'b', type: 'service', position: { x: 50, y: 50 } },
      ],
    };
    const result = computeAutoSize(canvas);
    expect(result.width).toBeGreaterThanOrEqual(180);
    expect(result.height).toBeGreaterThanOrEqual(120);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- --run test/unit/lib/computeAutoSize.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement `computeAutoSize`**

```ts
// src/lib/computeAutoSize.ts
import type { Canvas } from '@/types';

const MIN_WIDTH = 180;
const MIN_HEIGHT = 120;
const MAX_WIDTH = 400;
const MAX_HEIGHT = 300;

// Estimated average node size in mini-preview coordinates
const NODE_WIDTH = 60;
const NODE_HEIGHT = 30;

// Header height + margins
const HEADER_HEIGHT = 32;
const MARGIN = 24;

export function computeAutoSize(
  canvas: Canvas | undefined,
): { width: number; height: number } {
  const nodes = canvas?.nodes ?? [];
  if (nodes.length === 0) {
    return { width: MIN_WIDTH, height: MIN_HEIGHT };
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const node of nodes) {
    const x = node.position?.x ?? 0;
    const y = node.position?.y ?? 0;
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x + NODE_WIDTH > maxX) maxX = x + NODE_WIDTH;
    if (y + NODE_HEIGHT > maxY) maxY = y + NODE_HEIGHT;
  }

  const contentWidth = maxX - minX + MARGIN * 2;
  const contentHeight = maxY - minY + MARGIN * 2 + HEADER_HEIGHT;

  return {
    width: Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, contentWidth)),
    height: Math.max(MIN_HEIGHT, Math.min(MAX_HEIGHT, contentHeight)),
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- --run test/unit/lib/computeAutoSize.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/computeAutoSize.ts test/unit/lib/computeAutoSize.test.ts
git commit -m "feat: add computeAutoSize utility for subsystem container sizing"
```

---

## Task 3: `typeToColor` Utility

**Files:**
- Create: `src/lib/typeToColor.ts`
- Test: `test/unit/lib/typeToColor.test.ts`

**Context:** Maps node type strings to HSL colors for the mini-node preview. Must be deterministic (same type always returns same color).

- [ ] **Step 1: Write failing tests**

```ts
// test/unit/lib/typeToColor.test.ts
import { describe, it, expect } from 'vitest';
import { typeToColor } from '@/lib/typeToColor';

describe('typeToColor', () => {
  it('returns a valid CSS HSL color string', () => {
    const color = typeToColor('service');
    expect(color).toMatch(/^hsl\(\d+,\s*\d+%,\s*\d+%\)$/);
  });

  it('is deterministic — same input returns same output', () => {
    expect(typeToColor('database')).toBe(typeToColor('database'));
  });

  it('different types produce different colors', () => {
    const colors = new Set([
      typeToColor('service'),
      typeToColor('database'),
      typeToColor('queue'),
      typeToColor('cache'),
      typeToColor('gateway'),
    ]);
    // At least 3 distinct colors from 5 types (hash collisions are possible but rare)
    expect(colors.size).toBeGreaterThanOrEqual(3);
  });

  it('handles empty string', () => {
    const color = typeToColor('');
    expect(color).toMatch(/^hsl\(\d+,\s*\d+%,\s*\d+%\)$/);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- --run test/unit/lib/typeToColor.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement `typeToColor`**

```ts
// src/lib/typeToColor.ts

/**
 * Deterministic mapping from a node type string to an HSL color.
 * Uses a simple string hash to pick a hue. Saturation and lightness are
 * fixed to produce muted, preview-friendly colors.
 */
export function typeToColor(type: string): string {
  let hash = 0;
  for (let i = 0; i < type.length; i++) {
    hash = ((hash << 5) - hash + type.charCodeAt(i)) | 0;
  }
  const hue = ((hash % 360) + 360) % 360;
  return `hsl(${hue}, 55%, 55%)`;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- --run test/unit/lib/typeToColor.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/typeToColor.ts test/unit/lib/typeToColor.test.ts
git commit -m "feat: add typeToColor utility for mini-node preview colors"
```

---

## Task 4: SubsystemPreview Component

**Files:**
- Create: `src/components/nodes/SubsystemPreview.tsx`
- Test: `test/unit/components/SubsystemPreview.test.tsx`

**Context:** SVG component rendered inside RefNode containers. Reads child canvas from fileStore, renders mini rectangles + labels + edge lines. Non-interactive, reactive.

**Key reference:**
- `src/store/fileStore.ts` — `getCanvas(canvasId)` returns `LoadedCanvas | undefined`. The store clones the Map on mutations (`new Map(project.canvases)`), so the Map reference changes. However, `useFileStore(s => s.getCanvas(canvasId))` alone is **not reliably reactive** because Zustand compares selector results with `Object.is` — the `LoadedCanvas` object at a given key may be the same reference if a *different* canvas was mutated. To guarantee reactivity, the selector must touch the canvases Map reference so Zustand detects when *any* canvas changes:
- `src/types/schema.ts` — `Canvas.nodes` is `Node[]`, each with `id`, optional `position`, and either `type` (InlineNode) or `ref` (RefNode). `Canvas.edges` has `from.node` and `to.node`.

- [ ] **Step 1: Write failing tests**

```tsx
// test/unit/components/SubsystemPreview.test.tsx
import { describe, it, expect, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { SubsystemPreview } from '@/components/nodes/SubsystemPreview';
import { useFileStore } from '@/store/fileStore';

// Helper to set up a canvas in the store
function setCanvas(canvasId: string, data: { nodes?: any[]; edges?: any[] }) {
  const store = useFileStore.getState();
  // Use internal method to register a canvas for testing
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
    expect(container.querySelector('svg')).toBeNull();
  });

  it('renders nothing when canvas does not exist', () => {
    const { container } = render(<SubsystemPreview canvasId="nonexistent" />);
    expect(container.querySelector('svg')).toBeNull();
  });

  it('renders rect elements for each node', () => {
    setCanvas('test-canvas', {
      nodes: [
        { id: 'a', type: 'service', position: { x: 0, y: 0 } },
        { id: 'b', type: 'database', position: { x: 100, y: 50 } },
      ],
    });
    const { container } = render(<SubsystemPreview canvasId="test-canvas" />);
    const rects = container.querySelectorAll('rect');
    expect(rects.length).toBe(2);
  });

  it('renders text labels for each node', () => {
    setCanvas('test-canvas', {
      nodes: [
        { id: 'a', type: 'service', displayName: 'API', position: { x: 0, y: 0 } },
      ],
    });
    const { container } = render(<SubsystemPreview canvasId="test-canvas" />);
    const texts = container.querySelectorAll('text');
    expect(texts.length).toBe(1);
    expect(texts[0].textContent).toBe('API');
  });

  it('renders line elements for each edge', () => {
    setCanvas('test-canvas', {
      nodes: [
        { id: 'a', type: 'service', position: { x: 0, y: 0 } },
        { id: 'b', type: 'database', position: { x: 100, y: 50 } },
      ],
      edges: [{ from: { node: 'a' }, to: { node: 'b' } }],
    });
    const { container } = render(<SubsystemPreview canvasId="test-canvas" />);
    const lines = container.querySelectorAll('line');
    expect(lines.length).toBe(1);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- --run test/unit/components/SubsystemPreview.test.tsx`
Expected: FAIL — module not found

- [ ] **Step 3: Implement SubsystemPreview**

```tsx
// src/components/nodes/SubsystemPreview.tsx
import { useFileStore } from '@/store/fileStore';
import { typeToColor } from '@/lib/typeToColor';

interface SubsystemPreviewProps {
  canvasId: string;
}

const MINI_NODE_W = 44;
const MINI_NODE_H = 16;
const PADDING = 12;
const MAX_LABEL_LEN = 10;

export function SubsystemPreview({ canvasId }: SubsystemPreviewProps) {
  // Subscribe to canvases Map reference so Zustand re-renders when any canvas mutates.
  // getCanvas alone is not reliably reactive (same LoadedCanvas ref if a different canvas changed).
  const canvas = useFileStore((s) => {
    void s.project?.canvases; // touch Map ref for subscription
    return s.getCanvas(canvasId);
  });
  const nodes = canvas?.data.nodes ?? [];
  const edges = canvas?.data.edges ?? [];

  if (nodes.length === 0) return null;

  // Compute bounding box of node positions
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const n of nodes) {
    const x = n.position?.x ?? 0;
    const y = n.position?.y ?? 0;
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x + MINI_NODE_W > maxX) maxX = x + MINI_NODE_W;
    if (y + MINI_NODE_H > maxY) maxY = y + MINI_NODE_H;
  }

  const contentW = maxX - minX + PADDING * 2;
  const contentH = maxY - minY + PADDING * 2;

  // Build a node position map for edge rendering
  const nodePositions = new Map<string, { cx: number; cy: number }>();
  for (const n of nodes) {
    const x = (n.position?.x ?? 0) - minX + PADDING;
    const y = (n.position?.y ?? 0) - minY + PADDING;
    nodePositions.set(n.id, { cx: x + MINI_NODE_W / 2, cy: y + MINI_NODE_H / 2 });
  }

  return (
    <svg
      viewBox={`0 0 ${contentW} ${contentH}`}
      className="subsystem-preview"
      style={{ width: '100%', flex: 1, pointerEvents: 'none', minHeight: 0 }}
      preserveAspectRatio="xMidYMid meet"
    >
      {/* Edges first (behind nodes) */}
      {edges.map((edge, i) => {
        const from = nodePositions.get(edge.from.node);
        const to = nodePositions.get(edge.to.node);
        if (!from || !to) return null;
        return (
          <line
            key={i}
            x1={from.cx} y1={from.cy}
            x2={to.cx} y2={to.cy}
            stroke="currentColor"
            strokeOpacity={0.2}
            strokeWidth={0.8}
          />
        );
      })}

      {/* Nodes */}
      {nodes.map((n) => {
        const x = (n.position?.x ?? 0) - minX + PADDING;
        const y = (n.position?.y ?? 0) - minY + PADDING;
        const type = 'type' in n ? n.type : 'ref';
        const color = typeToColor(type);
        const displayName = ('displayName' in n && n.displayName) ? n.displayName : n.id;
        const label = displayName.length > MAX_LABEL_LEN
          ? displayName.slice(0, MAX_LABEL_LEN - 1) + '…'
          : displayName;

        return (
          <g key={n.id}>
            <rect
              x={x} y={y}
              width={MINI_NODE_W} height={MINI_NODE_H}
              rx={3}
              fill={color}
              fillOpacity={0.15}
              stroke={color}
              strokeOpacity={0.4}
              strokeWidth={0.8}
            />
            <text
              x={x + MINI_NODE_W / 2}
              y={y + MINI_NODE_H / 2 + 1}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize={7}
              fill={color}
              fillOpacity={0.8}
            >
              {label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- --run test/unit/components/SubsystemPreview.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/nodes/SubsystemPreview.tsx test/unit/components/SubsystemPreview.test.tsx
git commit -m "feat: add SubsystemPreview SVG component for mini-node maps"
```

---

## Task 5: NodeRenderer Container Mode + NodeResizer

**Files:**
- Modify: `src/components/nodes/NodeRenderer.tsx`
- Modify: `src/components/nodes/nodeShapes.css`
- Test: `test/unit/components/NodeRenderer.test.tsx` (existing, add container tests)

**Context:**
- `NodeResizer` imports from `@xyflow/react` (bundled in v12.10.1).
- `isVisible` must be gated on `isSelected`.
- `handleResize` reads `canvasId` from `useNavigationStore.getState().currentCanvasId` (established pattern).
- On resize end, calls `graphStore.updateNodePosition(canvasId, nodeId, { ...existingPos, width, height, autoSize: false })`.
- For `isRef` nodes, the shape class switches from `node-shape-${shape}` to `node-shape-container`.

- [ ] **Step 1: Write failing tests for container rendering**

Add to existing NodeRenderer test file (or create if none exists). Tests should verify:
- RefNode renders with `node-shape-container` class
- RefNode renders SubsystemPreview
- RefNode renders NodeResizer when selected
- InlineNodes are unchanged (no NodeResizer, no SubsystemPreview)

**Important:** The existing test file mocks `@xyflow/react`. Add `NodeResizer` to the mock:
```ts
// In the existing vi.mock('@xyflow/react', ...) block, add:
NodeResizer: (props: any) => <div data-testid="node-resizer" data-visible={props.isVisible} />,
```

```tsx
// Add to test/unit/components/NodeRenderer.test.tsx (or nodes/NodeRenderer.test.tsx)
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { NodeRenderer } from '@/components/nodes/NodeRenderer';

const wrapperProps = (overrides: Partial<any> = {}) => ({
  id: 'test',
  type: 'archNode' as const,
  data: {
    node: { id: 'test-ref', ref: 'test-ref.yaml', position: { x: 0, y: 0 } },
    nodeDef: undefined,
    isSelected: false,
    isRef: true,
    ...overrides,
  },
  selected: false,
  isConnectable: true,
  positionAbsoluteX: 0,
  positionAbsoluteY: 0,
  zIndex: 0,
  dragging: false,
  sourcePosition: undefined,
  targetPosition: undefined,
  dragHandle: undefined,
  parentId: undefined,
  width: 240,
  height: 160,
});

describe('NodeRenderer container mode', () => {
  it('renders ref-node with container shape class', () => {
    const { container } = render(
      <NodeRenderer {...wrapperProps()} />
    );
    const node = container.querySelector('.arch-node');
    expect(node?.classList.contains('node-shape-container')).toBe(true);
    expect(node?.classList.contains('ref-node')).toBe(true);
  });

  it('does not use container shape for inline nodes', () => {
    const { container } = render(
      <NodeRenderer {...wrapperProps({
        node: { id: 'inline', type: 'service', position: { x: 0, y: 0 } },
        isRef: false,
      })} />
    );
    const node = container.querySelector('.arch-node');
    expect(node?.classList.contains('node-shape-container')).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- --run test/unit/components/NodeRenderer.test.tsx`
Expected: FAIL — RefNode does not have `node-shape-container` class

- [ ] **Step 3: Update NodeRenderer for container mode**

In `src/components/nodes/NodeRenderer.tsx`:

1. Import `NodeResizer` from `@xyflow/react` and `SubsystemPreview`.
2. Import `useNavigationStore` and `useGraphStore`.
3. When `isRef`, override shape to `'container'` and render `NodeResizer` + `SubsystemPreview`.
4. Add resize handler that commits to `graphStore.updateNodePosition`.

Key changes:
- `const shape = isRef ? 'container' : (nodeDef?.metadata.shape ?? 'rectangle');`
- Add `<NodeResizer>` inside the div when `isRef`
- Add `<SubsystemPreview canvasId={node.id} />` after the header when `isRef`
- Add `handleResize` callback

- [ ] **Step 4: Update nodeShapes.css**

The `.node-shape-container` class already exists with `min-width: 180px; min-height: 80px` and `.ref-node` applies `border-style: dashed`. However, `.node-shape-container` sets `border: 2px solid` which overrides `.ref-node`'s dashed style (appears later in the file). To preserve the dashed border for ref-node containers, add a combined selector:

```css
.node-shape-container.ref-node {
  border-style: dashed;
  border-width: 2px;
}
```

This ensures container RefNodes keep their dashed visual identity while using the larger container sizing.

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test -- --run test/unit/components/NodeRenderer.test.tsx`
Expected: PASS

- [ ] **Step 6: Run full test suite**

Run: `npm test -- --run`
Expected: All pass. Existing inline node rendering is unchanged.

- [ ] **Step 7: Commit**

```bash
git add src/components/nodes/NodeRenderer.tsx src/components/nodes/nodeShapes.css
git commit -m "feat: switch RefNodes to container mode with NodeResizer and SubsystemPreview"
```

---

## Task 6: Auto-fit Sizing in useCanvasRenderer

**Files:**
- Modify: `src/components/canvas/hooks/useCanvasRenderer.ts:23-41`

**Context:**
- When building RFNodes for RefNodes, set `width`/`height` as top-level fields on the RFNode object.
- If `autoSize !== false`: compute from `computeAutoSize(childCanvas)` and clamp.
- If `autoSize === false`: use stored `position.width`/`position.height`.
- fileStore's `getCanvas()` is reactive (Map cloned on mutations), so reading child canvas inside the memo triggers re-renders when child content changes. Add `useFileStore` dependency to the memo.

- [ ] **Step 1: Modify node building in useCanvasRenderer**

Import `computeAutoSize` from `@/lib/computeAutoSize`.

For reactivity: subscribe to the canvases Map reference at the hook level. This re-runs the memo when any canvas is mutated (the Map reference changes on every `updateCanvasData` call). This is a deliberate trade-off — recomputing auto-fit sizes for all RefNodes on any canvas mutation is cheap (bounding-box math) and RefNode count per canvas is small.

```ts
// At hook level — subscribe to canvases Map reference for reactivity
const canvasesRef = useFileStore((s) => s.project?.canvases);
```

Add `canvasesRef` to the `useMemo` dependency array for `nodes`.

Inside the `useMemo` that builds `nodes`, add dimension computation for RefNodes:

```ts
// Inside the rawNodes.map callback, after creating the rfNode:
if (isRef) {
  // Read child canvas from the reactive canvasesRef (NOT getState — that bypasses subscription)
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
```

- [ ] **Step 2: Run existing tests to check for regressions**

Run: `npm test -- --run`
Expected: All pass. Non-RefNodes are unaffected.

- [ ] **Step 3: Commit**

```bash
git add src/components/canvas/hooks/useCanvasRenderer.ts
git commit -m "feat: auto-fit sizing for RefNode containers in useCanvasRenderer"
```

---

## Task 7: Context Menu — "Fit to content"

**Files:**
- Modify: `src/components/shared/ContextMenu.tsx`
- Modify: `src/components/canvas/Canvas.tsx`

**Context:**
- Add a "Fit to content" menu item for RefNodes when `autoSize` is `false`.
- `autoSize` is accessible via `target.nodeData.node.position?.autoSize`.
- Handler calls `graphStore.updateNodePosition(canvasId, nodeId, { ...existingPos, autoSize: true, width: undefined, height: undefined })`.

- [ ] **Step 1: Add "Fit to content" to ContextMenu**

In `ContextMenu.tsx`, when `target.kind === 'refNode'`:
- Read `autoSize` from `target.nodeData.node.position?.autoSize`.
- If `autoSize === false`, render a "Fit to content" menu item.
- On click, call the new `onRefNodeFitContent` prop.

Add the prop to the ContextMenu component interface:
```ts
onRefNodeFitContent?: (nodeId: string) => void;
```

- [ ] **Step 2: Wire handler in Canvas.tsx**

Add `handleRefNodeFitContent` callback:
```ts
const handleRefNodeFitContent = useCallback((nodeId: string) => {
  const canvasId = useNavigationStore.getState().currentCanvasId;
  const canvas = useFileStore.getState().getCanvas(canvasId);
  const node = canvas?.data.nodes?.find((n) => n.id === nodeId);
  if (!node?.position) return;
  useGraphStore.getState().updateNodePosition(canvasId, nodeId, {
    ...node.position,
    autoSize: true,
    width: undefined,
    height: undefined,
  });
}, []);
```

Pass `onRefNodeFitContent={handleRefNodeFitContent}` to `<ContextMenu>`.

- [ ] **Step 3: Run tests**

Run: `npm test -- --run`
Expected: All pass.

- [ ] **Step 4: Commit**

```bash
git add src/components/shared/ContextMenu.tsx src/components/canvas/Canvas.tsx
git commit -m "feat: add 'Fit to content' context menu item for subsystem containers"
```

---

## Task 8: Navigation Transition — Dive-in Morph

**Files:**
- Create: `src/components/canvas/NavigationTransition.tsx`
- Create: `src/components/canvas/hooks/useNavigationTransition.ts`
- Modify: `src/components/canvas/Canvas.tsx`
- Remove: `src/components/canvas/hooks/useCanvasNavigation.ts`
- Modify: `src/components/canvas/hooks/useCanvasKeyboard.ts`

**Context:**
- This is the most complex task. The overlay uses `position: fixed` to render clones of nodes at their screen positions, then CSS-transitions them to target positions.
- `isTransitioning` blocks keyboard/mouse interactions during animation.
- Edge endpoints are interpolated via `requestAnimationFrame` tracking node positions.
- `useCanvasNavigation.ts` is replaced — update import in `Canvas.tsx:7` and destructuring at `Canvas.tsx:32` atomically.
- **Critical:** `useCanvasKeyboard.ts` calls `useNavigationStore.getState().goUp()` directly for Escape key navigation. This must be changed to dispatch `archcanvas:navigate-up` so it goes through the transition hook. Without this, pressing Escape to go up bypasses the animation entirely.

- [ ] **Step 1: Create `useNavigationTransition` hook**

`src/components/canvas/hooks/useNavigationTransition.ts`

This hook manages:
- `isTransitioning` state
- `transitionData` — captured DOM positions, target positions, direction
- `diveIn(refNodeId)` — Phase 1 (capture) → Phase 2 (animate) → Phase 3 (swap)
- `goUp()` — reverse morph for one-level, dissolve otherwise
- `goToBreadcrumb(index)` — dissolve

Key implementation notes:
- Uses `useReactFlow()` for `fitView`.
- Reads `navigationStore` directly via `getState()` for store mutations.
- Capture phase reads DOM via `document.querySelector('[data-id="nodeId"]')` to get ReactFlow node elements.
- Returns `{ diveIn, goUp, goToBreadcrumb, isTransitioning, transitionData }`.

- [ ] **Step 2: Create `NavigationTransition` overlay component**

`src/components/canvas/NavigationTransition.tsx`

Renders a `position: fixed; inset: 0; z-index: 50` overlay when `transitionData` is set.

For **dive-in**:
- Render cloned sibling nodes as divs at their captured screen positions → CSS transition opacity to 0
- Render container border div at captured rect → CSS transition to viewport bounds
- Render mini-node divs at captured positions → CSS transition to target positions (font-size, padding, left, top all transition)
- Render SVG with edge lines → `requestAnimationFrame` loop reads each node div's `getBoundingClientRect` and updates SVG line attributes

For **reverse morph (go-up)**:
- Same structure but reversed: start at full positions, transition to mini positions
- Container border appears and shrinks, siblings fade in

For **dissolve**:
- Simple div with `opacity: 1` → transition to `opacity: 0` over 300ms

The `transitionend` event on the last-moving element triggers the swap callback.

- [ ] **Step 3: Update Canvas.tsx**

1. Replace `useCanvasNavigation` import with `useNavigationTransition`.
2. Destructure `{ diveIn, goUp, goToBreadcrumb, isTransitioning, transitionData }`.
3. Mount `<NavigationTransition>` as a sibling of `<ReactFlow>`.
4. Add `archcanvas:navigate-up` and `archcanvas:navigate-to-breadcrumb` event listeners that call `goUp()` and `goToBreadcrumb(index)`.
5. Gate `onNodesChange`, `onConnect`, and keyboard handlers on `!isTransitioning`.
6. Delete `useCanvasNavigation.ts`.
7. Update `useCanvasKeyboard.ts`: replace `useNavigationStore.getState().goUp()` with `window.dispatchEvent(new CustomEvent('archcanvas:navigate-up'))` so Escape-to-go-up goes through the transition hook.

- [ ] **Step 4: Manual testing**

Use the `playwright-cli` skill to:
1. Open the app, create a subsystem, add nodes to it.
2. Double-click the subsystem — verify morph animation plays and child canvas renders.
3. Verify edges follow nodes during animation (no lag/jump).
4. Verify keyboard shortcuts are blocked during transition.

- [ ] **Step 5: Commit**

```bash
git add src/components/canvas/NavigationTransition.tsx \
  src/components/canvas/hooks/useNavigationTransition.ts \
  src/components/canvas/Canvas.tsx
git rm src/components/canvas/hooks/useCanvasNavigation.ts
git commit -m "feat: add morph animation for subsystem navigation (dive-in)"
```

---

## Task 9: Navigation Transition — Go-up + Breadcrumb Wiring

**Files:**
- Modify: `src/components/shared/Breadcrumb.tsx`
- Modify: `src/components/canvas/NavigationTransition.tsx` (go-up logic)
- Modify: `src/components/canvas/hooks/useNavigationTransition.ts` (go-up + dissolve)

**Context:**
- `Breadcrumb.tsx` currently calls `navigationStore.goToBreadcrumb()` directly.
- Switch to dispatching `archcanvas:navigate-up` and `archcanvas:navigate-to-breadcrumb` custom events.
- `Canvas.tsx` already listens for these events (wired in Task 8).
- Go-up reverse morph: `currentCanvasId` = RefNode ID in parent (canvas map keyed by node.id).

- [ ] **Step 1: Update Breadcrumb.tsx to dispatch events**

Replace direct store calls with event dispatch:

```tsx
// Instead of: goToBreadcrumb(i)
const handleBreadcrumbClick = (index: number) => {
  if (index === breadcrumb.length - 2) {
    // One level up — triggers reverse morph
    window.dispatchEvent(new CustomEvent('archcanvas:navigate-up'));
  } else {
    // Multi-level jump — triggers dissolve
    window.dispatchEvent(
      new CustomEvent('archcanvas:navigate-to-breadcrumb', { detail: { index } })
    );
  }
};
```

- [ ] **Step 2: Implement go-up reverse morph in useNavigationTransition**

The `goUp()` function:
1. Sets `isTransitioning = true`.
2. Captures current full-node screen positions.
3. Saves `currentCanvasId` (= the RefNode ID in the parent, since canvas map is keyed by `node.id`).
4. Calls `navigationStore.goUp()` to switch canvas (hidden behind overlay). After this, `currentCanvasId` is now the parent.
5. Reads the parent canvas (now current) to find the RefNode by the saved ID. Gets its screen position to compute the target container rect where nodes must shrink back to.
6. Sets transition data with direction `'out'` → triggers reverse morph in `NavigationTransition`.
7. On `transitionend`: remove overlay, set `isTransitioning = false`.

**Note on ordering:** Step 4 (goUp) must happen *before* step 5 (read parent) because after goUp, the parent canvas is rendered by ReactFlow (behind the overlay) and its DOM positions are available. The RefNode ID is saved in step 3 before the switch.

- [ ] **Step 3: Implement dissolve in useNavigationTransition**

The `goToBreadcrumb(index)` function:
1. Sets `isTransitioning = true`.
2. Sets transition data with direction `'dissolve'`.
3. Calls `navigationStore.goToBreadcrumb(index)` after a frame (so overlay renders first).
4. Overlay fades out over 300ms.
5. On `transitionend`: remove overlay, set `isTransitioning = false`.

- [ ] **Step 4: Manual testing**

Use `playwright-cli` skill to:
1. Navigate into a subsystem (dive-in from Task 8).
2. Click breadcrumb parent — verify reverse morph animation.
3. Navigate two levels deep, click root breadcrumb — verify dissolve animation.
4. Verify Escape during animation snaps to final state.

- [ ] **Step 5: Commit**

```bash
git add src/components/shared/Breadcrumb.tsx \
  src/components/canvas/NavigationTransition.tsx \
  src/components/canvas/hooks/useNavigationTransition.ts
git commit -m "feat: add reverse morph (go-up) and dissolve (breadcrumb jump) navigation"
```

---

## Task 10: E2E Tests

**Files:**
- Modify: `test/e2e/subsystem.spec.ts`

**Context:**
- Existing E2E spec at `test/e2e/subsystem.spec.ts` has 7 tests for subsystem creation.
- Add new tests for container rendering, preview, resize, and navigation animation.
- Run with: `npm run test:e2e:no-bridge`

- [ ] **Step 1: Add container rendering tests**

```ts
test.describe('Subsystem Container', () => {
  test('subsystem renders as container with preview', async ({ page }) => {
    // Create a subsystem, add nodes to it
    // Verify the parent canvas shows a container with node-shape-container class
    // Verify SVG preview is present with rect elements
  });

  test('subsystem container is larger than regular nodes', async ({ page }) => {
    // Create a regular node and a subsystem
    // Compare bounding box sizes — subsystem should be significantly larger
  });
});
```

- [ ] **Step 2: Add resize tests**

```ts
test.describe('Subsystem Resize', () => {
  test('resize handles appear on selected subsystem', async ({ page }) => {
    // Click subsystem to select
    // Verify resize handle elements are visible
  });

  test('manual resize persists after save/reload', async ({ page }) => {
    // Select subsystem, drag resize handle
    // Save project
    // Reload page, open same project
    // Verify subsystem has same dimensions
  });

  test('fit to content resets auto-size', async ({ page }) => {
    // Manually resize subsystem
    // Right-click → "Fit to content"
    // Verify size resets to auto-fit
  });
});
```

- [ ] **Step 3: Add navigation animation tests**

```ts
test.describe('Subsystem Navigation Animation', () => {
  test('dive-in morph animation plays', async ({ page }) => {
    // Double-click subsystem
    // Verify transition overlay appears briefly
    // Verify child canvas renders after animation
    // Verify breadcrumb shows subsystem name
  });

  test('go-up reverse morph plays', async ({ page }) => {
    // Navigate into subsystem
    // Click parent breadcrumb
    // Verify reverse morph plays and parent canvas renders
  });

  test('multi-level breadcrumb jump uses dissolve', async ({ page }) => {
    // Navigate two levels deep (create nested subsystem)
    // Click root breadcrumb
    // Verify dissolve transition
  });
});
```

- [ ] **Step 4: Run E2E tests**

Run: `npm run test:e2e:no-bridge`
Expected: All tests pass (existing + new).

- [ ] **Step 5: Commit**

```bash
git add test/e2e/subsystem.spec.ts
git commit -m "test: add E2E tests for subsystem container, resize, and navigation animation"
```

---

## Task Dependencies

```
Task 1 (schema) ─────────────────┐
Task 2 (computeAutoSize) ────────┤
Task 3 (typeToColor) ────────────┼─→ Task 4 (SubsystemPreview) ─→ Task 5 (NodeRenderer) ─→ Task 6 (useCanvasRenderer)
                                  │                                                            ↓
                                  │                                                      Task 7 (ContextMenu)
                                  │
                                  └─→ Task 8 (NavigationTransition dive-in) ─→ Task 9 (go-up + breadcrumb)
                                                                                      ↓
                                                                                Task 10 (E2E tests)
```

Tasks 1, 2, 3 are independent and can run in parallel.
Tasks 8–9 can start after Task 5 (they need the container rendering to capture positions from).
Task 10 depends on all others.
