# Task 11: Right Panel — NotesTab + CodeRefsTab + EdgeDetailPanel

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:writing-plans to plan
> the implementation steps for this task.

**Scope:** Remaining right panel tabs and edge detail
**Parent feature:** [I2 Canvas Rendering](./2026-03-12-i2-canvas-rendering-index.md)

## Write Set

- Create: `src/components/panels/NotesTab.tsx` (~80 lines)
- Create: `src/components/panels/CodeRefsTab.tsx` (~50 lines)
- Create: `src/components/panels/EdgeDetailPanel.tsx` (~80 lines)
- Modify: `src/components/panels/NodeDetailPanel.tsx` (~10 lines) — wire Notes and Code tabs
- Modify: `src/components/layout/RightPanel.tsx` (~10 lines) — add edge selection routing

## Read Set (context needed)

- `src/components/panels/NodeDetailPanel.tsx` — tab structure from Task 10
- `src/components/layout/RightPanel.tsx` — selection routing from Task 10
- `src/store/canvasStore.ts` — `selectedEdgeKeys` (Task 8)
- `src/store/graphStore.ts` — `updateNode`, `updateEdge` (Task 4)
- `src/store/navigationStore.ts` — `currentCanvasId` (Task 9)
- `src/store/fileStore.ts` — `getCanvas` (to read edge data)
- `src/types/schema.ts` — `Note`, `Edge`, `Entity`
- `docs/specs/2026-03-12-i2-canvas-rendering-design.md` — Notes tab, Code Refs tab, Edge detail

## Dependencies

- **Blocked by:** Task 10 (NodeDetailPanel + RightPanel skeleton)
- **Blocks:** None

## Description

### NotesTab

- Chronological list of notes from `node.notes[]`
- Each note shows: author, content (plain text for now), tags as small badges
- "Add Note" button → inline form with author, content, tags fields
- Edit/delete via inline actions (small buttons on hover)
- Changes call `graphStore.updateNode(canvasId, nodeId, { notes: updatedArray })`

### CodeRefsTab

- List of `codeRefs` strings from the node
- Each shows file icon + path text
- "Add Code Ref" → text input
- Click on a ref → copy path to clipboard (via `navigator.clipboard.writeText`)
- Delete via X button
- Changes call `graphStore.updateNode(canvasId, nodeId, { codeRefs: updatedArray })`

### EdgeDetailPanel

Shown when a single edge is selected (from `canvasStore.selectedEdgeKeys`):

```
┌─────────────────────────────────┐
│ svc-order → db-postgres         │
│ SQL                             │
├─────────────────────────────────┤
│ Label: persist orders       ✏️  │
│ Protocol: SQL               ✏️  │
│ Entities: [Order] [Payment]     │  ← pills, add/remove
│ Notes: (same as NotesTab)       │
└─────────────────────────────────┘
```

- Header: `from.node → to.node` with protocol
- Editable label and protocol (text inputs)
- Entity pills: existing entities shown as removable badges, "Add Entity" to add
- Notes section: reuse NotesTab logic
- Changes call `graphStore.updateEdge(canvasId, from, to, updates)`

### RightPanel.tsx update

Add routing for edge selection: when `selectedEdgeKeys` has exactly one entry, render `<EdgeDetailPanel>`.

### NodeDetailPanel.tsx update

Wire the Notes and Code tab contents to `<NotesTab>` and `<CodeRefsTab>`.

### Acceptance Criteria

- Notes tab: CRUD operations on notes array
- Code refs tab: add/remove/copy-to-clipboard
- Edge detail panel: edit label, protocol, entities, notes
- All changes write through to graphStore
- `tsc --noEmit` passes
