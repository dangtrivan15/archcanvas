# Task 1: Schema + Validator + Registry

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:writing-plans to plan
> the implementation steps for this task.

**Scope:** NodeDef Zod schema, YAML validator, loader, layered registry
**Parent feature:** [./2026-03-11-i3-nodedef-registry-index.md](./2026-03-11-i3-nodedef-registry-index.md)

## Write Set

- Create: `src/types/nodeDefSchema.ts` (~80 lines) — Zod schemas for full NodeDef structure
- Modify: `src/types/index.ts` (~2 lines) — add re-export of nodeDefSchema
- Modify: `src/vite-env.d.ts` (~3 lines) — add `*.yaml?raw` module declaration
- Create: `src/core/registry/validator.ts` (~40 lines) — parseNodeDef(yaml) → NodeDef | error
- Create: `src/core/registry/loader.ts` (~80 lines) — loadBuiltins() + loadProjectLocal()
- Create: `src/core/registry/core.ts` (~70 lines) — layered registry with resolve/list/search/listByNamespace
- Create: `src/core/registry/index.ts` (~5 lines) — barrel exports
- Create: `src/core/registry/builtins/index.ts` (~20 lines) — placeholder barrel (empty until Task 2)

Test files (unlimited):
- Create: `test/types/nodeDefSchema.test.ts`
- Create: `test/core/registry/validator.test.ts`
- Create: `test/core/registry/loader.test.ts`
- Create: `test/core/registry/registry.test.ts`

## Read Set (context needed)

- `src/types/schema.ts` — existing Zod schemas, `PropertyMap` type used by Variant args
- `src/types/index.ts` — current barrel export pattern
- `src/platform/fileSystem.ts` — `FileSystem` interface (used by loadProjectLocal)
- `src/platform/inMemoryFileSystem.ts` — test utility for loader tests
- `src/storage/yamlCodec.ts` — reference for YAML parsing patterns (uses same `yaml` library)
- `src/vite-env.d.ts` — current type declarations
- [docs/specs/2026-03-11-i3-nodedef-system-registry-design.md](../specs/2026-03-11-i3-nodedef-system-registry-design.md) — full design spec
- [docs/archcanvas-v2-design.md](../archcanvas-v2-design.md) — Section 5 (NodeDef structure, port definitions, shapes, arg types)

## Dependencies

- **Blocked by:** None (first task)
- **Blocks:** Task 2 (YAML files must validate against this schema)

## Description

This task builds the four TypeScript modules that form the NodeDef system's core logic, bottom-up:

**Layer 1 — nodeDefSchema.ts:** Define the full Zod schema matching the design doc's NodeDef structure. Key types: `ArgDef` (5 type variants: string, number, boolean, enum, duration), `PortDef` (named connection points with direction and protocol list), `ChildConstraint`, `AiHints`, `Variant` (uses `PropertyMap` from existing `schema.ts`), `NodeDefMetadata` (with shape enum of 9 values), `NodeDefSpec`, and the top-level `NodeDef` with `kind: "NodeDef"` and `apiVersion: "v1"` literals.

**Layer 2 — validator.ts:** A single function `parseNodeDef(yamlContent: string)` that parses YAML via the `yaml` library and validates against the Zod schema. Returns a result type (`{ nodeDef }` or `{ error }`) — not exceptions. Error messages should be descriptive, including which field failed.

**Layer 3 — loader.ts:** Two functions. `loadBuiltins()` is synchronous — imports raw YAML strings from `builtins/index.ts` (initially empty/placeholder), parses each via `parseNodeDef`, throws on invalid (bugs in shipped data). `loadProjectLocal(fs, projectRoot)` is async — uses `FileSystem.listFiles()` to scan `.archcanvas/nodedefs/`, parses each YAML file, collects errors non-fatally. Both return `Map<string, NodeDef>` keyed by `"namespace/name"`.

**Layer 4 — core.ts:** `createRegistry(builtins, projectLocal)` composes two Maps into a `NodeDefRegistry` interface with `resolve()`, `list()`, `search()`, `listByNamespace()`. Resolution checks project-local first, falls back to built-in. Override warnings are collected and returned alongside the registry. `search()` does case-insensitive substring matching on name, displayName, description, and tags.

**Acceptance criteria:**
- All Zod schemas match the design doc's NodeDef structure (Section 5)
- `parseNodeDef` handles valid YAML, invalid YAML, and schema violations
- `loadProjectLocal` works with `InMemoryFileSystem` and handles missing directories, empty directories, and invalid files gracefully
- Registry resolves types, respects layer priority, emits override warnings
- `builtins/index.ts` exists as a placeholder (exports empty array) so loader compiles — Task 2 fills it
- `?raw` module declaration added to `vite-env.d.ts`
- All tests pass
