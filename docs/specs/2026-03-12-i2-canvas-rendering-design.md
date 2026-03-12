# I2: Canvas Rendering — Design Spec

> **Date**: 2026-03-12 | **Status**: Draft
> **Scope**: Full canvas rendering + interaction: Zustand stores, custom node/edge renderers, panels, navigation, command palette, auto-layout, undo/redo, keyboard shortcuts
> **Depends on**: I10 (Core Data Model) — complete, I3 (NodeDef Registry) — complete, I4 (Graph Engine) — complete
> **Blocks**: I5 (AI Integration), I6 (CLI + Onboarding)

## Context

I2 is the first initiative that touches both the **State Layer** (Zustand stores bridging core to UI) and the **Presentation Layer** (React components consuming those stores). It takes the pure-function Core Layer built in I10/I3/I4 and makes it interactive — users can see, navigate, and manipulate architecture graphs on a canvas.

The existing codebase provides:
- **Core Layer**: Graph engine (CRUD + validation + queries), NodeDef registry (32 built-in types, 9 namespaces), data model (14 Zod schemas)
- **Storage Layer**: YAML codec, file resolver, fileStore (Zustand)
- **App Shell**: Resizable 3-panel layout with bare ReactFlow container, placeholder toolbar/menubar/status bar

I2 fills the gap between the data and the user.

## Scope Boundary

**In scope:**
- 5 new Zustand stores (graphStore, canvasStore, navigationStore, registryStore, historyStore)
- Canvas rendering pipeline (useCanvasRenderer hook, CanvasNodeData/CanvasEdgeData types)
- Custom NodeRenderer (polymorphic, 9 shapes via CSS) and EdgeRenderer (protocol-based styling)
- Canvas interactions (selection, drag, connect, delete, context menus)
- Navigation (dive-in/go-up with single-phase concurrent animation, breadcrumb)
- Right panel (collapsible node/edge detail with properties/notes/code refs tabs)
- Command palette (cmdk + PaletteProvider interface, 5 built-in providers)
- Auto-layout (elkjs, core/layout/elk.ts)
- Undo/redo (Immer produceWithPatches, historyStore)
- Keyboard shortcuts
- Engine upgrade: `produce()` → `produceWithPatches()` with `EngineResult` extension

**Out of scope:**
- AI integration (ChatProvider, chat panel) — I5
- CLI commands — I6
- Onboarding wizard — I5 or I6
- Tauri desktop packaging — I6
- Remote NodeDef registry — v2 roadmap
- Protocol compatibility matrix — deferred per design doc
- File watching / auto-save — deferred

## Architecture

### Approach: Vertical Slices

Build complete vertical slices: each slice delivers a working increment through stores → hooks → components. Slices are independently testable and committable.

```
Slice 1: Engine upgrade (produceWithPatches) + graphStore + registryStore + fileStore.updateCanvasData
         + useCanvasRenderer + NodeRenderer + EdgeRenderer
Slice 2: canvasStore + useCanvasInteractions + selection + drag
Slice 3: navigationStore + breadcrumb + dive-in/go-up animation
Slice 4: Right panel (NodeDetailPanel, edge detail) + context menus + add/remove flows
Slice 5: historyStore + undo/redo keyboard shortcuts (Cmd+Z / Cmd+Shift+Z)
Slice 6: Command palette (cmdk + PaletteProvider)
Slice 7: Auto-layout (elkjs) + remaining keyboard shortcuts
```

Note: The engine upgrade moved from Slice 5 to Slice 1 because graphStore needs `patches`/`inversePatches` from `EngineResult` to feed historyStore. Doing the upgrade first means graphStore stores patches from day one, and historyStore (Slice 5) consumes them when ready.

### Data Flow

```
User interactions → canvasStore (selection, drafts, orchestration)
                       ↓ delegates mutations to
                    graphStore (pure CRUD, no UI awareness)
                       ↓ reads/writes via
                    fileStore (single source of truth for canvas data)
```

### New Dependencies

| Package | Purpose |
|---------|---------|
| `cmdk` | Command palette UI (~3KB, handles keyboard nav + fuzzy matching) |
| `elkjs` | Automatic graph layout (ELK compiled to JS) |

## Layer 1: State Layer — Zustand Stores

Five new stores, each thin, delegating business logic to the core layer.

### `graphStore`

Wraps the I4 graph engine. **Does not own canvas data** — reads from and writes back to `fileStore` (single source of truth).

