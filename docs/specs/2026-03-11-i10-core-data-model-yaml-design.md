# I10: Core Data Model & YAML — Design Spec

> **Date**: 2026-03-11 | **Status**: Draft
> **Scope**: Zod schemas, YAML codec, platform file system, file resolver, fileStore
> **Depends on**: I1 (Project Bootstrap) — complete
> **Blocks**: I3 (NodeDef System), I4 (Graph Engine)

## Context

I10 is the foundation layer for ArchCanvas v2. It defines how architecture data is represented in memory (Zod schemas), persisted to disk (YAML codec), read from the file system (platform adapters), loaded as a project (file resolver), and exposed reactively to the UI (fileStore).

Everything above this layer — graph mutations (I4), NodeDef registry (I3), canvas rendering, AI integration — depends on I10's types and persistence.

The data model and file format are fully specified in [docs/archcanvas-v2-design.md](../archcanvas-v2-design.md#4-data-model--file-format). This spec focuses on **implementation design**: how the code is structured, what each module delivers, and the decisions that shape implementation.

## Scope Boundary

**In scope:**
- Zod schemas for all data types (nodes, edges, entities, canvas files)
- YAML codec with format-preserving round-trips (Document API)
- Platform `FileSystem` interface + Web and Tauri implementations
- File resolver: load project, follow `ref:` pointers, validate `@root/` references
- Zustand `fileStore`: reactive project state, dirty tracking, load/save

**Out of scope:**
- Graph mutations (`addNode`, `removeNode`, `addEdge`) — I4
- NodeDef registry and validation — I3
- File watching for external changes — deferred
- Auto-save — deferred
- File deletion — deferred (comes with I4 mutations)

## Architecture

Five layers, built bottom-up. Each depends only on the layer below it.

```
src/store/fileStore.ts          ← State Layer (Zustand)
        │
src/storage/fileResolver.ts     ← Storage Layer (project loading)
src/storage/yamlCodec.ts        ← Storage Layer (YAML parse/serialize)
        │
src/platform/                   ← Platform Layer (file I/O abstraction)
        │
src/types/schema.ts             ← Types (Zod schemas, shared by all layers)
```

This maps to the module architecture defined in [docs/archcanvas-v2-design.md](../archcanvas-v2-design.md#module-architecture). Note: `storage/` is a top-level folder alongside `core/`, not inside it — Storage and Core are separate layers per the architecture diagram.

## Layer 1: Zod Schemas

**Location:** `src/types/schema.ts`, `src/types/index.ts`

Single schema file — the types are interconnected (edges reference nodes, canvases contain all three), so splitting creates circular import risk for little benefit.

### Types

| Type | Key fields | Notes |
|------|-----------|-------|
| `PropertyValue` | union: string, number, boolean, string[] | Untyped key-value for node `args` |
| `PropertyMap` | `Record<string, PropertyValue>` | Same pattern as v1 |
| `Note` | author, content, tags? | Simplified from v1 — no id, timestamp, status |
| `Position` | x, y, width?, height? | Inline in YAML, not in a sidecar file |
| `Entity` | name, description?, codeRefs? | `codeRefs` is `string[]` (no role metadata) |
| `EdgeEndpoint` | node, port? | `node` may include `@root/` prefix |
| `Edge` | from, to, protocol?, label?, entities?, notes? | No `id` — identified by from/to within scope |
| `InlineNode` | id, type, displayName?, args?, position?, codeRefs?, notes? | Leaf node, no children |
| `RefNode` | id, ref, position? | Pointer to subsystem canvas file |
| `Node` | union of RefNode and InlineNode | Discriminated by presence of `ref` field |
| `ProjectMetadata` | name, description?, version? | Only in `main.yaml` |
| `CanvasFile` | project?, id?, type?, displayName?, args?, nodes?, entities?, edges?, ... | Unified schema for root and subsystem files |

### Refinements

- `RootCanvasFile`: `CanvasFile` refined to require `project` metadata
- `SubsystemCanvasFile`: `CanvasFile` refined to require `id` and `type`

### Decisions

- **No `id` on edges** — edges are identified by their `from`/`to` pair within a scope
- **`Node` as union** — discriminated by `ref` field presence
- **`codeRefs` is `string[]`** — no `CodeRef` object with roles; path alone is sufficient. This overrides the parent design doc examples which show `{path, role}` objects — the `role` field was evaluated and deemed redundant (file paths are self-descriptive). Parent doc examples should be updated to match.
- **`Note` simplified from v1** — dropped `id`, `timestampMs`, `status`, `suggestionType`. V2 notes are human-authored annotations in YAML, not AI suggestion tracking. AI-generated suggestions live in `chatStore`, not in notes.
- **Optional everything** — YAML is human-authored; minimal required fields

For the complete YAML format with examples, see [docs/archcanvas-v2-design.md](../archcanvas-v2-design.md#4-data-model--file-format).

## Layer 2: YAML Codec

**Location:** `src/storage/yamlCodec.ts`

### Functions

```typescript
// Defined in yamlCodec.ts
interface ParsedCanvas {
  data: CanvasFile        // Zod-validated plain object
  doc: yaml.Document      // for format-preserving writes
}

function parseCanvasFile(yamlContent: string): ParsedCanvas
function serializeCanvasFile(data: CanvasFile, doc?: yaml.Document): string
```

`ParsedCanvas` is defined in `yamlCodec.ts`. The file resolver constructs a `LoadedCanvas` by combining a `ParsedCanvas` with a `filePath`.

`serializeCanvasFile` handles both cases: when `doc` is provided, it replaces the document's contents with `data` and returns `doc.toString()` (format-preserving). When `doc` is omitted (new file), it creates a fresh Document with consistent default formatting. Validation against Zod happens in both paths.

### Decisions

- **`yaml` Document API** — parse via `yaml.parseDocument()` to preserve comments, blank lines, key ordering, and quoting style. Mutations patch the Document; `doc.toString()` serializes with formatting intact. This supports the "git-friendly" principle — saving a file after adding one node shows only the new lines in git diff.
- **Validate on both parse and serialize** — parse catches invalid external YAML; serialize catches bugs in upstream code before writing garbage to disk.
- **Round-trip fidelity** — format is preserved via the Document API. New files (no existing Document) use a consistent default style.
- **Descriptive errors** — parse errors include the source file path and which field failed.

## Layer 3: Platform File System

**Location:** `src/platform/fileSystem.ts`, `src/platform/webFileSystem.ts`, `src/platform/tauriFileSystem.ts`, `src/platform/index.ts`

### Interface

```typescript
interface FileSystem {
  readFile(path: string): Promise<string>
  writeFile(path: string, content: string): Promise<void>
  listFiles(path: string): Promise<string[]>
  exists(path: string): Promise<boolean>
  mkdir(path: string): Promise<void>
}
```

Directory-oriented (not file-picker oriented like v1). Paths are relative to project root. Each implementation receives the root at construction time.

### Implementations

- **Web**: `FileSystemDirectoryHandle` from File System Access API. Navigates the handle tree.
- **Tauri**: `@tauri-apps/plugin-fs`. Resolves paths against the root directory string.
- **Factory**: `createFileSystem()` detects environment and returns the appropriate implementation.

### Decisions

- **Text-only** — `readFile`/`writeFile` work with strings. YAML is text. Binary methods added later if needed.
- **No `watch()`** — file watching deferred. Adds platform-specific complexity (debouncing, event handling) not needed for I10.
- **No `delete()`** — not needed until I4 (graph mutations).
- **`listFiles` included** — not used by I10's resolver (which follows explicit `ref:` pointers), but needed by I3 for scanning project-local NodeDefs in `.archcanvas/nodedefs/`. Including it now validates the interface against a second use case.
- **Both implementations built upfront** — two concrete implementations validate the interface quality. Both are thin wrappers and straightforward to implement.

## Layer 4: File Resolver

**Location:** `src/storage/fileResolver.ts`

### Types

```typescript
interface LoadedCanvas {
  filePath: string               // e.g., ".archcanvas/main.yaml"
  data: CanvasFile               // Zod-validated plain object
  doc: yaml.Document             // for format-preserving writes
}

interface ResolvedProject {
  root: LoadedCanvas
  canvases: Map<string, LoadedCanvas>  // keyed by canvas id; root uses "__root__" key
  errors: ResolutionError[]            // non-fatal warnings
}

interface ResolutionError {
  file: string
  message: string
}
```

### Functions

```typescript
async function loadProject(fs: FileSystem): Promise<ResolvedProject>
async function saveCanvas(fs: FileSystem, canvas: LoadedCanvas): Promise<void>
```

### `loadProject` behavior

1. Read `.archcanvas/main.yaml`, parse as root canvas
2. Scan nodes for `RefNode` entries (nodes with `ref:` field)
3. For each ref, read `.archcanvas/{ref}.yaml`, parse as subsystem canvas
4. Recurse — subsystem canvases can have their own refs
5. Validate `@root/` references — check referenced node IDs exist in root canvas
6. Collect non-fatal errors (missing refs, broken `@root/` references)

### `saveCanvas` behavior

1. Call `serializeCanvasFile(canvas.data, canvas.doc)` — validates against Zod, updates the Document's contents, returns the serialized YAML string
2. Write the string to disk via `FileSystem.writeFile(canvas.filePath, yamlString)`

### Decisions

- **Eager loading** — all canvases loaded upfront by following all `ref:` pointers recursively. This overrides the parent design doc's "on demand" default loading strategy. Rationale: project sizes are small (~60 files max for large projects per [docs/archcanvas-v2-design.md](../archcanvas-v2-design.md#core-rule-one-file-per-canvas)); lazy loading adds complexity (partial state, loading indicators, race conditions) without real benefit at this scale. Can be optimized to lazy later if needed.
- **Non-fatal errors** — missing refs or broken `@root/` references produce warnings, not exceptions. The UI shows them; the project still loads. Per the design doc: "Broken references show a warning."
- **Circular ref detection** — visited-set guard during recursive loading prevents infinite loops.
- **Root canvas keying** — the root canvas (which has no `id`) uses `"__root__"` as its key in the `canvases` Map and `dirtyCanvases` Set. It's also accessible via the `root` field directly. This convention is internal — not exposed in YAML or to users.
- **Flat directory** — all canvas files in `.archcanvas/` directly. `ref: svc-order-service` resolves to `.archcanvas/svc-order-service.yaml`. No subdirectory traversal.
- **`@root/` is validation-only** — the resolver checks that `@root/node-id` points to a real node in the root canvas. Actual cross-scope edge rendering is I4/presentation layer work. This resolves the deferred decision from [docs/archcanvas-v2-design.md](../archcanvas-v2-design.md#deferred-decisions): "Cross-scope reference syntax — `@root/` is proposed. May need `@parent/` or relative paths." Decision: start with `@root/` only. `@parent/` or relative paths can be added if real usage demands it.

## Layer 5: fileStore (Zustand)

**Location:** `src/store/fileStore.ts`

### Store shape

```typescript
interface FileStoreState {
  project: ResolvedProject | null
  dirtyCanvases: Set<string>          // canvas IDs with unsaved changes
  status: 'idle' | 'loading' | 'loaded' | 'error'
  error: string | null

  openProject(fs: FileSystem): Promise<void>
  saveCanvas(fs: FileSystem, canvasId: string): Promise<void>
  saveAll(fs: FileSystem): Promise<void>
  markDirty(canvasId: string): void
  getCanvas(canvasId: string): LoadedCanvas | undefined
  getRootCanvas(): LoadedCanvas | undefined
}
```

### Decisions

- **`FileSystem` passed as argument** — the store doesn't hold a reference. Callers pass it in. Avoids platform initialization dependency; makes testing trivial.
- **Thin store** — no business logic. Delegates to `loadProject` and `saveCanvas` from the resolver.
- **`dirtyCanvases` as Set** — simple, iterable by `saveAll`. `markDirty` is called by graph mutations in I4 — exposed now for downstream use.
- **No auto-save** — deliberate. Can be layered on later as a timer over `dirtyCanvases`.

## Build Order

Strict bottom-up, each layer testable before the next begins:

1. **Zod schemas** — pure types, tested with snapshot + round-trip tests
2. **YAML codec** — depends on schemas, tested with YAML fixture files
3. **Platform adapters** — independent of codec, tested with real file I/O (Web) and against Tauri APIs
4. **File resolver** — depends on codec + platform, tested with in-memory FileSystem + fixture YAML files
5. **fileStore** — depends on resolver, tested with mock FileSystem

## V1 Reuse Assessment

Evaluated [bak/src](../bak/src) during brainstorming:

| V1 module | Reuse in I10 | Notes |
|-----------|-------------|-------|
| `types/graph.ts` | Patterns only | v1 used recursive `children[]`; v2 uses `ref:` pointers. PropertyMap pattern carries over. |
| `core/storage/codec.ts` | None | v1 was protobuf binary. Full rewrite to YAML. |
| `core/storage/fileIO.ts` | None | Proto-to-TS conversion. Not applicable. |
| `core/platform/fileSystemAdapter.ts` | Interface pattern | v1 was file-picker oriented. v2 is directory-oriented. Same factory pattern. |
| `api/validation.ts` | Zod patterns | v1's refinement patterns (mutual exclusivity, at-least-one-field) are useful reference. |
