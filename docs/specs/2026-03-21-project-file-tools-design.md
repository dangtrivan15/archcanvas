# Project-Scoped File Tools — Design Spec

> **Date**: 2026-03-21 | **Status**: Draft
> **Scope**: Six project-scoped file tools for AI providers, FileSystem interface extensions, Claude Code built-in tool changes, provider-aware settings dialog, project path guard removal

---

## Problem

ArchCanvas AI tools currently only manipulate canvas data (nodes, edges, entities). The AI cannot read or modify the user's source code, which blocks key use cases like onboarding (analyzing a codebase to generate architecture diagrams) and code-aware assistance.

Claude Code's built-in filesystem tools (`Read`, `Write`, `Edit`, `Glob`, `Grep`, `Bash`) operate on arbitrary paths, posing a security risk. The API Key Provider (browser-only) has no filesystem access at all.

## Goals

1. Add project-scoped file tools that both providers can use
2. Remove `Write` and `Edit` from Claude Code's built-in tools (prevent writing outside project)
3. Make the settings dialog provider-aware
4. Remove the blocking project path guard from chatStore

## Decisions

| Decision | Chose | Over | Why |
|----------|-------|------|-----|
| Tool implementation | Custom tools using `FileSystem` interface | `@modelcontextprotocol/server-filesystem` | Works on all platforms (Web, Tauri, Node, InMemory) via existing abstraction. No external dependency. Browser sandbox enforces project-scoping naturally. |
| Tool namespace | `*_project_file(s)` prefix | Generic names (`read_file`) | Distinguishes from Claude Code built-in tools. Makes scoping explicit in the tool name. |
| `update_project_file` contract | `old_string`/`new_string` replacement | Line-range replacement, regex, patch/diff | Self-correcting (string match vs fragile line numbers). Same pattern as Claude Code's Edit tool. AI-friendly. |
| `search_project_files` | Regex support | Literal-only | Regex is more powerful for code search patterns. |
| Built-in tools kept | `Bash`, `Read`, `Glob`, `Grep`, `WebFetch`, `WebSearch`, `AskUserQuestion` | Drop all non-web builtins | Read-only filesystem access outside project is useful. Only `Write`/`Edit` dropped (prevent modification outside project). |
| Settings dialog | Provider-aware content | Separate dialogs per provider | Single entry point (gear icon). Content swaps based on active provider. |
| FileSystem gaps | Extend interface (add `listFilesRecursive`, `listEntries`) | Utility functions on top | Clean contract. Each platform has native support for these operations. |
| Glob matching | Hand-rolled glob-to-regex (~30 lines) | `picomatch`/`minimatch` dependency | Browser-compatible without extra dependency. Only `*`, `**`, `?` patterns needed. |
| Path traversal | Shared `validateRelativePath` utility | Per-platform guards | Single enforcement point before delegation to `fs.*`. Catches `../` traversal on all platforms consistently. |
| Async dispatcher | Make `dispatchStoreAction` async | Keep sync + workarounds | File operations are inherently async (`fs.readFile`, etc.). Clean migration, all callers already handle Promise-shaped results. |

---

## Design

### 1. New File Tools

Six tools added to the `archcanvas` MCP server, executed via `dispatchStoreAction` → `fileStore.getState().fs`. All operate on **text files only** within the opened project.

#### `read_project_file(path: string)`

Read text file contents within the opened project.

- `path`: Relative to project root (e.g., `"src/app.ts"`)
- Returns: File contents as string, capped at **2000 lines**. If truncated, appends a message indicating remaining lines.
- Errors: `FILE_NOT_FOUND` if path doesn't exist, `BINARY_FILE` if null bytes detected in first 1024 bytes
- Tool description: *"Read a text file in the opened project. Binary files are not supported."*

#### `write_project_file(path: string, content: string)`

Create or overwrite a file within the opened project.

- `path`: Relative to project root
- `content`: Full file content
- Auto-creates parent directories (handled by `FileSystem` implementations — `NodeFileSystem` and `WebFileSystem` already do this; `InMemoryFileSystem` has implicit directories)
- Returns: `{ ok: true, path }` on success

#### `update_project_file(path: string, old_string: string, new_string: string)`

Targeted string replacement within a project file.

