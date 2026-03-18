# Layout Quality Improvements — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve auto-layout quality — wider spacing, orthogonal edges with ELK bend points, edge label wrapping, and better node placement strategy.

**Architecture:** ELK `computeLayout()` is extended to return edge routing data alongside positions. `Canvas.tsx` holds transient route state and injects it into edge data. `EdgeRenderer` renders ELK bend points when available, falls back to `getSmoothStepPath`.

**Tech Stack:** ELK (elkjs), ReactFlow (`@xyflow/react` — `getSmoothStepPath`, `EdgeLabelRenderer`), Vitest

**Spec:** [docs/specs/2026-03-18-layout-quality-improvements-design.md](../specs/2026-03-18-layout-quality-improvements-design.md)

---

### Task 1: Add `EdgeRoute` type and extend `CanvasEdgeData`

**Files:**
- Modify: `src/core/layout/elk.ts:27-29` (add `EdgeRoute`, update `LayoutResult`)
- Modify: `src/components/canvas/types.ts:12-16` (add `route?` to `CanvasEdgeData`)

- [ ] **Step 1: Add `EdgeRoute` type and update `LayoutResult` in `elk.ts`**

In `src/core/layout/elk.ts`, add the `EdgeRoute` interface and update `LayoutResult`:

```typescript
export interface EdgeRoute {
  points: Array<{ x: number; y: number }>;
}

export interface LayoutResult {
  positions: Map<string, Position>;
  edgeRoutes: Map<string, EdgeRoute>;
}
```

- [ ] **Step 2: Add `route` to `CanvasEdgeData` in `types.ts`**

In `src/components/canvas/types.ts`, import `EdgeRoute` and add it to the interface:

```typescript
import type { EdgeRoute } from '@/core/layout/elk';

export interface CanvasEdgeData extends Record<string, unknown> {
  edge: Edge;
  styleCategory: 'sync' | 'async' | 'default';
  inherited?: boolean;
  route?: EdgeRoute;
}
```

- [ ] **Step 3: Fix compilation — return empty `edgeRoutes` from `computeLayout`**

