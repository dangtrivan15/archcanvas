# Layout Quality Improvements — Design Spec

## Context

Auto-layout produces visually cluttered diagrams:

1. **Edge/node overlap** — Edge labels overlap nodes because ELK spacing is too tight (80px between layers, 50px between nodes) and ELK doesn't account for edge label dimensions.
2. **Edge labels forced to one line** — CSS `white-space: nowrap` truncates long labels like "JPA/Flyway — segments, workspace_connections".
3. **Weak semantic ordering** — ELK's layered algorithm respects flow direction but default strategies don't optimize well for architecture diagrams.
4. **Curved edges** — Bezier curves are less readable than orthogonal (90° bend) edges for system diagrams.

## Design Decisions

### Why orthogonal edges over Bezier

Architecture diagrams conventionally use orthogonal edges (UML, C4, cloud architecture diagrams). Orthogonal edges make flow direction visually obvious and reduce visual noise when many edges cross. Bezier curves work well for small graphs but become spaghetti-like at scale.

### Why ELK bend points + `getSmoothStepPath` fallback (not pure client-side routing)

ReactFlow's `getSmoothStepPath` is a pure function of two endpoints — it has **zero knowledge of obstacle nodes**. Edges can and will route through other nodes.

ELK's `ORTHOGONAL` edge routing computes obstacle-aware bend points during the full layout pass. However, ELK has no standalone "route one edge around obstacles" API ([eclipse/elk#315](https://github.com/eclipse/elk/issues/315), unimplemented).

**Approach A (chosen):** Use ELK bend points after auto-layout; fall back to `getSmoothStepPath` when nodes are manually dragged. Rationale: auto-layout is where edge quality matters most (the "generated" view). When users drag nodes, they accept responsibility for the arrangement.

**Why not approach B** (re-run ELK on every drag): ELK's `Layered` algorithm re-positions nodes — it doesn't support fixed-position edge-only routing. The `Fixed` algorithm respects positions but has limited routing.

**Why not approach C** (custom A*/visibility-graph router): More work with diminishing returns. Can be added later if drag-time edge quality becomes a problem.

## Changes

### 1. ELK layout tuning — `src/core/layout/elk.ts`

**Spacing increases:**

| Option | Current | New | Why |
|--------|---------|-----|-----|
| `elk.layered.spacing.nodeNodeBetweenLayers` | `80` | `180` | Room for edge labels between layers |
| `elk.spacing.nodeNode` | `50` | `80` | Reduce node crowding within a layer |

**New options:**

| Option | Value | Purpose |
|--------|-------|---------|
| `elk.spacing.edgeLabel` | `20` | Reserve space around edge labels |
| `elk.layered.spacing.edgeNodeBetweenLayers` | `40` | Gap between edges and nodes in adjacent layers |
| `elk.layered.nodePlacement.strategy` | `NETWORK_SIMPLEX` | Optimize vertical node positions within each layer to minimize edge length (default is `BRANDES_KOEPF`) |
| `elk.layered.crossingMinimization.strategy` | `LAYER_SWEEP` | Reduce edge crossings (already the ELK default — included for explicitness) |
| `elk.edgeRouting` | `ORTHOGONAL` | Already the default for `layered` — included for explicitness. The real fix is that `EdgeRenderer` currently ignores ELK's bend points and uses `getBezierPath` |

**Return type change:**

`computeLayout()` currently returns `{ positions: Map<string, Position> }`. It will additionally return edge routing data:

```typescript
export interface EdgeRoute {
  points: Array<{ x: number; y: number }>; // startPoint + bendPoints + endPoint
}

export interface LayoutResult {
  positions: Map<string, Position>;
  edgeRoutes: Map<string, EdgeRoute>; // key: "sourceId->targetId"
}
```

ELK returns `sections[].startPoint`, `sections[].bendPoints`, and `sections[].endPoint` per edge. We flatten these into a single ordered point array per edge.

