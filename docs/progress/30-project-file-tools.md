# 30: Project-Scoped File Tools

> **Date**: 2026-03-21 | **Status**: Complete
> **Scope**: Six project-scoped file tools for AI providers, FileSystem interface extensions, provider-aware UI, project path guard removal

## Recap

This milestone adds the ability for AI providers to read and modify files within the user's project — a prerequisite for codebase-aware assistance like onboarding (analyzing source code to generate architecture diagrams) and code-aware chat.

Six tools were added: `read_project_file`, `write_project_file`, `update_project_file`, `list_project_files`, `glob_project_files`, and `search_project_files`. All operate through the existing `FileSystem` interface, meaning they work on every platform (Web, Tauri, Node, InMemory) without new dependencies. The `dispatchStoreAction` function was made async to support file I/O, and both providers (Claude Code via bridge relay, API Key via direct dispatch) use the same execution path.

The project path requirement was removed from three surfaces: the `chatStore` send guard (chat now works without a filesystem path), the `ChatPanel` inline path input bar (removed entirely), and the onboarding `AiSurveyStep` (project path field removed). Instead, the system prompt guides the AI to use relative-path file tools when no absolute path is available. The `AiSettingsDialog` and the onboarding page were made provider-aware — they show different settings depending on whether Claude Code or the API Key provider is active. The shared provider settings components (`ApiKeySettings`, `ClaudeCodeSettings`) were extracted into `src/components/ai/AiProviderSettings.tsx` for reuse across both surfaces.

A bug was discovered and fixed in `WebFileSystem` where the Web File System Access API rejected `"."` as a directory name in `getDirectoryHandle()`. The fix filters out `"."` segments in path resolution, affecting `list_project_files`, `glob_project_files`, and `search_project_files` on the web platform.

**What's next**: The spec deferred model selection for Claude Code to separate work (the SDK supports `Query.setModel()` but wiring it adds complexity). The v2 priority order continues with Templates, Visual Git Diff, etc.

## Decisions

| Decision | Chose | Over | Why |
|----------|-------|------|-----|
| Tool implementation | Custom tools using `FileSystem` interface | `@modelcontextprotocol/server-filesystem` | Works on all platforms via existing abstraction. No external dependency. Browser sandbox enforces project-scoping naturally |
| `update_project_file` contract | `old_string`/`new_string` replacement | Line-range, regex, or patch/diff | Self-correcting (string match vs fragile line numbers). Same pattern as Claude Code's Edit tool |
| Glob matching | Hand-rolled glob-to-regex (~30 lines) | `picomatch`/`minimatch` dependency | Browser-compatible without extra dependency. Only `*`, `**`, `?` needed |
| Path traversal guard | Shared `validateRelativePath` utility | Per-platform guards | Single enforcement point before delegation to `fs.*`. Consistent across all platforms |
| Async dispatcher | Make `dispatchStoreAction` async | Keep sync + workarounds | File operations are inherently async. All callers already handled Promise-shaped results |
| Built-in tools kept for Claude Code | `Bash`, `Read`, `Glob`, `Grep` (read-only outside project) | Drop all non-web builtins | Read-only filesystem access outside project is useful. Only `Write`/`Edit` removed |
| Settings UI | Provider-aware single dialog + shared components | Separate dialogs per provider | Single entry point (gear icon). Content swaps based on active provider. Reusable in onboarding |
| Onboarding provider settings | Extract to shared `AiProviderSettings.tsx` | Inline in each surface | Same settings needed in both `AiSettingsDialog` and `AiSurveyStep` — DRY |

## Retrospective

- **What went well** — The `FileSystem` interface abstraction paid off: adding `listEntries` and `listFilesRecursive` to the interface and implementing in all 4 platforms gave file tools universal platform support with zero new dependencies. The TDD approach caught the async migration ripple (existing dispatcher tests needed `await`) early.

- **What didn't** — The `WebFileSystem` `"."` path bug wasn't caught by unit tests because `InMemoryFileSystem` (used in all unit tests) handles `"."` implicitly. It only surfaced during manual testing with the actual Web File System Access API. The provider-aware dialog change caused E2E test failures because the default `activeProviderId` wasn't `claude-api-key` in the no-bridge E2E config — the WebSocket provider registers first and takes the active slot even when not connected.

- **Lessons** — Platform-specific edge cases (like `getDirectoryHandle(".")` rejection) need integration tests or at minimum documented assumptions. When changing what's conditionally rendered in a dialog, always check E2E tests that assert on dialog content — the rendering preconditions may have changed.
