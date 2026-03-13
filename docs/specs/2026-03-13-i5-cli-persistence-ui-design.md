# I5: CLI & Persistence UI — Design Spec

> **Date**: 2026-03-13 | **Status**: Final
> **Scope**: CLI (9 commands, headless store usage), Persistence UI (Open/Save/SaveAs, dirty tracking, save-on-close), universal FileSystem factory, builtin registry as TS objects

---

## Table of Contents

1. [Overview](#1-overview)
2. [Design Contracts](#2-design-contracts)
3. [CLI Architecture](#3-cli-architecture)
4. [Persistence UI](#4-persistence-ui)
5. [Universal FileSystem Factory](#5-universal-filesystem-factory)
6. [Registry: Builtins as TS Objects](#6-registry-builtins-as-ts-objects)
7. [Test Contracts](#7-test-contracts)

---

## 1. Overview

I5 delivers two capabilities:

- **CLI** — A standalone Node.js program (`archcanvas`) with 9 subcommands that share the same Zustand stores and core layer as the UI. Built via a separate Vite config targeting Node.
- **Persistence UI** — Wires the existing menu stubs (Open, Save) to real file system operations, adds Save As, dirty tracking, save-on-close confirmation, keyboard shortcuts, and recent files.

Both depend on two infrastructure changes:

- **Universal FileSystem factory** — Extends `createFileSystem` to handle Node.js via dynamic import.
- **Builtin NodeDefs as TS objects** — Eliminates Vite `?raw` dependency, making registry initialization work identically in browser and Node.js.

---

## 2. Design Contracts

These are the testable interfaces and behavioral guarantees that define I5. Tests assert against these contracts; implementation details may vary.

### Scope-to-CanvasId Mapping

All CLI commands that accept a `--scope` flag use this mapping:

| `--scope` value | `canvasId` |
|---|---|
| Omitted or `"root"` | `ROOT_CANVAS_KEY` (`"__root__"`) |
| Any other value | Used as-is (e.g., `"svc-order-service"`) |

This mapping is centralized in `src/cli/context.ts` as a `resolveCanvasId(scope?: string)` helper.

### Contract 1: FileSystem Factory

```typescript
// src/platform/index.ts
function createFileSystem(root: string | FileSystemDirectoryHandle): Promise<FileSystem>;
```

| Input | Environment | Returns |
|---|---|---|
| `FileSystemDirectoryHandle` | Any | `WebFileSystem` |
| `string` | `typeof window === 'undefined'` | `NodeFileSystem` (via dynamic import) |
| `string` | Tauri detected | `TauriFileSystem` |
| `string` | Browser, no Tauri | Throws `Error('Unsupported environment')` |

**Tauri detection:** `isTauriEnvironment()` checks for `window.__TAURI_INTERNALS__`. Tauri always runs in a webview with a `window` global, so the `typeof window === 'undefined'` check reliably distinguishes Node.js from Tauri. The detection order is: DirectoryHandle → Node.js (no window) → Tauri (window + `__TAURI_INTERNALS__`) → error.

**Invariants:**
- C1.1: Given a `DirectoryHandle`, always returns `WebFileSystem` regardless of environment.
- C1.2: Given a `string` in Node.js (no `window` global), returns `NodeFileSystem`.
- C1.3: Given a `string` with Tauri APIs present (`window.__TAURI_INTERNALS__`), returns `TauriFileSystem`.
- C1.4: Given a `string` in a browser without Tauri, throws a descriptive error.
- C1.5: The returned `FileSystem` satisfies the `FileSystem` interface (all 5 methods callable).
- C1.6: `NodeFileSystem` is never statically imported — only loaded via `await import()`.

### Contract 2: NodeFileSystem

```typescript
// src/platform/nodeFileSystem.ts
class NodeFileSystem implements FileSystem {
  constructor(root: string);
  readFile(path: string): Promise<string>;
  writeFile(path: string, content: string): Promise<void>;
  listFiles(dir: string): Promise<string[]>;
  exists(path: string): Promise<boolean>;
  mkdir(path: string): Promise<void>;
}
```

**Invariants:**
- C2.1: All paths are resolved relative to the `root` passed to the constructor.
- C2.2: `readFile` returns UTF-8 string content. Throws on missing file.
- C2.3: `writeFile` creates parent directories if they don't exist (recursive mkdir).
- C2.4: `listFiles` returns filenames (not full paths) in the given directory.
- C2.5: `exists` returns `true`/`false`, never throws.
- C2.6: `mkdir` is recursive (`{ recursive: true }`), no-op if directory exists.

### Contract 3: Builtin Registry Loader

```typescript
// src/core/registry/builtins/index.ts
export const builtinNodeDefs: NodeDef[];
```

**Invariants:**
- C3.1: `builtinNodeDefs` is a static array of validated `NodeDef` objects.
- C3.2: Length matches the number of builtin definitions (currently 32).
- C3.3: Each entry passes `nodeDefSchema.parse()` without error.
- C3.4: All 9 namespaces are represented: compute, data, messaging, network, client, integration, security, observability, ai.
- C3.5: No YAML parsing occurs at runtime for builtins — they are plain TS objects.
- C3.6: `registryStore.initialize()` uses `builtinNodeDefs` directly (no loader argument, no environment detection).

### Contract 4: CLI Context

```typescript
// src/cli/context.ts
interface CLIContext {
  fs: FileSystem;
}

function loadContext(projectPath?: string): Promise<CLIContext>;
function resolveCanvasId(scope?: string): string;
```

**Invariants:**
- C4.1: If `projectPath` is provided, uses it. Otherwise, searches cwd upward for `.archcanvas/`.
- C4.2: Creates a `FileSystem` via `createFileSystem(resolvedPath)`.
- C4.3: Calls `fileStore.openProject(fs)` and waits for `status === 'loaded'`.
- C4.4: Calls `registryStore.initialize()` (builtins loaded from TS objects).
- C4.5: Returns `{ fs }` on success. CLI commands access project data via `fileStore.getState()` — the store is the single source of truth for all mutations and reads.
- C4.6: Throws `CLIError` with code `PROJECT_NOT_FOUND` if no `.archcanvas/` directory found.
- C4.7: Throws `CLIError` with code `PROJECT_LOAD_FAILED` if fileStore reports an error.
- C4.8: `resolveCanvasId('root')` and `resolveCanvasId(undefined)` both return `ROOT_CANVAS_KEY`. Any other value passes through as-is.

### Contract 5: CLI Commands

```typescript
// src/cli/index.ts — commander program
// All commands accept --json flag for structured output
// All mutation commands call fileStore.saveAll(ctx.fs) before exit
```

#### 5a: `archcanvas init`

| Flag | Type | Default | Description |
|---|---|---|---|
| `--name` | string | directory name | Project name |
| `--path` | string | cwd | Target directory |

**Invariants:**
- C5a.1: Creates `.archcanvas/` directory at target path.
- C5a.2: Creates `main.yaml` with the following template (sections omitted, not empty arrays):

```yaml
project:
  name: <name>
  description: ""
  version: "1.0.0"

nodes: []
edges: []
entities: []
```

- C5a.3: If `.archcanvas/main.yaml` already exists, exits with error `PROJECT_EXISTS`.
- C5a.4: Human output: `"Initialized project '<name>' at <path>"`.
- C5a.5: JSON output: `{ ok: true, project: { name, path } }`.

#### 5b: `archcanvas add-node`

| Flag | Type | Required | Description |
|---|---|---|---|
| `--id` | string | yes | Node ID |
| `--type` | string | yes | NodeDef type (e.g., `compute/service`) |
| `--name` | string | no | Display name (defaults to NodeDef displayName) |
| `--scope` | string | no | Canvas scope (defaults to root) |
| `--args` | JSON string | no | Node args as JSON |

**Invariants:**
- C5b.1: Constructs an `InlineNode` object and calls `graphStore.addNode(canvasId, node)`:

```typescript
const node: InlineNode = {
  id: flags.id,
  type: flags.type,
  displayName: flags.name ?? nodeDef.metadata.displayName,
  args: flags.args ? JSON.parse(flags.args) : undefined,
};
graphStore.addNode(resolveCanvasId(flags.scope), node);
```

- C5b.2: On `result.ok === true`, calls `fileStore.saveAll(ctx.fs)` and outputs the created node.
- C5b.3: On `result.ok === false`, exits with the engine error (e.g., `DUPLICATE_NODE_ID`).
- C5b.4: If `--type` doesn't exist in registry, exits with `UNKNOWN_NODE_TYPE` before calling the engine.
- C5b.5: If `--name` is omitted, resolves `displayName` from the NodeDef's `metadata.displayName`.
- C5b.6: JSON output: `{ ok: true, node: { id, type, displayName } }` or `{ ok: false, error: { code, message } }`.

#### 5c: `archcanvas add-edge`

| Flag | Type | Required | Description |
|---|---|---|---|
| `--from` | string | yes | Source node ID |
| `--to` | string | yes | Target node ID |
| `--from-port` | string | no | Source port name |
| `--to-port` | string | no | Target port name |
| `--protocol` | string | no | Protocol label |
| `--label` | string | no | Edge label |
| `--scope` | string | no | Canvas scope (defaults to root) |

**Invariants:**
- C5c.1: Constructs an `Edge` object and calls `graphStore.addEdge(canvasId, edge)`:

```typescript
const edge: Edge = {
  from: { node: flags.from, port: flags.fromPort },
  to: { node: flags.to, port: flags.toPort },
  protocol: flags.protocol,
  label: flags.label,
};
graphStore.addEdge(resolveCanvasId(flags.scope), edge);
```

- C5c.2: On `result.ok === true`, calls `fileStore.saveAll(ctx.fs)` and outputs the created edge.
- C5c.3: On `result.ok === false`, exits with the engine error (e.g., `EDGE_ENDPOINT_NOT_FOUND`).
- C5c.4: JSON output follows the same `{ ok, ... }` structure.

#### 5d: `archcanvas remove-node`

| Flag | Type | Required | Description |
|---|---|---|---|
| `--id` | string | yes | Node ID to remove |
| `--scope` | string | no | Canvas scope (defaults to root) |

**Invariants:**
- C5d.1: Calls `graphStore.removeNode(resolveCanvasId(flags.scope), flags.id)`.
- C5d.2: On `result.ok === true`, calls `fileStore.saveAll(ctx.fs)` and outputs confirmation.
- C5d.3: On `result.ok === false`, exits with engine error (e.g., `NODE_NOT_FOUND`).
- C5d.4: Removes all edges connected to the removed node (engine handles this).

#### 5e: `archcanvas remove-edge`

| Flag | Type | Required | Description |
|---|---|---|---|
| `--from` | string | yes | Source node ID |
| `--to` | string | yes | Target node ID |
| `--scope` | string | no | Canvas scope (defaults to root) |

**Invariants:**
- C5e.1: Calls `graphStore.removeEdge(resolveCanvasId(flags.scope), flags.from, flags.to)`.
- C5e.2: On `result.ok === true`, calls `fileStore.saveAll(ctx.fs)` and outputs confirmation.
- C5e.3: On `result.ok === false`, exits with engine error (e.g., `EDGE_NOT_FOUND`).
- C5e.4: JSON output: `{ ok: true, removed: { from, to } }` or `{ ok: false, error: { code, message } }`.

#### 5f: `archcanvas list`

| Flag | Type | Default | Description |
|---|---|---|---|
| `--scope` | string | root | Canvas scope |
| `--type` | `nodes\|edges\|entities\|all` | `all` | What to list |

**Invariants:**
- C5f.1: Reads canvas data from `fileStore.getCanvas(resolveCanvasId(flags.scope))`.
- C5f.2: Filters by `--type` if specified.
- C5f.3: Human output: formatted table with columns appropriate to the type.
- C5f.4: JSON output: `{ nodes: [...], edges: [...], entities: [...] }` (only requested types included).
- C5f.5: If scope doesn't exist, exits with `CANVAS_NOT_FOUND`.

#### 5g: `archcanvas describe`

| Flag | Type | Required | Description |
|---|---|---|---|
| `--id` | string | no | Node ID (omit for full architecture) |
| `--scope` | string | no | Canvas scope (defaults to root) |

**Invariants:**
- C5g.1: If `--id` provided, outputs detailed node description: type, displayName, args, edges connected to this node, notes, codeRefs. Ports are resolved from the NodeDef registry (not stored on the node instance).
- C5g.2: If `--id` omitted, outputs full architecture summary (project name, node count, edge count, entity count per scope).
- C5g.3: For nodes with `ref` (subsystem canvases), includes child summary (node/edge counts inside).
- C5g.4: JSON output: full node or architecture object.

#### 5h: `archcanvas search`

| Flag | Type | Required | Description |
|---|---|---|---|
| `<query>` | positional | yes | Search term |
| `--type` | `nodes\|edges\|entities\|all` | no | Filter by type |

**Invariants:**
- C5h.1: Searches across all loaded scopes — iterates all entries in `fileStore.project.canvases` (i.e., only canvases reachable from root via `ref` pointers, not arbitrary files on disk).
- C5h.2: Matches against: node IDs, displayNames, types, entity names, edge labels.
- C5h.3: Case-insensitive substring matching (not fuzzy).
- C5h.4: Results include the scope (canvasId) where each match was found.
- C5h.5: JSON output: `{ results: [{ type, scope, item }] }`.

#### 5i: `archcanvas import`

| Flag | Type | Required | Description |
|---|---|---|---|
| `--file` | string | yes | Path to YAML file with nodes/edges/entities |
| `--scope` | string | no | Target canvas scope (defaults to root) |

**Invariants:**
- C5i.1: Reads the YAML file, parses it as a partial canvas (nodes, edges, entities arrays). Requires the `yaml` package at runtime.
- C5i.2: Iterates through items, calling `graphStore.addNode/addEdge/addEntity` for each.
- C5i.3: Collects errors per item — does not stop on first error.
- C5i.4: Saves once at the end via `fileStore.saveAll(ctx.fs)` (not per item).
- C5i.5: Human output: summary of added/failed counts.
- C5i.6: JSON output: `{ added: { nodes: N, edges: N, entities: N }, errors: [...] }`.

### Contract 6: CLI Output Formatting

```typescript
// src/cli/output.ts
interface OutputOptions {
  json: boolean;
}

function formatSuccess(data: unknown, options: OutputOptions): string;
function formatError(error: CLIError, options: OutputOptions): string;
```

**Invariants:**
- C6.1: When `json: true`, output is valid JSON parseable by `JSON.parse()`.
- C6.2: When `json: false`, output is human-readable text (tables, indented blocks).
- C6.3: Error output goes to stderr, success output goes to stdout.
- C6.4: All JSON error output has shape `{ ok: false, error: { code: string, message: string } }`.
- C6.5: All JSON success output has shape `{ ok: true, ...data }`.
- C6.6: Exit code 0 on success, 1 on error.

### Contract 7: Persistence UI — fileStore Extensions

```typescript
// Extended fileStore state/methods
interface FileStoreExtensions {
  // State
  fs: FileSystem | null;              // active FileSystem instance
  recentProjects: RecentProject[];    // last 5 opened paths

  // Methods (UI-only — CLI never calls these)
  open(): Promise<void>;             // show picker → load project
  save(): Promise<void>;             // delegates to saveAll(this.fs)
  saveAs(): Promise<void>;           // show picker → save to new location
  isDirty(): boolean;                // shortcut for dirtyCanvases.size > 0
}

interface RecentProject {
  name: string;
  path: string;                      // fs path (Tauri/Node) or handle name (Web, informational only)
  lastOpened: string;                // ISO timestamp
}
```

**Invariants:**
- C7.1: After `open()`, `fs` is set and `status === 'loaded'`.
- C7.2: After `save()`, `dirtyCanvases` is empty (all canvases saved). Internally delegates to the existing `saveAll(this.fs)`.
- C7.3: If `fs` is null when `save()` is called, falls through to `saveAs()` behavior.
- C7.4: `saveAs()` replaces `fs` with the new FileSystem from the picker.
- C7.5: `recentProjects` is persisted to `localStorage` and restored on app load.
- C7.6: `recentProjects` maintains max 5 entries, most-recent first, deduped by path.
- C7.7: `isDirty()` returns `dirtyCanvases.size > 0`.
- C7.8: `open()` and `saveAs()` are UI-only methods. CLI code never calls them — it uses `openProject(fs)` and `saveAll(fs)` directly with the `FileSystem` from `CLIContext`.
- C7.9: On web, `FileSystemDirectoryHandle` cannot be persisted across page loads. Recent project entries for web are informational only (show project name). Re-opening requires the user to select the directory via the picker again.

### Contract 8: Persistence UI — Dirty Indicator

**Invariants:**
- C8.1: When `isDirty() === true`, status bar shows a "Modified" indicator.
- C8.2: When `isDirty() === true`, window title is `"● {projectName} — ArchCanvas"`. When clean: `"{projectName} — ArchCanvas"`. If no project is loaded: `"ArchCanvas"`.
- C8.3: When `isDirty() === false`, no dirty indicator is shown in the status bar.
- C8.4: Dirty state updates reactively — adding/removing a node immediately updates the indicator.

### Contract 9: Persistence UI — Save-on-Close

**Invariants:**
- C9.1: If `isDirty() === true` and user attempts to close, a confirmation dialog appears.
- C9.2: Dialog offers three options: Save & Close, Discard, Cancel.
- C9.3: "Save & Close" calls `save()` then allows close.
- C9.4: "Discard" allows close without saving.
- C9.5: "Cancel" prevents close, returns to app.
- C9.6: If `isDirty() === false`, close proceeds without dialog.
- C9.7: In web, hooks into `beforeunload` event (browser shows native dialog — custom text not supported). In Tauri, hooks into close-requested event with a custom dialog.

### Contract 10: Persistence UI — Keyboard Shortcuts

**Invariants:**
- C10.1: `Cmd+S` (Mac) / `Ctrl+S` (other) triggers `save()`.
- C10.2: `Cmd+O` / `Ctrl+O` triggers `open()`.
- C10.3: `Cmd+Shift+S` / `Ctrl+Shift+S` triggers `saveAs()`.
- C10.4: Shortcuts are app-level (work regardless of which component has focus).
- C10.5: Shortcuts do not fire when the active element is an `<input>`, `<textarea>`, or element with `contentEditable="true"`.

### Contract 11: CLI Process Lifecycle

**Invariants:**
- C11.1: Every mutation command (add-node, add-edge, remove-node, remove-edge, import) calls `fileStore.saveAll(ctx.fs)` before exiting.
- C11.2: Read-only commands (list, describe, search) do not call save.
- C11.3: `init` creates files directly via `FileSystem` (no store mutation — there's no project to load yet).
- C11.4: On unhandled error, prints error to stderr and exits with code 1.
- C11.5: On success, exits with code 0.

---

## 3. CLI Architecture

### Entry Point

`src/cli/index.ts` — commander program. 9 subcommands registered via `program.command()`.

### Command Files

```
src/cli/
  index.ts                  ← commander program, registers all commands
  context.ts                ← loadContext(), resolveCanvasId()
  errors.ts                 ← CLIError class
  output.ts                 ← formatSuccess(), formatError()
  commands/
    init.ts
    add-node.ts
    add-edge.ts
    remove-node.ts
    remove-edge.ts
    list.ts
    describe.ts
    search.ts
    import.ts
```

### Context Flow (mutation commands)

```
1. Parse args (commander)
2. loadContext(--project flag or cwd)
   a. Find .archcanvas/ directory (walk cwd upward)
   b. createFileSystem(path) → NodeFileSystem
   c. fileStore.openProject(fs)
   d. registryStore.initialize()
3. Execute command logic via stores (graphStore/fileStore)
4. fileStore.saveAll(ctx.fs)
5. Format output (human or JSON)
6. Exit 0
```

### Context Flow (read-only commands)

Same as above but skip step 4 (no save).

### Context Flow (init)

```
1. Parse args
2. createFileSystem(targetPath)
3. fs.mkdir('.archcanvas')
4. fs.writeFile('.archcanvas/main.yaml', template)
5. Format output
6. Exit 0
```

### Build

`vite.config.cli.ts`:
- Entry: `src/cli/index.ts`
- Target: `node`
- Output: `dist/cli.js`
- Externals: `node:fs`, `node:path`, `node:child_process` (Node.js builtins)
- Bundles: `commander`, `yaml`, `zod`, `immer`, `zustand` and all `src/` imports

`package.json`:
```json
{
  "bin": { "archcanvas": "./dist/cli.js" }
}
```

### Error Handling

```typescript
// src/cli/errors.ts
class CLIError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
  }
}
```

Error codes: `PROJECT_NOT_FOUND`, `PROJECT_EXISTS`, `PROJECT_LOAD_FAILED`, `UNKNOWN_NODE_TYPE`, `INVALID_ARGS`, plus all engine error codes forwarded as-is (e.g., `DUPLICATE_NODE_ID`, `NODE_NOT_FOUND`, `EDGE_NOT_FOUND`, etc.).

---

## 4. Persistence UI

### fileStore Extensions

Add to existing `src/store/fileStore.ts`:

- `fs: FileSystem | null` — stored after Open or Save As
- `recentProjects: RecentProject[]` — loaded from localStorage on init
- `open()` — acquires FileSystem via picker, calls `openProject(fs)`, stores `fs`, updates recents
- `save()` — calls existing `saveAll(this.fs)`, falls through to saveAs if `fs` is null
- `saveAs()` — acquires new FileSystem via picker, calls `saveAll(newFs)`, replaces `this.fs`
- `isDirty()` — computed: `dirtyCanvases.size > 0`

**Relationship between `save()` and `saveAll(fs)`:** `save()` is a UI convenience that uses the stored `fs`. `saveAll(fs)` is the existing lower-level method that takes an explicit `FileSystem`. CLI code calls `saveAll(ctx.fs)` directly. UI code calls `save()`.

### File Picker Abstraction

```typescript
// src/platform/filePicker.ts
interface FilePicker {
  pickDirectory(): Promise<FileSystem | null>;  // null = user cancelled
}
```

- Web: `showDirectoryPicker()` → wraps result in `WebFileSystem`
- Tauri: Tauri dialog API → wraps result in `TauriFileSystem`
- Returns null on cancel (user dismissed picker)

### Keyboard Shortcuts

New hook: `src/components/hooks/useAppKeyboard.ts`

Registered at `src/App.tsx` level (above canvas). Handles:
- `Cmd+S` → `fileStore.save()`
- `Cmd+O` → `fileStore.open()`
- `Cmd+Shift+S` → `fileStore.saveAs()`

Ignores events when active element is `<input>`, `<textarea>`, or `contentEditable="true"` (C10.5).

### Dirty Indicator

- `src/components/layout/StatusBar.tsx`: reads `fileStore.isDirty()`, shows "Modified" badge when dirty
- `src/App.tsx`: `useEffect` updates `document.title` reactively: `"● {name} — ArchCanvas"` when dirty, `"{name} — ArchCanvas"` when clean

### Save-on-Close

- Web: `window.addEventListener('beforeunload', handler)` — if dirty, set `e.returnValue` to trigger native browser dialog
- Tauri: listen for close-requested event — if dirty, show custom dialog (Save & Close / Discard / Cancel)

### Recent Files

- Stored in `localStorage` under key `archcanvas:recentProjects`
- Max 5, deduped by path, most-recent first
- Shown in File menu as submenu items
- On select: `createFileSystem(path)` → `openProject(fs)` → store `fs`
- Web caveat: handles are not restorable from localStorage — web entries are informational only; re-opening requires a fresh picker (C7.9)

### Menu Wiring

Update `src/components/layout/TopMenubar.tsx`:

| Menu Item | Shortcut | Before | After |
|---|---|---|---|
| New Project | — | `initializeEmptyProject()` | Same (unchanged) |
| Open... | `Cmd+O` | console.log stub | `fileStore.open()` |
| Open Recent | — | (none) | Submenu from `recentProjects` |
| Save | `Cmd+S` | console.log stub | `fileStore.save()` |
| Save As... | `Cmd+Shift+S` | (none) | `fileStore.saveAs()` |

---

## 5. Universal FileSystem Factory

Update `src/platform/index.ts`:

```typescript
function isTauriEnvironment(): boolean {
  return typeof window !== 'undefined'
    && '__TAURI_INTERNALS__' in window;
}

async function createFileSystem(
  root: string | FileSystemDirectoryHandle,
): Promise<FileSystem> {
  // 1. Web: DirectoryHandle → WebFileSystem
  if (root instanceof FileSystemDirectoryHandle) {
    return new WebFileSystem(root);
  }

  // 2. Node.js: no window → NodeFileSystem (dynamic import)
  if (typeof window === 'undefined') {
    const { NodeFileSystem } = await import('./nodeFileSystem');
    return new NodeFileSystem(root);
  }

  // 3. Tauri: window + __TAURI_INTERNALS__ → TauriFileSystem
  if (isTauriEnvironment()) {
    return new TauriFileSystem(root);
  }

  // 4. Unsupported
  throw new Error('Unsupported environment: string root in browser without Tauri');
}
```

`NodeFileSystem` is loaded via dynamic import to prevent `node:fs` from entering the browser bundle. The detection order relies on the fact that Tauri always runs in a webview with `window`, so `typeof window === 'undefined'` reliably identifies Node.js.

---

## 6. Registry: Builtins as TS Objects

### Migration

Convert 32 YAML files in `src/core/registry/builtins/` to TS objects:

```
src/core/registry/builtins/
  compute/service.ts       ← was service.yaml
  compute/function.ts      ← was function.yaml
  ...
  index.ts                 ← barrel: export const builtinNodeDefs: NodeDef[]
```

Each file exports a single `NodeDef` object literal. The barrel collects them into an array.

### registryStore Update

```typescript
// Before
initialize() {
  const yamls = loadBuiltins();       // ?raw imports
  const defs = yamls.map(parseYaml);  // runtime YAML parsing
  this.register(defs);
}

// After
initialize() {
  this.register(builtinNodeDefs);     // static import, already validated TS objects
}
```

### Keeping YAML Files (optional)

The original YAML files can be kept alongside for reference or deleted. They are no longer loaded at runtime. If kept, they serve as human-readable documentation of the builtin set.

---

## 7. Test Contracts

### Unit Tests

#### 7.1 FileSystem Factory (`test/platform/createFileSystem.test.ts`)

Tests against **Contract 1**:

| Test | Asserts |
|---|---|
| returns WebFileSystem for DirectoryHandle input | C1.1 |
| returns NodeFileSystem for string input in Node env | C1.2 |
| returns TauriFileSystem for string input with Tauri | C1.3 |
| throws for string input in browser without Tauri | C1.4 |
| returned instance implements all FileSystem methods | C1.5 |
| NodeFileSystem is not statically imported | C1.6 — verify via bundle analysis or mock |

**Mocking strategy:** Mock `window` global presence/absence. Mock `window.__TAURI_INTERNALS__` for Tauri detection. Use `vi.importActual` for dynamic import verification.

#### 7.2 NodeFileSystem (`test/platform/nodeFileSystem.test.ts`)

Tests against **Contract 2** using a real temp directory (`fs.mkdtemp`):

| Test | Asserts |
|---|---|
| readFile returns UTF-8 content | C2.2 |
| readFile throws on missing file | C2.2 |
| writeFile creates file with content | C2.3 |
| writeFile creates parent directories | C2.3 |
| listFiles returns filenames only | C2.4 |
| exists returns true for existing path | C2.5 |
| exists returns false for missing path | C2.5 |
| mkdir creates nested directories | C2.6 |
| mkdir is no-op for existing directory | C2.6 |
| all paths resolve relative to root | C2.1 |

**Mocking strategy:** No mocks. Use real temp directories for true filesystem verification. Cleanup in `afterEach`.

#### 7.3 Builtin Registry (`test/core/registry/builtins.test.ts`)

Tests against **Contract 3**:

| Test | Asserts |
|---|---|
| builtinNodeDefs has expected length (32) | C3.2 |
| every entry passes nodeDefSchema.parse() | C3.3 |
| all 9 namespaces are represented | C3.4 |
| no duplicate namespace/name combinations | Implicit |
| registryStore.initialize() loads all builtins | C3.6 |

**Mocking strategy:** None needed — builtins are static TS objects.

#### 7.4 CLI Context (`test/cli/context.test.ts`)

Tests against **Contract 4**:

| Test | Asserts |
|---|---|
| loads project from explicit path | C4.1, C4.3, C4.5 |
| searches cwd upward for .archcanvas/ | C4.1 |
| creates FileSystem via factory | C4.2 |
| initializes registry | C4.4 |
| throws PROJECT_NOT_FOUND for missing project | C4.6 |
| throws PROJECT_LOAD_FAILED for corrupt YAML | C4.7 |
| resolveCanvasId(undefined) returns ROOT_CANVAS_KEY | C4.8 |
| resolveCanvasId('root') returns ROOT_CANVAS_KEY | C4.8 |
| resolveCanvasId('svc-foo') returns 'svc-foo' | C4.8 |

**Mocking strategy:** Use `InMemoryFileSystem` or temp directories. Mock `createFileSystem` to return InMemory. Reset stores between tests.

#### 7.5 CLI Commands (`test/cli/commands/*.test.ts`)

One test file per command. Tests against **Contract 5a–5i**.

Common setup:
1. Create temp `.archcanvas/` with `main.yaml`
2. Load context
3. Call command handler function directly (not via commander parse)
4. Assert output and store state

Representative tests (per command):

**init:**

| Test | Asserts |
|---|---|
| creates .archcanvas/ and main.yaml | C5a.1, C5a.2 |
| main.yaml matches template structure | C5a.2 |
| exits with PROJECT_EXISTS if already initialized | C5a.3 |
| human output contains project name | C5a.4 |
| json output is valid with ok: true | C5a.5 |

**add-node:**

| Test | Asserts |
|---|---|
| adds InlineNode to specified scope | C5b.1 |
| saves after successful add | C5b.2, C11.1 |
| returns engine error on duplicate ID | C5b.3 |
| errors on unknown node type | C5b.4 |
| defaults displayName from NodeDef metadata | C5b.5 |
| json output shape matches contract | C5b.6 |

**add-edge:**

| Test | Asserts |
|---|---|
| adds edge with EdgeEndpoint objects | C5c.1 |
| saves after successful add | C5c.2, C11.1 |
| returns error for missing endpoint | C5c.3 |
| json output shape matches contract | C5c.4 |

**remove-node:**

| Test | Asserts |
|---|---|
| removes node by ID | C5d.1 |
| saves after successful remove | C5d.2, C11.1 |
| returns error for missing node | C5d.3 |
| connected edges are also removed | C5d.4 |

**remove-edge:**

| Test | Asserts |
|---|---|
| removes edge by from/to | C5e.1 |
| saves after successful remove | C5e.2, C11.1 |
| returns error for missing edge | C5e.3 |
| json output shape matches contract | C5e.4 |

**list:**

| Test | Asserts |
|---|---|
| lists all items in scope | C5f.1 |
| filters by type flag | C5f.2 |
| human output is formatted table | C5f.3 |
| json output contains requested types only | C5f.4 |
| errors on unknown scope | C5f.5 |

**describe:**

| Test | Asserts |
|---|---|
| describes single node with full details (ports from registry) | C5g.1 |
| describes full architecture when no ID given | C5g.2 |
| includes child summary for ref nodes | C5g.3 |
| json output: full node or architecture object | C5g.4 |

**search:**

| Test | Asserts |
|---|---|
| finds nodes across all loaded scopes | C5h.1 |
| matches on ID, displayName, type, entity name, edge label | C5h.2 |
| case-insensitive substring matching | C5h.3 |
| results include scope (canvasId) | C5h.4 |
| json output shape matches contract | C5h.5 |

**import:**

| Test | Asserts |
|---|---|
| imports nodes, edges, entities from YAML | C5i.1, C5i.2 |
| collects errors per item, doesn't stop | C5i.3 |
| saves once at end | C5i.4, C11.1 |
| human output has added/failed summary | C5i.5 |
| json output has added/errors counts | C5i.6 |

#### 7.6 CLI Output Formatting (`test/cli/output.test.ts`)

Tests against **Contract 6**:

| Test | Asserts |
|---|---|
| json mode produces valid JSON | C6.1 |
| human mode produces readable text | C6.2 |
| json error shape: { ok: false, error: { code, message } } | C6.4 |
| json success shape: { ok: true, ...data } | C6.5 |

#### 7.7 Persistence Store Extensions (`test/store/fileStore.test.ts`)

Tests against **Contract 7** (extend existing test file):

| Test | Asserts |
|---|---|
| open() sets fs and loads project | C7.1 |
| save() clears dirty set | C7.2 |
| save() falls through to saveAs when fs is null | C7.3 |
| saveAs() replaces fs with new FileSystem | C7.4 |
| recentProjects persists to localStorage | C7.5 |
| recentProjects max 5, deduped, most-recent first | C7.6 |
| isDirty() reflects dirtyCanvases size | C7.7 |
| web recent entries are informational only | C7.9 |

**Mocking strategy:** Mock `filePicker.pickDirectory()` to return `InMemoryFileSystem`. Mock `localStorage`.

### E2E Tests

#### 7.8 File Operations (`test/e2e/file-operations.spec.ts`)

Tests against **Contracts 8, 9, 10**:

| Test | Asserts |
|---|---|
| adding a node shows dirty indicator in status bar | C8.1, C8.4 |
| window title shows dirty marker when modified | C8.2 |
| Cmd+S triggers save (dirty indicator clears) | C10.1, C8.3 |
| File → Save menu item works | C7.2 |
| File → Open Recent submenu shows entries | C7.5 |
| clean state shows no dirty indicator | C8.3 |

**Note:** Save-on-close (C9) is hard to test in E2E due to `beforeunload` limitations. Test the dialog appearance via direct store manipulation in unit tests, and verify the `beforeunload` handler registration in E2E.

#### 7.9 CLI Integration (`test/cli/cli-integration.test.ts`)

End-to-end tests that run the built CLI binary and verify output:

| Test | Asserts |
|---|---|
| `archcanvas init` creates project structure | C5a.1, C5a.2 |
| `archcanvas add-node --json` outputs valid JSON | C5b.6, C6.1 |
| `archcanvas list` after add-node shows the node | C5f.1 |
| `archcanvas add-edge` connects nodes | C5c.1 |
| `archcanvas remove-edge` removes edge | C5e.1 |
| `archcanvas remove-node` removes node and connected edges | C5d.1, C5d.4 |
| `archcanvas describe` shows full architecture | C5g.2 |
| `archcanvas search` finds across scopes | C5h.1 |
| `archcanvas import` bulk-creates items | C5i.2 |
| round-trip: CLI creates → UI opens → renders correctly | Cross-system |

**Execution:** These tests run the built `dist/cli.js` via `execFile` (not `exec`, to avoid shell injection) in a temp directory. The round-trip test opens the CLI-created project in the browser via Playwright.

---

## Dependencies

**New npm packages:**
- `commander` — CLI argument parsing

**Existing packages bundled into CLI output** (no new installs needed):
- `yaml` — YAML parsing for `import` command
- `zod` — schema validation
- `immer` — engine mutations
- `zustand` — headless store usage

---

## Files Created/Modified Summary

| Category | Files | Notes |
|---|---|---|
| **CLI** | ~13 new | `src/cli/`: index.ts, context.ts, errors.ts, output.ts, `commands/` with 9 command files |
| **Platform** | 2 new, 1 modified | `src/platform/`: nodeFileSystem.ts, filePicker.ts, index.ts (factory update) |
| **Registry** | ~33 modified, ~32 deleted | 32 YAML → TS conversion, loader update, barrel `index.ts` |
| **Store** | 1 modified | `src/store/fileStore.ts` (extensions: fs, recentProjects, open, save, saveAs, isDirty) |
| **UI** | 3 modified, 1 new | `src/components/layout/TopMenubar.tsx`, `src/components/layout/StatusBar.tsx`, `src/App.tsx`, new `src/components/hooks/useAppKeyboard.ts` |
| **Build** | 1 new, 1 modified | `vite.config.cli.ts`, `package.json` (bin field + commander dep) |
| **Tests** | ~14 new | unit: 7.1–7.7, E2E: 7.8–7.9 per test contracts above |
