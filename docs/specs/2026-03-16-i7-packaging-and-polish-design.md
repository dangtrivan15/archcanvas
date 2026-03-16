# I7 — Packaging & Polish

> **Date**: 2026-03-16 | **Phase**: Spec
> **Scope**: Cross-scope ref redesign, entity resolver + panel, protocol compatibility, AI bridge extraction, Tauri desktop packaging, NodeDetailPanel tab-switch API

## Problem

ArchCanvas v2 has completed all core initiatives (I1–I6b) plus refactoring and bug fixes. The app runs in `vite dev` mode with full functionality. However, several gaps remain before a v1 release:

1. **Cross-scope references are limited** — only `@root/` exists, which always jumps to the root canvas. No way to reference nodes in sibling subsystems or intermediate scopes. The syntax breaks when subsystem files are cloned/reused across projects.
2. **Entities lack a UI** — the Data pillar (entities) is defined in YAML and referenced on edges, but there's no panel to browse or navigate entities.
3. **No protocol validation** — ports define accepted protocols, but the engine doesn't check whether connected ports are compatible.
4. **AI only works in dev mode** — the WebSocket+HTTP bridge runs inside the Vite dev server plugin. Production builds (`vite preview`, Tauri) have no AI.
5. **Tauri is scaffold-only** — `cargo check` passes but there's no real build, sidecar, or packaging.
6. **NodeDetailPanel has no external tab-switch API** — deferred from I2.

---

## §1 — Cross-Scope Reference Redesign

### Current State (being replaced)

- `@root/node-id` syntax — child canvases reference nodes in root scope
- Edges with `@root/` live inside child canvas files (upward references)
- `ref` field is a plain identifier; `fileResolver` appends `.yaml`
- Subsystem files have an `id` field that mirrors the ref

### New Model

The redesign introduces three changes:

#### 1.1 — `ref` becomes an explicit file pointer with `.yaml` suffix

```yaml
# Before
nodes:
  - id: order-service
    ref: svc-order-service

# After
nodes:
  - id: order-service
    ref: svc-order-service.yaml
```

`fileResolver.ts` stops appending `.yaml` — the ref value is used as-is for file I/O. The `ref` field is a **file pointer** (storage concern). The parent node's `id` is the **logical identity** used in cross-scope references.

**Contract**: when `fileResolver` loads `ref: svc-order-service.yaml`, the file's contents describe the internals of the node whose `id` is `order-service` in the parent canvas. The subsystem file itself does **not** need an `id` field — its identity comes from the parent's node `id`.

**Canvases map key convention**: `fileResolver` uses the parent ref-node's `id` (not the `ref` filename) as the key in `project.canvases`. This means:
- `canvases.set(node.id, loadedCanvas)` — keyed by `'order-service'`, not `'svc-order-service.yaml'`
- All existing lookup sites (`getCanvas(canvasId)`, `navigationStore.diveIn()`, `NodeRenderer`, etc.) continue using the ref-node `id` as before
- The `ref` field is consumed **only** in `fileResolver` for file I/O — nowhere else in the codebase

Example:
```yaml
# main.yaml
nodes:
  - id: x
    ref: b.yaml

# b.yaml — no id field needed
type: compute/service
displayName: Order Service
nodes: [...]
edges: [...]
```

#### 1.2 — Cross-scope edges live at the parent level

Edges that connect nodes across scope boundaries are defined in the **parent canvas** — the scope where both endpoints are visible (directly or via `@ref-node-id/`).

**Syntax**: `@<ref-node-id>/<node-id>`

- `@<ref-node-id>` must match a ref-node `id` in the **same canvas**
- `/<node-id>` must be a node inside the referenced canvas

```yaml
# main.yaml
nodes:
  - id: order-service
    ref: svc-order-service.yaml
  - id: db-postgres
    type: data/database

edges:
  # Parent owns the cross-scope edge
  - from: { node: @order-service/processor }
    to: { node: db-postgres }
    protocol: SQL
    label: persist orders
```

**No upward references exist.** Child canvases never reference nodes in their parent. The `@root/` syntax is removed entirely.

**Validation rules:**

