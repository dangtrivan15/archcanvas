# Ephemeral Bridge Operations

**Date:** 2026-03-14
**Status:** Draft
**Scope:** CLI ↔ Bridge ↔ Browser store interaction model

## Problem

When the AI chat on the web UI triggers CLI commands, the bridge roundtrips operations to the browser and **auto-saves to disk** after every mutation. This removes user agency — the user should decide when to persist changes, not the system.

Additionally, read commands (`list`, `describe`, `search`, `catalog`) bypass the bridge entirely and read stale data from disk, even when the browser holds newer in-memory state.

## Design Principle

**When bridge is detected, CLI is a thin transport layer. All logic — validation, enrichment, reads, writes — happens in the browser's in-memory stores. No auto-save.**

When bridge is NOT detected, CLI continues to operate as a standalone tool: loads project from disk, mutates locally, persists to disk.

## Changes

### 1. Remove Auto-Save on Bridge Path

**File:** `src/core/ai/webSocketProvider.ts`

In `handleStoreAction()`, remove the `fileStore.save()` call (line 246) and the `NO_FILESYSTEM` error path (lines 248-254). After dispatching a store action successfully, send the `store_action_result` response immediately — the existing success-send block (lines 266-271) moves up to fill the gap left by the removed save block.

Dirty tracking still works naturally: `graphStore.addNode()` → `fileStore.updateCanvasData()` marks the canvas dirty → UI shows unsaved indicator. User saves via Cmd+S when ready.

### 2. Lightweight `loadContext()` When Bridge Detected

**File:** `src/cli/context.ts`

Reorder `loadContext()` to detect the bridge early. When bridge is found, skip all expensive operations:

```
Bridge detected:
  1. Find project root
  2. Detect bridge → found
  3. Return { fs: null, bridgeUrl }

No bridge (unchanged):
  1. Find project root
  2. Create filesystem
  3. Open project from disk
  4. Initialize registry
  5. Return { fs, bridgeUrl: null }
```

When bridge is active, the CLI does not need filesystem, project data, or registry — the browser has all of this.

**Type change:** `CLIContext.fs` becomes `FileSystem | null`. In the non-bridge path, `fs` is always non-null — write commands guard with `if (ctx.bridgeUrl)` before touching `ctx.fs`, so TypeScript narrowing handles it. Each `saveAll(ctx.fs)` call is inside an `else` branch where `bridgeUrl` is null, guaranteeing `fs` is non-null. Add a `!` assertion or explicit guard at each call site.

### 3. Extend HTTP API with Read Routes

**File:** `src/core/ai/vitePlugin.ts`

Add read routes to `ROUTE_TO_ACTION`:

```typescript
const ROUTE_TO_ACTION: Record<string, string> = {
  // writes
  'add-node': 'addNode',
  'add-edge': 'addEdge',
  'remove-node': 'removeNode',
  'remove-edge': 'removeEdge',
  'import': 'import',
  // reads
  'list': 'list',
  'describe': 'describe',
  'search': 'search',
  'catalog': 'catalog',
};
```

No other changes needed in the vite plugin — the relay logic is already action-agnostic.

### 4. Expand Browser-Side Dispatcher

**File:** `src/core/ai/webSocketProvider.ts`

Expand `dispatchStoreAction()` with:

**Read actions:**
- `list` — read from `fileStore`, format `{ nodes, edges, entities }` matching CLI output shape
- `describe` — read node/architecture from `fileStore` + `registryStore`, format matching CLI output
- `search` — search across all canvases in `fileStore.project`
- `catalog` — read from `registryStore` (browser registry includes both built-in types and any project-local overrides from the layered registry)

**Note:** `useRegistryStore` must be added to the imports in `webSocketProvider.ts` (currently only imports `useGraphStore` and `useFileStore`).

