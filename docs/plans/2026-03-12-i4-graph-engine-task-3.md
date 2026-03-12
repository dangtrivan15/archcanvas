# Task 3: Query Module

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:writing-plans to plan
> the implementation steps for this task.

**Scope:** Single-canvas lookups + cross-scope query functions + full-text search
**Parent feature:** [./2026-03-12-i4-graph-engine-index.md](./2026-03-12-i4-graph-engine-index.md)

## Write Set

- Create: `src/core/graph/query.ts` (~160 lines)
- Create: `test/core/graph/query.test.ts` (test, unlimited)

## Read Set (context needed)

- `src/core/graph/types.ts` — `SearchResult` discriminated union (from Task 1)
- `src/types/schema.ts` — `CanvasFile`, `Node`, `InlineNode`, `RefNode`, `Edge`, `Entity`
- `src/storage/fileResolver.ts` — `LoadedCanvas` type, `ROOT_CANVAS_KEY` constant
- `test/core/graph/helpers.ts` — shared test fixtures (from Task 1)
- `docs/specs/2026-03-12-i4-graph-engine-design.md` — Layer 4 (Query) section

## Dependencies

- **Blocked by:** Task 1 (needs `SearchResult` type from `types.ts`, test helpers)
- **Blocks:** None

## Description

This task implements the read-only query module — pure functions for looking up nodes, edges, and entities within a single canvas and across the full project.

No Immer dependency. No mutations. All functions are pure lookups returning existing data or computed results.

### Single-Canvas Queries

Five thin functions operating on a single `CanvasFile`:

- **`findNode(canvas, nodeId)`** → `Node | undefined` — Linear scan of `canvas.nodes`, match by `id`.
- **`findEdge(canvas, fromNode, toNode)`** → `Edge | undefined` — Match by `from.node` and `to.node`.
- **`listNodes(canvas)`** → `Node[]` — Returns `canvas.nodes ?? []`.
- **`listEdges(canvas)`** → `Edge[]` — Returns `canvas.edges ?? []`.
- **`listEntities(canvas)`** → `Entity[]` — Returns `canvas.entities ?? []`.

### Cross-Scope Queries

Five functions taking `Map<string, LoadedCanvas>` — the canvases map from `ResolvedProject`. The `canvasId` in all return types corresponds to the Map key: `ROOT_CANVAS_KEY` (`'__root__'`) for the root canvas, or the `ref` string (e.g., `'svc-order-service'`) for subsystem canvases.

- **`findNodeAcrossScopes(canvases, nodeId)`** → `{ canvasId, node } | undefined` — Iterates all canvases, returns first match by node ID.

- **`findEdgesReferencingNode(canvases, nodeId)`** → `Array<{ canvasId, edge }>` — Finds all edges where `from.node` or `to.node` matches. Also matches `@root/` prefixed references by stripping the prefix: endpoint `@root/db-postgres` matches `nodeId = 'db-postgres'`.

- **`findEdgesReferencingEntity(canvases, entityName)`** → `Array<{ canvasId, edge }>` — Finds all edges where the `entities[]` array includes the entity name.

- **`findRefsToSubsystem(canvases, ref)`** → `Array<{ canvasId, nodeId }>` — Finds all `RefNode` entries pointing to the given subsystem ref. Used for orphan detection when removing a ref node.

- **`searchGraph(canvases, query)`** → `SearchResult[]` — Full-text search across all canvases. Case-insensitive substring matching against node displayName/type/description/args, edge label/protocol, entity name/description. Scored results sorted descending.

### Search Scoring

| Match target | Points |
|-------------|--------|
| Node `displayName` | 20 |
| Entity `name` | 15 |
| Node `type` | 10 |
| Edge `label` | 10 |
| Node/Entity `description` | 5 |
| Node `args` values | 5 |
| Edge `protocol` | 5 |

`SearchResult` is a discriminated union (defined in `types.ts`):
- `{ type: 'node', canvasId, nodeId, displayName, matchContext, score }`
- `{ type: 'edge', canvasId, from, to, displayName, matchContext, score }`
- `{ type: 'entity', canvasId, name, displayName, matchContext, score }`

### Query Tests

**Single-canvas tests:**
- `findNode`: found, not found, empty canvas
- `findEdge`: found, not found
- `listNodes`/`listEdges`/`listEntities`: returns items, returns empty array for undefined/empty

**Cross-scope tests:**
- `findNodeAcrossScopes`: found in first canvas, found in second canvas, not found in any
- `findEdgesReferencingNode`: direct match, `@root/` prefix match, no matches
- `findEdgesReferencingEntity`: entity referenced by edges in multiple canvases, no matches
- `findRefsToSubsystem`: multiple refs across canvases, single ref, no refs
- `searchGraph`: node name match scores highest, multi-canvas results, empty query returns empty, multiple match types ranked by score

**Test setup for cross-scope:**
Build a `Map<string, LoadedCanvas>` with 2-3 canvases. Use `ROOT_CANVAS_KEY` for the root canvas key. LoadedCanvas wraps `CanvasFile` with `filePath` and `doc` — for tests, `doc` can be a minimal YAML Document object (import from `yaml` package) or mocked.

### Acceptance Criteria

- All 5 single-canvas functions return correct results
- All 5 cross-scope functions return correct results with correct `canvasId` values
- `findEdgesReferencingNode` matches both direct and `@root/` prefixed references
- `searchGraph` returns results sorted by score descending
- `SearchResult` items carry correct type-specific identifiers
- All existing project tests still pass