| Rule | Where | Error |
|------|-------|-------|
| `@<ref-node-id>` must match a ref-node `id` in the same canvas | `engine.ts` at edge-add time (local check) | `CROSS_SCOPE_REF_NOT_FOUND` |
| `/<node-id>` must exist inside the referenced canvas | `fileResolver.ts` at load time, after all canvases are loaded (replaces `validateRootRefs()`). Iterates all canvases, finds edges with `@` endpoints, resolves `@<ref-node-id>` to a canvas via the canvases map, then checks the node exists. If the referenced canvas failed to load earlier (load error), the edge is flagged as `CROSS_SCOPE_REF_UNRESOLVABLE` (degraded, not crash). | `CROSS_SCOPE_NODE_NOT_FOUND` |
| Self-loop: `@x/a` → `@x/a` | `engine.ts` at edge-add time | `EDGE_SELF_LOOP` |
| Removing a ref-node cascades: delete all edges with `@<ref-node-id>/*` endpoints | `engine.ts` in `removeNode()` | N/A (cascade, not error) |

> **Note on YAML quoting**: `@` is a reserved indicator in YAML. Cross-scope ref values must be quoted strings in YAML files: `node: "@order-service/processor"`. The existing `@root/` references work because they are already quoted in practice.

#### 1.3 — Inherited edges rendered in child canvas (render-only)

When the user dives into a subsystem, they need to see the subsystem's external connections. Since cross-scope edges now live in the parent, the renderer **injects** them into the child view at render time.

**Mechanism:**

1. User dives into `order-service` via `navigationStore.diveIn()`
2. The canvas renderer scans the **parent canvas's edges** for any endpoint matching `@order-service/*`
3. For matched edges, it strips the `@order-service/` prefix from the matching endpoint
4. These edges are added to the ReactFlow render list with an `inherited: true` flag
5. `EdgeRenderer` renders inherited edges with the existing ghost/dashed style

**Critical invariant:** inherited edges are **never written to the child's YAML file**. They are transient render-time data. When the user saves, only the file's own edges are serialized.

**Inherited edge interaction:**
- Visible on the child canvas with ghost styling
- Hoverable (shows tooltip with parent scope info)
- Not editable from the child canvas — must navigate to parent to modify
- The non-local endpoint (e.g., `db-postgres` which lives in the parent) renders as a ghost node placeholder at the canvas edge. Ghost nodes are positioned by ELK auto-layout alongside real nodes — they participate in the layout graph as fixed-size placeholders with a "ghost" visual style (dashed border, muted colors, parent scope label). They are not interactive beyond hovering for tooltip.

#### 1.4 — `@root/` removed entirely

No migration needed — the app has not shipped to external users. All `@root/` references in source code, tests, and YAML fixtures are replaced with the new `@<ref-node-id>/<node-id>` syntax.

### Design Decisions

| Decision | Chose | Over | Why |
|----------|-------|------|-----|
| Cross-scope edge ownership | Parent owns the edge | Child references upward | Subsystem files are self-contained; no knowledge of parent needed; enables cloning/reuse without broken refs |
| Canvas identity | Parent node `id` | `id` field in subsystem file | Identity lives where the relationship is defined; no duplication; renaming the file doesn't break refs |
| Ref field format | Explicit `.yaml` suffix | Implicit (append at load time) | Explicit is unambiguous; removes a question that shouldn't need asking |
| Child canvas visibility | Inherited edges at render time | Edges stored in child file | Clean data model; no duplication; render-only injection |
| `@root/` replacement | `@<ref-node-id>/<node-id>` | `@parent/`, `@parent(N)/`, `@ref/` | Restructure-proof (identity-based, not depth-based); locally validatable; works with cloned subsystems |

### Files Changed

