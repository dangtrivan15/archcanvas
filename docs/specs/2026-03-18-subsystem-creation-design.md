# Subsystem Creation — Design Spec

**Date:** 2026-03-18
**Status:** Draft
**Depends on:** I2 Canvas Rendering, I6a AI Integration, MCP Tools

## Problem

ArchCanvas supports subsystem canvases (RefNode → separate YAML file → navigable scope) at the engine, navigation, and rendering layers. However, there is no creation pipeline — neither the UI nor the AI can create a subsystem. Users must manually author YAML files and RefNodes.

## Goals

1. Users can create subsystems from the UI (Command Palette + Context Menu)
2. AI can create subsystems via a new MCP tool (`create_subsystem`)
3. System prompt teaches the AI about subsystem existence and usage
4. Full E2E test coverage: creation, navigation, inner nodes, saving, collision handling

## Non-Goals

- Promote inline node to subsystem (future)
- Delete subsystem cascade (engine already handles RefNode removal + edge cleanup)
- `unregisterCanvas` for undo (noted as known gap — see Undo section)

---

## Architecture

### Approach: fileStore-centric orchestration (Approach A)

- `fileStore.registerCanvas()` — registers a new canvas entry in the project map
- `graphStore.createSubsystem()` — orchestrates: register canvas + add RefNode + mark dirty
- Engine unchanged — `addNode` already accepts RefNodes
- Navigation unchanged — `diveIn` already works for RefNodes

---

## Layer 1: fileStore.registerCanvas

### Interface

```ts
registerCanvas(
  canvasId: string,
  filePath: string,
  data: Canvas,
): { ok: true } | { ok: false; error: { code: 'CANVAS_ALREADY_EXISTS'; canvasId: string } }
```

### Behavior

1. Check if `canvasId` already exists in `project.canvases` — if so, return error
2. Create `LoadedCanvas`: `{ filePath, data, doc: undefined }`
3. Clone the canvases Map, add the entry
4. Mark `canvasId` as dirty
5. Set state with new project object (triggers Zustand re-render)

### Canvas data shape

```ts
{
  type,          // from registry (e.g., "compute/service")
  displayName,   // user-provided name
  nodes: [],
  edges: [],
  entities: [],
}
```

### Save behavior

No changes needed. `saveAll` iterates `dirtyCanvases`; `saveCanvas` calls `saveCanvasToFile(fs, canvas)` which writes to `canvas.filePath`. The FileSystem `writeFile` creates the file if it doesn't exist.

---

## Layer 2: graphStore.createSubsystem

### Interface

```ts
createSubsystem(
  parentCanvasId: string,
  input: { id: string; type: string; displayName?: string },
): EngineResult
```

### Flow

1. **Resolve parent canvas** — `resolveCanvas(parentCanvasId)`, fail with `CANVAS_NOT_FOUND` if missing
2. **Register child canvas** — `fileStore.registerCanvas(id, '.archcanvas/<id>.yaml', { type, displayName, nodes: [], edges: [], entities: [] })`, fail with `CANVAS_ALREADY_EXISTS` if collision
3. **Add RefNode to parent** — `engineAddNode(parentCanvas, { id, ref: '<id>.yaml' })` via existing engine path. Fails with `DUPLICATE_NODE_ID` if collision.
4. **Apply result** — `applyResult(parentCanvasId, result)` updates fileStore + pushes patches to historyStore. This marks the parent canvas dirty via `updateCanvasData`.
5. **Mark child dirty** — `fileStore.markDirty(id)` so the new `.yaml` file gets persisted on save

### Dirty tracking

- **Parent canvas**: marked dirty by `applyResult` → `fileStore.updateCanvasData` (existing path, `fileStore.ts:289-290`)
- **Child canvas**: marked dirty explicitly via `fileStore.markDirty(id)` in step 5

### Undo consideration

`historyStore.pushPatches` records the RefNode addition to the parent canvas. Undoing removes the RefNode from the parent. The child canvas remains registered in `fileStore.project.canvases` (orphaned but harmless — it only gets written to disk on save).

**Known gap:** Full undo would require an `unregisterCanvas` inverse operation. Deferred — acceptable for now since orphaned canvases are inert and don't affect correctness.

---

## Layer 3: MCP Tool — create_subsystem

### Tool definition (mcpTools.ts)

```ts
tool('create_subsystem', 'Create a subsystem (nested canvas) with its own scope', {
  id: z.string().describe('Unique subsystem identifier (kebab-case, becomes both node ID and filename)'),
  type: z.string().describe('Node type (e.g., compute/service). Run catalog tool first.'),
  name: z.string().optional().describe('Display name'),
  scope: z.string().optional().describe('Parent canvas scope ID (omit for root)'),
})
```

### Dispatcher (storeActionDispatcher.ts)

New `createSubsystem` case:

```ts
case 'createSubsystem':
  return graphStore.createSubsystem(
    args.canvasId as string,
    { id: args.id, type: args.type, displayName: args.name }
  );
```

Type validation: `graphStore.createSubsystem` resolves displayName from the registry if `name` is not provided. No need for `validateAndBuildNode` — we're not building an InlineNode.

### allowedTools

Add `'mcp__archcanvas__create_subsystem'` to `MCP_TOOL_NAMES` array.

---

## Layer 4: System Prompt Update

### Tool listing addition

```
- **create_subsystem** — Create a nested subsystem: id (string), type (string), name? (string), scope?
```

### New section

