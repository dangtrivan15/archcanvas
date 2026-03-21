# Project-Scoped File Tools — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add six project-scoped file tools (read, write, update, list, glob, search) to the ArchCanvas AI tool set, make `dispatchStoreAction` async, extend the `FileSystem` interface, and make the settings dialog provider-aware.

**Architecture:** New file tool dispatchers in `storeActionDispatcher.ts` call `fileStore.getState().fs.*` methods. Shared utilities in `fileToolUtils.ts` handle path validation, glob matching, binary detection, and default ignore patterns. Both providers (Claude Code via bridge relay, API Key via direct dispatch) use the same async execution path.

**Tech Stack:** React 19, Zustand 5, Zod 4, Vitest, Playwright, TypeScript 5.9

**Spec:** `docs/specs/2026-03-21-project-file-tools-design.md`

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `src/platform/fileSystem.ts` | Modify | Add `listEntries()`, `listFilesRecursive()` to interface |
| `src/platform/inMemoryFileSystem.ts` | Modify | Implement new interface methods |
| `src/platform/nodeFileSystem.ts` | Modify | Implement new interface methods |
| `src/platform/webFileSystem.ts` | Modify | Implement new interface methods |
| `src/platform/tauriFileSystem.ts` | Modify | Implement new interface methods |
| `src/core/ai/fileToolUtils.ts` | Create | `validateRelativePath()`, `globToRegex()`, `DEFAULT_IGNORE`, `isBinaryContent()`, `truncateLines()` |
| `src/core/ai/storeActionDispatcher.ts` | Modify | Make async, add 6 file action dispatchers |
| `src/core/ai/toolDefs.ts` | Modify | Add 6 new tool definitions |
| `src/core/ai/translateToolArgs.ts` | Modify | Add 6 new entries to `TOOL_TO_ACTION` + switch cases |
| `src/core/ai/mcpTools.ts` | Modify | Register 6 new MCP tools, extend `MCP_TOOL_NAMES` |
| `src/core/ai/apiKeyProvider.ts` | Modify | `await` dispatchStoreAction calls |
| `src/core/ai/webSocketProvider.ts` | Modify | `await` dispatchStoreAction in handleStoreAction |
| `src/core/ai/claudeCodeBridge.ts` | Modify | Remove `Write`, `Edit` from `tools` array |
| `src/core/ai/systemPrompt.ts` | Modify | Add project file tools section, conditional cwd warning |
| `src/core/ai/types.ts` | Modify | Make `ProjectContext.projectPath` optional |
| `src/store/chatStore.ts` | Modify | Remove `projectPath` guard, update `assembleContext()` |
| `src/components/AiSettingsDialog.tsx` | Modify | Provider-aware content |
| `src/components/panels/ChatPanel.tsx` | Modify | Remove inline path input bar |

---

### Task 1: FileSystem Interface Extensions + InMemory Implementation

**Files:**
- Modify: `src/platform/fileSystem.ts:1-10`
- Modify: `src/platform/inMemoryFileSystem.ts:3-81`
- Create: `test/platform/fileSystem-extensions.test.ts`

- [ ] **Step 1: Write failing tests for InMemoryFileSystem extensions**

Create `test/platform/fileSystem-extensions.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryFileSystem } from '../../src/platform/inMemoryFileSystem';

describe('FileSystem extensions — InMemoryFileSystem', () => {
  let fs: InMemoryFileSystem;

  beforeEach(() => {
    fs = new InMemoryFileSystem('test');
    fs.seed({
      'src/app.ts': 'console.log("hello");',
      'src/lib/utils.ts': 'export function add(a: number, b: number) { return a + b; }',
      'src/lib/math.ts': 'export const PI = 3.14;',
      'README.md': '# Test Project',
      'package.json': '{}',
      '.git/config': '[core]',
      'node_modules/lodash/index.js': 'module.exports = {};',
    });
  });

  describe('listEntries', () => {
    it('lists direct children with type info', async () => {
      const entries = await fs.listEntries('.');
      const names = entries.map((e) => e.name);
      expect(names).toContain('src');
      expect(names).toContain('README.md');
      expect(names).toContain('package.json');
      const srcEntry = entries.find((e) => e.name === 'src');
      expect(srcEntry?.type).toBe('directory');
      const readmeEntry = entries.find((e) => e.name === 'README.md');
      expect(readmeEntry?.type).toBe('file');
    });

    it('lists subdirectory entries', async () => {
      const entries = await fs.listEntries('src');
      const names = entries.map((e) => e.name);
      expect(names).toContain('app.ts');
      expect(names).toContain('lib');
    });

    it('returns empty for nonexistent directory', async () => {
      const entries = await fs.listEntries('nonexistent');
      expect(entries).toEqual([]);
    });
  });

  describe('listFilesRecursive', () => {
    it('returns all files recursively', async () => {
      const files = await fs.listFilesRecursive('src');
      expect(files).toContain('src/app.ts');
      expect(files).toContain('src/lib/utils.ts');
      expect(files).toContain('src/lib/math.ts');
    });

    it('returns files from root', async () => {
      const files = await fs.listFilesRecursive('.');
      expect(files).toContain('README.md');
      expect(files).toContain('src/app.ts');
    });

    it('returns empty for nonexistent directory', async () => {
      const files = await fs.listFilesRecursive('nonexistent');
      expect(files).toEqual([]);
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test:unit -- --reporter verbose test/platform/fileSystem-extensions.test.ts`
Expected: FAIL — methods not found

- [ ] **Step 3: Extend FileSystem interface**

In `src/platform/fileSystem.ts`, add after `mkdir`:

```typescript
  /** List direct entries (files and directories) under `path`. */
  listEntries(path: string): Promise<{ name: string; type: 'file' | 'directory' }[]>;
  /** List all file paths under `path` recursively, relative to project root. */
  listFilesRecursive(path: string): Promise<string[]>;
```

- [ ] **Step 4: Implement in InMemoryFileSystem**

In `src/platform/inMemoryFileSystem.ts`, add implementations. The key insight: InMemoryFileSystem stores files as `Map<string, string>` keys. Directories are implicit (a key `src/app.ts` implies `src/` exists).

