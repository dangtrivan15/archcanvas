# Task 2: Browser Dispatcher Expansion

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:writing-plans to plan
> the implementation steps for this task.

**Scope:** Browser-side store action dispatcher (reads + write enrichment)
**Parent feature:** [./2026-03-14-ephemeral-bridge-index.md](./2026-03-14-ephemeral-bridge-index.md)

## Write Set

- Modify: `src/core/ai/webSocketProvider.ts` (~150 lines)

## Read Set (context needed)

- `docs/specs/2026-03-14-ephemeral-bridge-operations-design.md` — design spec (sections 1, 4)
- `src/store/fileStore.ts` — fileStore API: `getCanvas()`, `project` (Map of canvases)
- `src/store/registryStore.ts` — registryStore API: `resolve()`, `search()`, `listByNamespace()`, `list()`
- `src/store/graphStore.ts` — graphStore API: `addNode()`, `addEdge()`, `addEntity()`
- `src/cli/commands/list.ts` — output shape for `list` action (nodes/edges/entities formatting)
- `src/cli/commands/describe.ts` — output shape for `describe` action (node details + connected edges)
- `src/cli/commands/search.ts` — output shape for `search` action (cross-canvas search results)
- `src/cli/commands/catalog.ts` — output shape for `catalog` action (nodeTypes array)
- `src/cli/commands/add-node.ts:25-83` — validation + fuzzy matching logic to replicate in browser
- `src/types/schema.ts` — InlineNode type
- `src/types/nodeDefSchema.ts` — NodeDef type
- `src/storage/fileResolver.ts` — ROOT_CANVAS_KEY constant

## Dependencies

- **Blocked by:** Task 1 (read routes must exist in vitePlugin for end-to-end flow)
- **Blocks:** None

## Description

This task expands the browser-side `dispatchStoreAction()` in `webSocketProvider.ts` to handle both read actions and enriched write actions.

### 1. Remove auto-save (spec §1)

In `handleStoreAction()`, remove the `fileStore.save()` call (line 246) and the `NO_FILESYSTEM` error path (lines 248-254). After dispatching a store action successfully, send the `store_action_result` response immediately. Dirty tracking still works naturally: `graphStore.addNode()` → `fileStore.updateCanvasData()` marks the canvas dirty → UI shows unsaved indicator.

### 2. Add `useRegistryStore` import

Currently only imports `useGraphStore` and `useFileStore`. Add `useRegistryStore` for type validation and catalog reads.

### 3. Read action dispatchers (spec §4)

Expand `dispatchStoreAction()` with four read cases:

- **`list`** — args: `{ canvasId, type? }`. Read from `fileStore.getCanvas()`, format `{ nodes, edges, entities }` matching the CLI `listCommand` output shape.
- **`describe`** — args: `{ canvasId?, id? }`. When `id` provided: read node from canvas + connected edges + port info from registry. When no `id`: describe architecture (all canvases). Match CLI `describeCommand` output shape.
- **`search`** — args: `{ query, type? }`. Search across all canvases in `fileStore.project`. Match CLI `searchCommand` output shape.
- **`catalog`** — args: `{ namespace? }`. Read from `registryStore.list()` or `listByNamespace()`. Match CLI `catalogCommand` output shape.

Each returns `{ ok: true, data: <result> }` on success or `{ ok: false, error: { code, message } }` on failure (e.g., canvas not found).

### 4. Write action enrichment — `addNode` (spec §4)

Replace the current `addNode` case (which expects a pre-constructed `InlineNode`) with enriched handling:

- Receives raw CLI args: `{ canvasId, id, type, name?, args? }`
- Validates `type` against registry with fuzzy matching (dot→slash substitution, `search()`, `listByNamespace()`)
- Resolves `displayName` from `NodeDef` if `name` not provided
- Constructs `InlineNode`
- Calls `graphStore.addNode()`
- Returns result with node info

This replicates the validation logic from `add-node.ts` lines 25-104 in the browser context. The fuzzy matching and error messages should be format-identical.

### 5. Write action — `import` (spec §4)

Add an `import` case that receives pre-parsed `{ canvasId, nodes, edges, entities }`:
- Validates canvas existence
- Iterates and calls `graphStore.addNode()`, `graphStore.addEdge()`, `graphStore.addEntity()` for each item
- Collects results (added counts + errors)
- Returns `{ ok: true, data: { added, errors } }`

### Acceptance Criteria

- No `fileStore.save()` call in `handleStoreAction()`
- No `NO_FILESYSTEM` error path
- `list`, `describe`, `search`, `catalog` dispatch correctly with matching output shapes
- `addNode` validates type, does fuzzy matching, resolves displayName, constructs InlineNode
- `import` handles pre-parsed nodes/edges/entities
- All existing write actions (addEdge, removeNode, removeEdge) continue to work
