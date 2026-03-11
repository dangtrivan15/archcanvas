# 02: Core Data Model & YAML (I10)

> **Date**: 2026-03-11 | **Status**: Complete
> **Scope**: Foundation data layer — Zod schemas, YAML codec, platform file system, file resolver, and Zustand fileStore

## Recap

I10 implemented the five-layer data foundation that all downstream initiatives (I3 canvas rendering, I4 graph mutations) build on. The layers were built bottom-up: Types → Platform → YAML Codec → File Resolver → Zustand Store. Each layer depends only on the one below it.

The implementation produced 20 new files (12 source, 5 test suites, 3 YAML fixtures) totaling ~1,460 lines. All 72 tests pass. The work was executed using subagent-driven development — Tasks 1 (Zod schemas) and 3 (Platform FileSystem) ran in parallel since they have no dependencies on each other, while Tasks 2, 4, and 5 ran sequentially following the dependency graph. Each task went through TDD (tests first → implement → verify) and a two-stage review (spec compliance → code quality).

The data model supports multi-file projects: a root canvas (`.archcanvas/main.yaml`) with ref nodes that point to subsystem YAML files, loaded recursively with cycle detection and diamond-dependency handling. The `@root/` reference syntax lets subsystem canvases reference nodes in the root canvas for cross-cutting edges. The Zustand store wraps this with reactive state, dirty tracking, and save actions for React consumption.

**What's next:** I3 (Canvas Rendering) will consume `useFileStore` to render the node graph via ReactFlow. I4 (Graph Mutations) will use the store's `markDirty` and `saveCanvas` APIs to persist edits.

## Decisions

| Decision | Chose | Over | Why |
|----------|-------|------|-----|
| Node union discrimination | `z.union` (first-match) | `z.discriminatedUnion` | RefNode has `ref`, InlineNode has `type` — mutually exclusive required fields make first-match sufficient; Zod 4's discriminated union API adds no benefit here |
| Tauri FS export strategy | Dynamic import in `createFileSystem()` factory | Static re-export from index | `@tauri-apps/plugin-fs` npm package isn't installed in web builds; static import would break the web bundle |
| FileSystemDirectoryHandle.entries() | `as unknown as AsyncIterable` cast | Waiting for TS DOM lib fix | TypeScript 5.9 still doesn't fully type the async iterable protocol on `FileSystemDirectoryHandle`; the cast is the standard workaround |
| YAML format preservation | Field-level merge via `doc.set()` per top-level key | Full document replacement | Preserves comments and key ordering on unchanged sections; only top-level values are replaced |
| Error path formatting | `nodes[0].id` bracket notation | `nodes.0.id` dot notation | Bracket notation for array indices is the conventional format and easier to read in error messages |
| Cycle vs diamond detection | Two-set DFS (`loaded` + `ancestors`) | Single visited set | `loaded` prevents re-loading (diamonds); `ancestors` tracks the current DFS path (true cycles). Standard textbook approach. |

## Retrospective

- **What went well** — Subagent-driven development with parallel execution of independent tasks worked smoothly. The two-stage review process (spec → quality) caught real issues: unused imports, missing test cases, fragile iteration-during-mutation, and interface signature gaps. The bottom-up layering meant each task had clean, testable boundaries.

- **What didn't** — The `@tauri-apps/plugin-fs` npm package not being installed required a workaround (custom `.d.ts` declaration file and omitting the static re-export). This is a known gap that will need resolution when Tauri integration is activated.

- **Lessons** — Zod 4's `issue.path` contains `PropertyKey[]` (strings, numbers, symbols), not just strings. Joining with `.` produces `nodes.0.id` instead of `nodes[0].id`. Always use a `formatPath` helper for user-facing error messages. Also: `yaml` library's `isMap()`/`isScalar()` type guards are preferable to duck-typing with `'items' in root` — they provide proper TypeScript narrowing without `any` casts.

- **Notes for future** — `saveAll` in fileStore has no partial-failure handling (if one canvas save fails, remaining canvases are skipped). Address before I4 graph mutations start calling it. The `ROOT_CANVAS_KEY` constant is exported from `src/storage/index.ts` — callers need to know to import it from there alongside store imports.
