# Task 10: Right Panel — Skeleton + PropertiesTab

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:writing-plans to plan
> the implementation steps for this task.

**Scope:** Right panel node detail skeleton + Properties tab
**Parent feature:** [I2 Canvas Rendering](./2026-03-12-i2-canvas-rendering-index.md)

## Write Set

- Create: `src/components/panels/NodeDetailPanel.tsx` (~80 lines)
- Create: `src/components/panels/PropertiesTab.tsx` (~100 lines) — dynamic form from NodeDef args
- Modify: `src/components/layout/RightPanel.tsx` (~30 lines) — delegate to NodeDetailPanel based on selection

## Read Set (context needed)

- `src/components/layout/RightPanel.tsx` — current placeholder (17 lines)
- `src/store/canvasStore.ts` — `selectedNodeIds`, `selectedEdgeKeys` (Task 8)
- `src/store/fileStore.ts` — `getCanvas` (to read node data)
- `src/store/registryStore.ts` — `resolve` (to get NodeDef for properties form)
- `src/store/graphStore.ts` — `updateNode` (for property edits)
- `src/store/uiStore.ts` — `rightPanelOpen`, `toggleRightPanel`
- `src/store/navigationStore.ts` — `currentCanvasId` (Task 9)
- `src/types/schema.ts` — `InlineNode`, `Note`
- `src/types/nodeDefSchema.ts` — `NodeDef`, `spec.args[]` (type, name, required, options)
- `docs/specs/2026-03-12-i2-canvas-rendering-design.md` — Layer 5: Right Panel

## Dependencies

- **Blocked by:** Task 8 (canvasStore provides selection)
- **Blocks:** Task 11 (remaining tabs and edge detail)

## Description

### RightPanel.tsx changes

Replace the placeholder content with selection-aware routing:

| Selection | Shows |
|-----------|-------|
| Nothing | "Select a node to view details" placeholder |
| One InlineNode | `<NodeDetailPanel>` |
| Multiple nodes | "N nodes selected" summary |
| One edge | Placeholder for now (EdgeDetailPanel in Task 11) |

Read selection from `canvasStore`, resolve node data from `fileStore.getCanvas(currentCanvasId)`.

### NodeDetailPanel

Renders the full detail view for a single selected InlineNode:

```
┌─────────────────────────────────┐
│ [icon] Order Service        ✏️  │  ← displayName, editable inline
│ compute/service                 │  ← type label (read-only)
├─────────────────────────────────┤
│ Properties  │  Notes  │  Code   │  ← tab bar
├─────────────────────────────────┤
│  (tab content)                  │
└─────────────────────────────────┘
```

- Header: icon + editable displayName + type label
- Tab bar with 3 tabs (Properties active by default; Notes and Code are placeholders until Task 11)
- displayName edit calls `graphStore.updateNode(canvasId, nodeId, { displayName })`

### PropertiesTab

Built dynamically from the NodeDef's `spec.args`:

- Each arg → appropriate input component:
  - `string` → text input
  - `number` → number input
  - `boolean` → toggle/checkbox
  - `enum` → select dropdown (options from NodeDef)
  - `duration` → text input with format hint
- Required args marked with asterisk or indicator
- Current values from node's `args` map
- Changes call `graphStore.updateNode(canvasId, nodeId, { args: { ...currentArgs, [argName]: value } })`
- Unknown type (no NodeDef): show raw key-value editor for `args`

### Acceptance Criteria

- RightPanel routes based on selection state
- NodeDetailPanel renders header with icon, name, type
- displayName editable inline
- PropertiesTab generates form from NodeDef args
- Property changes write through to graphStore
- Raw key-value editor shown when NodeDef unknown
- Panel is collapsible via uiStore
- `tsc --noEmit` passes
