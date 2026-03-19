# Node Type Overlay — Design Spec

**Date:** 2026-03-19
**Status:** Draft

## Problem

The "Add Node" button in the left toolbar dispatches `archcanvas:open-palette` with `{ prefix: '@' }`, which routes to `NodeSearchProvider` — listing existing canvas nodes for selection, not node types for creation. The `NodeTypeProvider` exists but is only reachable via the unprefixed palette or subsystem mode.

Beyond the routing bug, the command palette is not the most natural way to browse 32+ node types across 9 namespaces. A visual overlay with drag-to-canvas support better matches the mental model of "pick a type and place it."

## Goals

1. Add a hover overlay on the "Add Node" button that lists all NodeDef types grouped by namespace
2. Support drag-to-canvas to create nodes at the cursor drop position
3. Support click-to-add for quick node creation at a default position
4. Add a `+` prefix in the CommandPalette for keyboard-first node type search
5. Keep `@` prefix as-is (search existing nodes) — no change

## Non-Goals

- Canvas drop preview ghost (native drag image is sufficient)
- Accordion/collapsible namespaces (flat grouped grid is simpler and fast enough for 32 types)
- Radix popover (hover-to-peek and drag interactions conflict with focus-trap model)

## Architecture

### New Files

| File | Purpose |
|------|---------|
| `src/components/layout/NodeTypeOverlay.tsx` | Overlay component: grouped grid, filter input, hover/pin state, drag source, click-to-add |

### Modified Files

| File | Change |
|------|--------|
| `src/components/layout/LeftToolbar.tsx` | Render `NodeTypeOverlay`, replace `archcanvas:open-palette` dispatch with overlay hover/pin management |
| `src/components/canvas/Canvas.tsx` | Add `onDragOver` + `onDrop` handlers on the ReactFlow wrapper for node creation |
| `src/components/shared/CommandPalette.tsx` | Add `PREFIX_ADD = '+'` routing to `NodeTypeProvider`, update placeholder text |

### No New Dependencies

Uses native HTML5 drag-and-drop API, existing `motion/react` for animations, existing `useRegistryStore` for NodeDef data, existing `resolveIcon` for Lucide icon rendering.

## Interaction Model

### Hover Intent (Peek)

The "Add Node" button and the overlay form a shared hover zone:

1. Mouse enters "Add Node" button → overlay slides in (`motion` transition, ~150ms)
2. Mouse moves from button to overlay → overlay stays open
3. Mouse leaves both button AND overlay → 150ms delay → overlay slides out
4. Implementation: `onMouseEnter`/`onMouseLeave` on both elements sharing a timeout ref

### Pin

- Clicking the "Add Node" button toggles pin state
- Pinned overlay stays open regardless of hover; visual indicator (e.g. highlighted border)
- Unpin by: clicking button again, pressing `Escape`, or clicking on canvas

### Click-to-Add

- Clicking a type item in the overlay creates a node at a default staggered position
- Reuses the same naming/positioning logic as `NodeTypeProvider.onSelect` (unique display name, count-based stagger)
- Overlay stays open after click (user may want to add multiple nodes)

### Drag-to-Canvas

- Type items have `draggable="true"`
- `onDragStart` sets `dataTransfer` with MIME type `application/archcanvas-nodetype` and the type key as data (e.g. `"compute/service"`)
- Dragging auto-pins the overlay (prevents closing mid-drag)

## Overlay Layout

- **Width:** ~260px
- **Position:** absolute, to the right of the left toolbar (`left: 48px`), top-aligned with the "Add Node" button
- **Max height:** `calc(100vh - 32px)`, scrollable body
- **Filter input** at top: filters types by name using `registryStore.search(query)`, hides empty namespaces
- **Namespace headers:** uppercase, muted text
- **Type grid:** 2-column grid per namespace, each item shows Lucide icon (via `resolveIcon(nodeDef.metadata.icon)`) + display name
- **Animation:** `motion` slide-in/out, gated by `useReducedMotion()`
- **Namespace order:** follows builtin registration order (compute, data, messaging, network, client, integration, security, observability, ai)

## Canvas Drop Handling

On the wrapping `<div data-testid="main-canvas">` in `Canvas.tsx` (native DOM events, not ReactFlow props):

1. `onDragOver`: `e.preventDefault()` to allow drop, `e.dataTransfer.dropEffect = 'copy'`
2. `onDrop`: read type key from `e.dataTransfer.getData('application/archcanvas-nodetype')`, bail if empty (not our drag)
3. Convert screen position → canvas position via the existing `reactFlow` instance (`const reactFlow = useReactFlow()` already in Canvas.tsx): `reactFlow.screenToFlowPosition({ x: e.clientX, y: e.clientY })`
4. Create node with same logic as `NodeTypeProvider.onSelect`:
   - Resolve `NodeDef` for `displayName`
   - Count existing same-type nodes for unique naming (`Service`, `Service 2`, ...)
   - Generate id: `node-${crypto.randomUUID().slice(0, 8)}`
   - Call `graphStore.addNode(canvasId, node)`

## CommandPalette Changes

### New `+` Prefix

Add `PREFIX_ADD = '+'` constant. When input starts with `+`, route to `[NodeTypeProvider]`:

```typescript
const PREFIX_ADD = '+';

// In resolveProviders():
if (raw.startsWith(PREFIX_ADD)) {
  return { providers: [NodeTypeProvider], query: raw.slice(1).trimStart() };
}
```

### `N` Shortcut (new)

There is currently no `N` keydown handler — the toolbar only displays `N` as a tooltip hint. Add a new `N` key binding in `useCanvasKeyboard.ts` that dispatches `archcanvas:open-palette` with `{ prefix: '+' }`.

The toolbar "Add Node" button itself no longer dispatches this event — it manages the overlay instead.

### Placeholder Update

Update the palette input placeholder to include the new prefix:

```
"Type a command or search… (> actions, @ nodes, # entities, + add node)"
```

### `@` Prefix — Unchanged

`@` continues to route to `NodeSearchProvider` (search/select existing canvas nodes). No changes needed.

## Shared Node-Creation Logic

Both the overlay (click-to-add and drag-to-canvas) and `NodeTypeProvider.onSelect` need the same logic:
- Resolve NodeDef → display name
- Count same-type nodes for unique naming
- Generate node id

Extract this into a helper function in `src/lib/createNodeFromType.ts`:

```typescript
createNodeFromType(canvasId: string, typeKey: string, position?: { x: number; y: number }): void
```

Both call sites (overlay and `NodeTypeProvider.onSelect`) use this. If no position is provided, use the existing staggered grid logic.

## Overlay Data Source

The overlay needs types grouped by namespace. `registryStore.search()` returns a flat `NodeDef[]`, which is suitable for the filter input (filter in-component, then group by `metadata.namespace`). For the initial unfiltered view, use `registryStore.list()` to get all types and group them in-component by namespace. The `listByNamespace()` method is also available but would require iterating over known namespace names.

## Testing

### Unit Tests

- `NodeTypeOverlay` renders grouped grid from registry, filter narrows results, click-to-add calls `graphStore.addNode`
- Hover/pin state management (shared hover zone, pin toggle, Escape to unpin)
- Canvas drop handler: creates node at correct position from drag event
- CommandPalette `+` prefix routes to `NodeTypeProvider`
- Shared `createNodeFromType` helper: unique naming, staggered fallback position

### E2E Tests

- Hover over Add Node → overlay appears, hover away → overlay disappears
- Click Add Node → overlay pins, click type → node appears on canvas
- Drag type from overlay → drop on canvas → node created at drop position
- `N` key → palette opens with `+` prefix, select type → node created
