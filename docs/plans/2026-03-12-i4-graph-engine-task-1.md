# Task 1: Result Types + Validation + Test Helpers

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:writing-plans to plan
> the implementation steps for this task.

**Scope:** Result types, NodeDef-aware validation, shared test fixtures, barrel export
**Parent feature:** [./2026-03-12-i4-graph-engine-index.md](./2026-03-12-i4-graph-engine-index.md)

## Write Set

- Create: `src/core/graph/types.ts` (~50 lines)
- Create: `src/core/graph/validation.ts` (~100 lines)
- Create: `src/core/graph/index.ts` (~5 lines — barrel, forward-declares all module exports)
- Create: `test/core/graph/helpers.ts` (~50 lines — shared test fixtures)
- Create: `test/core/graph/validation.test.ts` (test, unlimited)

## Read Set (context needed)

- `src/types/schema.ts` — `CanvasFile`, `InlineNode`, `RefNode`, `Edge`, `Entity`, `Position`, `Node` types
- `src/types/nodeDefSchema.ts` — `NodeDef`, `ArgDef`, `PortDef`, `ArgType` types
- `src/core/registry/core.ts` — `NodeDefRegistry` interface (resolve, list, search, listByNamespace)
- `docs/specs/2026-03-12-i4-graph-engine-design.md` — Layer 1 (Result Types) and Layer 2 (Validation) sections

## Dependencies

- **Blocked by:** None (first task)
- **Blocks:** Task 2 (Engine), Task 3 (Query)

## Description

This task builds the foundation for the graph engine: the shared result types and the validation module.

### `types.ts`

Define the `EngineError` discriminated union (10 error codes: `DUPLICATE_NODE_ID`, `NODE_NOT_FOUND`, `EDGE_ENDPOINT_NOT_FOUND`, `DUPLICATE_EDGE`, `SELF_LOOP`, `EDGE_NOT_FOUND`, `ENTITY_NOT_FOUND`, `DUPLICATE_ENTITY`, `ENTITY_IN_USE`, `INVALID_REF_NODE_UPDATE`). Define the `EngineWarning` discriminated union (5 warning codes: `UNKNOWN_NODE_TYPE`, `INVALID_ARG`, `UNKNOWN_PORT`, `INVALID_PORT_DIRECTION`, `ENTITY_UNREFERENCED`). Define `EngineResult = { ok: true; data: CanvasFile; warnings: EngineWarning[] } | { ok: false; error: EngineError }`. Also define `SearchResult` as a discriminated union with three variants (node, edge, entity), each carrying type-specific identifiers.

See the spec's Layer 1 section for exact field definitions per error/warning code.

### `validation.ts`

Three functions:
- `validateNode(node: Node, registry: NodeDefRegistry): EngineWarning[]` — accepts the `Node` union type. Returns `[]` for ref nodes (detected by presence of `ref` field). For inline nodes: checks type resolves in registry (`UNKNOWN_NODE_TYPE`), checks args match NodeDef spec (required args present, enum values valid → `INVALID_ARG`).
- `validateEdge(edge: Edge, canvas: CanvasFile, registry: NodeDefRegistry): EngineWarning[]` — checks port existence on source/target NodeDefs (`UNKNOWN_PORT`), checks port direction (`INVALID_PORT_DIRECTION`). Skips port checks if node type is unknown.
- `validateCanvas(canvas: CanvasFile, registry: NodeDefRegistry): EngineWarning[]` — runs `validateNode` on all nodes, `validateEdge` on all edges, checks for unreferenced entities (`ENTITY_UNREFERENCED`). Deduplicates warnings.

Registry is a parameter, not a singleton. All functions return warnings (soft), never throw.

### `index.ts`

Barrel export that re-exports from `./types`, `./validation`, `./engine`, and `./query`. The engine and query modules won't exist yet — the barrel will have TypeScript errors until Tasks 2 and 3 complete. This is expected during incremental development.

### Test helpers (`test/core/graph/helpers.ts`)

Factory functions shared across all three test files:
- `makeCanvas(overrides?)` — returns a minimal valid `CanvasFile`
- `makeNode(overrides?)` — returns a minimal `InlineNode` with defaults (`id: 'test-node'`, `type: 'compute/service'`)
- `makeRefNode(overrides?)` — returns a minimal `RefNode`
- `makeEdge(overrides?)` — returns a minimal `Edge` with from/to defaults
- `makeEntity(overrides?)` — returns a minimal `Entity`
- `makeMockRegistry(nodeDefs?)` — returns an object implementing `NodeDefRegistry` backed by the provided Map (or empty)

### Validation tests

Cover:
- `validateNode`: unknown type warning, valid args pass clean, required arg missing, enum arg invalid value, ref node returns empty array
- `validateEdge`: unknown port, port direction mismatch (inbound port used as from), skips port check when node type unknown
- `validateCanvas`: combines node + edge warnings, detects unreferenced entities, deduplicates

### Acceptance Criteria

- All types compile with no errors
- `EngineError` and `EngineWarning` are discriminated unions narrowable by `code` field
- `EngineResult` narrowable by `ok` field
- `SearchResult` narrowable by `type` field
- Validation functions return correct warnings for all specified scenarios
- All existing project tests still pass (84 I3 + 72 I10 = 156 tests)