| File | Change |
|------|--------|
| `src/types/schema.ts` | Change `SubsystemCanvas` refinement from requiring `id && type` to requiring only `type`; update ref field docs |
| `src/storage/fileResolver.ts` | Remove `.yaml` append; new cross-scope validation for `@<ref-node-id>/<node-id>`; remove `validateRootRefs()` |
| `src/core/graph/engine.ts` | Replace `@root/` checks with `@`-prefix checks; `removeNode` must cascade-delete edges with `@<removed-ref-node-id>/*` endpoints; protocol mismatch on cross-scope edges |
| `src/core/graph/query.ts` | Update `matchesNodeId()` for new syntax |
| `src/core/graph/validation.ts` | Update cross-scope skip logic |
| `src/components/edges/EdgeRenderer.tsx` | Inherited edge rendering (ghost style, `inherited` flag) |
| `src/components/canvas/hooks/useCanvasRenderer.ts` | Inject inherited edges from parent when in child scope |
| `src/store/navigationStore.ts` | `diveIn()` already receives the ref-node `id` as its argument — change canvas lookup from `node.ref` to the `refNodeId` parameter (aligns with new map key convention); pass parent canvas context for inherited edge resolution |
| `src/store/fileStore.ts` | No `saveAll` change needed (`LoadedCanvas.filePath` already handles file paths). Verify that `fileResolver` sets `filePath` correctly using the new `ref` value (with `.yaml` suffix). |
| `src/store/graphStore.ts` | Update cross-scope ref handling in store actions |
| `src/components/nodes/NodeRenderer.tsx` | Uses `getCanvas(node.ref)` → update to use ref-node `id` consistently |
| `src/core/ai/webSocketProvider.ts` | Update `canvases.get(ref)` lookups to use ref-node `id` |
| `src/core/ai/systemPrompt.ts` | Update cross-scope examples |
| `src/cli/commands/*` | Update `@root/` references in help text and output |
| All test files with `@root/` | Replace with new syntax |

---

## §2 — Entity Resolver & EntityPanel

### Entity Resolver (`src/core/entity/resolver.ts`)

Pure function layer for cross-scope entity lookup. No store, no React.

```typescript
interface EntityUsage {
  canvasId: string;           // ref-node-id (or ROOT_CANVAS_KEY for root)
  canvasDisplayName: string;
  edges: Edge[];              // edges in that canvas referencing this entity
}

interface EntitySummary {
  name: string;
  description?: string;
  definedIn: string[];        // canvas ids where entity is in the entities array
  referencedIn: string[];     // canvas ids where edges reference this entity name
}

/** Find all usages of a named entity across all loaded canvases. */
function findEntityUsages(project: ResolvedProject, entityName: string): EntityUsage[]

/** List all unique entities across the project with definition and usage scopes. */
function listAllEntities(project: ResolvedProject): EntitySummary[]

/** Get entities defined in a specific canvas scope. */
function getEntitiesForCanvas(project: ResolvedProject, canvasId: string): Entity[]
```

**Key design:**
- Entities are matched by **name** (string equality), consistent with how edges reference them
- An entity can be defined in scope A but referenced on edges in scopes A, B, and C
- The resolver scans all loaded canvases — it works with the existing `ResolvedProject` structure, no new data model needed

### EntityPanel (`src/components/panels/EntityPanel.tsx`)

A new tab in the right panel area, peer to NodeDetailPanel, EdgeDetailPanel, and ChatPanel.

**Layout:**
- Header: "Entities" with scope indicator (current canvas name)
- Search/filter input
- Entity list — each row shows:
  - Entity name
  - Description (truncated)
  - Usage badge: number of edges referencing this entity in current scope
- Expandable detail per entity:
  - Full description
  - `codeRefs` list
  - Cross-scope usages via `findEntityUsages()` — shows which other canvases use this entity
  - Click a cross-scope usage → navigates to that canvas and highlights the referencing edges

**Interactions:**
- Click entity row → highlights all edges in the current canvas that reference it (via `canvasStore.highlightEdges()`)
- Click cross-scope usage → uses `navigationStore`'s breadcrumb-based navigation to reach the target canvas (may require multiple dive-in/go-up steps for deeply nested targets), then highlights edges
- Command palette `# ` prefix → searches entities across all scopes, selecting navigates to defining scope and opens EntityPanel

**`highlightEdges` behavior** (new action in `canvasStore`):
- `highlightEdges(edgeIds: string[])` — sets `highlightedEdgeIds` state
- Highlighted edges render with a distinct visual treatment (brighter stroke, slight glow) — different from selection
- Highlight clears on: next click anywhere on canvas, Escape key, or navigation change
- `EdgeRenderer` checks `highlightedEdgeIds` and applies a CSS class (e.g., `.edge-highlighted`)

**When visible:**
- Always available as a tab
- Auto-activates when user selects an entity via command palette

**No CRUD** — entities are read-only from YAML. Adding, editing, and deleting entities from the panel is deferred to a future initiative.

### Design Decisions