**Edge ID correlation:** Current ELK code uses `edge-${idx}` as edge IDs. To build the `edgeRoutes` map, we read each result edge's `sources[0]` and `targets[0]` arrays (which contain the node IDs) and construct the key as `"sourceId->targetId"`.

### 2. Transient edge route state — `src/components/canvas/Canvas.tsx`

Edge routes are **transient** — valid only for the current node positions. Stored as local component state (not in a Zustand store, not persisted).

```typescript
const [edgeRoutes, setEdgeRoutes] = useState<Map<string, EdgeRoute>>(new Map());
```

**Lifecycle:**
- `handleAutoLayout()` calls `computeLayout()` → sets both node positions and `edgeRoutes`
- Node drag-**start** (`onNodesChange` with `change.dragging === true`) → clears `edgeRoutes` immediately. This ensures edges fall back to `getSmoothStepPath` during the drag, not after. Clearing on drag-end would leave stale bend points visible throughout the entire drag.
- Canvas navigation (scope change) → `edgeRoutes` resets naturally via component state

**Plumbing routes to EdgeRenderer:** `Canvas.tsx` transforms the `edges` array returned by `useCanvasRenderer()` to inject `route` data from the transient `edgeRoutes` map before passing to `<ReactFlow>`. The hook itself remains pure (derives from store data only). This keeps transient state contained in `Canvas.tsx`.

### 3. Edge renderer — `src/components/edges/EdgeRenderer.tsx`

Two rendering paths:

1. **If `data.route` exists** (after auto-layout): Build SVG path from the point array. Construct an `M x,y L x,y L x,y ...` path with optional rounded corners at bends (configurable `borderRadius`). **Label position** is computed as the midpoint of the total path length (walk the segments, find the point at 50% cumulative distance).
2. **If no route** (manual positioning / fallback): Use `getSmoothStepPath` from `@xyflow/react` (replaces current `getBezierPath`). Parameters: same source/target coordinates + `borderRadius: 8` for slightly rounded 90° bends. Label position comes from `getSmoothStepPath`'s returned `labelX`/`labelY` (same API as `getBezierPath`).

Both paths produce orthogonal edges. The difference is obstacle awareness.

### 4. Edge label wrapping — `src/components/edges/EdgeRenderer.css`

```css
.edge-label {
-  white-space: nowrap;
+  white-space: normal;
+  max-width: 200px;
+  text-align: center;
}
```

200px fits ~30 characters before wrapping. Labels remain compact but no longer truncate.

## Files Modified

| File | Change |
|------|--------|
| `src/core/layout/elk.ts` | Spacing values, new ELK options, extract edge routes from result |
| `src/components/edges/EdgeRenderer.tsx` | `getBezierPath` → conditional ELK route / `getSmoothStepPath` fallback |
| `src/components/edges/EdgeRenderer.css` | Edge label wrapping |
| `src/components/canvas/Canvas.tsx` | Transient `edgeRoutes` state, pass routes to edges, clear on drag |
| `src/components/canvas/types.ts` | Add `route?: EdgeRoute` to `CanvasEdgeData` |

No new files. No new dependencies.

## Testing

Existing `computeLayout` unit tests verify the function contract (positions returned for all nodes). We add:

- Unit test: `computeLayout` returns `edgeRoutes` with correct keys and non-empty point arrays when edges exist
- Unit test: `edgeRoutes` map is empty when canvas has no edges
- Update existing `EdgeRenderer.test.ts`: mock `getSmoothStepPath` instead of `getBezierPath`, add tests for both rendering paths (with `data.route` and without)

Visual tuning (spacing values, corner radius) is verified by inspection.

## Out of Scope

- Persisting edge routes to canvas files (routes are transient, recomputed on auto-layout)
- Custom pathfinding for drag-time obstacle avoidance (future enhancement if needed)
- Per-edge routing API (ELK doesn't support it — [eclipse/elk#315](https://github.com/eclipse/elk/issues/315))
