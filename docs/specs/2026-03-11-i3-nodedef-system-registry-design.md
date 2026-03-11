# I3: NodeDef System & Registry — Design Spec

> **Date**: 2026-03-11 | **Status**: Draft
> **Scope**: NodeDef Zod schema, YAML validation, layered registry, 32 built-in NodeDefs
> **Depends on**: I10 (Core Data Model & YAML) — complete
> **Blocks**: I4 (Graph Engine), canvas rendering (presentation layer)

## Context

I3 builds the NodeDef system — the blueprint layer that defines what types of nodes exist on the canvas. When a node in a canvas file says `type: data/database`, the registry resolves that to a NodeDef which specifies the node's shape, icon, ports, configurable properties, and AI hints.

The NodeDef system and file format are specified in [docs/archcanvas-v2-design.md](../archcanvas-v2-design.md#5-nodedef-system--registry). This spec focuses on implementation design.

## Scope Boundary

**In scope:**
- Zod schema for the full NodeDef structure
- YAML → NodeDef parsing and validation
- Layered registry: built-in + project-local with priority override
- 32 built-in NodeDefs as YAML files across 9 namespaces
- Built-in bundling via Vite `?raw` imports

**Out of scope:**
- Remote registry (v2 feature per [docs/archcanvas-v2-design.md](../archcanvas-v2-design.md#registry-architecture))
- Zustand `registryStore` (State Layer — added when presentation layer consumes registry)
- Graph engine / CRUD operations — I4
- Canvas rendering / React components — presentation layer initiative
- Protocol compatibility matrix — deferred

## Architecture

Three modules in the Core Layer, plus a types extension. Built bottom-up.

```
src/types/nodeDefSchema.ts          ← Zod schema (pure types)
        │
src/core/registry/validator.ts      ← YAML string → validated NodeDef
        │
src/core/registry/loader.ts         ← load built-ins (?raw) + project-local (FileSystem)
        │
src/core/registry/core.ts           ← layered registry interface
```

This sits in `core/` per the module architecture in [docs/archcanvas-v2-design.md](../archcanvas-v2-design.md#module-architecture). The Core Layer has zero dependency on React, DOM, or Tauri — pure TypeScript.

## Layer 1: NodeDef Zod Schema

**Location:** `src/types/nodeDefSchema.ts`, re-exported from `src/types/index.ts`

Separate file from `schema.ts` — NodeDef schemas have a one-way import from `schema.ts` (`PropertyMap` for variant args) but no circular dependency. Different concerns warrant separate files.

### Type Structure

| Type | Key fields | Notes |
|------|-----------|-------|
| `ArgDef` | name, type, required?, options?, default?, description? | Configurable property blueprint |
| `PortDef` | name, direction (inbound\|outbound), protocol: string[], description? | Named connection point for edges |
| `ChildConstraint` | nodedef (namespace/name string), min?, max? | Nesting rules |
| `AiHints` | context?, reviewHints?: string[] | Injected into AI prompts |
| `Variant` | name, description?, args: PropertyMap | Quick-start presets |
| `NodeDefMetadata` | name, namespace, version, displayName, description, icon, tags?, shape | Identity and visual appearance |
| `NodeDefSpec` | args?, ports?, children?, ai? | Capabilities and constraints |
| `NodeDef` | kind: "NodeDef", apiVersion: "v1", metadata, spec, variants? | Top-level schema |

### Key Decisions

- **Named ports** — ports are named connection points with direction and protocol list, matching the design doc. Port names (e.g., `http-in`, `publish-out`) are referenced by `EdgeEndpoint.port` in canvas YAML files. This serves two purposes: visual anchor points for edge rendering, and protocol validation via the compatibility matrix. Matches [docs/archcanvas-v2-design.md](../archcanvas-v2-design.md#nodedef-structure).
- **Shape enum** — 9 values: `rectangle`, `cylinder`, `hexagon`, `parallelogram`, `cloud`, `stadium`, `document`, `badge`, `container`. Matches [docs/archcanvas-v2-design.md](../archcanvas-v2-design.md#shapes).
- **ArgDef type enum** — 5 values: `string`, `number`, `boolean`, `enum`, `duration`. Matches [docs/archcanvas-v2-design.md](../archcanvas-v2-design.md#arg-types).
- **`kind` and `apiVersion` as literals** — `"NodeDef"` and `"v1"` are hardcoded. Provides forward compatibility for schema evolution.

### Type Resolution

Node instances in canvas files reference NodeDefs via the `type` field:

```
Canvas node: { id: "db-postgres", type: "data/database" }
                                          ↓         ↓
                                    namespace     name
                                          ↓
NodeDef: { metadata: { namespace: "data", name: "database" } }
```

The registry resolves `type` strings by splitting on `/` and matching both `namespace` and `name`.

## Layer 2: Validator

**Location:** `src/core/registry/validator.ts`

### Function

```typescript
function parseNodeDef(yamlContent: string): { nodeDef: NodeDef } | { error: string }
```

Parses a YAML string via the `yaml` library, validates against the NodeDef Zod schema, returns either a validated `NodeDef` object or a descriptive error string.

### Decisions

- **Result type over exceptions** — callers decide whether an invalid NodeDef is fatal (validator tests) or non-fatal (project-local loader skipping bad files). Same pattern as I10's error handling.
- **Reuses `yaml` library from I10** — same dependency, consistent parsing behavior.

## Layer 3: Loader

**Location:** `src/core/registry/loader.ts`

### Functions

```typescript
function loadBuiltins(): Map<string, NodeDef>
function loadProjectLocal(fs: FileSystem, projectRoot: string): Promise<LoadProjectLocalResult>
```

```typescript
interface LoadProjectLocalResult {
  nodeDefs: Map<string, NodeDef>
  errors: Array<{ file: string; message: string }>
}
```

Maps are keyed by compound key `"namespace/name"` (e.g., `"data/database"`).

### Built-in Loading

Built-in NodeDef YAML files live in `src/core/registry/builtins/` organized by namespace. Each namespace directory has a barrel file that imports the YAML strings via Vite `?raw` suffix. A top-level `builtins/index.ts` collects all namespaces and exports the raw strings.

`loadBuiltins()` is synchronous — all YAML is available as bundled strings at import time. It iterates the raw strings, calls `parseNodeDef()` on each, and populates the Map. Invalid built-ins throw (these are bugs in our shipped data, not user errors).

### Project-Local Loading

`loadProjectLocal()` uses the Platform `FileSystem` (from I10) to scan `.archcanvas/nodedefs/` for YAML files. Each file is parsed and validated. Invalid files produce errors in the result (non-fatal — the project still loads). Valid NodeDefs are added to the Map.

### Decisions

- **Vite `?raw` for built-ins** — YAML strings baked into the JS bundle. Works identically in web and Tauri. 32 small files is negligible bundle size. No async loading or platform file system access needed for app assets. Requires a `*.yaml` module declaration in `src/vite-env.d.ts` for TypeScript to recognize `?raw` imports.
- **Synchronous built-in loading** — since `?raw` imports are available at module load time, `loadBuiltins()` can be sync. This simplifies registry construction.
- **Built-in invalid = throw, project-local invalid = collect error** — built-ins are our code (bugs should surface immediately). Project-local are user-authored (graceful degradation).

## Layer 4: Registry

**Location:** `src/core/registry/core.ts`

### Interface

```typescript
interface NodeDefRegistry {
  resolve(type: string): NodeDef | undefined
  list(): NodeDef[]
  search(query: string): NodeDef[]
  listByNamespace(namespace: string): NodeDef[]
}
```

### Layered Implementation

```typescript
function createRegistry(
  builtins: Map<string, NodeDef>,
  projectLocal: Map<string, NodeDef>
): { registry: NodeDefRegistry; warnings: string[] }
```

Two layers, checked in priority order:

```
resolve("data/database")
  1. Check project-local Map
  2. Fall back to built-in Map
  3. Not found → return undefined
```

### Override Warnings

When `createRegistry` detects a key that exists in both maps, it records a warning: `"NodeDef 'data/database' overridden by project-local definition"`. Warnings are returned alongside the registry — callers decide how to surface them (log, toast, etc.).

### Search

`search(query)` performs case-insensitive substring matching against `name`, `displayName`, `description`, and `tags`. Returns results from both layers (with project-local overrides applied). This supports the command palette's NodeDef search (future initiative).

### Decisions

- **Layered maps, not merged** — each layer maintains its own Map. `resolve()` checks them in order. This means project-local NodeDefs can be reloaded independently (e.g., if user adds a new file) without rebuilding the entire registry.
- **Warnings as data, not side effects** — warnings are returned from `createRegistry`, not logged internally. The caller controls presentation. Same pattern as I10's `ResolutionError[]`.
- **Third layer placeholder** — the remote registry (v2) will slot in as a third layer with lowest priority. The layered architecture supports this without restructuring.

## Built-in NodeDefs

32 YAML files across 9 namespaces, stored in `src/core/registry/builtins/`:

| Namespace | NodeDefs | Count |
|-----------|----------|-------|
| `compute` | service, function, worker, container, cron-job | 5 |
| `data` | database, cache, object-storage, search-index | 4 |
| `messaging` | message-queue, event-bus, stream-processor, notification | 4 |
| `network` | api-gateway, load-balancer, cdn | 3 |
| `client` | web-app, mobile-app, cli | 3 |
| `integration` | third-party-api, webhook, etl-pipeline | 3 |
| `security` | auth-provider, vault, waf | 3 |
| `observability` | logging, monitoring, tracing | 3 |
| `ai` | llm-provider, vector-store, agent, rag-pipeline | 4 |

**Total: 32 NodeDefs.** Additional types can be added iteratively without structural changes.

Each file follows the full schema. See the `compute/service` example in [docs/archcanvas-v2-design.md](../archcanvas-v2-design.md#nodedef-structure) for the canonical structure.

### File Layout

```
src/core/registry/builtins/
├── index.ts              ← collects all namespace barrels, exports raw YAML strings
├── compute/
│   ├── index.ts          ← imports *.yaml?raw, exports string[]
│   ├── service.yaml
│   ├── function.yaml
│   ├── worker.yaml
│   ├── container.yaml
│   └── cron-job.yaml
├── data/
│   ├── index.ts
│   └── ... (4 YAML files)
├── messaging/
│   ├── index.ts
│   └── ... (4 YAML files)
├── network/
│   ├── index.ts
│   └── ... (3 YAML files)
├── client/
│   ├── index.ts
│   └── ... (3 YAML files)
├── integration/
│   ├── index.ts
│   └── ... (3 YAML files)
├── security/
│   ├── index.ts
│   └── ... (3 YAML files)
├── observability/
│   ├── index.ts
│   └── ... (3 YAML files)
└── ai/
    ├── index.ts
    └── ... (4 YAML files)
```

## Build Order

Bottom-up, each layer testable before the next:

1. **NodeDef Zod schema** — pure types, tested with valid/invalid fixture data
2. **Validator** — depends on schema, tested with YAML strings
3. **Loader** — depends on validator + built-in YAML files + FileSystem (from I10), tested with `InMemoryFileSystem`
4. **Registry** — depends on loader, tested with constructed Maps

## Testing Strategy

| Module | Test file | Coverage |
|--------|-----------|----------|
| `nodeDefSchema.ts` | `test/types/nodeDefSchema.test.ts` | Valid NodeDefs parse, invalid reject with clear errors, all field types, edge cases (missing required fields, unknown shapes, invalid port directions) |
| `validator.ts` | `test/core/registry/validator.test.ts` | YAML string → validated NodeDef, malformed YAML errors, schema violations |
| `loader.ts` | `test/core/registry/loader.test.ts` | All built-ins load and validate, project-local via InMemoryFileSystem, missing/invalid files handled gracefully |
| `core.ts` | `test/core/registry/registry.test.ts` | `resolve()` by namespace/name, project-local overrides built-in + warning, `search()` matches name/displayName/tags, `listByNamespace()`, unknown type returns undefined |
| (integration) | `test/core/registry/builtins.test.ts` | Smoke test: load all ~32 built-in YAML files, assert every one parses without error |

No E2E tests — I3 has no UI surface.

## V1 Reuse Assessment

| V1 module | Reuse in I3 | Notes |
|-----------|-------------|-------|
| `core/registry/` | None | v1 registry was built around protobuf format. YAML-based registry is a full rewrite. |
| `bak/src/types/` | Patterns only | NodeDef field names and concepts carry over, but schemas are new (Zod 4). |