```typescript
async listEntries(path: string): Promise<{ name: string; type: 'file' | 'directory' }[]> {
  const prefix = path === '.' || path === '' ? '' : this.normalize(path) + '/';
  const entries = new Map<string, 'file' | 'directory'>();

  for (const key of this.files.keys()) {
    if (!key.startsWith(prefix)) continue;
    const rest = key.slice(prefix.length);
    const slashIdx = rest.indexOf('/');
    if (slashIdx === -1) {
      // Direct file child
      entries.set(rest, 'file');
    } else {
      // Directory child
      const dirName = rest.slice(0, slashIdx);
      if (!entries.has(dirName)) {
        entries.set(dirName, 'directory');
      }
    }
  }

  return [...entries.entries()].map(([name, type]) => ({ name, type }));
}

async listFilesRecursive(path: string): Promise<string[]> {
  const prefix = path === '.' || path === '' ? '' : this.normalize(path) + '/';
  const results: string[] = [];

  for (const key of this.files.keys()) {
    if (prefix === '' || key.startsWith(prefix)) {
      // Skip files under ignored directories
      const segments = key.split('/');
      if (segments.some((s) => DEFAULT_IGNORE_SET.has(s))) continue;
      results.push(key);
    }
  }

  return results.sort();
}
```

Where `DEFAULT_IGNORE_SET` is imported from `fileToolUtils` (or a shared constant). Since `InMemoryFileSystem` is in `src/platform/` and `fileToolUtils` is in `src/core/ai/`, to avoid a cross-layer dependency, define a simple ignore set inline or accept the import. Alternatively, pass the ignore list as a parameter:

```typescript
async listFilesRecursive(path: string, ignore: string[] = []): Promise<string[]> {
```

**Recommended approach**: Add an optional `ignore` parameter to the `listFilesRecursive` interface method. The dispatchers pass `DEFAULT_IGNORE` from `fileToolUtils`. The FileSystem implementations filter during traversal. This keeps the platform layer independent of the AI layer.

Update the interface in `fileSystem.ts`:

```typescript
  listFilesRecursive(path: string, ignore?: string[]): Promise<string[]>;
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm run test:unit -- --reporter verbose test/platform/fileSystem-extensions.test.ts`
Expected: PASS

- [ ] **Step 6: Implement in NodeFileSystem**

In `src/platform/nodeFileSystem.ts`, add:

```typescript
async listEntries(path: string): Promise<{ name: string; type: 'file' | 'directory' }[]> {
  const full = this.resolvePath(path === '.' ? '' : path);
  const entries = await readdir(full, { withFileTypes: true });
  return entries.map((e) => ({
    name: e.name,
    type: e.isDirectory() ? 'directory' as const : 'file' as const,
  }));
}

async listFilesRecursive(path: string, ignore: string[] = []): Promise<string[]> {
  const full = this.resolvePath(path === '.' ? '' : path);
  const ignoreSet = new Set(ignore);
  const results: string[] = [];

  async function walk(dir: string, rel: string) {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const e of entries) {
      if (ignoreSet.has(e.name)) continue;
      const entryRel = rel ? `${rel}/${e.name}` : e.name;
      if (e.isDirectory()) {
        await walk(`${dir}/${e.name}`, entryRel);
      } else if (e.isFile()) {
        results.push(entryRel);
      }
    }
  }

  await walk(full, path === '.' || path === '' ? '' : path);
  return results.sort();
}
```

- [ ] **Step 7: Implement stubs in WebFileSystem and TauriFileSystem**

In `src/platform/webFileSystem.ts`, add stub implementations using recursive `resolveDir` + `entries()`.

In `src/platform/tauriFileSystem.ts`, add stub implementations using `readDir` with recursive flag.

Both follow the same pattern as Node but using their platform APIs. For now, basic implementations that satisfy the interface.

- [ ] **Step 8: Run full test suite**

Run: `npm run test:unit`
Expected: All tests pass (no TS compilation errors from unsatisfied interface)

- [ ] **Step 9: Commit**

```bash
git add src/platform/ test/platform/fileSystem-extensions.test.ts
git commit -m "feat: extend FileSystem interface with listEntries and listFilesRecursive"
```

---

### Task 2: File Tool Utilities

**Files:**
- Create: `src/core/ai/fileToolUtils.ts`
- Create: `test/ai/fileToolUtils.test.ts`

- [ ] **Step 1: Write failing tests**

Create `test/ai/fileToolUtils.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import {
  validateRelativePath,
  globToRegex,
  isBinaryContent,
  truncateLines,
  DEFAULT_IGNORE,
  shouldIgnore,
} from '../../src/core/ai/fileToolUtils';

describe('validateRelativePath', () => {
  it('accepts simple relative paths', () => {
    expect(validateRelativePath('src/app.ts')).toBe('src/app.ts');
    expect(validateRelativePath('README.md')).toBe('README.md');
  });

  it('rejects paths with .. traversal', () => {
    expect(() => validateRelativePath('../etc/passwd')).toThrow('Path traversal');
    expect(() => validateRelativePath('src/../../etc')).toThrow('Path traversal');
  });

  it('rejects absolute paths', () => {
    expect(() => validateRelativePath('/etc/passwd')).toThrow('Absolute path');
    expect(() => validateRelativePath('C:\\Windows')).toThrow('Absolute path');
  });

  it('normalizes separators', () => {
    expect(validateRelativePath('src\\lib\\utils.ts')).toBe('src/lib/utils.ts');
  });

  it('strips leading ./', () => {
    expect(validateRelativePath('./src/app.ts')).toBe('src/app.ts');
  });
});

describe('globToRegex', () => {
  it('matches * (single segment wildcard)', () => {
    const re = globToRegex('*.ts');
    expect(re.test('app.ts')).toBe(true);
    expect(re.test('src/app.ts')).toBe(false); // * doesn't cross /
  });

  it('matches ** (recursive wildcard)', () => {
    const re = globToRegex('**/*.ts');
    expect(re.test('app.ts')).toBe(true);
    expect(re.test('src/app.ts')).toBe(true);
    expect(re.test('src/lib/utils.ts')).toBe(true);
  });

  it('matches ? (single character)', () => {
    const re = globToRegex('app.?s');
    expect(re.test('app.ts')).toBe(true);
    expect(re.test('app.js')).toBe(true);
    expect(re.test('app.css')).toBe(false);
  });

  it('matches specific directory prefix', () => {
    const re = globToRegex('src/**/*.tsx');
    expect(re.test('src/App.tsx')).toBe(true);
    expect(re.test('src/components/Chat.tsx')).toBe(true);
    expect(re.test('test/App.tsx')).toBe(false);
  });
});

describe('isBinaryContent', () => {
  it('returns false for text content', () => {
    expect(isBinaryContent('Hello, world!\nconsole.log("test");')).toBe(false);
  });

  it('returns true for content with null bytes', () => {
    expect(isBinaryContent('ELF\x00\x01\x02')).toBe(true);
  });
});

describe('truncateLines', () => {
  it('returns content unchanged if under limit', () => {
    expect(truncateLines('line1\nline2\nline3', 10)).toBe('line1\nline2\nline3');
  });

  it('truncates and adds message', () => {
    const content = Array.from({ length: 100 }, (_, i) => `line ${i + 1}`).join('\n');
    const result = truncateLines(content, 10);
    const lines = result.split('\n');
    expect(lines.length).toBe(11); // 10 lines + truncation message
    expect(lines[10]).toContain('truncated');
    expect(lines[10]).toContain('90');
  });
});

describe('shouldIgnore', () => {
  it('ignores default directories', () => {
    expect(shouldIgnore('node_modules')).toBe(true);
    expect(shouldIgnore('.git')).toBe(true);
    expect(shouldIgnore('dist')).toBe(true);
    expect(shouldIgnore('.archcanvas')).toBe(true);
  });

  it('allows normal directories', () => {
    expect(shouldIgnore('src')).toBe(false);
    expect(shouldIgnore('test')).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test:unit -- --reporter verbose test/ai/fileToolUtils.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement fileToolUtils.ts**

Create `src/core/ai/fileToolUtils.ts`:

```typescript
/**
 * Utilities for project-scoped file tools.
 * Path validation, glob matching, binary detection, output truncation.
 */

