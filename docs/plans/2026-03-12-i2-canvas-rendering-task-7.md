# Task 7: EdgeRenderer

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:writing-plans to plan
> the implementation steps for this task.

**Scope:** Protocol-based edge rendering
**Parent feature:** [I2 Canvas Rendering](./2026-03-12-i2-canvas-rendering-index.md)

## Write Set

- Create: `src/components/edges/EdgeRenderer.tsx` (~80 lines) — custom edge component
- Test: Create `test/unit/components/edges/EdgeRenderer.test.ts`

## Read Set (context needed)

- `src/components/canvas/types.ts` — `CanvasEdgeData`, `PROTOCOL_STYLES` (Task 5)
- `src/types/schema.ts` — `Edge`, `EdgeEndpoint`
- `docs/specs/2026-03-12-i2-canvas-rendering-design.md` — EdgeRenderer section, `@root/` ghost node section

## Dependencies

- **Blocked by:** Task 5 (CanvasEdgeData type, PROTOCOL_STYLES, Canvas.tsx registers this component)
- **Blocks:** None

## Description

A single custom ReactFlow edge component that styles edges based on their protocol. Uses the `PROTOCOL_STYLES` lookup from `types.ts` to determine visual treatment.

### Visual mapping

| Category | Visual |
|----------|--------|
| `sync` | Solid line, medium stroke-width (~2px), dark color |
| `async` | Dashed line with animated dash flow (CSS `stroke-dasharray` + `stroke-dashoffset` animation), medium color |
| `default` | Solid line, thin (~1px), gray |

### Component structure

Uses ReactFlow's `getBezierPath` (or `getSmoothStepPath`) for path computation. Renders:
1. The edge path `<path>` with style category classes
2. Edge label at midpoint (from `edge.label`)
3. Entity pills below the label (from `edge.entities[]`) — small rounded badges

### @root/ ghost nodes

When an edge has a `from.node` or `to.node` starting with `@root/`, the external endpoint renders as a ghost node — a faded badge positioned at the viewport edge. This is the most complex part:
- Ghost nodes are positioned at left (for `from` endpoints) or right (for `to` endpoints) of the viewport
- Vertically aligned with the connected internal node
- Non-interactive
- Show the parent node's displayName with a "↑" indicator

For this task, implement a simplified version: render `@root/` endpoints as a special marker SVG element near the edge start/end. Full viewport-edge positioning can be refined later.

### Tests

- Renders solid line for sync protocol (HTTP)
- Renders dashed animated line for async protocol (Kafka)
- Renders thin gray line for unknown protocol
- Renders edge label at midpoint
- Renders entity pills when entities present
- Handles edge with no protocol (defaults to 'default' style)
- Handles @root/ endpoint with ghost marker

### Acceptance Criteria

- Three distinct visual styles for sync/async/default
- Async edges have animated dash flow
- Edge labels and entity pills rendered
- @root/ endpoints have visual indicator
- `tsc --noEmit` passes
