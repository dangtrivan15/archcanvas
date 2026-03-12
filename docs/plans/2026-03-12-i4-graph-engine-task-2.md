# Task 2: CRUD Engine

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:writing-plans to plan
> the implementation steps for this task.

**Scope:** Scope-local CRUD operations for nodes, edges, and entities via Immer
**Parent feature:** [./2026-03-12-i4-graph-engine-index.md](./2026-03-12-i4-graph-engine-index.md)

## Write Set

- Create: `src/core/graph/engine.ts` (~220 lines)
- Create: `test/core/graph/engine.test.ts` (test, unlimited)

## Read Set (context needed)

- `src/core/graph/types.ts` — `EngineResult`, `EngineError`, `EngineWarning` (from Task 1)
- `src/core/graph/validation.ts` — `validateNode`, `validateEdge` (from Task 1)
- `src/types/schema.ts` — `CanvasFile`, `InlineNode`, `RefNode`, `Edge`, `Entity`, `Position`, `Node`
- `src/core/registry/core.ts` — `NodeDefRegistry` interface
- `test/core/graph/helpers.ts` — shared test fixtures (from Task 1)
- `docs/specs/2026-03-12-i4-graph-engine-design.md` — Layer 3 (Engine) section

## Dependencies

- **Blocked by:** Task 1 (types and validation must exist)
- **Blocks:** None

## Description

This task implements the scope-local CRUD engine — the core mutation layer for graph manipulation. All functions take a `CanvasFile`, validate structurally, optionally validate semantically via the registry, mutate via Immer's `produce()`, and return `EngineResult`.

### Prerequisites

Install Immer: `npm install immer`. Verify it works with the existing Vite/TypeScript setup.

### Node Operations

- **`addNode(canvas, node, registry?)`** — Check ID unique → `DUPLICATE_NODE_ID`. If inline node + registry, run `validateNode` → collect warnings. Produce new canvas with node appended.
- **`removeNode(canvas, nodeId)`** — Check node exists → `NODE_NOT_FOUND`. Produce new canvas with node removed AND all edges referencing that node removed (cascade within scope).
- **`updateNode(canvas, nodeId, updates, registry?)`** — Check node exists → `NODE_NOT_FOUND`. Check not ref node → `INVALID_REF_NODE_UPDATE`. Apply partial updates via produce. If registry provided and args changed, re-validate. `type` field is intentionally excluded from updates — type changes require remove + add.
- **`updateNodePosition(canvas, nodeId, position)`** — Check node exists → `NODE_NOT_FOUND`. Works on both inline and ref nodes. Replaces the full Position object.

### Edge Operations

- **`addEdge(canvas, edge, registry?)`** — Check both endpoints exist in scope (skip `@root/` prefixed endpoints) → `EDGE_ENDPOINT_NOT_FOUND`. Check not self-loop → `SELF_LOOP`. Check no duplicate `from.node + to.node` pair → `DUPLICATE_EDGE`. If registry, run `validateEdge` → collect warnings. Produce new canvas.
- **`removeEdge(canvas, from, to)`** — Find edge by `from.node` + `to.node` → `EDGE_NOT_FOUND`. Produce new canvas.
- **`updateEdge(canvas, from, to, updates)`** — Find edge → `EDGE_NOT_FOUND`. Apply partial updates to `protocol`, `label`, `entities`, `notes`.

### Entity Operations

- **`addEntity(canvas, entity)`** — Check name unique → `DUPLICATE_ENTITY`. Produce new canvas.
- **`removeEntity(canvas, entityName)`** — Check exists → `ENTITY_NOT_FOUND`. Check no edges reference it → `ENTITY_IN_USE` (with `referencedBy` listing offending edges). Produce new canvas.
- **`updateEntity(canvas, entityName, updates)`** — Check exists → `ENTITY_NOT_FOUND`. Apply partial updates to `description`, `codeRefs`.

### Key Implementation Notes

- All mutations use `produce()` from Immer — write mutation code as if mutable, get structural sharing for free.
- Registry parameter is optional on `addNode`, `updateNode`, `addEdge`. When omitted, no semantic validation runs and warnings array is empty.
- `@root/` prefixed edge endpoints are accepted without checking the current canvas — they reference nodes in the parent scope.
- Edge identity is `from.node + to.node` (not including ports). At most one edge between any two nodes in a scope.
- `removeNode` cascades edge removal within the scope only. Cross-scope edge cleanup is the store's responsibility.

### Engine Tests

Comprehensive coverage of all operations and error/warning codes:

**Node tests:**
- Add inline node (success, with warnings from registry)
- Add ref node (success, no validation)
- Add duplicate ID → `DUPLICATE_NODE_ID` error
- Remove node → success + edge cascade
- Remove non-existent → `NODE_NOT_FOUND`
- Update inline node fields → success
- Update ref node (non-position) → `INVALID_REF_NODE_UPDATE`
- Update non-existent → `NODE_NOT_FOUND`
- Update position on inline and ref nodes → success

**Edge tests:**
- Add edge (success, with port warnings from registry)
- Add with non-existent endpoint → `EDGE_ENDPOINT_NOT_FOUND`
- Add self-loop → `SELF_LOOP`
- Add duplicate → `DUPLICATE_EDGE`
- Add with `@root/` endpoint → success (no scope check)
- Remove edge → success
- Remove non-existent → `EDGE_NOT_FOUND`
- Update edge fields → success

**Entity tests:**
- Add entity → success
- Add duplicate name → `DUPLICATE_ENTITY`
- Remove entity → success
- Remove entity in use → `ENTITY_IN_USE` with referencedBy
- Remove non-existent → `ENTITY_NOT_FOUND`
- Update entity → success

**Immer verification:**
- Verify original canvas is not mutated (structural sharing)
- Verify returned canvas is a new object reference

### Acceptance Criteria

- All 10 error codes are exercised in tests
- Warning passthrough from validation module works correctly
- Immer produces new references (original not mutated)
- `@root/` endpoints pass without scope checking
- `removeNode` cascade removes connected edges
- `removeEntity` blocks when edges reference it
- All existing project tests still pass