export const DEFAULT_IGNORE = ['node_modules', '.git', 'dist', 'build', '.archcanvas'];

/** Validate and normalize a relative path. Rejects traversal and absolute paths. */
export function validateRelativePath(path: string): string {
  // Normalize separators
  let normalized = path.replace(/\\/g, '/');

  // Strip leading ./
  if (normalized.startsWith('./')) {
    normalized = normalized.slice(2);
  }

  // Reject absolute paths
  if (normalized.startsWith('/') || /^[A-Za-z]:/.test(normalized)) {
    throw new Error(`Absolute path not allowed: '${path}'`);
  }

  // Reject traversal
  const segments = normalized.split('/');
  if (segments.some((s) => s === '..')) {
    throw new Error(`Path traversal not allowed: '${path}'`);
  }

  return normalized;
}

/** Convert a glob pattern to a RegExp. Supports *, **, ? */
export function globToRegex(pattern: string): RegExp {
  let regexStr = '';
  let i = 0;

  while (i < pattern.length) {
    const char = pattern[i];
    if (char === '*' && pattern[i + 1] === '*') {
      // ** matches any number of path segments
      if (pattern[i + 2] === '/') {
        regexStr += '(?:.+/)?';
        i += 3;
      } else {
        regexStr += '.*';
        i += 2;
      }
    } else if (char === '*') {
      // * matches anything except /
      regexStr += '[^/]*';
      i++;
    } else if (char === '?') {
      regexStr += '[^/]';
      i++;
    } else if (char === '.') {
      regexStr += '\\.';
      i++;
    } else {
      regexStr += char;
      i++;
    }
  }

  return new RegExp(`^${regexStr}$`);
}

/** Check if content appears to be binary (contains null bytes in first 1024 chars). */
export function isBinaryContent(content: string): boolean {
  const sample = content.slice(0, 1024);
  return sample.includes('\0');
}

/** Truncate content to maxLines, appending a truncation message. */
export function truncateLines(content: string, maxLines: number): string {
  const lines = content.split('\n');
  if (lines.length <= maxLines) return content;

  const truncated = lines.slice(0, maxLines);
  const remaining = lines.length - maxLines;
  truncated.push(`... (${remaining} more lines truncated)`);
  return truncated.join('\n');
}