- Reads file via `fs.readFile(path)`
- Finds `old_string` in content
- Replaces with `new_string`
- Writes back via `fs.writeFile(path, updated)`
- Errors:
  - `FILE_NOT_FOUND` — file doesn't exist
  - `STRING_NOT_FOUND` — `old_string` not found in file
  - `AMBIGUOUS_MATCH` — `old_string` matches multiple locations

#### `list_project_files(path?: string)`

List direct children of a directory within the opened project.

- `path`: Relative to project root (defaults to `"."` for root)
- Returns: Array of entries with `[FILE]`/`[DIR]` prefix and name
- Uses new `fs.listEntries(path)` method that returns both files and directories with type info

#### `glob_project_files(pattern: string, path?: string)`

Recursive filename pattern matching within the opened project.

- `pattern`: Glob pattern (e.g., `"**/*.ts"`, `"src/**/*.tsx"`)
- `path`: Base directory to search from (defaults to project root)
- Returns: Array of matching file paths relative to project root, capped at **1000 results**
- Uses `fs.listFilesRecursive(path)` + hand-rolled glob-to-regex matching
- **Ignores** by default: `node_modules`, `.git`, `dist`, `build`, `.archcanvas` directories

#### `search_project_files(query: string, path?: string, include?: string)`

Search file contents by regex pattern within the opened project.

- `query`: Regex pattern to search for
- `path`: Subdirectory to scope the search (defaults to project root)
- `include`: Optional glob filter for filenames (e.g., `"*.ts"`)
- Returns: Array of `{ path, line, content }` matches, capped at **100 matches**
- Uses `fs.listFilesRecursive(path)` → `fs.readFile()` per file → regex match per line
- Skips binary files (null-byte detection)
- **Ignores** by default: `node_modules`, `.git`, `dist`, `build`, `.archcanvas` directories

### 2. FileSystem Interface Extensions

Add two methods to `src/platform/fileSystem.ts`:

```typescript
export interface FileSystem {
  // ... existing methods ...

  /** List direct entries (files and directories) under `path`. */
  listEntries(path: string): Promise<{ name: string; type: 'file' | 'directory' }[]>;

  /** List all file paths under `path` recursively, relative to project root. */
  listFilesRecursive(path: string): Promise<string[]>;
}
```

Note: the originally-proposed `stat()` method is replaced by `listEntries()` which provides type info alongside names in a single call — more efficient than `listFiles()` + per-entry `stat()`.

Implementation per platform:

| Platform | `listEntries` | `listFilesRecursive` |
|----------|--------------|---------------------|
| **Node** | `readdir(path, { withFileTypes: true })` → map to `{ name, type }` | `readdir(path, { recursive: true, withFileTypes: true })` → filter files |
| **Web** | Async iteration over `entries()`, check `handle.kind` | Recursive async iteration, accumulate file paths |
| **Tauri** | `readDir(path)` → map `isFile`/`isDirectory` | `readDir` with recursive traversal |
| **InMemory** | Derive from Map keys — entries at `path/` prefix with no further `/` | Map key prefix scan for all keys under `path/` |

### 3. Path Traversal Protection

Add a shared utility `validateRelativePath(path: string): string` in `src/core/ai/fileToolUtils.ts`:

- Rejects paths containing `..` segments
- Rejects absolute paths (starting with `/` or drive letter)
- Normalizes separators
- Called by the dispatcher **before** delegating to `fs.*` methods
- Ensures consistent protection across all platforms (even `TauriFileSystem` which lacks its own traversal guard)

### 4. Async Dispatcher Migration

`dispatchStoreAction` must become async because file operations (`fs.readFile`, `fs.writeFile`, etc.) return Promises.

```typescript
// Before:
export function dispatchStoreAction(action: string, args: Record<string, unknown>): unknown

// After:
export async function dispatchStoreAction(action: string, args: Record<string, unknown>): Promise<unknown>
```

Existing canvas actions remain synchronous in body but are now wrapped in an async function (returns a resolved Promise — no behavioral change).

**Callers that need updating:**

- `src/core/ai/webSocketProvider.ts` — `handleStoreAction` must `await dispatchStoreAction()`
- `src/core/ai/apiKeyProvider.ts` — tool loop dispatch must `await dispatchStoreAction()`
- The bridge relay path (`RelayStoreActionFn`) already returns `Promise<StoreActionResult>`, so no change needed on the server side.

### 5. Default Ignore Patterns

`glob_project_files`, `search_project_files`, and `listFilesRecursive` respect a hardcoded default ignore list:

