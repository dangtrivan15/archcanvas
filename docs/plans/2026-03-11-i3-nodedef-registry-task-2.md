# Task 2: Built-in NodeDef YAML Files

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:writing-plans to plan
> the implementation steps for this task.

**Scope:** 32 built-in NodeDef YAML files across 9 namespaces + barrel imports
**Parent feature:** [./2026-03-11-i3-nodedef-registry-index.md](./2026-03-11-i3-nodedef-registry-index.md)

## Write Set

- Create: 32 YAML files in `src/core/registry/builtins/<namespace>/` (~30 lines each, ~960 lines total)
- Create: 9 namespace barrel files `src/core/registry/builtins/<namespace>/index.ts` (~8 lines each, ~72 lines total)
- Modify: `src/core/registry/builtins/index.ts` (~20 lines) — import and re-export all namespace barrels

Test files (unlimited):
- Create: `test/core/registry/builtins.test.ts` — smoke test: all 32 built-ins parse without error

## Read Set (context needed)

- `src/types/nodeDefSchema.ts` — Zod schema (from Task 1) to understand valid field values
- `src/core/registry/validator.ts` — parseNodeDef function (from Task 1) used by smoke test
- `src/core/registry/loader.ts` — loadBuiltins function (from Task 1) used by smoke test
- `src/core/registry/builtins/index.ts` — placeholder barrel (from Task 1) to be filled in
- [docs/archcanvas-v2-design.md](../archcanvas-v2-design.md) — Section 5 (NodeDef structure example, built-in NodeDef table, port/shape/arg definitions)
- [docs/specs/2026-03-11-i3-nodedef-system-registry-design.md](../specs/2026-03-11-i3-nodedef-system-registry-design.md) — built-in NodeDefs table (namespaces and names)

## Dependencies

- **Blocked by:** Task 1 (schema, validator, and loader must exist)
- **Blocks:** None (final task)

## Description

This task creates all 32 built-in NodeDef YAML files and wires them into the loader via barrel imports.

**YAML file structure:** Each file follows the full NodeDef schema with `kind: NodeDef`, `apiVersion: v1`, `metadata` (name, namespace, version, displayName, description, icon, tags, shape), `spec` (args, ports, children, ai), and optionally `variants`. The `compute/service` example in the design doc (Section 5) is the canonical reference.

**Namespaces and files (32 total):**

| Namespace | Files |
|-----------|-------|
| `compute` | service, function, worker, container, cron-job |
| `data` | database, cache, object-storage, search-index |
| `messaging` | message-queue, event-bus, stream-processor, notification |
| `network` | api-gateway, load-balancer, cdn |
| `client` | web-app, mobile-app, cli |
| `integration` | third-party-api, webhook, etl-pipeline |
| `security` | auth-provider, vault, waf |
| `observability` | logging, monitoring, tracing |
| `ai` | llm-provider, vector-store, agent, rag-pipeline |

**Barrel file pattern:** Each namespace gets an `index.ts` that imports all YAML files in that namespace via `?raw` and exports them as named strings. The top-level `builtins/index.ts` collects all namespace exports into a flat array of raw YAML strings.

**Content guidelines for each NodeDef:**
- `icon` — use a Lucide React icon name that represents the concept (e.g., `Server` for service, `Database` for database, `MessageSquare` for message-queue)
- `shape` — pick from the 9-value enum based on the design doc's shape/use mapping (rectangle for services, cylinder for databases, etc.)
- `args` — define 2-5 configurable properties that make sense for the node type (language, framework, engine, version, replicas, etc.)
- `ports` — named connection points with direction and protocols. Use descriptive names matching the design doc pattern (e.g., `http-in`, `http-out`, `query-in`, `publish-out`)
- `children` — only for node types that can contain sub-nodes (e.g., service can contain functions)
- `ai` — context string and 2-3 review hints relevant to the node type
- `variants` — 1-2 common presets where applicable

**Acceptance criteria:**
- All 32 YAML files exist and follow the schema
- All 9 namespace barrel files correctly import `?raw` and export
- Top-level `builtins/index.ts` collects all namespaces
- `loadBuiltins()` successfully loads all 32 NodeDefs (smoke test)
- Every NodeDef has at minimum: metadata (all required fields), at least one port, and an ai.context string
- No duplicate `namespace/name` combinations
