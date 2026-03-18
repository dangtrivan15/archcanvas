# 23: Mini Viewport Subsystem Preview

> **Date**: 2026-03-18 | **Status**: Complete
> **Scope**: Replace SVG-based SubsystemPreview with a non-interactive mini ReactFlow instance; fix two-phase zoom in navigation transitions; clean up dead code.

## Recap

The subsystem container nodes previously rendered child content as a custom SVG with uniform 44x16px rectangles, HSL-hashed colors (`typeToColor`), and 7px text — a completely separate rendering system from the actual canvas. This caused two problems: (1) a visual mismatch between the preview and the real canvas (different shapes, colors, font sizes, no icons), and (2) a two-phase zoom during dive-in transitions where `fitView()` kicked in as a visible second step after the morph overlay faded.

Both problems are now fixed. `SubsystemPreview` is a non-interactive `<ReactFlow>` instance wrapped in its own `<ReactFlowProvider>`, reusing the same `NodeRenderer`, `EdgeRenderer`, and CSS theme variables as the main canvas. Node shapes (cylinder for Database, hexagon for Service, etc.), Lucide icons, and theme colors now match exactly between preview and canvas. A `PreviewModeContext` prevents recursive ReactFlow nesting when RefNodes appear inside previews.

The transition hook now pre-computes the fitted viewport using `computeFitViewport` (a pure utility) and calls `setViewport()` while the morph overlay is still opaque — eliminating the second zoom step entirely. `captureVisibleNodes`/`captureVisibleEdges` are scoped to a container element to distinguish main canvas nodes from mini ReactFlow preview nodes. The SVG-specific `captureMiniNodes` function and `typeToColor` utility are deleted.

**Spec**: [docs/specs/2026-03-18-mini-viewport-subsystem-preview-design.md](../specs/2026-03-18-mini-viewport-subsystem-preview-design.md)
**Plan**: [docs/plans/2026-03-18-mini-viewport-subsystem-preview.md](../plans/2026-03-18-mini-viewport-subsystem-preview.md)

### Key deliverables
- `computeFitViewport` pure utility — node positions + viewport dims → zoom, offset, per-node screen rects
- `PreviewModeContext` — React context preventing recursive SubsystemPreview in mini ReactFlow
- `mapCanvasData.ts` — extracted `mapCanvasNodes`/`mapCanvasEdges` from `useCanvasRenderer` for reuse
- Rewritten `SubsystemPreview` — mini ReactFlow with own provider, fitView, all interactions disabled
- Viewport-aware transitions — `setViewport()` during opaque overlay, no post-transition `fitView`
- Simplified `NavigationTransition` overlay — removed font-size morph and `color-mix` hacks

### Stats
- **Unit tests**: 1430 (up from 1426 baseline — +8 computeFitViewport, +1 PreviewModeContext, -4 typeToColor, -1 SVG SubsystemPreview)
- **Test files**: 65 (net 0 — +1 computeFitViewport, -1 typeToColor)
- **E2E tests**: 88 passed (up from 87 — +1 viewport stability test)
- **Files changed**: 15 (5 new, 2 deleted, 8 modified)

## Decisions

| Decision | Chose | Over | Why |
|----------|-------|------|-----|
| Recursion guard mechanism | React context (`PreviewModeContext`) | Prop on `CanvasNodeData` | Avoids leaking preview concerns into the data type shared with the main canvas; context applies automatically to all nested NodeRenderers |
| Mini ReactFlow isolation | Own `ReactFlowProvider` per preview | Shared provider with main canvas | ReactFlow v12 uses provider-scoped internal store; sharing would cause viewport state conflicts between main canvas and previews |
| Viewport pre-computation | Pure `computeFitViewport` utility | Waiting for ReactFlow's async `fitView` | Enables instant `setViewport()` while overlay is opaque; eliminates the visible second zoom step; testable without React/DOM |
| DOM query scoping | Container parameter on capture functions | Global `document.querySelectorAll` | Mini ReactFlow instances also have `.react-flow__node` elements; unscoped queries would capture preview nodes during transitions |
| Container node height | `height: 100%` on `.node-shape-container` | Explicit pixel height | ReactFlow needs pixel dimensions on its parent; `height: 100%` propagates from ReactFlow wrapper's explicit dimensions set by `rfNode.width`/`rfNode.height` |

## Retrospective

- **What went well** — TDD discipline kept each task clean and verifiable. The 9-task plan decomposed naturally into independently testable units. The `computeFitViewport` pure function was trivial to test and immediately useful. Extracting `mapCanvasData` before rewriting SubsystemPreview avoided a large monolithic change.

- **What didn't** — ReactFlow's "parent container needs width and height" requirement wasn't caught until visual verification (Task 9). The `flex: 1` approach from the plan worked in unit tests (jsdom doesn't enforce layout) but failed in a real browser because the container node's `.arch-node` div didn't stretch to fill its ReactFlow wrapper. The CSS fix (`height: 100%`) was simple but required a full visual cycle to discover.

- **Lessons** — Visual verification with Playwright CLI is essential for ReactFlow changes, not just E2E assertions. Layout issues (flex vs. explicit dimensions) don't surface in jsdom. The plan's test assertions for `computeFitViewport` needed small fixes (maxZoom clamping edge cases) — test plans should account for default parameter values. E2E tests using `.react-flow__node` globally need scoping when mini ReactFlow instances exist on the page.

- **Notes for future** — Performance with many visible subsystem containers (>20) hasn't been tested; the design spec notes IntersectionObserver-based lazy mounting as a future optimization. The `computeAutoSize` utility still uses fixed `NODE_WIDTH=60, NODE_HEIGHT=30` estimates for container sizing; now that real ReactFlow nodes render inside, the auto-size may be slightly off (mini ReactFlow's `fitView` compensates).
