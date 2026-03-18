# Layout Quality Improvements — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve auto-layout quality — wider spacing, edge label wrapping, and better node placement strategy.

**Architecture:** ELK `computeLayout()` tuned with better spacing/strategy options and extended to extract edge routing data for future use. Edge labels wrap instead of truncating.

**Tech Stack:** ELK (elkjs), ReactFlow (`@xyflow/react`), Vitest

**Spec:** [docs/specs/2026-03-18-layout-quality-improvements-design.md](../specs/2026-03-18-layout-quality-improvements-design.md)

---

### Task 1: Add `EdgeRoute` type and update `LayoutResult`

**Files:**
- Modify: `src/core/layout/elk.ts` (add `EdgeRoute`, update `LayoutResult`)

- [x] **Step 1: Add `EdgeRoute` type and update `LayoutResult` in `elk.ts`**

```typescript
export interface EdgeRoute {
  points: Array<{ x: number; y: number }>;
}

export interface LayoutResult {
  positions: Map<string, Position>;
  edgeRoutes: Map<string, EdgeRoute>;
}
```

- [x] **Step 2: Return empty `edgeRoutes` from `computeLayout`**

Temporary placeholder until edge route extraction is added in Task 2.

- [x] **Step 3: Run type check and tests**
- [x] **Step 4: Commit**

---

### Task 2: Tune ELK options and extract edge routes

**Files:**
- Modify: `src/core/layout/elk.ts` (layout options + edge route extraction)
- Modify: `test/unit/core/layout/elk.test.ts` (add edge route tests)

- [x] **Step 1: Write failing tests for `edgeRoutes`**

Three tests: correct keys, non-empty points, empty for no edges.

- [x] **Step 2: Update ELK layout options**

| Option | Value |
|--------|-------|
| `elk.layered.spacing.nodeNodeBetweenLayers` | `180` (was `80`) |
| `elk.spacing.nodeNode` | `80` (was `50`) |
| `elk.spacing.edgeLabel` | `20` |
| `elk.layered.spacing.edgeNodeBetweenLayers` | `40` |
| `elk.spacing.edgeEdge` | `20` |
| `elk.layered.spacing.edgeEdgeBetweenLayers` | `20` |
| `elk.layered.nodePlacement.strategy` | `NETWORK_SIMPLEX` |
| `elk.layered.crossingMinimization.strategy` | `LAYER_SWEEP` |
| `elk.edgeRouting` | `ORTHOGONAL` |

- [x] **Step 3: Extract edge routes from ELK result**

Read `sources[0]`/`targets[0]` from each result edge, flatten `sections[0]` into point array, store as `"sourceId->targetId"` key.

- [x] **Step 4: Run tests, commit**

---

### Task 3: Edge label CSS wrapping

**Files:**
- Modify: `src/components/edges/EdgeRenderer.css`

- [x] **Step 1: Update `.edge-label` CSS**

```css
.edge-label {
  white-space: normal;
  max-width: 200px;
  text-align: center;
}
```

- [x] **Step 2: Run tests, commit**

---

### Task 4: Visual verification

- [ ] **Step 1: Start dev server and load project**
- [ ] **Step 2: Trigger auto-layout (Shift+L)**

Verify: wider spacing, edge labels wrap, better flow ordering (sources left, sinks right).

- [ ] **Step 3: Run E2E tests**

Run: `npm run test:e2e-no-bridge`
Expected: All pass.