```
## Subsystems
- Use create_subsystem to create nested scopes (subsystem canvases)
- The subsystem becomes a RefNode in the parent canvas and a navigable scope
- After creation, use the scope parameter on other tools to add nodes/edges inside it
  (e.g., add_node with scope: "order-service" adds a node inside that subsystem)
- Cross-scope edges reference nodes inside subsystems: @<subsystem-id>/<node-id>
- Example workflow:
  1. create_subsystem(id: "order-svc", type: "compute/service", name: "Order Service")
  2. add_node(id: "processor", type: "compute/function", scope: "order-svc")
  3. add_edge(from: "api-gateway", to: "@order-svc/processor", scope: root)
```

---

## Layer 5: UI Entry Points

### 5a. Command Palette

New edit action:

```ts
{ id: 'action:create-subsystem', title: 'Create Subsystem...', icon: '⊞', category: 'Edit',
  execute: () => window.dispatchEvent(
    new CustomEvent('archcanvas:open-palette', { detail: { mode: 'subsystem' } })
  )
}
```

When the palette opens in `mode === 'subsystem'`, selecting a node type opens the `CreateSubsystemDialog` instead of calling `addNode`.

### 5b. Context Menu — canvas background

Add item to `target.kind === 'canvas'` section, below "Add Node...":

```tsx
<MenuItem label="Create Subsystem..." onClick={() => {
  window.dispatchEvent(new CustomEvent('archcanvas:open-palette', { detail: { mode: 'subsystem' } }));
  onClose();
}} />
```

### 5c. CreateSubsystemDialog

New component: `src/components/CreateSubsystemDialog.tsx`

Small modal dialog (Radix Dialog, like `AppearanceDialog`) with:

| Field | Behavior |
|-------|----------|
| **Subsystem name** | Text input, required. Driver field. |
| **File name** | Auto-derived from name, editable. `deriveId(name) + '.yaml'` |
| **ID** | Auto-derived from name, editable. `deriveId(name)` |

#### Name → ID/filename derivation

```ts
function deriveId(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}
// "Order Service" → "order-service"
// filename = `${deriveId(name)}.yaml`
```

Typing in the name field live-updates file name and ID. If the user manually edits file name or ID, auto-derive stops for that field (tracked via a `userOverride` flag per field).

#### Collision checks (client-side, before submit)

- **File name**: `Array.from(project.canvases.values()).some(c => c.filePath === '.archcanvas/' + filename)`
- **ID**: parent canvas `(canvas.data.nodes ?? []).some(n => n.id === id)`

Both show inline error messages. User must fix before submitting.

Server-side guards (`CANVAS_ALREADY_EXISTS`, `DUPLICATE_NODE_ID`) remain as safety nets.

#### Submit flow

1. User clicks Create
2. Client-side validation passes
3. Call `graphStore.createSubsystem(parentCanvasId, { id, type, displayName: name })`
4. Close dialog
5. Stay on current canvas (user can dive in when ready)

---

## Layer 6: E2E Tests

New spec: `test/e2e/subsystem.spec.ts`

### Test cases

| # | Test | What it verifies |
|---|------|------------------|
| 1 | Create subsystem via command palette | Full UI flow: palette → type pick → name dialog → RefNode appears |
| 2 | Create subsystem via context menu | Context menu → same flow → RefNode appears |
| 3 | Navigate into subsystem | Dive into RefNode → breadcrumb shows `Root > Name`, canvas switches |
| 4 | Add nodes inside subsystem | Inside subsystem, add node → appears in subsystem canvas, not root |
| 5 | Navigate back up | Breadcrumb click or goUp → returns to root, RefNode still present |
| 6 | Save and verify persistence | Create + add inner nodes → Cmd+S → verify both YAML files |
| 7 | ID/filename collision | Create subsystem, try same name → error shown, user edits |
| 8 | Cross-scope edge | Root node → @subsystem/inner-node edge → renders correctly |

### Test helpers (e2e-helpers.ts)

- `createSubsystem(page, name, type)` — drives full UI flow
- `diveIntoSubsystem(page, nodeId)` — context menu dive-in
- `getBreadcrumbText(page)` — reads breadcrumb trail

### Patterns followed

- `vite preview` on port 4173
- Slot guard for parallel isolation
- `data-testid` attributes on new UI elements

---

## Files Changed / Created

### New files

| File | Purpose |
|------|---------|
| `src/components/CreateSubsystemDialog.tsx` | Name/ID/filename input dialog |
| `test/e2e/subsystem.spec.ts` | E2E test suite |

### Modified files

| File | Change |
|------|--------|
| `src/store/fileStore.ts` | Add `registerCanvas()` method |
| `src/store/graphStore.ts` | Add `createSubsystem()` method |
| `src/core/ai/mcpTools.ts` | Add `create_subsystem` tool + update `MCP_TOOL_NAMES` |
| `src/core/ai/storeActionDispatcher.ts` | Add `createSubsystem` dispatcher case |
| `src/core/ai/systemPrompt.ts` | Add subsystem tool + guidance section |
| `src/components/shared/CommandPalette.tsx` | Add "Create Subsystem" action + subsystem mode |
| `src/components/shared/ContextMenu.tsx` | Add "Create Subsystem..." to canvas menu |
| `test/e2e/e2e-helpers.ts` | Add subsystem test helpers |

### Unchanged

- `src/core/graph/engine.ts` — already handles RefNodes
- `src/store/navigationStore.ts` — diveIn/goUp already work
- `src/components/canvas/hooks/useCanvasNavigation.ts` — already handles RefNodes
- `src/components/nodes/NodeRenderer.tsx` — already renders RefNodes
- `src/storage/fileResolver.ts` — loadProject already resolves refs; save already works