**Write action enrichment:**
- `addNode` — receives raw CLI args `{ canvasId, id, type, name?, args? }` (not a pre-constructed `InlineNode`). The browser dispatcher validates type against registry (with fuzzy matching and suggestions), resolves `displayName` from `NodeDef` if `name` is not provided, constructs the `InlineNode`, then calls `graphStore.addNode()`. This replaces the validation + node construction logic currently in `add-node.ts` lines 27-104 — in bridge mode, the CLI moves the bridge guard before all validation and sends raw args directly. The non-bridge path retains the existing local validation.
- `import` — receive pre-parsed nodes/edges/entities, merge into stores via graphStore (iterating each item and calling `graphStore.addNode/addEdge/addEntity`)

Each action returns data in the same shape the CLI currently outputs, so `bridgeRequest()` responses are format-identical regardless of path.

### 5. CLI Commands Route Through Bridge

**Write commands** (`add-node`, `add-edge`, `remove-node`, `remove-edge`, `import`):
- When bridge detected: send raw args via `bridgeRequest()`, print response. No local validation — browser handles everything.
- When no bridge: unchanged (local store mutation + `fileStore.saveAll()`).

**Read commands** (`list`, `describe`, `search`, `catalog`):
- When bridge detected: send query args via `bridgeRequest()`, print response.
- When no bridge: unchanged (read from local stores populated by `loadContext()`).

Each command calls `loadContext()` internally (matching existing write command pattern) and checks `ctx.bridgeUrl`.

### 6. Rename `bridgeMutate` → `bridgeRequest`

**File:** `src/cli/context.ts` + all call sites

The function is no longer mutation-only — it handles reads too. Rename to `bridgeRequest` to reflect its general purpose.

### 7. Update System Prompt

**File:** `src/core/ai/systemPrompt.ts`

Add a section after Guidelines:

```
## Important: Changes Are Not Auto-Saved

When you execute commands, changes are applied to the in-memory canvas state only.
They are NOT automatically saved to disk. The user will save when they are ready
(e.g., Cmd+S). Do not tell the user that changes have been "saved" — instead confirm
that changes have been "applied" to the canvas.
```

### 8. Import via Bridge

**File:** `src/cli/commands/import.ts`

The import command already uses `node:fs/promises` `readFile()` directly (not the `FileSystem` abstraction) to read the source file. This works regardless of whether `ctx.fs` is null in bridge mode.

When bridge detected:
1. CLI reads and parses the source YAML file locally using `readFile()` from `node:fs/promises` (already the current pattern — no change needed for file reading)
2. CLI parses the YAML into structured `{ nodes, edges, entities }` arrays (currently this parsing only happens in the non-bridge path — move it before the bridge guard)
3. Send parsed data through `bridgeRequest(ctx.bridgeUrl, 'import', { canvasId, nodes, edges, entities })`

**Canvas existence check:** The current code checks `fileStore.getCanvas(canvasId)` before the bridge guard (line 32-35). In bridge mode, `fileStore` has no project loaded, so this check always fails. Move the canvas existence check inside the non-bridge path — the browser-side dispatcher validates canvas existence using its own in-memory state.

**Wire format change:** The current bridge path sends raw YAML (`{ canvasId, yaml: fileContent }`). The new bridge path sends pre-parsed data (`{ canvasId, nodes, edges, entities }`). This is a breaking change to the import wire format, but since the current browser dispatcher doesn't handle `import` at all (returns `UNKNOWN_ACTION`), there is no backward compatibility concern.

The browser receives structured data and merges via graphStore. No filesystem access needed on the browser side.

### 9. `init` Command — No Change

**File:** `src/cli/commands/init.ts`

`init` does not call `loadContext()` — it creates a new project from scratch, writing `.archcanvas/main.yaml` to disk. This command always writes to disk regardless of bridge state, which is correct: creating a new project is a filesystem operation, not a canvas mutation. No bridge routing needed.

### 10. Bridge Disconnect During In-Flight Requests

The existing vite plugin `ws.on('close')` handler already rejects all entries in `pendingMutations` when the browser disconnects. Since read requests reuse the same `pendingMutations` map and relay mechanism, they are automatically covered. A read request in-flight during disconnect receives a `BRIDGE_DISCONNECTED` error response just like a mutation would.

