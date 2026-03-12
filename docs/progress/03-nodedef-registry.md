# 03: NodeDef System & Registry (I3)

> **Date**: 2026-03-12 | **Status**: Complete
> **Scope**: NodeDef Zod schema, YAML validator, layered registry, and 32 built-in NodeDefs across 9 namespaces

## Recap

I3 implemented the NodeDef system — the blueprint layer that defines what types of nodes exist on the canvas. When a canvas file says `type: data/database`, the registry resolves that string to a NodeDef that specifies the node's shape, icon, ports, configurable properties, and AI hints.

The work was split into two sequential tasks per the [plan](../plans/2026-03-11-i3-nodedef-registry-index.md). Task 1 built the four core TypeScript modules bottom-up: Zod schema → YAML validator → loader → layered registry. Task 2 created 32 built-in NodeDef YAML files organized into 9 namespace directories, each with a barrel file using Vite `?raw` imports to bundle the YAML as strings.

The implementation produced ~50 new files: 8 source modules (~275 LOC), 32 YAML NodeDef files (~960 YAML LOC), 9 namespace barrel files, and 5 test suites (84 tests). All 156 project tests pass (84 new + 72 existing). Task 2 was parallelized using 9 subagents (one per namespace), which completed in ~40 seconds wall-clock time. Post-merge validation caught three patterns of YAML issues across agents (`protocols` vs `protocol`, string vs array protocol values, variants nested inside `spec` instead of top-level) — all fixed in a single pass.

**What's next:** I4 (Graph Engine) will consume the registry to validate node types during CRUD operations. The presentation layer will use `resolve()` to look up shapes, icons, and ports when rendering nodes on the ReactFlow canvas.

## Decisions

| Decision | Chose | Over | Why |
|----------|-------|------|-----|
| Result type for validator | `{ nodeDef } \| { error }` union | Thrown exceptions | Callers decide policy: loader throws on invalid built-ins (bugs) but collects errors for project-local files (user mistakes). Same pattern as I10's error handling. |
| Built-in loading | Synchronous via `?raw` imports | Async file reads | YAML strings are baked into the JS bundle at build time. Works identically in web and Tauri. 32 small files is negligible bundle size. |
| Registry layer structure | Separate Maps checked in order | Single merged Map | Separate layers enable independent hot-reload of project-local definitions without rebuilding the entire registry. Third "remote" layer slots in naturally. |
| Variant `args` field | Required (not optional) | Optional with empty default | Variants are "quick-start presets" — a variant with no args preset is meaningless. Making it required catches authoring mistakes at schema validation time. |
| `formatPath` duplication | Duplicate in validator.ts | Shared utility extraction | Both `yamlCodec.ts` and `validator.ts` have a 5-line `formatPath` helper. Extracting a shared util adds indirection without meaningful benefit for such a small function. |

## Retrospective

- **What went well** — Parallel subagent execution for the 32 YAML files was very efficient. 9 agents completed all namespaces in ~40 seconds. The bottom-up layering from Task 1 meant each test suite only exercised its own layer, making failures easy to diagnose. The smoke test (`builtins.test.ts`) that validates all 32 files parse correctly proved essential — it caught every YAML issue immediately.

- **What didn't** — Subagents produced three categories of YAML inconsistencies: using `protocols` (plural) instead of `protocol`, writing `protocol: HTTP/HTTPS` as a string instead of `protocol: [HTTP, HTTPS]` as an array, and nesting `variants` inside `spec` instead of at the top level. These are the kinds of subtle schema mismatches that parallel agents can introduce when working from natural-language specs rather than a strict template.

- **Lessons** — For future subagent-parallelized YAML/config generation, provide an exact validated example file rather than a schema description. A single canonical YAML that passes validation is worth more than a detailed spec for preventing format drift across agents. The smoke test pattern (parse all files, assert count, assert invariants) is a good safety net and should be standard for any bulk-generated content.

- **Notes for future** — The `NodeDef` schema currently has all optional fields on `NodeDefSpec` (`args`, `ports`, `children`, `ai`). The acceptance criteria require at least one port and an `ai.context`, but these are only enforced by the smoke test, not the Zod schema itself. If these become hard requirements, add Zod refinements. The `saveAll` partial-failure gap noted in I10 memory still applies — fix before I4.