| Decision | Chose | Over | Why |
|----------|-------|------|-----|
| Panel placement | Right panel tab | Bottom panel, inside NodeDetailPanel | Entities are a top-level pillar, not a node property; right panel infrastructure exists |
| Interaction model | Browse + navigate | Read-only browser, full CRUD | Makes the Data pillar feel real; CRUD deferred |
| Cross-scope lookup | Scan all loaded canvases | Index at load time | Simpler; project sizes are small enough that scanning is fast |
| Entity matching | By name (string equality) | By ID | Consistent with existing edge entity references |

### Files

| File | Change |
|------|--------|
| **New**: `src/core/entity/resolver.ts` | Pure functions for entity lookup |
| **New**: `src/components/panels/EntityPanel.tsx` | React component |
| `src/components/layout/RightPanel.tsx` | Add EntityPanel tab |
| `src/components/shared/CommandPalette.tsx` | Add entity provider for `#` prefix |
| `src/store/canvasStore.ts` | Add `highlightEdges(edgeIds: string[])` action |
| `src/store/uiStore.ts` | Expand `rightPanelMode` from `'details' \| 'chat'` to `'details' \| 'chat' \| 'entities'` |

---

## §3 — Protocol Compatibility

### Approach

No separate lookup table. Compatibility is determined by **protocol intersection between connected ports**. The data already exists on NodeDef port definitions.

When an edge is created between two ports, the engine checks whether the ports' protocol arrays have any overlap. If they don't, the edge is **rejected** (hard error, not a soft warning).

### Core Function (`src/core/protocol/compatibility.ts`)

```typescript
interface ProtocolCheckResult {
  compatible: boolean;
  fromPortName?: string;
  fromProtocols?: string[];
  toPortName?: string;
  toProtocols?: string[];
}

/**
 * Check whether two ports have compatible protocols.
 * Compatible = at least one protocol in common.
 * If either port has no protocol list, compatibility is assumed (no check).
 *
 * Uses `PortDef` from `nodeDefSchema.ts` — the resolved port definition from the registry.
 * Edge endpoints only carry a port name (`string`); the engine resolves to `PortDef` via the registry.
 */
function arePortsCompatible(
  fromPort: PortDef | undefined,
  toPort: PortDef | undefined,
): ProtocolCheckResult
```

### Behavior Matrix

| From port protocols | To port protocols | Result |
|---------------------|-------------------|--------|
| `[HTTP, HTTPS]` | `[HTTP, gRPC]` | **Compatible** — HTTP overlaps |
| `[HTTP, HTTPS]` | `[SQL]` | **Rejected** — no overlap |
| `[HTTP]` | `[]` or undefined | **Compatible** — skip check |
| undefined | undefined | **Compatible** — skip check |
| Port not found in NodeDef | Any | No check (existing `PORT_NOT_FOUND` warning) |

### Integration

**Engine (`addEdge`):**

When both endpoints specify ports, the engine resolves the ports from the NodeDef registry and checks protocol intersection. If incompatible:

```typescript
{
  ok: false,
  error: {
    code: 'PROTOCOL_MISMATCH',
    message: 'http-out accepts [HTTP, HTTPS], query-in accepts [SQL] — no common protocol'
  }
}
```

The edge is **not created**. Same error pattern as `EDGE_ENDPOINT_NOT_FOUND`. The error message format above is illustrative of the common case (both ports defined); port names and protocol arrays come from `ProtocolCheckResult`.

**CLI:**

`archcanvas add-edge` reports the error and exits non-zero. The `--json` flag includes structured error output for AI consumption.

### Design Decisions

| Decision | Chose | Over | Why |
|----------|-------|------|-----|
| Data source | Port protocol arrays from NodeDefs | Separate compatibility matrix / lookup table | Data already exists; no duplication; NodeDefs are source of truth |
| Incompatible behavior | Reject edge creation (hard error) | Soft warning with persistent badge | If ports can't talk, the edge is invalid — prevent the invalid state |
| No protocols defined | Skip check (assume compatible) | Reject | Many edges don't specify ports; too restrictive otherwise |

### Files

| File | Change |
|------|--------|
| **New**: `src/core/protocol/compatibility.ts` | `arePortsCompatible()` function |
| `src/core/graph/engine.ts` | Check on `addEdge()`, reject on mismatch |
| `src/cli/commands/add-edge.ts` | Error output for protocol mismatch |