```typescript
interface GraphStoreState {
  addNode(canvasId: string, node: Node): EngineResult;  // Node = InlineNode | RefNode (from schema.ts)
  removeNode(canvasId: string, nodeId: string): EngineResult;
  updateNode(
    canvasId: string, nodeId: string,
    updates: Partial<Pick<InlineNode, 'displayName' | 'description' | 'args' | 'position' | 'codeRefs' | 'notes'>>,
  ): EngineResult;
  updateNodePosition(canvasId: string, nodeId: string, position: Position): EngineResult;
  addEdge(canvasId: string, edge: Edge): EngineResult;
  removeEdge(canvasId: string, from: string, to: string): EngineResult;
  updateEdge(
    canvasId: string, from: string, to: string,
    updates: Partial<Pick<Edge, 'protocol' | 'label' | 'entities' | 'notes'>>,
  ): EngineResult;
  addEntity(canvasId: string, entity: Entity): EngineResult;
  removeEntity(canvasId: string, entityName: string): EngineResult;
  updateEntity(
    canvasId: string, entityName: string,
    updates: Partial<Pick<Entity, 'description' | 'codeRefs'>>,
  ): EngineResult;
}
```

Each mutation:
1. Gets canvas from `fileStore.getState().getCanvas(canvasId)` — if `undefined`, returns `{ ok: false, error: { code: 'CANVAS_NOT_FOUND', canvasId } }` (new engine error code added to `EngineError` union)
2. Calls engine function with registry from `registryStore`
3. On success: writes updated `CanvasFile` back via `fileStore.updateCanvasData(canvasId, result.data)`, pushes patches to `historyStore`
4. Returns `EngineResult` to the caller

### fileStore write-back: `updateCanvasData`

The current `fileStore` (from I10) has `getCanvas()` for reading but no method for writing mutated data back. I2 adds one method:

```typescript
updateCanvasData(canvasId: string, data: CanvasFile): void;
```

This method:
1. Replaces `canvas.data` in `project.canvases.get(canvasId)` with the new `CanvasFile`
2. Sets `canvas.doc = undefined` — the YAML `Document` AST is now stale relative to the engine-mutated data, so clear it. On next save, `serializeCanvasFile(data, undefined)` falls back to plain YAML `stringify()`, which is correct but loses comment preservation. This is an acceptable trade-off: programmatic mutations (engine CRUD) don't interact with YAML comments, and hand-edited comments are only preserved on load → hand-edit → save round-trips (which don't go through the engine)
3. Calls `markDirty(canvasId)` so pending save picks it up
4. Triggers Zustand re-render (via `set()`) so `useCanvasRenderer` reacts

This is the only new method fileStore needs — a minimal write-back path. The `LoadedCanvas` structure wraps `CanvasFile` with file metadata (`filePath`, `doc`); `updateCanvasData` replaces the inner `.data` and clears `.doc`.

### Key decision: graphStore has no state of its own

It is pure methods that orchestrate fileStore + engine + historyStore + registryStore. This avoids data duplication — fileStore is the only place canvas data lives. graphStore reads from fileStore, transforms via the engine, and writes back.

### `canvasStore`

UI-only state for canvas viewport, selection, and interaction orchestration. Not persisted.

```typescript
interface CanvasStoreState {
  // Selection
  selectedNodeIds: Set<string>;
  selectedEdgeKeys: Set<string>;   // "from→to" format
  draftEdge: { from: EdgeEndpoint } | null;

  // Selection actions
  selectNodes(ids: string[]): void;
  selectEdge(from: string, to: string): void;
  clearSelection(): void;

  // Draft edge (connection being drawn)
  startDraftEdge(from: EdgeEndpoint): void;
  completeDraftEdge(to: EdgeEndpoint): EngineResult;  // delegates to graphStore.addEdge, clears draftEdge on both success and failure
  cancelDraftEdge(): void;

  // Selection-aware orchestration
  deleteSelection(): EngineResult | null;  // reads selection, calls graphStore.removeNode/removeEdge; returns first failure or null on full success
}
```

canvasStore is the **interaction layer** — it knows about selection and delegates mutations to graphStore. graphStore stays focused on graph CRUD with no knowledge of what's selected.

**Error handling**: When `completeDraftEdge` or `deleteSelection` receives `{ ok: false }` from graphStore, it clears the draft/selection state and returns the `EngineResult` to the caller (the hook). The hook can surface errors via a toast notification or status bar message — error display is a UI concern, not a store concern.

### `navigationStore`

Tracks which canvas is being viewed and the breadcrumb path.

```typescript
interface NavigationStoreState {
  currentCanvasId: string;          // ROOT_CANVAS_KEY or ref string
  breadcrumb: Array<{ canvasId: string; displayName: string }>;

  diveIn(refNodeId: string): void;  // navigate into a subsystem (see resolution below)
  goUp(): void;                     // navigate to parent
  goToRoot(): void;
  goToBreadcrumb(index: number): void;
  navigateTo(canvasId: string): void;  // jump directly to any canvas (used by ScopeProvider)
}
```

