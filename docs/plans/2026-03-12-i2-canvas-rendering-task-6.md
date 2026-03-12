# Task 6: NodeRenderer + CSS Shapes

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:writing-plans to plan
> the implementation steps for this task.

**Scope:** Polymorphic node component
**Parent feature:** [I2 Canvas Rendering](./2026-03-12-i2-canvas-rendering-index.md)

## Write Set

- Create: `src/components/nodes/NodeRenderer.tsx` (~120 lines) — single polymorphic node component
- Create: `src/components/nodes/nodeShapes.css` (~100 lines CSS) — 9 shape definitions
- Test: Create `test/unit/components/nodes/NodeRenderer.test.ts`

## Read Set (context needed)

- `src/components/canvas/types.ts` — `CanvasNodeData` interface (Task 5)
- `src/types/nodeDefSchema.ts` — `NodeDef` type, `metadata.icon`, `metadata.shape`, `spec.ports`
- `src/types/schema.ts` — `InlineNode`, `RefNode`, `Node`
- `docs/specs/2026-03-12-i2-canvas-rendering-design.md` — NodeRenderer section (layout diagram, shapes, ports, ref node rendering)

## Dependencies

- **Blocked by:** Task 5 (CanvasNodeData type, Canvas.tsx registers this component)
- **Blocks:** None

## Description

A single React component that renders all node types on the canvas. It receives `CanvasNodeData` and adapts its visual presentation based on the node type, NodeDef metadata, and ref status.

### Component structure

```tsx
function NodeRenderer({ data }: NodeProps<CanvasNodeData>) {
  const { node, nodeDef, isSelected, isRef } = data;
  const shape = nodeDef?.metadata.shape ?? 'rectangle';

  return (
    <div className={`arch-node node-shape-${shape} ${isSelected ? 'selected' : ''} ${isRef ? 'ref-node' : ''}`}>
      {/* Header: icon + displayName + dive-in indicator */}
      {/* Body: type label + key args */}
      {/* Ports: ReactFlow Handles */}
      {/* Footer: note/ref count badges */}
    </div>
  );
}
```

### Key rendering rules

- **Shape**: CSS class `node-shape-{shape}` applied to outer wrapper. 9 shapes: `rectangle`, `cylinder`, `hexagon`, `parallelogram`, `cloud`, `stadium`, `document`, `badge`, `container`
- **Icon**: Resolved from `nodeDef.metadata.icon` → Lucide React icon. Use a lookup map of common icons. Fallback to a generic icon if not found.
- **Ports**: Rendered as ReactFlow `<Handle>` elements. Inbound ports on left (`Position.Left`), outbound on right (`Position.Right`). Port names as labels.
- **Ref nodes**: Dashed border, subsystem icon, displayName resolved from referenced canvas via `fileStore.getCanvas(refNode.ref)?.data.displayName ?? refNode.ref`
- **Unknown type** (nodeDef undefined): Warning badge, default rectangle shape
- **Selection**: Blue border highlight when `isSelected`

### CSS shapes (nodeShapes.css)

Each shape uses a combination of `border-radius`, `clip-path`, or CSS `shape-outside`:
- `rectangle`: default (no special styling)
- `cylinder`: rounded top/bottom with gradient
- `hexagon`: `clip-path: polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)`
- `parallelogram`: `clip-path: polygon(10% 0%, 100% 0%, 90% 100%, 0% 100%)`
- `cloud`: border-radius with pseudo-elements
- `stadium`: large border-radius on left/right
- `document`: wavy bottom border
- `badge`: pill shape (fully rounded)
- `container`: double border, larger min-width

### Tests (React Testing Library)

- Renders displayName for InlineNode
- Applies correct shape class from NodeDef metadata
- Renders ports as Handle elements (correct count and position)
- Renders ref node with dashed border and dive-in indicator
- Renders warning badge when nodeDef is undefined
- Applies selected class when isSelected is true
- Falls back to raw ref string when referenced canvas not found

### Acceptance Criteria

- Single component handles all 9 shapes
- Ports rendered correctly (left=inbound, right=outbound)
- Ref nodes visually distinct (dashed, subsystem icon)
- Unknown types render with warning, don't crash
- All CSS shapes visually distinct (verified in Storybook or visual test)
- `tsc --noEmit` passes