```typescript
const DEFAULT_IGNORE = ['node_modules', '.git', 'dist', 'build', '.archcanvas'];
```

Directories matching these names are skipped during recursive traversal. This prevents wasting tokens on irrelevant files. The ignore list is not configurable in v1.

Symlinks are followed (platform default behavior). Circular symlinks are handled by the OS.

### 6. Claude Code Built-in Tool Changes

In `src/core/ai/claudeCodeBridge.ts`, change the `tools` array:

```typescript
// Before:
tools: ['Bash', 'Read', 'Write', 'Edit', 'Glob', 'Grep', 'WebFetch', 'WebSearch', 'AskUserQuestion']

// After:
tools: ['Bash', 'Read', 'Glob', 'Grep', 'WebFetch', 'WebSearch', 'AskUserQuestion']
```

`Write` and `Edit` are removed — the AI should not modify files outside the project. Reading/searching the broader filesystem (`Read`, `Glob`, `Grep`) remains available. `Bash` is kept for general shell tasks.

The `allowedTools` list is extended with the six new MCP tool names so they are auto-approved.

### 7. System Prompt Changes

Add a section encouraging use of project file tools:

```
## Project File Tools (preferred for project files)

Use these tools to read and modify files within the opened project.
They do not require knowing the project path — all paths are relative
to the project root. Prefer these over built-in Read/Glob/Grep when
working with project files.

- **read_project_file** — Read a text file: path (string, relative to project root)
- **write_project_file** — Create/overwrite a file: path (string), content (string)
- **update_project_file** — Edit a file: path (string), old_string (string), new_string (string)
- **list_project_files** — List directory contents: path? (string, defaults to root)
- **glob_project_files** — Find files by pattern: pattern (string), path? (string)
- **search_project_files** — Search file contents: query (regex string), path? (string), include? (glob)
```