**`diveIn` resolution**: `diveIn(refNodeId)` looks up the RefNode in the current canvas via `fileStore.getCanvas(currentCanvasId)`, finds the node with matching `id`, reads its `.ref` field → that's the target `canvasId`. The breadcrumb `displayName` is resolved from `fileStore.getCanvas(targetCanvasId)?.data.displayName ?? refNode.ref`. If the target canvas doesn't exist in fileStore, the dive-in is a no-op (defensive — shouldn't happen with valid data).

**`navigateTo` vs `diveIn`**: `diveIn` resolves through a RefNode (used by click handlers). `navigateTo` jumps directly by canvasId (used by ScopeProvider and breadcrumb). Both update `currentCanvasId` and `breadcrumb`.

### `registryStore`

Reactive bridge to the core registry. Loads once on project open.

```typescript
interface RegistryStoreState {
  registry: NodeDefRegistry | null;
  status: 'idle' | 'loading' | 'ready' | 'error';

  initialize(fs?: FileSystem): Promise<void>;  // loadBuiltins (sync) + project-local (async, needs fs)
  resolve(type: string): NodeDef | undefined;
  list(): NodeDef[];
  search(query: string): NodeDef[];
  listByNamespace(namespace: string): NodeDef[];
}
```

`initialize()` is async because loading project-local NodeDefs reads YAML files via `FileSystem`. The `fs` parameter is optional — when omitted (or no project-local defs), only built-in defs are loaded (sync). `App.tsx` must `await registryStore.initialize(fs)` before rendering the canvas to avoid a race where `graphStore` calls `resolve()` on a null registry. The `status` field lets components show a loading state.

`resolve`, `list`, `search`, and `listByNamespace` are pass-through delegations to `this.registry` — all four `NodeDefRegistry` methods. When `registry` is null (before initialization), they return `undefined` / `[]` / `[]` / `[]` respectively — safe no-ops, not throws.

### `historyStore`

Patch-based undo/redo using Immer patches.

```typescript
interface HistoryEntry {
  canvasId: string;
  patches: Patch[];
  inversePatches: Patch[];
}

interface HistoryStoreState {
  undoStack: HistoryEntry[];
  redoStack: HistoryEntry[];
  canUndo: boolean;
  canRedo: boolean;

  pushPatches(canvasId: string, patches: Patch[], inversePatches: Patch[]): void;
  undo(): void;
  redo(): void;
  clear(): void;
}
```

**Undo flow:**
1. Pop from `undoStack`
2. Get canvas from `fileStore.getCanvas(entry.canvasId)`
3. `const patched = applyPatches(canvas.data, entry.inversePatches)` — `applyPatches` returns a new object, does not mutate in place
4. `fileStore.updateCanvasData(entry.canvasId, patched)`
5. Push entry to `redoStack`

**Redo:** Same but forward — apply `patches`, move from `redoStack` to `undoStack`.

**Stack behavior:**
- Max depth: 50 entries (configurable). Oldest entries dropped when exceeded.
- Clears on canvas switch — each canvas scope has independent undo context.
- Batch grouping: multi-op actions (e.g., auto-layout producing N position updates) are grouped into a single history entry so Cmd+Z undoes the entire operation.

### Cross-store communication

Stores communicate via `getState()` — no event bus needed. The relationships:

- **canvasStore** reads selection, delegates to **graphStore** for mutations
- **graphStore** reads canvas from **fileStore**, validates with **registryStore**, pushes patches to **historyStore**, writes back to **fileStore**
- **historyStore** reads/writes canvas data via **fileStore**
- **navigationStore** is consumed by `useCanvasRenderer` to know which canvas to render

### Shared vs local state principle

- **Zustand store** for state read by multiple components (selection, navigation, history)
- **React local state** for state scoped to a single component (context menu open/position/target)

## Layer 2: Canvas Rendering Pipeline

### `useCanvasRenderer` hook

The bridge between stores and ReactFlow. Derives ReactFlow-compatible data from the current canvas.

```typescript
function useCanvasRenderer(): {
  nodes: ReactFlowNode<CanvasNodeData>[];
  edges: ReactFlowEdge<CanvasEdgeData>[];
}
```

Internally:
1. Reads `navigationStore.currentCanvasId`
2. Gets the canvas from `fileStore.getCanvas(canvasId)`
3. For each node: resolves its NodeDef from `registryStore` → builds `CanvasNodeData`
4. For each edge: maps protocol → style category → builds `CanvasEdgeData`
5. Memoized — only recomputes when canvas data or registry changes

### `CanvasNodeData`

```typescript
interface CanvasNodeData {
  node: Node;                        // Node = InlineNode | RefNode (from schema.ts)
  nodeDef: NodeDef | undefined;     // undefined if type unresolved
  isSelected: boolean;
  isRef: boolean;                    // true = can dive in (single-click navigates)
}
```

### `CanvasEdgeData`

```typescript
interface CanvasEdgeData {
  edge: Edge;
  styleCategory: 'sync' | 'async' | 'default';
}
```

### `NodeRenderer`

Single component registered as the sole custom ReactFlow node type. Renders based on `CanvasNodeData`.

Layout:
```
┌─────────────────────────────────┐
│ [icon] Display Name        [▶]  │  ← dive-in indicator if isRef
│─────────────────────────────────│
│ type: compute/service           │
│ key-arg: value                  │
│─────────────────────────────────│
│ ● port-in-1      port-out-1 ●  │  ← ReactFlow Handles
│ ● port-in-2      port-out-2 ●  │
│─────────────────────────────────│
│ 📝 3 notes  📁 2 refs          │  ← count badges
└─────────────────────────────────┘
```

**Shape** applied via CSS class on the outer wrapper — `node-shape-rectangle`, `node-shape-cylinder`, etc. Each of the 9 shapes (`rectangle`, `cylinder`, `hexagon`, `parallelogram`, `cloud`, `stadium`, `document`, `badge`, `container`) is a CSS definition using `border-radius`, `clip-path`, or SVG background. Not separate components.

**Icon** resolved from NodeDef `metadata.icon` → Lucide React component via dynamic lookup.

**Ports** rendered as ReactFlow `<Handle>` elements — inbound ports on the left (`Position.Left`), outbound ports on the right (`Position.Right`). Port names shown as labels next to handles.

**Unknown type** (NodeDef not resolved) → renders with a warning badge and default rectangle shape.

**Ref nodes** rendered distinctly — dashed border, subsystem icon, displayName resolved from the referenced canvas file via `fileStore.getCanvas(refNode.ref)?.data.displayName ?? refNode.ref`. If the referenced canvas is not loaded (e.g., unresolved ref), fall back to the raw `ref` string as display text and show a warning indicator.

### `EdgeRenderer`

Single custom edge type. Protocol → style mapping via lookup table:

```typescript
const PROTOCOL_STYLES: Record<string, EdgeStyleCategory> = {
  HTTP: 'sync', HTTPS: 'sync', gRPC: 'sync', SQL: 'sync',
  Kafka: 'async', SQS: 'async', RabbitMQ: 'async', NATS: 'async',
};
// Unlisted protocols → 'default'
```

| Category | Visual |
|----------|--------|
| `sync` | Solid line, medium weight |
| `async` | Dashed line, animated dash flow |
| `default` | Solid line, thin, gray |

Edge label rendered at midpoint. Entities shown as small pills below the label if present.

### `@root/` edge rendering

When viewing a child canvas, edges referencing `@root/node-id` render the external endpoint as a **ghost node** — a faded badge showing the parent node's displayName with a "↑" indicator. Ghost nodes are positioned at the edge of the viewport on the side closest to their connected node (left/right based on whether they are a `from` or `to` endpoint), vertically aligned with the connected internal node. They are non-interactive (no drag, no select) and reposition on viewport pan/zoom.

## Layer 3: Navigation & Breadcrumb

### Click behavior by node type

| Node type | Single click | Drag |
|-----------|-------------|------|
| **InlineNode** | Select + open right panel | Reposition |
| **RefNode** | Dive in (navigate to child canvas) | Reposition |

RefNodes are never "selected" in the traditional sense (no highlight state). They are either clicked (dive in) or dragged (reposition). Deletion is via context menu.

### Dive-in / Go-up flow

**Dive-in** (click a ref node):
1. `useCanvasInteractions` detects click on a RefNode
2. `useCanvasNavigation.diveIn()` fires — starts concurrent animation
3. `navigationStore.diveIn(refNodeId)` updates breadcrumb and `currentCanvasId`
4. `useCanvasRenderer` reacts — derives new nodes/edges from child canvas

**Go-up** (click breadcrumb or Escape at non-root):
1. `navigationStore.goUp()` pops breadcrumb
2. Reverse animation plays
3. `useCanvasRenderer` reacts with parent canvas data

### Animation: single-phase concurrent

Both directions use a single-phase animation combining viewport zoom and content transition:

**Dive-in (300ms):**
1. Viewport zooms toward clicked node's position via `reactFlow.setViewport({ ... }, { duration: 300 })`
2. Simultaneously: outgoing nodes fade out + scale down via CSS transition
3. After canvas data swaps: incoming nodes fade in + scale up via CSS transition

**Go-up (300ms):**
- Inverse — zoom out, child nodes shrink, parent nodes fade in

Same duration and easing curve (`ease-in-out`) for viewport and content transitions so they feel coupled — one fluid motion, not two layered steps.

```typescript
function useCanvasNavigation() {
  const reactFlow = useReactFlow();

  function diveIn(refNodeId: string, position: Position): void {
    // 1. Add CSS class → triggers fade-out transition on current nodes
    // 2. Zoom viewport toward target
    reactFlow.setViewport(
      { x: -position.x * 2, y: -position.y * 2, zoom: 2 },
      { duration: 300 }
    );
    // 3. After data swap, incoming nodes have entrance CSS transition
  }

  function goUp(): void { /* inverse animation */ }

  return { diveIn, goUp };
}
```

### Breadcrumb component

```
Root  >  Order Service  >  API Layer
 ↑          ↑                ↑
click     click          (current, not clickable)
```

- Overlaid at top-left of canvas (absolute positioned, semi-transparent background)
- Each segment clickable except the last (current scope)
- Clicking a segment calls `navigationStore.goToBreadcrumb(index)` — jumps directly, no intermediate animations

## Layer 4: Interaction Hooks

Three hooks wire user actions to stores.

### `useCanvasInteractions`

```typescript
function useCanvasInteractions() {
  return {
    onNodesChange,      // ReactFlow drag handler → graphStore.updateNodePosition
    onNodeClick,        // InlineNode → canvasStore.selectNodes; RefNode → diveIn
    onEdgeClick,        // canvasStore.selectEdge → opens detail panel
    onConnect,          // connection complete → canvasStore.completeDraftEdge
    onConnectStart,     // canvasStore.startDraftEdge
    onConnectEnd,       // canvasStore.cancelDraftEdge (if not completed)
    onPaneClick,        // canvasStore.clearSelection
  };
}
```

### `useCanvasKeyboard`

| Key | Action |
|-----|--------|
| `Delete` / `Backspace` | `canvasStore.deleteSelection()` |
| `Cmd+Z` | `historyStore.undo()` |
| `Cmd+Shift+Z` | `historyStore.redo()` |
| `Cmd+K` | Open command palette |
| `Cmd+Shift+L` | Auto-layout |
| `Cmd+A` | Select all nodes |
| `Escape` | Clear selection, or `navigationStore.goUp()` if nothing selected |

### `useCanvasNavigation`

The dive animation hook. Coordinates with `navigationStore` for state changes and `useReactFlow()` for viewport transitions.

```typescript
function useCanvasNavigation() {
  return {
    diveIn(refNodeId: string, position: Position): void;
    goUp(): void;
  };
}
```

## Layer 5: Right Panel — Node Detail

Collapsible panel controlled by `uiStore.rightPanelOpen` / `uiStore.toggleRightPanel()`.

### Panel states

| Selection | Panel shows |
|-----------|-------------|
| Nothing selected | "Select a node to view details" placeholder |
| One InlineNode | Full detail view (properties, notes, code refs tabs) |
| Multiple nodes | "N nodes selected" summary with bulk actions (delete, auto-layout selection) |
| One edge | Edge detail (protocol, label, entities, notes) |

### InlineNode detail layout

```
┌─────────────────────────────────┐
│ [icon] Order Service        ✏️  │  ← displayName, editable inline
│ compute/service                 │  ← type label (read-only)
├─────────────────────────────────┤
│ Properties  │  Notes  │  Code   │  ← tab bar
├─────────────────────────────────┤
│                                 │
│  (tab content)                  │
│                                 │
└─────────────────────────────────┘
```

### Properties tab

Built dynamically from the NodeDef's `spec.args`:

- Each arg renders as the appropriate input type:
  - `string` → text field
  - `number` → number input
  - `boolean` → toggle switch
  - `enum` → dropdown (options from NodeDef)
  - `duration` → text field with format hint
- Required args marked with indicator
- Current values from the node's `args` map
- Changes call `canvasStore` → `graphStore.updateNode(canvasId, nodeId, { args: ... })`
- If NodeDef is unresolved (unknown type): show raw key-value editor for `args`

### Notes tab

- Chronological list of notes
- Each shows: author, content (rendered markdown), tags as badges
- "Add Note" button → inline form (author, content, tags)
- Edit/delete via inline actions
- Changes call through to `graphStore.updateNode` with updated `notes` array

### Code Refs tab

- List of `codeRefs` strings
- Each shows file/folder icon + path
- "Add Code Ref" → text input
- Click → copies path to clipboard

### Edge detail

```
┌─────────────────────────────────┐
│ svc-order → db-postgres         │  ← from → to
│ SQL                             │  ← protocol
├─────────────────────────────────┤
│ Label: persist orders       ✏️  │
│ Protocol: SQL               ✏️  │
│ Entities: [Order] [Payment]     │  ← pills, add/remove
│ Notes: (same as node notes)     │
└─────────────────────────────────┘
```

## Layer 6: Command Palette

Built on `cmdk` library, wrapped with the `PaletteProvider` interface from the design doc.

### Provider interface

```typescript
interface PaletteProvider {
  category: string;
  search(query: string): PaletteResult[];
  onSelect(result: PaletteResult): void;
}

interface PaletteResult {
  id: string;
  title: string;
  subtitle?: string;
  icon?: string;
  category: string;
}
```

### Built-in providers

| Provider | Category | Source | On select |
|----------|----------|-------|-----------|
| `NodeSearchProvider` | Nodes in graph | `searchGraph` from query module | Select node on canvas |
| `ActionProvider` | Actions | Hardcoded list | Execute action |
| `NodeTypeProvider` | Node types | `registryStore.search()` | Open "add node" flow with type pre-selected |
| `EntityProvider` | Entities | `listEntities` from current canvas | Select referencing edge |
| `ScopeProvider` | Scopes | All canvases in project | `navigationStore.navigateTo(canvasId)` |

### Prefix shortcuts

| Prefix | Filters to |
|--------|-----------|
| `>` | Actions only |
| `@` | Nodes only |
| `#` | Entities only |

### UX

- `Cmd+K` opens overlay (centered, modal)
- Type to filter (cmdk handles fuzzy matching)
- Arrow keys navigate, Enter selects, Escape closes
- Results grouped by category with section headers

## Layer 7: Auto-Layout

### `core/layout/elk.ts`

Pure TypeScript, no React dependency. In the Core Layer.

```typescript
interface LayoutResult {
  positions: Map<string, Position>;   // nodeId → computed position
}

function computeLayout(
  canvas: CanvasFile,
  options?: { direction?: 'horizontal' | 'vertical' }
): Promise<LayoutResult>;
```

Internally:
1. Maps `CanvasFile` nodes → ELK graph nodes (with dimensions from NodeDef shape hints or defaults)
2. Maps edges → ELK edges (preserving directionality)
3. Runs `elk.layout()` (async — ELK uses web workers)
4. Returns position map

### Trigger points

| Trigger | Behavior |
|---------|----------|
| First load, no positions | Auto-run, apply positions via batch `graphStore.updateNodePosition` |
| "Auto Layout" button / `Cmd+Shift+L` | Re-run, overwrite existing positions (undoable) |
| Command palette → "Auto Layout" | Same as button |

### Layout options

Two directions — horizontal (left-to-right, default) and vertical (top-to-bottom). Exposed as a dropdown next to the toolbar Auto Layout button and as a parameter in the command palette action.

## Layer 8: Undo/Redo — Engine Upgrade

### `produce()` → `produceWithPatches()`

Every engine mutation function in `src/core/graph/engine.ts` switches from:

```typescript
const data = produce(canvas, draft => { /* mutation */ });
return { ok: true, data, warnings };
```

To:

```typescript
const [data, patches, inversePatches] = produceWithPatches(canvas, draft => { /* mutation */ });
return { ok: true, data, patches, inversePatches, warnings };
```

### `EngineResult` extension

The existing `EngineResult` type in `src/core/graph/types.ts` is modified **in place** — not a new type. The `ok: true` branch gains two fields:

```typescript
// src/core/graph/types.ts — modified, same file, same type name
import type { Patch } from 'immer';  // new import — types.ts gains its first external library dependency

type EngineResult =
  | { ok: true; data: CanvasFile; patches: Patch[]; inversePatches: Patch[]; warnings: EngineWarning[] }
  | { ok: false; error: EngineError }
```

Note: `types.ts` currently imports only from `@/types`. Adding `import type { Patch } from 'immer'` introduces an external library dependency to the Core Layer types file. This is acceptable because `immer` is already a production dependency (used by `engine.ts`), and the import is type-only (`import type`) — no runtime coupling.

This is the non-breaking extension the I4 spec anticipated. All existing consumers that check `result.ok` continue to work; the new fields are additive. Existing tests gain assertions for `patches`/`inversePatches` presence.

### `enablePatches()`

Called once at app startup (before any engine call):

```typescript
import { enablePatches } from 'immer';
enablePatches();
```

Placed in an init module imported by `App.tsx`.

## Layer 9: Context Menus

Right-click menus for canvas, nodes, and edges. State is component-local (React state) — not in a store, since only the ContextMenu component reads it.

### Canvas context menu (right-click on empty space)

| Action | Calls |
|--------|-------|
| Add Node... | Opens command palette filtered to node types (`@` prefix) |
| Auto Layout | `computeLayout` → batch `graphStore.updateNodePosition` |
| Fit View | `reactFlow.fitView()` |

### InlineNode context menu

| Action | Calls |
|--------|-------|
| Edit Properties | Opens right panel, focuses Properties tab |
| Add Note | Opens right panel, focuses Notes tab with new note form |
| Delete | `canvasStore.deleteSelection()` |

### RefNode context menu

| Action | Calls |
|--------|-------|
| Dive In | `useCanvasNavigation.diveIn()` |
| Delete | `canvasStore.deleteSelection()` |

### Edge context menu

| Action | Calls |
|--------|-------|
| Edit | Opens right panel with edge detail |
| Delete | `graphStore.removeEdge()` |

## Integration with Existing Layers

### Downward Dependencies

| New module | Imports from |
|-----------|-------------|
| `graphStore` | `src/core/graph/engine.ts`, `src/store/fileStore.ts`, `registryStore`, `historyStore` |
| `canvasStore` | `graphStore` |
| `navigationStore` | `src/store/fileStore.ts` (to resolve ref node → canvas) |
| `registryStore` | `src/core/registry/` (loadBuiltins, createRegistry) |
| `historyStore` | `immer` (applyPatches), `src/store/fileStore.ts` |
| `useCanvasRenderer` | `fileStore`, `navigationStore`, `registryStore`, `canvasStore` |
| `core/layout/elk.ts` | `elkjs`, `src/types/schema.ts` |

### Upward Consumers (Future — NOT part of I2)

- **chatStore** (I5) will call `graphStore` methods when AI modifies the graph
- **CLI commands** (I6) will call engine functions directly (no stores)

## File Map

### New files

```
src/store/
  graphStore.ts               ← graph mutation orchestration
  canvasStore.ts              ← selection, drafts, interaction orchestration
  navigationStore.ts          ← breadcrumb, dive-in/go-up state
  registryStore.ts            ← reactive NodeDef registry bridge
  historyStore.ts             ← undo/redo stacks with Immer patches

src/core/layout/
  elk.ts                      ← auto-layout via elkjs

src/components/canvas/
  Canvas.tsx                  ← (modify existing) wire hooks to ReactFlow
  hooks/
    useCanvasRenderer.ts      ← core graph → ReactFlow nodes/edges
    useCanvasInteractions.ts  ← mouse/pointer event handlers
    useCanvasKeyboard.ts      ← keyboard shortcut handlers
    useCanvasNavigation.ts    ← dive-in/go-up animation

src/components/nodes/
  NodeRenderer.tsx            ← polymorphic node component (9 shapes via CSS)
  nodeShapes.css              ← CSS definitions for each shape

src/components/edges/
  EdgeRenderer.tsx            ← protocol-based edge styling

src/components/panels/
  NodeDetailPanel.tsx         ← right panel for node inspection
  PropertiesTab.tsx           ← dynamic form from NodeDef args
  NotesTab.tsx                ← note list + add/edit
  CodeRefsTab.tsx             ← code reference list
  EdgeDetailPanel.tsx         ← right panel for edge inspection

src/components/shared/
  CommandPalette.tsx          ← cmdk wrapper + PaletteProvider system
  Breadcrumb.tsx              ← navigation breadcrumb overlay
  ContextMenu.tsx             ← right-click menus

src/components/canvas/
  types.ts                    ← CanvasNodeData, CanvasEdgeData interfaces
```

### Modified files

```
src/core/graph/engine.ts      ← produce() → produceWithPatches()
src/core/graph/types.ts       ← EngineResult gains patches/inversePatches fields; EngineError gains CANVAS_NOT_FOUND; adds Patch import
src/core/graph/index.ts       ← re-export updated types
src/storage/fileResolver.ts   ← widen LoadedCanvas.doc to `Document | undefined` (required by updateCanvasData)
src/store/fileStore.ts        ← add updateCanvasData(canvasId, data) write-back method
src/components/canvas/Canvas.tsx  ← wire hooks, register custom node/edge types
src/components/layout/RightPanel.tsx  ← delegate to NodeDetailPanel/EdgeDetailPanel
src/components/layout/LeftToolbar.tsx ← wire toolbar buttons to store actions
src/components/layout/TopMenubar.tsx  ← wire menu items to store actions
src/components/layout/StatusBar.tsx   ← show canvas info (node count, dirty state)
src/App.tsx                   ← enablePatches() init, registryStore.initialize()
```

## Testing Strategy

| Module | Test file | Approach |
|--------|-----------|----------|
| `graphStore` | `test/store/graphStore.test.ts` | Unit — mock fileStore, verify engine calls + fileStore writes + history pushes |
| `canvasStore` | `test/store/canvasStore.test.ts` | Unit — verify selection state, deleteSelection orchestration |
| `navigationStore` | `test/store/navigationStore.test.ts` | Unit — breadcrumb management, diveIn/goUp state transitions |
| `historyStore` | `test/store/historyStore.test.ts` | Unit — push/undo/redo patch flow, stack limits, clear behavior |
| `registryStore` | `test/store/registryStore.test.ts` | Unit — initialize, resolve, search delegation |
| `core/layout/elk.ts` | `test/core/layout/elk.test.ts` | Unit — verify position output for known graph inputs |
| `useCanvasRenderer` | `test/components/canvas/useCanvasRenderer.test.ts` | Hook test — verify ReactFlow data derivation from store state |
| `NodeRenderer` | `test/components/nodes/NodeRenderer.test.ts` | Component test — render with various CanvasNodeData, verify shape classes + ports |
| `EdgeRenderer` | `test/components/edges/EdgeRenderer.test.ts` | Component test — verify protocol → style mapping |
| `CommandPalette` | `test/components/shared/CommandPalette.test.ts` | Component test — provider registration, search, selection |
| Engine upgrade | Existing `test/core/graph/engine.test.ts` | Extend — verify patches/inversePatches on all mutation results |
| **E2E** | `test/e2e/canvas.spec.ts` | Playwright — load project, verify nodes render, click to select, dive in, undo/redo |

### Test approach

- Store tests use plain Zustand stores in test — no React rendering needed
- Component tests use React Testing Library with jsdom
- Hook tests use `@testing-library/react` `renderHook`
- E2E tests use Playwright against `vite preview` (port 4173, existing infrastructure)
- Engine upgrade tests extend the existing I4 test suite — add assertions for `patches`/`inversePatches` presence

## Build Order (Vertical Slices)

```
Slice 1: Engine upgrade + stores + rendering pipeline
  Engine upgrade (produce→produceWithPatches) → fileStore.updateCanvasData →
  registryStore → graphStore → useCanvasRenderer → NodeRenderer → EdgeRenderer → Canvas wiring
  (delivers: nodes and edges visible on canvas, engine emits patches for future undo)

Slice 2: Selection + drag
  canvasStore → useCanvasInteractions → selection highlighting → drag-to-move
  (delivers: click to select, drag to reposition, click pane to deselect)

Slice 3: Navigation
  navigationStore → useCanvasNavigation → Breadcrumb → dive-in/go-up animation
  (delivers: click ref node to dive in, breadcrumb to navigate up)

Slice 4: Right panel + context menus
  NodeDetailPanel → PropertiesTab → NotesTab → CodeRefsTab → EdgeDetailPanel → ContextMenu
  (delivers: inspect and edit node/edge properties, right-click actions)

Slice 5: Undo/redo
  historyStore → wire graphStore patch flow → keyboard shortcuts (Cmd+Z/Shift+Cmd+Z)
  (delivers: undo/redo for all mutations; engine already emits patches from Slice 1)

Slice 6: Command palette
  CommandPalette → PaletteProvider interface → 5 built-in providers
  (delivers: Cmd+K search across nodes, actions, types, entities, scopes)

Slice 7: Auto-layout + remaining keyboard shortcuts
  core/layout/elk.ts → toolbar wiring → Cmd+Shift+L → auto-layout on first load
  (delivers: automatic graph positioning)
```

Each slice is independently testable and committable. Slices 1-3 are sequential (each builds on prior). Slices 4-7 are mostly independent after Slice 2.

**Cross-slice note**: `useCanvasRenderer` (Slice 1) derives `CanvasNodeData.isSelected` from `canvasStore.selectedNodeIds`, but `canvasStore` is built in Slice 2. In Slice 1, `isSelected` is hardcoded to `false` — selection highlighting is wired when Slice 2 lands.

## V1 Reuse Assessment

| V1 module | Reuse in I2 | Notes |
|-----------|-------------|-------|
| `bak/src/core/layout/` | Patterns only | V1's ELK integration is reusable conceptually but operates on `ArchGraph` with recursive children. V2 uses flat `CanvasFile`. |
| `bak/src/core/history/undoManager.ts` | Patterns only | V1 uses `produceWithPatches` — same Immer pattern, but wrapped around a different graph type. The patch flow is identical. |
| `bak/src/store/` | None | V1 stores are tightly coupled to v1 types and protobuf codec. |
| `bak/src/components/nodes/` | Patterns only | V1 had per-type node components (ServiceNode, DatabaseNode, etc.). V2 uses a single polymorphic NodeRenderer — different approach. |

## Known Issues & Future Considerations

- **`CanvasFile` naming** — Still should be renamed to `Canvas`. Deferred.
- **`saveAll` partial-failure** — Known gap from I10. Should be addressed before I2 relies on save operations in graphStore.
- **Protocol compatibility matrix** — Design doc lists this as a deferred decision. I2 renders edges by protocol but does not validate protocol compatibility on connection.
- **Multi-select drag** — ReactFlow supports this natively. Needs testing with the `onNodesChange` handler.
- **Large canvases** — ReactFlow handles virtualization. Performance testing with 50+ nodes should be part of E2E.
- **`enablePatches()` global side effect** — Must be called before any engine function. If tests run engine functions, test setup must also call `enablePatches()`.