At the bottom of `computeLayout()` in `elk.ts`, change the return to include an empty map (we'll populate it in Task 2):

```typescript
return { positions, edgeRoutes: new Map() };
```

- [ ] **Step 4: Run type check**

Run: `npx tsc --noEmit`
Expected: No errors. The new fields are optional (`route?`) or empty maps, so existing consumers are unaffected.

- [ ] **Step 5: Run tests**

Run: `npm run test:unit`
Expected: All pass. No behavioral change yet.

- [ ] **Step 6: Commit**

```bash
git add src/core/layout/elk.ts src/components/canvas/types.ts
git commit -m "feat: add EdgeRoute type and extend CanvasEdgeData with optional route"
```

---

### Task 2: Tune ELK options and extract edge routes

**Files:**
- Modify: `src/core/layout/elk.ts:96-125` (layout options + edge route extraction)
- Modify: `test/unit/core/layout/elk.test.ts` (add edge route tests)

- [ ] **Step 1: Write failing tests for `edgeRoutes`**

Add to `test/unit/core/layout/elk.test.ts`:

```typescript
it('returns edgeRoutes with correct keys for edges', async () => {
  const canvas = makeCanvas(['a', 'b', 'c'], [
    { from: 'a', to: 'b' },
    { from: 'b', to: 'c' },
  ]);

  const result = await computeLayout(canvas);

  expect(result.edgeRoutes.size).toBe(2);
  expect(result.edgeRoutes.has('a->b')).toBe(true);
  expect(result.edgeRoutes.has('b->c')).toBe(true);
});

it('edgeRoutes contain non-empty point arrays', async () => {
  const canvas = makeCanvas(['a', 'b'], [{ from: 'a', to: 'b' }]);

  const result = await computeLayout(canvas);

  const route = result.edgeRoutes.get('a->b');
  expect(route).toBeDefined();
  expect(route!.points.length).toBeGreaterThanOrEqual(2);
  for (const pt of route!.points) {
    expect(typeof pt.x).toBe('number');
    expect(typeof pt.y).toBe('number');
  }
});

it('returns empty edgeRoutes when canvas has no edges', async () => {
  const canvas = makeCanvas(['a', 'b']);

  const result = await computeLayout(canvas);

  expect(result.edgeRoutes.size).toBe(0);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run test/unit/core/layout/elk.test.ts`
Expected: The first two new tests FAIL (edgeRoutes is empty). The third passes (already returns empty map).

- [ ] **Step 3: Update ELK layout options**

In `src/core/layout/elk.ts`, replace the `layoutOptions` object:

```typescript
const graph = {
  id: 'root',
  layoutOptions: {
    'elk.algorithm': 'layered',
    'elk.direction': direction,
    'elk.layered.spacing.nodeNodeBetweenLayers': '180',
    'elk.spacing.nodeNode': '80',
    'elk.spacing.edgeLabel': '20',
    'elk.layered.spacing.edgeNodeBetweenLayers': '40',
    'elk.layered.nodePlacement.strategy': 'NETWORK_SIMPLEX',
    'elk.layered.crossingMinimization.strategy': 'LAYER_SWEEP',
    'elk.edgeRouting': 'ORTHOGONAL',
  },
  children,
  edges: elkEdges,
};
```

- [ ] **Step 4: Extract edge routes from ELK result**

After the positions loop in `computeLayout()`, add edge route extraction before the return statement:

```typescript
const edgeRoutes = new Map<string, EdgeRoute>();

for (const edge of result.edges ?? []) {
  // ElkExtendedEdge has sources/targets arrays
  const src = (edge as { sources?: string[] }).sources?.[0];
  const tgt = (edge as { targets?: string[] }).targets?.[0];
  const sections = (edge as { sections?: Array<{
    startPoint: { x: number; y: number };
    endPoint: { x: number; y: number };
    bendPoints?: Array<{ x: number; y: number }>;
  }> }).sections;

  if (src && tgt && sections && sections.length > 0) {
    const section = sections[0];
    const points: Array<{ x: number; y: number }> = [
      section.startPoint,
      ...(section.bendPoints ?? []),
      section.endPoint,
    ];
    edgeRoutes.set(`${src}->${tgt}`, { points });
  }
}

return { positions, edgeRoutes };
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run test/unit/core/layout/elk.test.ts`
Expected: All tests pass, including the three new ones.

- [ ] **Step 6: Run full test suite**

Run: `npm run test:unit`
Expected: All pass. The layout option changes don't affect test contracts (they test positions exist, not pixel values).

- [ ] **Step 7: Commit**

```bash
git add src/core/layout/elk.ts test/unit/core/layout/elk.test.ts
git commit -m "feat: tune ELK spacing/strategy and extract edge routes from layout"
```

---

### Task 3: Switch EdgeRenderer to orthogonal edges with route support

**Files:**
- Modify: `src/components/edges/EdgeRenderer.tsx` (two rendering paths)
- Modify: `test/unit/components/edges/EdgeRenderer.test.ts` (update mock, add route tests)

- [ ] **Step 1: Update EdgeRenderer mock in test file**

In `test/unit/components/edges/EdgeRenderer.test.ts`, replace the `vi.mock` block:

```typescript
vi.mock('@xyflow/react', () => ({
  getSmoothStepPath: () => ['M0 0 L 30 0 L 30 30', 15, 15],
  EdgeLabelRenderer: ({ children }: { children: React.ReactNode }) => children,
  Position: { Top: 'top', Bottom: 'bottom', Left: 'left', Right: 'right' },
}));
```

- [ ] **Step 2: Add tests for the two rendering paths**

Add to the test file:

```typescript
describe('rendering paths', () => {
  it('uses ELK route path when data.route is present', () => {
    const route = {
      points: [
        { x: 0, y: 50 },
        { x: 50, y: 50 },
        { x: 50, y: 150 },
        { x: 100, y: 150 },
      ],
    };
    const { container } = render(
      React.createElement(EdgeRenderer, {
        ...defaultProps,
        data: makeData({ route }),
      }),
    );
    const path = container.querySelector('path');
    expect(path).toBeTruthy();
    const d = path?.getAttribute('d') ?? '';
    // ELK route path starts with M and uses L commands (not curve commands)
    expect(d).toMatch(/^M\s/);
    expect(d).not.toContain('C');
  });

  it('uses getSmoothStepPath fallback when no route', () => {
    const { container } = render(
      React.createElement(EdgeRenderer, {
        ...defaultProps,
        data: makeData(),
      }),
    );
    const path = container.querySelector('path');
    expect(path).toBeTruthy();
    // Path comes from the mocked getSmoothStepPath
    expect(path?.getAttribute('d')).toBe('M0 0 L 30 0 L 30 30');
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run test/unit/components/edges/EdgeRenderer.test.ts`
Expected: FAIL — `getBezierPath` is no longer mocked (we changed it to `getSmoothStepPath`), and the route test expects path logic that doesn't exist yet.

- [ ] **Step 4: Implement the two rendering paths in EdgeRenderer**

Replace the full content of `src/components/edges/EdgeRenderer.tsx`:

```typescript
import { getSmoothStepPath, EdgeLabelRenderer, type EdgeProps } from '@xyflow/react';
import type { Edge as RFEdge } from '@xyflow/react';
import type { CanvasEdgeData } from '../canvas/types';
import type { EdgeRoute } from '@/core/layout/elk';
import { useCanvasStore } from '../../store/canvasStore';
import './EdgeRenderer.css';

type EdgeRendererProps = EdgeProps<RFEdge<CanvasEdgeData>>;

const BEND_RADIUS = 8;

/**
 * Build an SVG path from an array of points with rounded corners at bends.
 */
function buildRoutePath(points: EdgeRoute['points']): string {
  if (points.length < 2) return '';
  const parts: string[] = [`M ${points[0].x} ${points[0].y}`];

  for (let i = 1; i < points.length - 1; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const next = points[i + 1];

    // Direction vectors from curr to prev and curr to next
    const dxIn = curr.x - prev.x;
    const dyIn = curr.y - prev.y;
    const dxOut = next.x - curr.x;
    const dyOut = next.y - curr.y;

    const lenIn = Math.sqrt(dxIn * dxIn + dyIn * dyIn);
    const lenOut = Math.sqrt(dxOut * dxOut + dyOut * dyOut);

    // Clamp radius to half the shortest segment
    const r = Math.min(BEND_RADIUS, lenIn / 2, lenOut / 2);

    // Points where the curve starts and ends
    const startX = curr.x - (dxIn / lenIn) * r;
    const startY = curr.y - (dyIn / lenIn) * r;
    const endX = curr.x + (dxOut / lenOut) * r;
    const endY = curr.y + (dyOut / lenOut) * r;

    parts.push(`L ${startX} ${startY}`);
    parts.push(`Q ${curr.x} ${curr.y} ${endX} ${endY}`);
  }

  const last = points[points.length - 1];
  parts.push(`L ${last.x} ${last.y}`);
  return parts.join(' ');
}

/**
 * Compute the label position at the midpoint of the total path length.
 */
function routeLabelPosition(points: EdgeRoute['points']): { x: number; y: number } {
  if (points.length < 2) return points[0] ?? { x: 0, y: 0 };

  // Calculate total length
  let totalLength = 0;
  const segLengths: number[] = [];
  for (let i = 1; i < points.length; i++) {
    const dx = points[i].x - points[i - 1].x;
    const dy = points[i].y - points[i - 1].y;
    const len = Math.sqrt(dx * dx + dy * dy);
    segLengths.push(len);
    totalLength += len;
  }

  // Walk to the midpoint
  let remaining = totalLength / 2;
  for (let i = 0; i < segLengths.length; i++) {
    if (remaining <= segLengths[i]) {
      const t = remaining / segLengths[i];
      return {
        x: points[i].x + (points[i + 1].x - points[i].x) * t,
        y: points[i].y + (points[i + 1].y - points[i].y) * t,
      };
    }
    remaining -= segLengths[i];
  }

  return points[points.length - 1];
}

export function EdgeRenderer({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  markerEnd,
}: EdgeRendererProps) {
  let edgePath: string;
  let labelX: number;
  let labelY: number;

  const route = data?.route;

  if (route && route.points.length >= 2) {
    // ELK-computed obstacle-aware path
    edgePath = buildRoutePath(route.points);
    const labelPos = routeLabelPosition(route.points);
    labelX = labelPos.x;
    labelY = labelPos.y;
  } else {
    // Fallback: client-side orthogonal path (no obstacle awareness)
    [edgePath, labelX, labelY] = getSmoothStepPath({
      sourceX,
      sourceY,
      targetX,
      targetY,
      sourcePosition,
      targetPosition,
      borderRadius: BEND_RADIUS,
    });
  }

  const styleCategory = data?.styleCategory ?? 'default';
  const edge = data?.edge;
  const isInherited = data?.inherited === true;
  const highlightedEdgeIds = useCanvasStore((s) => s.highlightedEdgeIds);
  const isHighlighted = highlightedEdgeIds.includes(id);

  const classNames = [
    'react-flow__edge-path',
    `edge-${styleCategory}`,
    isInherited ? 'edge-inherited' : '',
    isHighlighted ? 'edge-highlighted' : '',
  ].filter(Boolean).join(' ');

  return (
    <>
      <path
        id={id}
        className={classNames}
        d={edgePath}
        markerEnd={isInherited ? undefined : markerEnd}
      />
      {edge?.label && (
        <EdgeLabelRenderer>
          <div
            className="edge-label nodrag nopan"
            style={{
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              position: 'absolute',
              pointerEvents: 'all',
            }}
          >
            {edge.label}
            {edge.entities && edge.entities.length > 0 && (
              <div className="entity-pills">
                {edge.entities.map((e) => (
                  <span key={e} className="entity-pill">
                    {e}
                  </span>
                ))}
              </div>
            )}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}
```

- [ ] **Step 5: Run EdgeRenderer tests**

Run: `npx vitest run test/unit/components/edges/EdgeRenderer.test.ts`
Expected: All pass (existing + new tests).

- [ ] **Step 6: Commit**

```bash
git add src/components/edges/EdgeRenderer.tsx test/unit/components/edges/EdgeRenderer.test.ts
git commit -m "feat: switch to orthogonal edges with ELK route support and getSmoothStepPath fallback"
```

---

### Task 4: Wire transient edge routes in Canvas.tsx

**Files:**
- Modify: `src/components/canvas/Canvas.tsx:30-59,82-119,249-254` (state, lifecycle, edge injection)

- [ ] **Step 1: Add `edgeRoutes` state and import**

In `src/components/canvas/Canvas.tsx`, add `useMemo` to the React import on line 1:

```typescript
import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
```

And add the `EdgeRoute` type import:

```typescript
import type { EdgeRoute } from '@/core/layout/elk';
```

Inside the `Canvas` function, after the `rfNodes` state, add:

```typescript
// ---------------------------------------------------------------------------
// Transient edge routes from ELK auto-layout.
// Valid only for current node positions — cleared on drag-start.
// ---------------------------------------------------------------------------
const [edgeRoutes, setEdgeRoutes] = useState<Map<string, EdgeRoute>>(new Map());
```

- [ ] **Step 2: Clear routes on drag-start in `onNodesChange`**

In the `onNodesChange` callback, add route clearing when a drag starts. Insert at the top of the callback, before the existing logic:

```typescript
const onNodesChange = useCallback((changes: NodeChange<RFNode<CanvasNodeData>>[]) => {
  // Clear ELK edge routes on drag-start — stale during drag
  for (const change of changes) {
    if (change.type === 'position' && change.dragging) {
      setEdgeRoutes(new Map());
      break;
    }
  }

  // Apply ALL changes locally so ReactFlow can render smooth drag movement
  setRfNodes((nds) => applyNodeChanges(changes, nds));

  // ... rest of existing handler unchanged
```

- [ ] **Step 3: Store edge routes from `handleAutoLayout`**

In `handleAutoLayout`, after the positions loop, add:

```typescript
// Store ELK edge routes for obstacle-aware rendering
setEdgeRoutes(result.edgeRoutes);
```

This goes right before the `requestAnimationFrame` call.

- [ ] **Step 4: Inject routes into edges before passing to ReactFlow**

In the return JSX, the `<ReactFlow>` currently receives `edges={edges}`. Replace with a `useMemo` that injects routes:

```typescript
const edgesWithRoutes = useMemo(() => {
  if (edgeRoutes.size === 0) return edges;
  return edges.map((edge) => {
    const routeKey = `${edge.source}->${edge.target}`;
    const route = edgeRoutes.get(routeKey);
    if (!route) return edge;
    return { ...edge, data: { ...edge.data, route } };
  });
}, [edges, edgeRoutes]);
```

Then update the JSX:

```tsx
<ReactFlow
  nodes={rfNodes}
  edges={edgesWithRoutes}
  ...
```

- [ ] **Step 5: Run type check**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 6: Run full unit tests**

Run: `npm run test:unit`
Expected: All pass.

- [ ] **Step 7: Commit**

```bash
git add src/components/canvas/Canvas.tsx
git commit -m "feat: wire transient edge routes — store on auto-layout, clear on drag, inject into edges"
```

---

### Task 5: Edge label CSS wrapping

**Files:**
- Modify: `src/components/edges/EdgeRenderer.css:34-43`

- [ ] **Step 1: Update edge label CSS**

In `src/components/edges/EdgeRenderer.css`, replace the `.edge-label` rule:

```css
/* Edge label container */
.edge-label {
  background: var(--color-card);
  border: 1px solid var(--color-border);
  border-radius: 4px;
  padding: 2px 6px;
  font-size: 11px;
  font-weight: 500;
  color: var(--color-foreground);
  white-space: normal;
  max-width: 200px;
  text-align: center;
}
```

- [ ] **Step 2: Run full unit tests**

Run: `npm run test:unit`
Expected: All pass. CSS-only change.

- [ ] **Step 3: Commit**

```bash
git add src/components/edges/EdgeRenderer.css
git commit -m "fix: allow edge labels to wrap with max-width instead of forcing single line"
```

---

### Task 6: Visual verification

- [ ] **Step 1: Start dev server**

Run: `npm run dev`

- [ ] **Step 2: Load a project with multiple nodes and edges**

Open the app in a browser. Load or create a project with 5+ nodes and several edges (ideally the system shown in the screenshot from the issue).

- [ ] **Step 3: Trigger auto-layout (Shift+L or toolbar button)**

Verify:
- Nodes are spaced further apart than before
- Edges are orthogonal (90° bends), not curves
- Edge labels wrap onto multiple lines if long
- Edges route around nodes (obstacle-aware) after auto-layout
- Flow direction is left-to-right (source nodes left, sink nodes right)

- [ ] **Step 4: Drag a node**

Verify:
- Edges immediately switch to `getSmoothStepPath` rendering (may cross nodes — expected)
- No visual glitches or stale bend points during drag

- [ ] **Step 5: Re-run auto-layout after drag**

Verify: edges snap back to obstacle-aware ELK routes.

- [ ] **Step 6: Run E2E tests**

Run: `npm run test:e2e-no-bridge`
Expected: All pass. Layout changes are visual only — E2E tests don't assert pixel positions.