**Naming:** The `pendingMutations` map now handles both reads and writes. Rename to `pendingRequests` for clarity. Also rename related identifiers: `MUTATION_TIMEOUT_MS` → `REQUEST_TIMEOUT_MS`, `mutationTimeoutMs` → `requestTimeoutMs`.

## Data Flow Diagrams

### Write (bridge detected)
```
CLI (raw args)
  → bridgeRequest(POST /api/add-node, { canvasId, id, type, name?, args? })
    → Vite plugin relays via WebSocket
      → Browser dispatchStoreAction('addNode', args)
        → Validate type (registry, fuzzy matching, suggestions)
        → Resolve displayName from NodeDef if name not provided
        → Construct InlineNode
        → graphStore.addNode() → fileStore.updateCanvasData() (marks dirty)
        → Return { ok, data } or { ok: false, error: { code, message } }
      → WebSocket response
    → HTTP response
  → CLI prints result or error
```

### Read (bridge detected)
```
CLI (query args)
  → bridgeRequest(POST /api/list, { canvasId, type })
    → Vite plugin relays via WebSocket
      → Browser dispatchStoreAction('list', args)
        → Read from fileStore/registryStore
        → Format response matching CLI output shape
        → Return { ok, data }
      → WebSocket response
    → HTTP response
  → CLI prints result
```

### Write (no bridge — unchanged)
```
CLI
  → loadContext() → loads project from disk, inits registry
  → Validate locally
  → graphStore.addNode()
  → fileStore.saveAll(fs) → persists to disk
  → Print result
```

### Read (no bridge — unchanged)
```
CLI
  → loadContext() → loads project from disk, inits registry
  → Read from local stores
  → Print result
```

## Files Changed

| File | Change |
|------|--------|
| `src/core/ai/webSocketProvider.ts` | Remove auto-save, add `useRegistryStore` import, expand dispatcher with reads + write enrichment |
| `src/core/ai/vitePlugin.ts` | Add read routes to `ROUTE_TO_ACTION`, rename `pendingMutations` → `pendingRequests` |
| `src/cli/context.ts` | Reorder `loadContext()`, `CLIContext.fs` becomes `FileSystem \| null`, rename `bridgeMutate` → `bridgeRequest` |
| `src/cli/commands/add-node.ts` | Bridge path sends raw args, skip local validation; non-bridge path unchanged |
| `src/cli/commands/add-edge.ts` | Bridge path sends raw args; non-bridge path unchanged |
| `src/cli/commands/remove-node.ts` | Bridge path sends raw args; non-bridge path unchanged |
| `src/cli/commands/remove-edge.ts` | Bridge path sends raw args; non-bridge path unchanged |
| `src/cli/commands/list.ts` | Add bridge guard, call `loadContext()` internally |
| `src/cli/commands/describe.ts` | Add bridge guard, call `loadContext()` internally |
| `src/cli/commands/search.ts` | Add bridge guard, call `loadContext()` internally |
| `src/cli/commands/catalog.ts` | Add bridge guard, call `loadContext()` internally |
| `src/cli/commands/import.ts` | Move YAML parsing before bridge guard, send parsed `{ nodes, edges, entities }` via bridge (wire format change from `{ yaml }`) |
| `src/cli/index.ts` | Update read command wiring (commands now self-contained) |
| `src/core/ai/systemPrompt.ts` | Add "changes not auto-saved" note |

## Testing Considerations

- Existing tests for the non-bridge path should remain green (no behavioral change)
- Bridge path tests in `test/ai/bridge.test.ts` need updating — remove save assertions, add read action tests
- `test/ai/webSocketProvider.test.ts` — test new dispatcher cases (list, describe, search, catalog, enriched addNode with fuzzy matching)
- `test/ai/vitePlugin.test.ts` — test new read routes, verify `pendingRequests` rename
- CLI integration tests — verify read commands route through bridge when detected
- Import tests — verify new wire format (`nodes/edges/entities` instead of `yaml`)
