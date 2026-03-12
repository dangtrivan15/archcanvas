# I4: Graph Engine — Design Spec

> **Date**: 2026-03-12 | **Status**: Draft
> **Scope**: Scope-local CRUD engine, NodeDef-aware validation, single-canvas + cross-scope queries, entity CRUD
> **Depends on**: I10 (Core Data Model & YAML) — complete, I3 (NodeDef Registry) — complete
> **Blocks**: Presentation layer (canvas rendering), CLI commands, graphStore (State Layer)

## Context

I4 builds the graph engine — the Core Layer that handles CRUD operations on nodes, edges, and entities within canvas scopes. When a user adds a node, connects two nodes with an edge, or defines an entity, the graph engine validates the operation, transforms the canvas data, and returns the result.

The engine sits between the State Layer (Zustand stores, future initiative) and the existing data model from I10 + NodeDef registry from I3. It is the central business logic layer for graph manipulation.

The data model and NodeDef system are specified in [docs/archcanvas-v2-design.md](../archcanvas-v2-design.md#6-application-architecture). The Core Layer module layout is defined in [docs/archcanvas-v2-design.md](../archcanvas-v2-design.md#core-layer). This spec focuses on implementation design for the graph engine modules.

## Scope Boundary

**In scope:**
- Scope-local CRUD for nodes (inline + ref), edges, and entities via Immer
- Structured error/warning result types for all mutations
- NodeDef-aware semantic validation (type existence, args, ports)
- Single-canvas query functions (find, list)
- Cross-scope query functions (find across canvases, entity reference lookup, full-text search)
- Cross-scope subsystem ref counting (for orphan detection on ref node removal)

**Out of scope:**
- `graphStore` Zustand store (State Layer — added when presentation layer consumes engine)
- Protocol compatibility matrix (deferred per [docs/archcanvas-v2-design.md](../archcanvas-v2-design.md#protocol-compatibility-matrix))
- Children constraint validation (nesting = separate canvas files, managed by store/UI)
- `core/entity/resolver.ts` as a separate module — cross-scope entity queries are folded into `query.ts`
- Undo/redo history (future initiative, but engine uses Immer for forward-compatibility with `produceWithPatches`)
- Canvas rendering, React components, CLI commands

## Architecture

Four modules in the Core Layer, plus a barrel export. Built bottom-up.

```
src/core/graph/types.ts            ← Result types, error/warning codes
        │
src/core/graph/validation.ts       ← NodeDef-aware semantic checks
        │
src/core/graph/engine.ts           ← Scope-local CRUD via Immer
        │
src/core/graph/query.ts            ← Single-canvas + cross-scope queries
        │
src/core/graph/index.ts            ← Barrel export
```

This sits in `core/graph/` per the module architecture in [docs/archcanvas-v2-design.md](../archcanvas-v2-design.md#core-layer). The Core Layer has zero dependency on React, DOM, Zustand, or Tauri — pure TypeScript with Immer as the only runtime dependency.

### Why Four Modules

The design doc lists three files: `engine.ts`, `query.ts`, `validation.ts`. This spec adds `types.ts` for shared result types. The separation:

- **`engine.ts`** — structural CRUD. Enforces graph integrity (unique IDs, valid edge endpoints). Returns structured errors on violations.
- **`validation.ts`** — semantic validation against the NodeDef registry. Checks type existence, arg conformance, port validity. Returns warnings, not errors — the engine calls into it but unknown types don't block operations.
- **`query.ts`** — read-only lookups. No Immer, no mutations. Single-canvas and cross-scope.
- **`types.ts`** — shared `EngineResult`, `EngineError`, `EngineWarning` types used by all three modules.

This separates structural integrity (engine) from semantic correctness (validation) from read operations (query). The engine can be tested without a registry; validation can be called independently for bulk re-validation.

The design doc lists `core/entity/resolver.ts` as a separate module for "resolve entity references, cross-scope lookup." This spec folds that functionality into `query.ts` because the cross-scope entity queries (`findEdgesReferencingEntity`) fit naturally alongside the other cross-scope lookups, and a separate file would add indirection without benefit.

## Layer 1: Result Types

**Location:** `src/core/graph/types.ts`

### Error Codes (Hard — Block the Operation)

| Code | Fields | When |
|------|--------|------|
| `DUPLICATE_NODE_ID` | `nodeId: string` | Adding a node with an ID that already exists in the scope |
| `NODE_NOT_FOUND` | `nodeId: string` | Removing/updating a node that doesn't exist |
| `EDGE_ENDPOINT_NOT_FOUND` | `endpoint: string`, `side: 'from' \| 'to'` | Adding an edge where a referenced node doesn't exist in scope |
| `DUPLICATE_EDGE` | `from: string`, `to: string` | Adding an edge when an edge with the same `from.node` + `to.node` pair already exists in the scope |
| `SELF_LOOP` | `nodeId: string` | Adding an edge from a node to itself |
| `EDGE_NOT_FOUND` | `from: string`, `to: string` | Removing/updating an edge that doesn't exist |
| `ENTITY_NOT_FOUND` | `name: string` | Removing/updating an entity that doesn't exist |
| `DUPLICATE_ENTITY` | `name: string` | Adding an entity with a name that already exists |
| `ENTITY_IN_USE` | `name: string`, `referencedBy: Array<{ from: string; to: string }>` | Removing an entity that is still referenced by edges |
| `INVALID_REF_NODE_UPDATE` | — | Attempting to update fields other than `position` on a ref node |

### Warning Codes (Soft — Operation Succeeds)

| Code | Fields | When |
|------|--------|------|
| `UNKNOWN_NODE_TYPE` | `type: string` | Node's type doesn't resolve in the registry |
| `INVALID_ARG` | `nodeId: string`, `arg: string`, `reason: string` | Arg doesn't match NodeDef spec (missing required, invalid enum value, wrong type) |
| `UNKNOWN_PORT` | `nodeId: string`, `port: string` | Port referenced in edge doesn't exist on the node's NodeDef |
| `INVALID_PORT_DIRECTION` | `nodeId: string`, `port: string`, `expected: 'inbound' \| 'outbound'` | Port used in wrong direction (from-port should be outbound, to-port should be inbound) |
| `ENTITY_UNREFERENCED` | `name: string` | Entity exists but no edges reference it (from `validateCanvas`) |

### Result Type

```typescript
type EngineResult =
  | { ok: true; data: CanvasFile; warnings: EngineWarning[] }
  | { ok: false; error: EngineError }
```

### Key Decisions

- **`ok` discriminant** — TypeScript narrows cleanly: `if (result.ok) { result.data }`. Avoids the ambiguity of `{ data?, error? }` where both could theoretically be present.
- **Structured over strings** — Error/warning objects with `code` discriminants enable the UI to present targeted messages (e.g., highlight the duplicate ID field) and enable programmatic handling (e.g., auto-fix suggestions). Consistent with I3's pattern of "warnings as data."
- **`ENTITY_IN_USE` includes `referencedBy`** — The error tells the caller exactly which edges reference the entity, so the UI can show "Entity 'Order' is used by 3 edges" with specifics.
- **Edges identified by `from/to`** — No `edgeId` in the v2 schema. Edges are identified by their endpoint pair within a scope.
- **`@root/` endpoints exempt from scope check** — Edge endpoints starting with `@root/` reference nodes in the parent scope. The engine allows these without checking the current canvas (cross-scope validation is a query concern).

## Layer 2: Validation

**Location:** `src/core/graph/validation.ts`

### Functions

```typescript
function validateNode(node: Node, registry: NodeDefRegistry): EngineWarning[]
function validateEdge(edge: Edge, canvas: CanvasFile, registry: NodeDefRegistry): EngineWarning[]
function validateCanvas(canvas: CanvasFile, registry: NodeDefRegistry): EngineWarning[]
```

### `validateNode`

Accepts the `Node` union type (`InlineNode | RefNode`). If the node is a `RefNode` (has `ref` field), returns an empty array — ref nodes have no type or args to validate. For `InlineNode`, checks:

1. **Type resolves** — `registry.resolve(node.type)`. If not found → `UNKNOWN_NODE_TYPE` warning.
2. **Args conformance** (only if type resolves):
   - Each arg key exists in the NodeDef's `spec.args` → if not, `INVALID_ARG` with reason "unknown argument"
   - Required args are present → if missing, `INVALID_ARG` with reason "required argument missing"
   - Enum args have a valid option → if not, `INVALID_ARG` with reason "invalid enum value, expected one of [...]"

### `validateEdge`

Takes an `Edge`, the containing `CanvasFile` (to resolve node types), and the registry. Checks:

1. **Port existence** — For each endpoint with a `port` field, resolve the node's type via the canvas, then check the NodeDef's `spec.ports` for a matching port name. If not found → `UNKNOWN_PORT`.
2. **Port direction** — `from` endpoint's port should be `outbound`; `to` endpoint's port should be `inbound`. If reversed → `INVALID_PORT_DIRECTION`.

Only runs port checks if the referenced node's type resolves in the registry. If the node type is unknown, port validation is skipped (the `UNKNOWN_NODE_TYPE` warning already covers it).

### `validateCanvas`

Bulk validation: runs `validateNode` on every inline node and `validateEdge` on every edge. Also checks for unreferenced entities — entities defined in the canvas but not referenced by any edge's `entities[]` array → `ENTITY_UNREFERENCED` warning.

Returns deduplicated warnings.

### Key Decisions

- **Warnings, not errors** — Validation issues don't block operations. A user might add a node with `type: "custom/thing"` before creating the NodeDef. The engine allows it and flags it.
- **Registry as parameter** — Not imported as a singleton. Keeps validation testable with mock registries.
- **Skips ref nodes** — Ref nodes have no type or args; their subsystem file handles its own validation.
- **`validateCanvas` for bulk use** — Called after project load, after NodeDef changes, or on-demand from the store. Not called on every individual CRUD operation (that's handled by inline validation in the engine).

## Layer 3: Engine

**Location:** `src/core/graph/engine.ts`

All functions take a `CanvasFile`, perform structural validation, optionally run semantic validation via the registry, and return `EngineResult`. Mutations use Immer's `produce()`.

### Node Operations

```typescript
function addNode(
  canvas: CanvasFile,
  node: InlineNode | RefNode,
  registry?: NodeDefRegistry,
): EngineResult

function removeNode(canvas: CanvasFile, nodeId: string): EngineResult

function updateNode(
  canvas: CanvasFile,
  nodeId: string,
  updates: Partial<Pick<InlineNode, 'displayName' | 'description' | 'args' | 'position' | 'codeRefs' | 'notes'>>,
  registry?: NodeDefRegistry,
): EngineResult

function updateNodePosition(
  canvas: CanvasFile,
  nodeId: string,
  position: Position,
): EngineResult
```

#### `addNode`

1. Check `node.id` is unique among `canvas.nodes` → `DUPLICATE_NODE_ID` error if not
2. If node is `InlineNode` and registry is provided, run `validateNode(node, registry)` → collect warnings
3. `produce(canvas, draft => { (draft.nodes ??= []).push(node) })`
4. Return `{ ok: true, data: newCanvas, warnings }`

#### `removeNode`

1. Check node exists in `canvas.nodes` → `NODE_NOT_FOUND` error if not
2. `produce(canvas, draft => { draft.nodes = draft.nodes.filter(n => n.id !== nodeId) })`
3. Also remove all edges where `from.node === nodeId` or `to.node === nodeId`
4. Return `{ ok: true, data: newCanvas, warnings: [] }`

#### `updateNode`

1. Check node exists → `NODE_NOT_FOUND` error if not
2. Check node is not a `RefNode` (has `ref` field) → `INVALID_REF_NODE_UPDATE` error if it is
3. Apply updates via `produce()` — merge provided fields
4. If registry provided and `args` changed, re-validate → collect warnings
5. Return result

The `type` field is intentionally excluded from the `updates` Pick. Node type is part of a node's identity — changing it is semantically a different node with different ports, args, and constraints. Type changes are performed via `removeNode` + `addNode`.

#### `updateNodePosition`

Works on both inline and ref nodes. Replaces the full `Position` object.

`moveNode` is not included as a separate function — it would be a convenience wrapper around `updateNodePosition` that merges only `x` and `y` while preserving `width` and `height`. The caller can achieve this by reading the current position and constructing the updated `Position` object. If this pattern becomes repetitive in the store layer, `moveNode` can be added later as a thin wrapper.

### Edge Operations

```typescript
function addEdge(
  canvas: CanvasFile,
  edge: Edge,
  registry?: NodeDefRegistry,
): EngineResult

function removeEdge(
  canvas: CanvasFile,
  from: string,
  to: string,
): EngineResult

function updateEdge(
  canvas: CanvasFile,
  from: string,
  to: string,
  updates: Partial<Pick<Edge, 'protocol' | 'label' | 'entities' | 'notes'>>,
): EngineResult
```

#### `addEdge`

1. Check `from.node` and `to.node` exist in scope (unless `@root/` prefixed) → `EDGE_ENDPOINT_NOT_FOUND` error
2. Check not a self-loop (`from.node === to.node`) → `SELF_LOOP` error
3. Check no existing edge with same `from.node` → `to.node` pair → `DUPLICATE_EDGE` error
4. If registry provided, run `validateEdge(edge, canvas, registry)` → collect warnings
5. `produce(canvas, draft => { (draft.edges ??= []).push(edge) })`
6. Return result

#### `removeEdge`

1. Find edge by matching `from.node` and `to.node` → `EDGE_NOT_FOUND` error if not found
2. `produce(canvas, draft => { draft.edges = draft.edges.filter(...) })`
3. Return result

#### `updateEdge`

1. Find edge by `from`/`to` → `EDGE_NOT_FOUND` error if not found
2. Apply updates via `produce()`
3. Return result

### Entity Operations

```typescript
function addEntity(canvas: CanvasFile, entity: Entity): EngineResult
function removeEntity(canvas: CanvasFile, entityName: string): EngineResult
function updateEntity(
  canvas: CanvasFile,
  entityName: string,
  updates: Partial<Pick<Entity, 'description' | 'codeRefs'>>,
): EngineResult
```

#### `addEntity`

1. Check `entity.name` is unique among `canvas.entities` → `DUPLICATE_ENTITY` error
2. `produce(canvas, draft => { (draft.entities ??= []).push(entity) })`
3. Return result

#### `removeEntity`

1. Check entity exists → `ENTITY_NOT_FOUND` error
2. Check no edges reference this entity name in their `entities[]` → `ENTITY_IN_USE` error with `referencedBy` listing the offending edges
3. `produce(canvas, draft => { draft.entities = draft.entities.filter(e => e.name !== entityName) })`
4. Return result

#### `updateEntity`

1. Check entity exists → `ENTITY_NOT_FOUND` error
2. Apply updates via `produce()`
3. Return result

### Key Decisions

- **Immer for mutations** — `produce()` provides structural sharing (unchanged subtrees keep the same reference) and forward-compatibility with `produceWithPatches` for future undo/redo. The engine's external API is the same as pure immutable — `(canvas, params) → newCanvas` — but internals get cleaner mutation code.
- **Registry is optional** — Every CRUD function that accepts a registry makes it optional (`registry?: NodeDefRegistry`). When omitted, no semantic validation runs and warnings are empty. This means the engine works without a registry (useful for tests, CLI bulk operations, or scenarios where the registry isn't loaded yet).
- **`removeNode` cascades edges** — Removing a node also removes all edges referencing it within the same scope. This prevents orphaned edges. The cascade is scope-local; cross-scope edges referencing the removed node are the store's responsibility (via `findEdgesReferencingNode` from query module).
- **`@root/` endpoints are allowed** — The engine doesn't validate `@root/` prefixed endpoints against the current canvas. It accepts them as valid cross-scope references. Validation of `@root/` targets is a query/store concern using `findNodeAcrossScopes`.
- **Edge identity is `from.node` + `to.node`** — Not `from.node + from.port + to.node + to.port`. Two nodes can have at most one edge between them in a scope. This is a simplification — if multi-edges are needed later, the identity can be expanded.

## Layer 4: Query

**Location:** `src/core/graph/query.ts`

Pure read-only functions. No Immer, no mutations. Split into single-canvas and cross-scope groups.

### Single-Canvas Queries

```typescript
function findNode(canvas: CanvasFile, nodeId: string): Node | undefined
function findEdge(canvas: CanvasFile, fromNode: string, toNode: string): Edge | undefined
function listNodes(canvas: CanvasFile): Node[]
function listEdges(canvas: CanvasFile): Edge[]
function listEntities(canvas: CanvasFile): Entity[]
```

Thin wrappers over array lookups. `findEdge` matches by `from.node` and `to.node`. List functions return `canvas.nodes ?? []` etc.

### Cross-Scope Queries

All take `Map<string, LoadedCanvas>` — the `canvases` map from `ResolvedProject` (defined in [src/storage/fileResolver.ts](../../src/storage/fileResolver.ts)). The `canvasId` in all return types corresponds to the Map key: `ROOT_CANVAS_KEY` (`'__root__'`) for the root canvas, or the `ref` string (e.g., `'svc-order-service'`) for subsystem canvases. This matches the keying convention established by `fileResolver.ts`.

```typescript
function findNodeAcrossScopes(
  canvases: Map<string, LoadedCanvas>,
  nodeId: string,
): { canvasId: string; node: Node } | undefined

function findEdgesReferencingNode(
  canvases: Map<string, LoadedCanvas>,
  nodeId: string,
): Array<{ canvasId: string; edge: Edge }>

function findEdgesReferencingEntity(
  canvases: Map<string, LoadedCanvas>,
  entityName: string,
): Array<{ canvasId: string; edge: Edge }>

function findRefsToSubsystem(
  canvases: Map<string, LoadedCanvas>,
  ref: string,
): Array<{ canvasId: string; nodeId: string }>

function searchGraph(
  canvases: Map<string, LoadedCanvas>,
  query: string,
): SearchResult[]
```

#### `findNodeAcrossScopes`

Iterates all canvases, returns the first canvas containing a node with the given ID. Returns the canvas ID and the node.

#### `findEdgesReferencingNode`

Finds all edges across all canvases where `from.node` or `to.node` matches the given node ID. Also matches `@root/` prefixed references by stripping the prefix and comparing: an endpoint `@root/db-postgres` matches `nodeId = 'db-postgres'`. Used by the store to check cross-scope impact before removing a node.

#### `findEdgesReferencingEntity`

Finds all edges across all canvases where the `entities[]` array includes the given entity name. Used for the command palette's entity search and for impact analysis.

#### `findRefsToSubsystem`

Finds all `RefNode` entries across all canvases that point to the given subsystem ref. Used by the store to determine if a subsystem file would be orphaned after removing a ref node.

#### `searchGraph`

Full-text search across all canvases. Searches node `displayName`, `type`, `description`, `args` values; edge `label`, `protocol`; entity `name`, `description`. Returns scored results.

### Search Result Type

```typescript
type SearchResult =
  | { type: 'node'; canvasId: string; nodeId: string; displayName: string; matchContext: string; score: number }
  | { type: 'edge'; canvasId: string; from: string; to: string; displayName: string; matchContext: string; score: number }
  | { type: 'entity'; canvasId: string; name: string; displayName: string; matchContext: string; score: number }
```

Discriminated union so each result type carries the identifier needed for navigation: `nodeId` to select a node on canvas, `from`/`to` to identify an edge, `name` to look up an entity.

Scoring (same heuristic as v1, adapted for v2):
- Node `displayName` match: 20 points
- Node `type` match: 10 points
- Edge `label` match: 10 points
- Entity `name` match: 15 points
- Arg/description/protocol match: 5 points

Results sorted by score descending.

### Key Decisions

- **No level-based navigation** — V1's `getNodesAtLevel(path)` is replaced by the multi-file model. Navigating "into" a node means loading a different canvas, which is a store concern.
- **No `getNeighbors`** — Useful for AI context building but no consumer exists yet. Can be added later without changing existing APIs.
- **No `flattenNodes`** — V2 canvases have flat node lists (no recursive children within a canvas). Not needed.
- **`Map<string, LoadedCanvas>` as parameter** — Cross-scope queries take the canvases map directly, not the full `ResolvedProject`. This keeps query functions decoupled from the project metadata and testable with simple Maps.

## Integration with Existing Layers

### Downward Dependencies

| Module | Imports from |
|--------|-------------|
| `types.ts` | `src/types/schema.ts` (`CanvasFile`, `InlineNode`, `RefNode`, `Edge`, `Entity`, `Position`) |
| `validation.ts` | `types.ts`, `src/core/registry/core.ts` (`NodeDefRegistry` interface) |
| `engine.ts` | `types.ts`, `validation.ts`, `immer` |
| `query.ts` | `types.ts`, `src/storage/fileResolver.ts` (`LoadedCanvas` type import only) |

### Upward Consumers (Future — NOT part of I4)

The `graphStore` (Zustand) will be the primary consumer. The engine's API is designed so store integration is straightforward:

```typescript
// Future graphStore pattern — illustrative, not part of I4
addNode: (canvasId, node, registry) => {
  const canvas = get().canvases.get(canvasId);
  const result = engine.addNode(canvas.data, node, registry);
  if (!result.ok) return result;
  const next = new Map(get().canvases);
  next.set(canvasId, { ...canvas, data: result.data });
  set({ canvases: next });
  fileStore.getState().markDirty(canvasId);
  return result;
}
```

The engine does not interact with fileStore or any Zustand store. Stores call down into the engine; the engine returns pure data.

### Relationship to fileStore

The engine transforms `CanvasFile` objects in memory. File persistence flows separately:

```
engine.addNode(canvas, node) → returns new CanvasFile
  ↑ called by graphStore (State Layer)
graphStore updates its state → calls fileStore.markDirty(canvasId)
fileStore.saveCanvas() → delegates to yamlCodec + fileResolver (Storage Layer)
```

### Relationship to NodeDef Registry

The `NodeDefRegistry` is passed as an optional parameter — not imported as a singleton, not accessed via a store. This keeps the engine testable:

```typescript
const mockRegistry: NodeDefRegistry = {
  resolve: (type) => type === 'compute/service' ? serviceNodeDef : undefined,
  list: () => [serviceNodeDef],
  search: () => [],
  listByNamespace: () => [],
};
const result = engine.addNode(canvas, node, mockRegistry);
```

## Build Order

Bottom-up, each layer testable before the next:

```
1. types.ts        ← no deps, pure type definitions
       ↓
2. validation.ts   ← depends on types.ts + NodeDefRegistry interface from I3
       ↓
3. engine.ts       ← depends on types.ts + validation.ts + Immer
   query.ts        ← depends on types.ts + LoadedCanvas type (independent of engine)
       ↓
4. index.ts        ← barrel export
```

Steps 3's engine and query are independent — they can be built in parallel.

**External dependency:** `immer` npm package must be installed before engine implementation.

## Testing Strategy

| Module | Test file | Coverage |
|--------|-----------|----------|
| `engine.ts` | `test/core/graph/engine.test.ts` | Node CRUD: add (inline + ref), remove (with edge cascade), update (fields + rejection for ref nodes + type immutability), updateNodePosition. Edge CRUD: add (with endpoint checks, self-loop, duplicate), remove, update. Entity CRUD: add, remove (with in-use check), update. All error codes exercised. Warning passthrough from validation. |
| `validation.ts` | `test/core/graph/validation.test.ts` | `validateNode`: unknown type, valid/invalid args (required, enum, type mismatch), returns empty array for ref nodes. `validateEdge`: unknown ports, port direction mismatch, skips when type unknown. `validateCanvas`: bulk validation, unreferenced entities, deduplication. |
| `query.ts` | `test/core/graph/query.test.ts` | Single-canvas: findNode, findEdge, list functions, empty canvas edge cases. Cross-scope: findNodeAcrossScopes (found/not found), findEdgesReferencingNode (including @root/ matching), findEdgesReferencingEntity, findRefsToSubsystem, searchGraph (scoring, ranking, multi-canvas). |

### Test Approach

- All tests use plain `CanvasFile` objects built inline — no YAML parsing, no file system
- Registry is mocked via a simple object implementing `NodeDefRegistry`
- Engine tests verify both the returned `CanvasFile` content and the result shape (`ok: true` with correct warnings, or `ok: false` with correct error code)
- No E2E tests — I4 has no UI surface (same as I3)

### Test Fixtures

A small set of helper functions to reduce boilerplate across test files:

```typescript
function makeCanvas(overrides?: Partial<CanvasFile>): CanvasFile
function makeNode(overrides?: Partial<InlineNode>): InlineNode
function makeRefNode(overrides?: Partial<RefNode>): RefNode
function makeEdge(overrides?: Partial<Edge>): Edge
function makeEntity(overrides?: Partial<Entity>): Entity
function makeMockRegistry(nodeDefs?: Map<string, NodeDef>): NodeDefRegistry
```

## V1 Reuse Assessment

| V1 module | Reuse in I4 | Notes |
|-----------|-------------|-------|
| `bak/src/core/graph/graphEngine.ts` | Patterns only | V1 operates on a single `ArchGraph` with recursive `children[]`. V2 operates on per-scope `CanvasFile` with flat node lists. CRUD signatures differ. Immutability via spread replaced by Immer. |
| `bak/src/core/graph/graphQuery.ts` | Patterns only | V1's level-based navigation (`getNodesAtLevel`) replaced by multi-file scoping. `searchGraph` scoring logic reusable conceptually but data structures differ. |
| `bak/src/store/graphStore.ts` | None | V1 store tightly coupled to v1 types and protobuf. graphStore out of I4 scope. |

## Known Issues & Future Considerations

- **`CanvasFile` naming** — The type name implies a file; it represents canvas data. A rename to `Canvas` is warranted but deferred (IDE-assisted refactor, not an I4 concern).
- **Multi-edge support** — Current design allows at most one edge per `from.node → to.node` pair. If multi-edges are needed (e.g., two different protocols between the same nodes), edge identity would need to expand to include port or a generated ID.
- **`saveAll` partial-failure handling** — Noted in I10 memory, still unaddressed. Should be fixed before I4 consumers rely on save operations.
- **Immer → `produceWithPatches`** — When undo/redo is designed, engine functions can switch from `produce()` to `produceWithPatches()` to get JSON patches for free. The external API (`EngineResult`) would gain a `patches` field. This is a non-breaking extension.