---

## §4 — AI Bridge Extraction & Tauri Packaging

### Problem

The AI bridge (WebSocket + HTTP endpoints for Claude Code SDK communication) currently runs only inside the Vite dev server via the `configureServer` hook in `vitePlugin.ts`. Production builds have no AI.

### Bridge Extraction

Split `vitePlugin.ts` into two layers:

```
src/core/ai/
  bridgeServer.ts      ← NEW: standalone HTTP + WebSocket server (pure Node.js)
  vitePlugin.ts        ← MODIFIED: thin wrapper that delegates to bridgeServer
  claudeCodeBridge.ts  ← unchanged
```

**`bridgeServer.ts`** owns:
- HTTP server (`http.createServer`) with the same routes as current vitePlugin (prefix: `/__archcanvas_ai/api/`):
  - `POST /__archcanvas_ai/api/add-node`, `/add-edge`, `/remove-node`, `/remove-edge`, `/import` — mutations
  - `POST /__archcanvas_ai/api/list`, `/describe`, `/search`, `/catalog` — read operations (POST, not GET, matching current vitePlugin; the Claude Code SDK tool definitions send POST for all routes)
- WebSocket upgrade handling (same protocol as current vitePlugin)
- Port configuration (default: 17248, configurable via `--port` or `ARCHCANVAS_BRIDGE_PORT` env)
- Unhandled rejection handler for SDK workaround (carry forward from vitePlugin lines 118-125)
- Graceful shutdown

**`vitePlugin.ts`** becomes a thin adapter:
- `configureServer` hook: attaches bridgeServer routes to Vite's dev server (existing behavior, refactored)
- `configurePreviewServer` hook: same attachment for `vite preview` mode (bonus fix)

### Standalone Server Entry

```
src/bridge/
  index.ts    ← entry: node bridge-server.js --port 17248 --cwd /path/to/project
```

**Build**: new `vite.config.bridge.ts` → produces `dist/bridge-server.js`. Same pattern as existing CLI build (`vite.config.cli.ts`): single ESM file, `node20` target, shebang.

**Arguments:**
- `--port <number>` — server port (default: 17248)
- `--cwd <path>` — project working directory (passed to Claude Code SDK sessions)

### Compiled Binary Sidecar

```bash
bun build --compile dist/bridge-server.js --outfile src-tauri/binaries/archcanvas-bridge
```

Produces a standalone binary with Node runtime bundled (~50-80 MB). Zero external dependencies for the user.

**Risk gate**: before full implementation, validate that `bun build --compile` works with `@anthropic-ai/claude-code` SDK. If native dependencies or runtime assumptions break:
- **Fallback**: ship `dist/bridge-server.js` and require Node.js on the user's machine (viable — target audience is developers)

### Tauri Integration

```
src-tauri/
  binaries/
    archcanvas-bridge-aarch64-apple-darwin    ← compiled sidecar (per-platform)
  tauri.conf.json                             ← sidecar declaration
  src/
    main.rs                                   ← spawn sidecar, capture port
```

**Sidecar lifecycle:**
1. Tauri app starts → spawns `archcanvas-bridge` sidecar with `--cwd` set to the project directory
2. Sidecar writes a structured first line to stdout: `BRIDGE_PORT=<port>` (e.g., `BRIDGE_PORT=17248`). All subsequent stdout is log output — Tauri only parses the first line.
3. Tauri captures the port via sidecar stdout and exposes it to the webview via a Tauri command
4. Frontend reads the port and connects WebSocket to `ws://localhost:<port>`
5. App closes → Tauri kills the sidecar

**Port discovery**: the frontend calls a Tauri command (`get_bridge_port`) to get the port. In non-Tauri environments (web), falls back to well-known port 17248 or `ARCHCANVAS_BRIDGE_PORT` env var.

### Build Pipeline

```bash
npm run build            # web assets (existing)
npm run build:cli        # CLI binary (existing)
npm run build:bridge     # bridge server JS (NEW)
npm run build:sidecar    # bun compile bridge → binary (NEW)
npm run tauri build      # Tauri app with sidecar (NEW)
```

### Tauri Packaging