**When `projectPath` is null** (Web platform, user hasn't set a path), add:

```
## Important: No Filesystem Path Available

This project is opened via a web browser. The absolute filesystem path
is not available. Do not rely on cwd or assume any working directory.
Use the project file tools (read_project_file, etc.) which access files
relative to the project root without needing an absolute path.
```

**When `projectPath` is available** (Tauri, Node, or manually set): include `**Path:** ${projectPath}` as before. Omit entirely when null — do not fall back to `"."`.

### 8. Provider-Aware Settings Dialog

The `AiSettingsDialog` renders different content based on `activeProviderId`:

**Claude Code provider (`claude-code`):**

```
┌─ AI Settings ─────────────────────────────────┐
│                                                │
│  Project Path                                  │
│  ┌──────────────────────────────┐              │
│  │ /Users/you/projects/my-app   │  Set         │
│  └──────────────────────────────┘              │
│  Can improve context awareness, but optional.  │
│                                                │
│                                    [Close]     │
└────────────────────────────────────────────────┘
```

- **Project path**: auto-filled from `fs.getPath()` on Tauri/Node, empty on Web. User can override on any platform. Note: *"Can improve context awareness, but optional."*
- **Model dropdown**: deferred to separate work. The SDK supports `Query.setModel()` and `supportedModels()`, but integrating model switching for Claude Code adds complexity beyond this spec's scope.

**API Key provider (`claude-api-key`):**

```
┌─ AI Settings ─────────────────────────────────┐
│                                                │
│  API Key                                       │
│  ┌──────────────────────────────┐              │
│  │ sk-ant-api03-...••••••••••   │  Clear       │
│  └──────────────────────────────┘              │
│  ⚠ Key is stored in your browser's             │
│    local storage. Use your own key only.       │
│                                                │
│  Model                                         │
│  ┌──────────────────────────────┐              │
│  │ Claude Sonnet 4.6         ▼  │              │
│  └──────────────────────────────┘              │
│                                                │
│  [Test Connection]     ✓ Connected             │
│                                                │
│                                    [Close]     │
└────────────────────────────────────────────────┘
```

- Same API key + model + test connection UI as currently implemented.
- No project path field (file tools use `FileSystem` directly).

**No active provider:**

- Shows a message: *"Select an AI provider to configure settings."*

### 9. ChatPanel Changes

- **Remove** the inline project path input bar from the footer (`needsPath` section, lines 213-250)
- **Remove** the `needsPath` guard that disables the textarea
- **Remove** `projectPath` and `pathInput` state from the component
- **Keep** the gear icon button in the header

### 10. chatStore Changes

- **Remove** the `if (!projectPath)` guard in `_sendMessageInternal` (lines 119-123)
- **`assembleContext()`**: make `ProjectContext.projectPath` optional (`string | undefined`). When `fs.getPath()` returns null and user hasn't set a path, omit `projectPath` from the context entirely. Do not fall back to `"."`.
- Update `ProjectContext` type in `src/core/ai/types.ts`: `projectPath` becomes `projectPath?: string`

### 11. Execution Path

Both providers use the same tool execution path:

**Claude Code (via bridge):**
```
SDK tool call → MCP server handler → translateToolArgs()
→ relay over WebSocket → browser dispatchStoreAction (async)
→ validateRelativePath() → fileStore.getState().fs.*
→ result relayed back
```

**API Key Provider (in-browser):**
```
API response tool_use → translateToolArgs()
→ await dispatchStoreAction()
→ validateRelativePath() → fileStore.getState().fs.*
→ result back to API
```

---

## Files Changed

| File | Change |
|------|--------|
| `src/platform/fileSystem.ts` | Add `listEntries()`, `listFilesRecursive()` to interface |
| `src/platform/inMemoryFileSystem.ts` | Implement new methods |
| `src/platform/webFileSystem.ts` | Implement new methods |
| `src/platform/tauriFileSystem.ts` | Implement new methods, add path traversal guard |
| `src/platform/nodeFileSystem.ts` | Implement new methods |
| `src/core/ai/fileToolUtils.ts` | **New** — `validateRelativePath()`, glob-to-regex, default ignore list, binary detection |
| `src/core/ai/toolDefs.ts` | Add 6 new tool definitions |
| `src/core/ai/translateToolArgs.ts` | Add 6 new tool translations + `TOOL_TO_ACTION` entries |
| `src/core/ai/storeActionDispatcher.ts` | Make async, add 6 new file action dispatchers |
| `src/core/ai/mcpTools.ts` | Register 6 new MCP tools, extend `MCP_TOOL_NAMES` |
| `src/core/ai/apiKeyProvider.ts` | `await` dispatchStoreAction calls |
| `src/core/ai/webSocketProvider.ts` | `await` dispatchStoreAction in `handleStoreAction` |
| `src/core/ai/claudeCodeBridge.ts` | Remove `Write`, `Edit` from `tools` array |
| `src/core/ai/systemPrompt.ts` | Add project file tools section, conditional cwd warning |
| `src/core/ai/types.ts` | Make `ProjectContext.projectPath` optional |
| `src/store/chatStore.ts` | Remove `projectPath` guard, update `assembleContext()` |
| `src/components/AiSettingsDialog.tsx` | Provider-aware content (Claude Code: path, API Key: key + model) |
| `src/components/panels/ChatPanel.tsx` | Remove inline path input bar |

## Tests

| File | Coverage |
|------|----------|
| `test/platform/fileSystem.test.ts` | New: `listEntries`, `listFilesRecursive` for InMemory + Node |
| `test/ai/fileToolUtils.test.ts` | New: `validateRelativePath` (traversal rejection, normalization), glob-to-regex, binary detection |
| `test/ai/toolDefs.test.ts` | Update: verify 19 tools (13 existing + 6 new) |
| `test/ai/translateToolArgs.test.ts` | Update: add 6 new tool translation tests |
| `test/ai/storeActionDispatcher-file.test.ts` | New: all 6 file actions — read (+ truncation, binary rejection), write, update (success + all error cases), list, glob (+ ignore patterns), search (+ regex, include filter, result cap) |
| `test/ai/apiKeyProvider.test.ts` | Update: verify async file tool execution in tool loop |
| `test/components/AiSettingsDialog.test.tsx` | Update: provider-aware rendering (Claude Code vs API Key) |
| `test/components/chatPanel.test.tsx` | Update: verify path input removed |
| `test/e2e/project-file-tools.spec.ts` | New: E2E for file tools via mock bridge |

## Dependencies

No new dependencies. Glob pattern matching implemented via hand-rolled glob-to-regex utility (~30 lines, supporting `*`, `**`, `?` patterns). Browser-compatible.

## Scope

- ~500-600 lines production code (6 dispatchers + FileSystem extensions + tool defs + utilities + system prompt)
- ~400-500 lines tests
- 18 modified/new files, 3 new test files
- 0 new dependencies
