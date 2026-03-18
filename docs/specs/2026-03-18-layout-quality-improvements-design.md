# Layout Quality Improvements — Design Spec

## Context

Auto-layout produces visually cluttered diagrams:

1. **Edge/node overlap** — Edge labels overlap nodes because ELK spacing is too tight (80px between layers, 50px between nodes) and ELK doesn't account for edge label dimensions.
2. **Edge labels forced to one line** — CSS `white-space: nowrap` truncates long labels like "JPA/Flyway — segments, workspace_connections".
3. **Weak semantic ordering** — ELK's layered algorithm respects flow direction but default strategies don't optimize well for architecture diagrams.

## Design Decisions

### Why not orthogonal edges

Orthogonal (90° bend) edges were prototyped but rejected. Two problems emerged:

1. **Handle overlap** — All outgoing edges from a node share the same handle position, so they exit on the same horizontal line and overlap until diverging into vertical channels. Bezier curves naturally diverge from a shared point.
2. **Coordinate mismatch** — ELK computes edge endpoints at the node border, but ReactFlow positions edges at Handle coordinates. Bridging this gap required fragile connector logic that produced visual artifacts.

Bezier curves combined with improved ELK spacing produce better results with no custom edge rendering code.

### Why `EdgeRoute` type is preserved in `elk.ts`

`computeLayout()` extracts ELK's edge routing data (`sections[].startPoint/bendPoints/endPoint`) into an `edgeRoutes` map. This infrastructure is kept for potential future use (e.g., smooth splines through waypoints) even though `EdgeRenderer` does not consume it currently.

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
| `elk.spacing.edgeEdge` | `20` | Spacing between parallel edge segments |
| `elk.layered.spacing.edgeEdgeBetweenLayers` | `20` | Spacing between edges between layers |
| `elk.layered.nodePlacement.strategy` | `NETWORK_SIMPLEX` | Optimize vertical node positions within each layer to minimize edge length (default is `BRANDES_KOEPF`) |
| `elk.layered.crossingMinimization.strategy` | `LAYER_SWEEP` | Reduce edge crossings (already the ELK default — included for explicitness) |
| `elk.edgeRouting` | `ORTHOGONAL` | Already the default for `layered` — included for explicitness |

**Return type extension:**

`computeLayout()` additionally returns edge routing data for future use:

```typescript
export interface EdgeRoute {
  points: Array<{ x: number; y: number }>;
}

export interface LayoutResult {
  positions: Map<string, Position>;
  edgeRoutes: Map<string, EdgeRoute>;
}
```

### 2. Edge label wrapping — `src/components/edges/EdgeRenderer.css`

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
| `src/core/layout/elk.ts` | Spacing values, new ELK options, `EdgeRoute` type, edge route extraction |
| `src/components/edges/EdgeRenderer.css` | Edge label wrapping |

No new files. No new dependencies. `EdgeRenderer.tsx` and `Canvas.tsx` unchanged.

## Testing

Existing `computeLayout` unit tests verify the function contract (positions returned for all nodes). We add:

- Unit test: `computeLayout` returns `edgeRoutes` with correct keys and non-empty point arrays when edges exist
- Unit test: `edgeRoutes` map is empty when canvas has no edges

Visual tuning (spacing values) is verified by inspection.

## Out of Scope

- Orthogonal edge rendering (prototyped and rejected — see Design Decisions)
- Persisting edge routes to canvas files
- Custom pathfinding for obstacle avoidance
- Per-edge routing API (ELK doesn't support it — [eclipse/elk#315](https://github.com/eclipse/elk/issues/315))