- **Target**: macOS (aarch64 + x86_64)
- **Distribution**: `.dmg` installer
- **App signing**: Apple Developer ID (required for Gatekeeper)
- **Notarization**: Apple notarization for distribution outside App Store
- **Tauri plugins needed**: `tauri-plugin-shell` (already in Cargo.toml), `@tauri-apps/plugin-fs` (install npm package, remove custom `.d.ts` workaround)

### Design Decisions

| Decision | Chose | Over | Why |
|----------|-------|------|-----|
| Bridge architecture | Extract to standalone server, vitePlugin delegates | Keep in vitePlugin only | Enables Tauri sidecar and `vite preview` without duplicating bridge logic |
| Sidecar binary | `bun build --compile` | Require Node.js on user machine | Zero dependencies for desktop users; ~80MB is reasonable for desktop app |
| Port discovery | Sidecar stdout → Tauri command | Well-known port only | Avoids port conflicts; multiple instances can run |
| Tauri platform | macOS only for v1 | Cross-platform | Primary target; Linux/Windows in future |

### Files

| File | Change |
|------|--------|
| **New**: `src/core/ai/bridgeServer.ts` | Standalone HTTP+WS server |
| **New**: `src/bridge/index.ts` | Bridge CLI entry |
| **New**: `vite.config.bridge.ts` | Bridge build config |
| `src/core/ai/vitePlugin.ts` | Refactor to delegate to bridgeServer; add `configurePreviewServer` hook for `vite preview` support |
| `src-tauri/tauri.conf.json` | Sidecar declaration |
| `src-tauri/src/main.rs` | Sidecar spawn + port capture |
| `package.json` | New build scripts |

---

## §5 — NodeDetailPanel Tab-Switch API

### Scope

Low priority — convenience item. Wire up if implementation is straightforward.

### Approach

Add an imperative API to `NodeDetailPanel` that allows external code to switch to a specific tab:

```typescript
// In canvasStore or uiStore:
setDetailPanelTab(tab: 'properties' | 'notes' | 'codeRefs'): void
```

The panel subscribes to this state and switches tabs when it changes.

**Use cases:**
- Command palette search result → opens node detail with Notes tab active
- EntityPanel cross-scope navigation → opens edge detail panel
- Future: AI chat actions that reference specific node properties

### Files

| File | Change |
|------|--------|
| `src/store/uiStore.ts` | Add `detailPanelTab` state + setter |
| `src/components/panels/NodeDetailPanel.tsx` | Subscribe to `detailPanelTab` |

---

## §6 — Future Work (Out of Scope)

Items explicitly deferred:

| Item | Notes |
|------|-------|
| **ApiKeyProvider** (direct Anthropic API) | v1 ships Claude Code-only. ApiKeyProvider does not need the bridge — it runs entirely in the browser. Adding it later is a clean addition, not a refactor. |
| **Entity CRUD** | EntityPanel is read-only in v1. Add/edit/delete from the panel is a future initiative. |
| **Remote NodeDef registry** | Community-shared NodeDefs via HTTP API. v2 feature. |
| **Protocol customization** | Project-level protocol compatibility overrides. Not needed for v1. |
| **Linux/Windows Tauri builds** | macOS only for v1. |
| **`getPath()` auto-resolve for Tauri** | Interface exists. Exercise when Tauri runtime is active — should "just work" once the sidecar launches with `--cwd`. |

---

## Summary

| Area | Approach |
|------|----------|
| **Cross-scope refs** | `@<ref-node-id>/<node-id>` in parent edges. Inherited edges rendered in child (render-only). `ref` includes `.yaml`. No subsystem `id` field. `@root/` removed. |
| **Entity resolver** | Pure functions: `findEntityUsages()`, `listAllEntities()`, `getEntitiesForCanvas()`. Cross-scope by name. |
| **EntityPanel** | Right panel tab. Browse, click-to-highlight-edges, cross-scope usage. `#` prefix in command palette. No CRUD. |
| **Protocol compatibility** | Port protocol intersection. No overlap → reject edge creation (hard error). Data from NodeDef ports. |
| **AI bridge** | Extract `bridgeServer.ts`. Standalone entry. Compiled via `bun build --compile` for Tauri sidecar. |
| **Tauri packaging** | Sidecar binary in `.app` bundle. macOS `.dmg`. App signing + notarization. |
| **Tab-switch API** | `uiStore.detailPanelTab` state. Convenience, low priority. |
