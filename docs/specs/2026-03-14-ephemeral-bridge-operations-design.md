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

In `handleStoreAction()`, remove the `fileStore.save()` call and the `NO_FILESYSTEM` error path. After dispatching a store action, send the result back immediately.

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
- `catalog` — read from `registryStore`

**Write action enrichment:**
- `addNode` — validate type against registry (with fuzzy matching and suggestions), resolve `displayName` from `NodeDef` if not provided, then call `graphStore.addNode()`
- `import` — receive pre-parsed nodes/edges/entities, merge into stores via graphStore

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

When bridge detected:
1. CLI parses the source `.archcanvas` file locally (CLI has filesystem access via `loadContext()` — but wait, in bridge mode `fs` is null)
2. Use a dedicated filesystem just for reading the import file (not the project filesystem)
3. Send parsed nodes/edges/entities through `bridgeRequest(ctx.bridgeUrl, 'import', { canvasId, nodes, edges, entities })`

The browser receives structured data and merges via graphStore. No filesystem access needed on the browser side.

**Note:** The import command is the one exception where the CLI still needs filesystem access in bridge mode — but only to read the *source* file, not the project files. This is a one-off `fs.readFile()` on the import path, not a full `loadContext()` load.

## Data Flow Diagrams

### Write (bridge detected)
```
CLI (raw args)
  → bridgeRequest(POST /api/add-node, { id, type, name? })
    → Vite plugin relays via WebSocket
      → Browser dispatchStoreAction('addNode', args)
        → Validate type (registry, fuzzy matching)
        → Resolve displayName
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
| `src/core/ai/webSocketProvider.ts` | Remove auto-save, expand dispatcher with reads + write enrichment |
| `src/core/ai/vitePlugin.ts` | Add read routes to `ROUTE_TO_ACTION` |
| `src/cli/context.ts` | Reorder `loadContext()`, rename `bridgeMutate` → `bridgeRequest` |
| `src/cli/commands/add-node.ts` | Simplify bridge path (send raw args, no local validation) |
| `src/cli/commands/add-edge.ts` | Simplify bridge path |
| `src/cli/commands/remove-node.ts` | Simplify bridge path |
| `src/cli/commands/remove-edge.ts` | Simplify bridge path |
| `src/cli/commands/list.ts` | Add bridge guard, call `loadContext()` internally |
| `src/cli/commands/describe.ts` | Add bridge guard, call `loadContext()` internally |
| `src/cli/commands/search.ts` | Add bridge guard, call `loadContext()` internally |
| `src/cli/commands/catalog.ts` | Add bridge guard, call `loadContext()` internally |
| `src/cli/commands/import.ts` | Parse file locally, send parsed data via bridge |
| `src/cli/index.ts` | Update read command wiring (commands now self-contained) |
| `src/core/ai/systemPrompt.ts` | Add "changes not auto-saved" note |

## Testing Considerations

- Existing tests for the non-bridge path should remain green (no behavioral change)
- Bridge path tests in `test/ai/bridge.test.ts` need updating — remove save assertions, add read action tests
- `test/ai/webSocketProvider.test.ts` — test new dispatcher cases (list, describe, search, catalog, enriched addNode)
- `test/ai/vitePlugin.test.ts` — test new read routes
- CLI integration tests — verify read commands route through bridge when detected