/** Check if a directory name should be ignored during recursive traversal. */
export function shouldIgnore(name: string): boolean {
  return DEFAULT_IGNORE.includes(name);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test:unit -- --reporter verbose test/ai/fileToolUtils.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/core/ai/fileToolUtils.ts test/ai/fileToolUtils.test.ts
git commit -m "feat: add file tool utilities (path validation, glob, binary detection)"
```

---

### Task 3: Async Dispatcher Migration

**Files:**
- Modify: `src/core/ai/storeActionDispatcher.ts:34`
- Modify: `src/core/ai/webSocketProvider.ts:233-235`
- Modify: `src/core/ai/apiKeyProvider.ts:203`

- [ ] **Step 1: Make dispatchStoreAction async**

In `src/core/ai/storeActionDispatcher.ts:34`, change:

```typescript
// Before:
export function dispatchStoreAction(action: string, args: Record<string, unknown>): unknown {

// After:
export async function dispatchStoreAction(action: string, args: Record<string, unknown>): Promise<unknown> {
```

All existing synchronous return values are automatically wrapped in resolved Promises.

- [ ] **Step 2: Update webSocketProvider to await**

In `src/core/ai/webSocketProvider.ts:233-236`, change:

```typescript
// Before:
    let result: unknown;
    try {
      result = dispatchStoreAction(action, args);
    } catch (err) {

// After:
    let result: unknown;
    try {
      result = await dispatchStoreAction(action, args);
    } catch (err) {
```

Also make the containing method `async`. Find the method containing this code (it's the `handleStoreAction` handler inside the WebSocket `onmessage`). If it's not already async, make it async.

- [ ] **Step 3: Update apiKeyProvider to await**

In `src/core/ai/apiKeyProvider.ts:203`, change:

```typescript
// Before:
          const result = dispatchStoreAction(action, translatedArgs as Record<string, unknown>);

// After:
          const result = await dispatchStoreAction(action, translatedArgs as Record<string, unknown>);
```

- [ ] **Step 4: Run full test suite**

Run: `npm run test:unit`
Expected: All tests pass — async wrapping doesn't change behavior for sync callers

- [ ] **Step 5: Commit**

```bash
git add src/core/ai/storeActionDispatcher.ts src/core/ai/webSocketProvider.ts src/core/ai/apiKeyProvider.ts
git commit -m "refactor: make dispatchStoreAction async for file tool support"
```

---

### Task 4: File Tool Definitions + Arg Translation

**Files:**
- Modify: `src/core/ai/toolDefs.ts:135-141` (append after catalog)
- Modify: `src/core/ai/translateToolArgs.ts:12-26,41-119`
- Modify: `test/ai/toolDefs.test.ts`
- Modify: `test/ai/translateToolArgs.test.ts`

- [ ] **Step 1: Write failing tests for new tool definitions**

Update `test/ai/toolDefs.test.ts`, in the `'includes all expected tool names'` test, add:

```typescript
    expect(names).toContain('read_project_file');
    expect(names).toContain('write_project_file');
    expect(names).toContain('update_project_file');
    expect(names).toContain('list_project_files');
    expect(names).toContain('glob_project_files');
    expect(names).toContain('search_project_files');
```

Also update the count test: `expect(archCanvasToolDefs.length).toBeGreaterThanOrEqual(19);`

- [ ] **Step 2: Write failing tests for new arg translations**

Append to `test/ai/translateToolArgs.test.ts`:

```typescript
describe('file tool translations', () => {
  it('translates read_project_file', () => {
    const { action, translatedArgs } = translateToolArgs('read_project_file', { path: 'src/app.ts' });
    expect(action).toBe('readProjectFile');
    expect(translatedArgs).toEqual({ path: 'src/app.ts' });
  });

  it('translates write_project_file', () => {
    const { action, translatedArgs } = translateToolArgs('write_project_file', {
      path: 'src/new.ts', content: 'hello',
    });
    expect(action).toBe('writeProjectFile');
    expect(translatedArgs).toEqual({ path: 'src/new.ts', content: 'hello' });
  });

  it('translates update_project_file', () => {
    const { action, translatedArgs } = translateToolArgs('update_project_file', {
      path: 'src/app.ts', old_string: 'foo', new_string: 'bar',
    });
    expect(action).toBe('updateProjectFile');
    expect(translatedArgs).toEqual({ path: 'src/app.ts', oldString: 'foo', newString: 'bar' });
  });

  it('translates list_project_files', () => {
    const { action, translatedArgs } = translateToolArgs('list_project_files', { path: 'src' });
    expect(action).toBe('listProjectFiles');
    expect(translatedArgs).toEqual({ path: 'src' });
  });

  it('translates list_project_files with default path', () => {
    const { action, translatedArgs } = translateToolArgs('list_project_files', {});
    expect(action).toBe('listProjectFiles');
    expect(translatedArgs).toEqual({ path: '.' });
  });

  it('translates glob_project_files', () => {
    const { action, translatedArgs } = translateToolArgs('glob_project_files', {
      pattern: '**/*.ts', path: 'src',
    });
    expect(action).toBe('globProjectFiles');
    expect(translatedArgs).toEqual({ pattern: '**/*.ts', path: 'src' });
  });

  it('translates search_project_files', () => {
    const { action, translatedArgs } = translateToolArgs('search_project_files', {
      query: 'import.*React', path: 'src', include: '*.tsx',
    });
    expect(action).toBe('searchProjectFiles');
    expect(translatedArgs).toEqual({ query: 'import.*React', path: 'src', include: '*.tsx' });
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npm run test:unit -- --reporter verbose test/ai/toolDefs.test.ts test/ai/translateToolArgs.test.ts`
Expected: FAIL — missing tool names

- [ ] **Step 4: Add tool definitions to toolDefs.ts**

In `src/core/ai/toolDefs.ts`, append after the `catalog` entry (line 141):

```typescript
  // --- Project File Tools ---
  {
    name: 'read_project_file',
    description: 'Read a text file in the opened project. Binary files are not supported.',
    inputSchema: z.object({
      path: z.string().describe('File path relative to project root (e.g., "src/app.ts")'),
    }),
  },
  {
    name: 'write_project_file',
    description: 'Create or overwrite a file in the opened project. Auto-creates parent directories.',
    inputSchema: z.object({
      path: z.string().describe('File path relative to project root'),
      content: z.string().describe('Full file content'),
    }),
  },
  {
    name: 'update_project_file',
    description: 'Edit a file by replacing a specific string. Provide enough surrounding context in old_string to make the match unique.',
    inputSchema: z.object({
      path: z.string().describe('File path relative to project root'),
      old_string: z.string().describe('Exact text to find (must be unique in the file)'),
      new_string: z.string().describe('Replacement text'),
    }),
  },
  {
    name: 'list_project_files',
    description: 'List direct children (files and directories) of a directory in the opened project.',
    inputSchema: z.object({
      path: z.string().optional().describe('Directory path relative to project root (defaults to root)'),
    }),
  },
  {
    name: 'glob_project_files',
    description: 'Find files by glob pattern in the opened project. Supports *, **, ? wildcards.',
    inputSchema: z.object({
      pattern: z.string().describe('Glob pattern (e.g., "**/*.ts", "src/**/*.tsx")'),
      path: z.string().optional().describe('Base directory to search from (defaults to root)'),
    }),
  },
  {
    name: 'search_project_files',
    description: 'Search file contents by regex pattern in the opened project.',
    inputSchema: z.object({
      query: z.string().describe('Regex pattern to search for'),
      path: z.string().optional().describe('Subdirectory to scope the search (defaults to root)'),
      include: z.string().optional().describe('Glob filter for filenames (e.g., "*.ts")'),
    }),
  },
```

- [ ] **Step 5: Add translations to translateToolArgs.ts**

In the `TOOL_TO_ACTION` map (`src/core/ai/translateToolArgs.ts:12-26`), add:

```typescript
  read_project_file: 'readProjectFile',
  write_project_file: 'writeProjectFile',
  update_project_file: 'updateProjectFile',
  list_project_files: 'listProjectFiles',
  glob_project_files: 'globProjectFiles',
  search_project_files: 'searchProjectFiles',
```

In the switch statement, add cases before the default:

```typescript
    // --- Project File Tools ---
    case 'read_project_file':
      return { action, translatedArgs: { path: args.path } };

    case 'write_project_file':
      return { action, translatedArgs: { path: args.path, content: args.content } };

    case 'update_project_file':
      return { action, translatedArgs: {
        path: args.path, oldString: args.old_string, newString: args.new_string,
      }};

    case 'list_project_files':
      return { action, translatedArgs: { path: (args.path as string) ?? '.' } };

    case 'glob_project_files':
      return { action, translatedArgs: {
        pattern: args.pattern, path: (args.path as string) ?? '.',
      }};

    case 'search_project_files':
      return { action, translatedArgs: {
        query: args.query, path: (args.path as string) ?? '.',
        ...(args.include !== undefined && { include: args.include }),
      }};
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npm run test:unit -- --reporter verbose test/ai/toolDefs.test.ts test/ai/translateToolArgs.test.ts`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/core/ai/toolDefs.ts src/core/ai/translateToolArgs.ts test/ai/toolDefs.test.ts test/ai/translateToolArgs.test.ts
git commit -m "feat: add project file tool definitions and arg translations"
```

---

### Task 5: File Action Dispatchers

**Files:**
- Modify: `src/core/ai/storeActionDispatcher.ts:35-76`
- Create: `test/ai/storeActionDispatcher-file.test.ts`

- [ ] **Step 1: Write failing tests for file dispatchers**

Create `test/ai/storeActionDispatcher-file.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { enablePatches } from 'immer';
import { useFileStore } from '@/store/fileStore';
import { useRegistryStore } from '@/store/registryStore';
import { InMemoryFileSystem } from '@/platform/inMemoryFileSystem';
import { serializeCanvas } from '@/storage/yamlCodec';
import { dispatchStoreAction } from '@/core/ai/storeActionDispatcher';

enablePatches();

async function setup() {
  useFileStore.setState({
    project: null, dirtyCanvases: new Set(), status: 'idle', error: null,
  });
  const fs = new InMemoryFileSystem();
  fs.seed({
    '.archcanvas/main.yaml': serializeCanvas({
      project: { name: 'Test' }, nodes: [], edges: [],
    } as any),
    'src/app.ts': 'const greeting = "hello";\nconsole.log(greeting);',
    'src/lib/utils.ts': 'export function add(a: number, b: number) { return a + b; }',
    'README.md': '# Test',
  });
  await useFileStore.getState().openProject(fs);
  await useRegistryStore.getState().initialize();
}

describe('dispatchStoreAction — file actions', () => {
  beforeEach(setup);

  describe('readProjectFile', () => {
    it('reads an existing file', async () => {
      const result = await dispatchStoreAction('readProjectFile', { path: 'src/app.ts' });
      expect(result).toMatchObject({ ok: true });
      expect((result as any).data).toContain('hello');
    });

    it('returns error for nonexistent file', async () => {
      const result = await dispatchStoreAction('readProjectFile', { path: 'missing.ts' });
      expect(result).toMatchObject({ ok: false, error: { code: 'FILE_NOT_FOUND' } });
    });

    it('rejects path traversal', async () => {
      const result = await dispatchStoreAction('readProjectFile', { path: '../etc/passwd' });
      expect(result).toMatchObject({ ok: false, error: { code: 'INVALID_PATH' } });
    });
  });

  describe('writeProjectFile', () => {
    it('creates a new file', async () => {
      const result = await dispatchStoreAction('writeProjectFile', {
        path: 'src/new.ts', content: 'export const x = 1;',
      });
      expect(result).toMatchObject({ ok: true });
      const fs = useFileStore.getState().fs!;
      const content = await fs.readFile('src/new.ts');
      expect(content).toBe('export const x = 1;');
    });

    it('overwrites existing file', async () => {
      await dispatchStoreAction('writeProjectFile', {
        path: 'README.md', content: '# Updated',
      });
      const fs = useFileStore.getState().fs!;
      const content = await fs.readFile('README.md');
      expect(content).toBe('# Updated');
    });
  });

  describe('updateProjectFile', () => {
    it('replaces matching string', async () => {
      const result = await dispatchStoreAction('updateProjectFile', {
        path: 'src/app.ts', oldString: '"hello"', newString: '"world"',
      });
      expect(result).toMatchObject({ ok: true });
      const fs = useFileStore.getState().fs!;
      const content = await fs.readFile('src/app.ts');
      expect(content).toContain('"world"');
      expect(content).not.toContain('"hello"');
    });

    it('returns error when string not found', async () => {
      const result = await dispatchStoreAction('updateProjectFile', {
        path: 'src/app.ts', oldString: 'nonexistent', newString: 'replacement',
      });
      expect(result).toMatchObject({ ok: false, error: { code: 'STRING_NOT_FOUND' } });
    });

    it('returns error for ambiguous match', async () => {
      // Write file with duplicate content
      const fs = useFileStore.getState().fs!;
      await fs.writeFile('src/dup.ts', 'foo\nfoo\n');
      const result = await dispatchStoreAction('updateProjectFile', {
        path: 'src/dup.ts', oldString: 'foo', newString: 'bar',
      });
      expect(result).toMatchObject({ ok: false, error: { code: 'AMBIGUOUS_MATCH' } });
    });
  });

  describe('listProjectFiles', () => {
    it('lists root directory', async () => {
      const result = await dispatchStoreAction('listProjectFiles', { path: '.' }) as any;
      expect(result.entries).toBeDefined();
      const names = result.entries.map((e: any) => e.name);
      expect(names).toContain('src');
      expect(names).toContain('README.md');
    });
  });

  describe('globProjectFiles', () => {
    it('matches glob pattern', async () => {
      const result = await dispatchStoreAction('globProjectFiles', {
        pattern: '**/*.ts', path: '.',
      }) as any;
      expect(result.files).toContain('src/app.ts');
      expect(result.files).toContain('src/lib/utils.ts');
    });
  });

  describe('searchProjectFiles', () => {
    it('finds regex matches', async () => {
      const result = await dispatchStoreAction('searchProjectFiles', {
        query: 'export', path: '.',
      }) as any;
      expect(result.matches.length).toBeGreaterThan(0);
      expect(result.matches[0].path).toBe('src/lib/utils.ts');
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test:unit -- --reporter verbose test/ai/storeActionDispatcher-file.test.ts`
Expected: FAIL — unknown actions

- [ ] **Step 3: Implement file action dispatchers**

In `src/core/ai/storeActionDispatcher.ts`, add imports at top:

```typescript
import { validateRelativePath, isBinaryContent, truncateLines, globToRegex, DEFAULT_IGNORE } from './fileToolUtils';
```

Add cases to the switch statement (before `default:`):

```typescript
    // --- Project File actions ---
    case 'readProjectFile':
      return dispatchReadProjectFile(args);
    case 'writeProjectFile':
      return dispatchWriteProjectFile(args);
    case 'updateProjectFile':
      return dispatchUpdateProjectFile(args);
    case 'listProjectFiles':
      return dispatchListProjectFiles(args);
    case 'globProjectFiles':
      return dispatchGlobProjectFiles(args);
    case 'searchProjectFiles':
      return dispatchSearchProjectFiles(args);
```

Add the dispatcher functions at the end of the file:

```typescript
// ---------------------------------------------------------------------------
// Project file action dispatchers
// ---------------------------------------------------------------------------

async function dispatchReadProjectFile(args: Record<string, unknown>) {
  let path: string;
  try { path = validateRelativePath(args.path as string); }
  catch { return { ok: false, error: { code: 'INVALID_PATH', message: `Invalid path: ${args.path}` } }; }

  const fs = useFileStore.getState().fs;
  if (!fs) return { ok: false, error: { code: 'NO_FILESYSTEM', message: 'No project open' } };

  try {
    const content = await fs.readFile(path);
    if (isBinaryContent(content)) {
      return { ok: false, error: { code: 'BINARY_FILE', message: `'${path}' appears to be a binary file` } };
    }
    return { ok: true, data: truncateLines(content, 2000) };
  } catch {
    return { ok: false, error: { code: 'FILE_NOT_FOUND', message: `File '${path}' not found` } };
  }
}

async function dispatchWriteProjectFile(args: Record<string, unknown>) {
  let path: string;
  try { path = validateRelativePath(args.path as string); }
  catch { return { ok: false, error: { code: 'INVALID_PATH', message: `Invalid path: ${args.path}` } }; }

  const fs = useFileStore.getState().fs;
  if (!fs) return { ok: false, error: { code: 'NO_FILESYSTEM', message: 'No project open' } };

  await fs.writeFile(path, args.content as string);
  return { ok: true, data: { path } };
}

async function dispatchUpdateProjectFile(args: Record<string, unknown>) {
  let path: string;
  try { path = validateRelativePath(args.path as string); }
  catch { return { ok: false, error: { code: 'INVALID_PATH', message: `Invalid path: ${args.path}` } }; }

  const fs = useFileStore.getState().fs;
  if (!fs) return { ok: false, error: { code: 'NO_FILESYSTEM', message: 'No project open' } };

  let content: string;
  try { content = await fs.readFile(path); }
  catch { return { ok: false, error: { code: 'FILE_NOT_FOUND', message: `File '${path}' not found` } }; }

  const oldString = args.oldString as string;
  const newString = args.newString as string;
  const firstIdx = content.indexOf(oldString);
  if (firstIdx === -1) {
    return { ok: false, error: { code: 'STRING_NOT_FOUND', message: `String not found in '${path}'` } };
  }
  const secondIdx = content.indexOf(oldString, firstIdx + 1);
  if (secondIdx !== -1) {
    return { ok: false, error: { code: 'AMBIGUOUS_MATCH', message: `String matches multiple locations in '${path}'. Provide more surrounding context.` } };
  }

  const updated = content.slice(0, firstIdx) + newString + content.slice(firstIdx + oldString.length);
  await fs.writeFile(path, updated);
  return { ok: true, data: { path } };
}

async function dispatchListProjectFiles(args: Record<string, unknown>) {
  let path = (args.path as string) ?? '.';
  if (path !== '.') {
    try { path = validateRelativePath(path); }
    catch { return { ok: false, error: { code: 'INVALID_PATH', message: `Invalid path: ${args.path}` } }; }
  }

  const fs = useFileStore.getState().fs;
  if (!fs) return { ok: false, error: { code: 'NO_FILESYSTEM', message: 'No project open' } };

  const entries = await fs.listEntries(path);
  return { entries: entries.map((e) => ({ name: e.name, type: e.type })) };
}

async function dispatchGlobProjectFiles(args: Record<string, unknown>) {
  const pattern = args.pattern as string;
  let basePath = (args.path as string) ?? '.';
  if (basePath !== '.') {
    try { basePath = validateRelativePath(basePath); }
    catch { return { ok: false, error: { code: 'INVALID_PATH', message: `Invalid path: ${args.path}` } }; }
  }

  const fs = useFileStore.getState().fs;
  if (!fs) return { ok: false, error: { code: 'NO_FILESYSTEM', message: 'No project open' } };

  const allFiles = await fs.listFilesRecursive(basePath, DEFAULT_IGNORE);
  const regex = globToRegex(pattern);
  const matched = allFiles.filter((f) => {
    // Match against path relative to basePath
    const rel = basePath === '.' ? f : f.startsWith(basePath + '/') ? f.slice(basePath.length + 1) : f;
    return regex.test(rel);
  });

  return { files: matched.slice(0, 1000) };
}

async function dispatchSearchProjectFiles(args: Record<string, unknown>) {
  const query = args.query as string;
  let basePath = (args.path as string) ?? '.';
  if (basePath !== '.') {
    try { basePath = validateRelativePath(basePath); }
    catch { return { ok: false, error: { code: 'INVALID_PATH', message: `Invalid path: ${args.path}` } }; }
  }
  const include = args.include as string | undefined;

  const fs = useFileStore.getState().fs;
  if (!fs) return { ok: false, error: { code: 'NO_FILESYSTEM', message: 'No project open' } };

  let regex: RegExp;
  try { regex = new RegExp(query); }
  catch { return { ok: false, error: { code: 'INVALID_REGEX', message: `Invalid regex: ${query}` } }; }

  const includeRegex = include ? globToRegex(include) : null;
  const allFiles = await fs.listFilesRecursive(basePath, DEFAULT_IGNORE);

  const matches: { path: string; line: number; content: string }[] = [];

  for (const filePath of allFiles) {
    if (includeRegex && !includeRegex.test(filePath.split('/').pop()!)) continue;
    if (matches.length >= 100) break;

    let content: string;
    try { content = await fs.readFile(filePath); } catch { continue; }
    if (isBinaryContent(content)) continue;

    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (regex.test(lines[i])) {
        matches.push({ path: filePath, line: i + 1, content: lines[i] });
        if (matches.length >= 100) break;
      }
    }
  }

  return { matches };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test:unit -- --reporter verbose test/ai/storeActionDispatcher-file.test.ts`
Expected: PASS

- [ ] **Step 5: Run full AI test suite for regressions**

Run: `npm run test:unit -- --reporter verbose test/ai/`
Expected: All tests pass

- [ ] **Step 6: Commit**

```bash
git add src/core/ai/storeActionDispatcher.ts test/ai/storeActionDispatcher-file.test.ts
git commit -m "feat: implement 6 project file action dispatchers"
```

---

### Task 6: MCP Tool Registration

**Files:**
- Modify: `src/core/ai/mcpTools.ts:152-171`

- [ ] **Step 1: Register new MCP tools**

In `src/core/ai/mcpTools.ts`, after the `catalog` tool registration (line 157), add the 6 new tool registrations following the same pattern:

```typescript
      // --- Project File Tools ---
      tool('read_project_file', 'Read a text file in the opened project. Binary files are not supported.', {
        path: z.string().describe('File path relative to project root'),
      }, async (a) => {
        const { action, translatedArgs } = translateToolArgs('read_project_file', a);
        return toCallToolResult(await relay(action, translatedArgs));
      }),

      tool('write_project_file', 'Create or overwrite a file in the opened project. Auto-creates parent directories.', {
        path: z.string().describe('File path relative to project root'),
        content: z.string().describe('Full file content'),
      }, async (a) => {
        const { action, translatedArgs } = translateToolArgs('write_project_file', a);
        return toCallToolResult(await relay(action, translatedArgs));
      }),

      tool('update_project_file', 'Edit a file by replacing a specific string. Provide enough context in old_string to make the match unique.', {
        path: z.string().describe('File path relative to project root'),
        old_string: z.string().describe('Exact text to find'),
        new_string: z.string().describe('Replacement text'),
      }, async (a) => {
        const { action, translatedArgs } = translateToolArgs('update_project_file', a);
        return toCallToolResult(await relay(action, translatedArgs));
      }),

      tool('list_project_files', 'List direct children (files and directories) of a directory in the opened project.', {
        path: z.string().optional().describe('Directory path relative to project root (defaults to root)'),
      }, async (a) => {
        const { action, translatedArgs } = translateToolArgs('list_project_files', a);
        return toCallToolResult(await relay(action, translatedArgs));
      }),

      tool('glob_project_files', 'Find files by glob pattern in the opened project. Supports *, **, ? wildcards.', {
        pattern: z.string().describe('Glob pattern (e.g., "**/*.ts")'),
        path: z.string().optional().describe('Base directory (defaults to root)'),
      }, async (a) => {
        const { action, translatedArgs } = translateToolArgs('glob_project_files', a);
        return toCallToolResult(await relay(action, translatedArgs));
      }),

      tool('search_project_files', 'Search file contents by regex pattern in the opened project.', {
        query: z.string().describe('Regex pattern to search for'),
        path: z.string().optional().describe('Subdirectory scope (defaults to root)'),
        include: z.string().optional().describe('Glob filter for filenames (e.g., "*.ts")'),
      }, async (a) => {
        const { action, translatedArgs } = translateToolArgs('search_project_files', a);
        return toCallToolResult(await relay(action, translatedArgs));
      }),
```

- [ ] **Step 2: Extend MCP_TOOL_NAMES**

In `src/core/ai/mcpTools.ts`, update the `MCP_TOOL_NAMES` array to include:

```typescript
  'mcp__archcanvas__read_project_file',
  'mcp__archcanvas__write_project_file',
  'mcp__archcanvas__update_project_file',
  'mcp__archcanvas__list_project_files',
  'mcp__archcanvas__glob_project_files',
  'mcp__archcanvas__search_project_files',
```

- [ ] **Step 3: Run full test suite**

Run: `npm run test:unit`
Expected: All tests pass

- [ ] **Step 4: Commit**

```bash
git add src/core/ai/mcpTools.ts
git commit -m "feat: register 6 project file MCP tools"
```

---

### Task 7: Claude Code Built-in Tools + System Prompt

**Files:**
- Modify: `src/core/ai/claudeCodeBridge.ts:366`
- Modify: `src/core/ai/systemPrompt.ts:7-79`
- Modify: `src/core/ai/types.ts:213-218`

- [ ] **Step 1: Remove Write and Edit from built-in tools**

In `src/core/ai/claudeCodeBridge.ts:366`, change:

```typescript
// Before:
tools: ['Bash', 'Read', 'Write', 'Edit', 'Glob', 'Grep', 'WebFetch', 'WebSearch', 'AskUserQuestion'],

// After:
tools: ['Bash', 'Read', 'Glob', 'Grep', 'WebFetch', 'WebSearch', 'AskUserQuestion'],
```

- [ ] **Step 2: Make ProjectContext.projectPath optional**

In `src/core/ai/types.ts:213-218`, change:

```typescript
// Before:
export interface ProjectContext {
  projectName: string;
  projectDescription?: string;
  currentScope: string;
  projectPath: string;
}

// After:
export interface ProjectContext {
  projectName: string;
  projectDescription?: string;
  currentScope: string;
  projectPath?: string;
}
```

- [ ] **Step 3: Update system prompt**

In `src/core/ai/systemPrompt.ts`, update `buildSystemPrompt`:

1. Make the `**Path:**` line conditional:

```typescript
    ...(context.projectPath
      ? [`- **Path:** ${context.projectPath}`]
      : []),
```

2. Add the project file tools section after the "Read Tools" section:

```typescript
    ``,
    `### Project File Tools (preferred for project files)`,
    ``,
    `Use these to read and modify files within the opened project.`,
    `All paths are relative to the project root — no absolute path needed.`,
    `Prefer these over built-in Read/Glob/Grep for project files.`,
    ``,
    `- **read_project_file** — Read a text file: path (string)`,
    `- **write_project_file** — Create/overwrite a file: path (string), content (string)`,
    `- **update_project_file** — Edit a file: path (string), old_string (string), new_string (string)`,
    `- **list_project_files** — List directory contents: path? (string, defaults to root)`,
    `- **glob_project_files** — Find files by pattern: pattern (string), path? (string)`,
    `- **search_project_files** — Search file contents: query (regex), path? (string), include? (glob)`,
```

3. Add conditional cwd warning when `projectPath` is absent:

```typescript
    ...(!context.projectPath ? [
      ``,
      `## Important: No Filesystem Path Available`,
      ``,
      `This project is opened via a web browser. The absolute filesystem path`,
      `is not available. Do not rely on cwd or assume any working directory.`,
      `Use the project file tools which access files relative to the project root.`,
    ] : []),
```

- [ ] **Step 4: Run full test suite**

Run: `npm run test:unit`
Expected: All tests pass (some bridge tests may need updating for the removed tools)

- [ ] **Step 5: Commit**

```bash
git add src/core/ai/claudeCodeBridge.ts src/core/ai/systemPrompt.ts src/core/ai/types.ts
git commit -m "feat: update built-in tools, system prompt, and ProjectContext for file tools"
```

---

### Task 8: chatStore + ChatPanel Changes

**Files:**
- Modify: `src/store/chatStore.ts:60-77,117-123`
- Modify: `src/components/panels/ChatPanel.tsx:23-24,67-68,213-250`

- [ ] **Step 1: Remove projectPath guard from chatStore**

In `src/store/chatStore.ts:117-123`, remove:

```typescript
    // Guard: project path required for AI CWD
    const projectPath = useFileStore.getState().projectPath;
    if (!projectPath) {
      set({ error: 'Project path is required for AI chat. Set it in project settings.' });
      return;
    }
```

- [ ] **Step 2: Update assembleContext**

In `src/store/chatStore.ts:60-77`, change:

```typescript
// Before:
  const projectPath = fileState.projectPath ?? '.';

// After:
  const projectPath = fileState.projectPath ?? undefined;
```

And update the return to conditionally include `projectPath`:

```typescript
  return {
    projectName,
    projectDescription,
    currentScope,
    ...(projectPath ? { projectPath } : {}),
  };
```

- [ ] **Step 3: Remove path input from ChatPanel**

In `src/components/panels/ChatPanel.tsx`:

1. Remove import of `useFileStore` (line 5, if only used for projectPath)
2. Remove `projectPath` state (line 23): `const projectPath = useFileStore((s) => s.projectPath);`
3. Remove `pathInput` state (line 24): `const [pathInput, setPathInput] = useState('');`
4. Remove `needsPath` (line 67): `const needsPath = !projectPath && !!activeProvider?.available;`
5. Update `canSend` (line 68): remove `&& !needsPath`
6. Remove the entire path input bar JSX (lines 213-250): `{needsPath && (...)}` block
7. Remove `needsPath` from textarea disabled prop (line 262): remove `|| needsPath`

Note: Keep the `useFileStore` import if it's used elsewhere in ChatPanel (check for other references first).

- [ ] **Step 4: Run full test suite**

Run: `npm run test:unit`
Expected: All tests pass. Some chatPanel tests may need updating to remove path-related assertions.

- [ ] **Step 5: Commit**

```bash
git add src/store/chatStore.ts src/components/panels/ChatPanel.tsx
git commit -m "feat: remove projectPath guard and inline path input from chat"
```

---

### Task 9: Provider-Aware Settings Dialog

**Files:**
- Modify: `src/components/AiSettingsDialog.tsx:14-185`
- Modify: `test/components/AiSettingsDialog.test.tsx`

- [ ] **Step 1: Update AiSettingsDialog to be provider-aware**

Refactor `src/components/AiSettingsDialog.tsx` to render different content based on the active provider:

```typescript
import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Settings, Check, X, Loader2, AlertTriangle } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { useUiStore } from '@/store/uiStore';
import { useApiKeyStore, AVAILABLE_MODELS } from '@/store/apiKeyStore';
import { useChatStore } from '@/store/chatStore';
import { useFileStore } from '@/store/fileStore';
```

Add `activeProviderId` to the component:

```typescript
  const activeProviderId = useChatStore((s) => s.activeProviderId);
```

Then conditionally render:
- If `activeProviderId === 'claude-api-key'`: show API key + model + test connection (existing content)
- If `activeProviderId` is any other value (e.g., `'claude-code'`): show project path input with note
- If no active provider: show "Select an AI provider to configure settings"

For the Claude Code panel, add project path input:

```typescript
function ClaudeCodeSettings() {
  const projectPath = useFileStore((s) => s.projectPath);
  const fsPath = useFileStore((s) => s.fs?.getPath() ?? null);
  const [pathInput, setPathInput] = useState(projectPath ?? fsPath ?? '');

  const handleSetPath = () => {
    if (pathInput.trim()) {
      useFileStore.getState().setProjectPath(pathInput.trim());
    }
  };

  return (
    <div className="space-y-2">
      <label htmlFor="project-path-input" className="text-sm font-medium">
        Project Path
      </label>
      <div className="flex gap-2">
        <input
          id="project-path-input"
          type="text"
          className="flex-1 rounded-md border border-border bg-surface px-3 py-1.5 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-primary"
          placeholder="/Users/you/projects/my-app"
          value={pathInput}
          onChange={(e) => setPathInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleSetPath(); }}
        />
        <button
          className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:opacity-90"
          onClick={handleSetPath}
          disabled={!pathInput.trim()}
        >
          Set
        </button>
      </div>
      <p className="text-xs text-muted-foreground">
        Can improve context awareness, but optional.
      </p>
    </div>
  );
}
```

- [ ] **Step 2: Update tests**

Update `test/components/AiSettingsDialog.test.tsx` to test provider-aware rendering:

```typescript
  it('shows API key settings when API key provider is active', () => {
    // Mock activeProviderId = 'claude-api-key'
    render(<AiSettingsDialog />);
    expect(screen.getByLabelText(/api key/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/model/i)).toBeInTheDocument();
  });

  it('shows project path when Claude Code provider is active', () => {
    // Mock activeProviderId = 'claude-code'
    render(<AiSettingsDialog />);
    expect(screen.getByLabelText(/project path/i)).toBeInTheDocument();
    expect(screen.getByText(/context awareness/i)).toBeInTheDocument();
  });

  it('shows message when no provider is active', () => {
    // Mock activeProviderId = null
    render(<AiSettingsDialog />);
    expect(screen.getByText(/select.*provider/i)).toBeInTheDocument();
  });
```

- [ ] **Step 3: Run tests**

Run: `npm run test:unit -- --reporter verbose test/components/AiSettingsDialog.test.tsx`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/components/AiSettingsDialog.tsx test/components/AiSettingsDialog.test.tsx
git commit -m "feat: make AI settings dialog provider-aware"
```

---

### Task 10: Build Verification + E2E Test

**Files:**
- Create: `test/e2e/project-file-tools.spec.ts`

- [ ] **Step 1: Verify build**

Run: `npm run build`
Expected: Build succeeds with no TS errors

- [ ] **Step 2: Write E2E test**

Create `test/e2e/project-file-tools.spec.ts`:

```typescript
import { test, expect } from '@playwright/test';
import { gotoApp } from './e2e-helpers';

test.describe('Project File Tools', () => {
  test.beforeEach(async ({ page }) => {
    await gotoApp(page);
  });

  test('gear icon opens provider-aware settings dialog', async ({ page }) => {
    // Open chat panel
    await page.evaluate(() => {
      (window as any).__archcanvas_uiStore__.getState().toggleChat();
    });
    await page.waitForTimeout(200);

    // Click gear icon
    await page.getByRole('button', { name: /AI settings/i }).click();
    await page.waitForTimeout(200);

    // Verify dialog opens
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByText('AI Settings')).toBeVisible();
  });

  test('chat panel does not show inline path input', async ({ page }) => {
    await page.evaluate(() => {
      (window as any).__archcanvas_uiStore__.getState().toggleChat();
    });
    await page.waitForTimeout(200);

    // Verify no path input bar in chat footer
    await expect(page.locator('[data-testid="path-input-bar"]')).not.toBeVisible();
  });
});
```

- [ ] **Step 3: Run E2E tests**

Run: `npm run test:e2e-no-bridge`
Expected: All tests pass including new ones

- [ ] **Step 4: Run full unit test suite**

Run: `npm run test:unit`
Expected: All tests pass

- [ ] **Step 5: Commit**

```bash
git add test/e2e/project-file-tools.spec.ts
git commit -m "test: add E2E tests for project file tools UI changes"
```
