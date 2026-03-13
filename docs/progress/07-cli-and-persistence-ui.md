# 07: CLI & Persistence UI (I5)

> **Date**: 2026-03-13 | **Status**: Complete
> **Scope**: 9 CLI commands via standalone Node.js program, persistence UI (Open/Save/SaveAs, dirty tracking, save-on-close, keyboard shortcuts, recent files), builtin NodeDefs as TS objects, NodeFileSystem for Node.js

## Recap

I5 delivered two capabilities on the same foundation: a headless CLI (`archcanvas`) and a persistence-aware UI, both sharing the same Zustand stores and graph engine. The CLI is a single-file ESM bundle built by a dedicated Vite config (`vite.config.cli.ts`), producing `dist/cli.js` with a shebang header. The UI gained real File menu actions, keyboard shortcuts (Cmd+S/O/Shift+S), a reactive dirty indicator, and save-on-close via `beforeunload`.

Two infrastructure changes made this possible. First, all 32 builtin NodeDefs were converted from runtime-parsed YAML (via Vite `?raw` imports) to static TypeScript object literals. This eliminated the environment coupling that prevented the registry from initializing outside the Vite dev server. Second, a new `NodeFileSystem` class backed by `node:fs/promises` was added, and the `createFileSystem` factory was extended with 4-branch environment detection: Web (DirectoryHandle) → Node.js (dynamic import) → Tauri → error. The Node.js branch uses `await import()` to keep `node:fs` out of the browser bundle.

The CLI architecture is straightforward: `commander` handles arg parsing, a `loadContext()` function walks upward from cwd to find `.archcanvas/`, loads the project into `fileStore`, and initializes the registry. Commands call the same `graphStore` methods the UI uses, then `fileStore.saveAll()` persists mutations back to YAML. Read-only commands (list, describe, search) skip the save step. The `init` command is unique — it creates the project structure directly via `FileSystem` without loading stores.

The persistence UI extended `fileStore` with `open()`, `save()`, `saveAs()`, `isDirty()`, and `recentProjects`. A `FilePicker` abstraction handles the platform-specific directory picker (Web `showDirectoryPicker`, Tauri dialog stub). The store uses dependency injection (`setFilePicker`, `setLocalStorage`) for testability.

The implementation was decomposed into 10 tasks across 4 parallel groups, executed by subagents in git worktrees. This produced 87 changed files, ~7,500 lines added, and 616 total tests (up from 460). A post-implementation code review caught 6 issues (path traversal in `NodeFileSystem`, broken `Cmd+Shift+S` due to `e.key` case, missing `--project` global option, `engineErrorMessage` duplication across 4 files, duplicated builtins-to-map logic in `registryStore`, and `CommanderError` swallowing `--help`/`--version`), all fixed in a follow-up pass.

**What's next:** I6 (AI Integration + Onboarding), I7 (Packaging + Polish). The CLI is ready for AI agent consumption (JSON output mode), which feeds directly into I6's design.

## Decisions

### Infrastructure

| Decision | Chose | Over | Why |
|----------|-------|------|-----|
| Builtin format | TS object literals | Keep YAML with Node.js parser | Eliminates `?raw` dependency; zero runtime parsing; type-safe at compile time |
| NodeFileSystem loading | Dynamic `await import()` in factory | Static import + tree-shaking | Guarantees `node:fs` never enters browser bundle regardless of bundler behavior |
| CLI build tool | Dedicated `vite.config.cli.ts` | esbuild/tsup standalone | Reuses existing Vite infrastructure, path aliases, and plugin ecosystem |
| CLI output format | Dual JSON/human with `--json` flag | JSON-only or human-only | CLI is both human-operated and AI-consumable (I6 preparation) |

### Architecture

| Decision | Chose | Over | Why |
|----------|-------|------|-----|
| CLI store access | Direct `useStore.getState()` calls | Separate CLI data layer | Stores are the single source of truth; no duplication, guaranteed consistency |
| FilePicker testability | Dependency injection (`setFilePicker`) | `vi.mock` for the module | Cleaner test setup, explicit in the code, avoids Vitest mock hoisting quirks |
| save() fallthrough | `save()` → `saveAs()` when `fs` is null | Throw error when no project open | Better UX: user can Cmd+S on a new project and get prompted for location |

### Execution

| Decision | Chose | Over | Why |
|----------|-------|------|-----|
| Parallel execution | 4 groups via git worktrees | Sequential task-by-task | Maximized throughput; non-overlapping write sets enabled safe parallelism |
| Merge strategy | Merge worktree branches into main sequentially | Rebase or squash | Preserved per-task commit history; conflicts were minimal and localized to `src/cli/index.ts` |

## Retrospective

- **What went well** — The 10-task decomposition with dependency graph worked cleanly. Worktree isolation prevented cross-task interference, and the only merge conflicts were in `src/cli/index.ts` (expected — all command tasks modify it). The store-as-single-source-of-truth pattern paid off: the CLI reuses 100% of the UI's data layer with zero adaptation code. Test count grew from 460 to 616 with no regressions at any merge point. The post-merge code review loop caught real bugs (keyboard shortcut, path traversal) before they shipped.

- **What didn't** — The builtin YAML→TS conversion produced 32 mechanical files that exceeded the task-decomposition file cap (10). The cap is designed for logic-heavy tasks; mechanical data conversions need different treatment. Also, each subagent independently merged main into its worktree, which added overhead and occasionally led to redundant fix-ups (T10 re-fixed `add-node.ts` args type that was already fixed in main).

- **Lessons** — (1) For mechanical bulk conversions, the file-count cap should be relaxed with an explicit note. (2) Worktree merges should be done in dependency order to minimize conflicts. (3) The `src/cli/index.ts` file is a natural merge-conflict magnet since every command task modifies it — consider splitting command registration into per-command self-registration in the future. (4) `tsconfig.json` `include: ["src"]` causes IDE diagnostics for test files using `@/` aliases, but this is cosmetic — Vitest handles resolution correctly.

- **Notes for future** — `fileStore.saveAll` still has no partial-failure handling (known gap from I10). The Tauri `FilePicker` is a stub (Tauri dialog package not installed). `recentProjects` on web are informational only (handles not restorable from localStorage). The CLI binary at `dist/cli.js` is ~125KB unminified ESM.
