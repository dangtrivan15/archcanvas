# Task 2: IndexedDB Handle Store + Open Recent on Web

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:writing-plans to plan
> the implementation steps for this task.

**Scope:** Persist `FileSystemDirectoryHandle` in IndexedDB so "Open Recent" works on web
**Parent feature:** [./2026-03-24-menubar-ux-index.md](./2026-03-24-menubar-ux-index.md)

## Write Set

- Create: `src-web/platform/handleStore.ts` (~50 lines) — IndexedDB wrapper for storing/retrieving `FileSystemDirectoryHandle` objects
- Modify: `src-web/store/fileStore.ts` (~20 lines) — integrate handleStore into `addToRecent()` and add `openRecent(path: string)` method
- Modify: `src-web/components/layout/TopMenubar.tsx` (~10 lines) — wire "Open Recent" items to `openRecent()`

Test files (unlimited):
- Create: `test/platform/handleStore.test.ts` — IndexedDB store/retrieve/remove tests
- Modify: `test/store/fileStore-open.test.ts` (renamed in Task 1) — add `openRecent()` tests

## Read Set (context needed)

- `src-web/store/fileStore.ts` — `addToRecent()`, `RecentProject` type, recent projects localStorage logic (lines 20-89)
- `src-web/components/layout/TopMenubar.tsx` — current Open Recent submenu (lines 48-69)
- `src-web/platform/filePicker.ts` — `WebFilePicker` uses `showDirectoryPicker` returning a handle (lines 14-26)
- `src-web/platform/webFileSystem.ts` — `WebFileSystem` constructor takes a `FileSystemDirectoryHandle`

## Dependencies

- **Blocked by:** Task 1 (Task 1 modifies fileStore.ts and TopMenubar.tsx)
- **Blocks:** None

## Description

On web, "Open Recent" currently does nothing because `FileSystemDirectoryHandle` objects can't survive `JSON.stringify()` → localStorage. However, they **can** be persisted in IndexedDB using the browser's structured clone algorithm.

### Architecture

**New module: `handleStore.ts`**

A thin IndexedDB wrapper with three operations:
- `storeHandle(key: string, handle: FileSystemDirectoryHandle): Promise<void>` — stores a handle keyed by project path/name
- `getHandle(key: string): Promise<FileSystemDirectoryHandle | null>` — retrieves a stored handle
- `removeHandle(key: string): Promise<void>` — removes a handle (for cleanup)

Uses a single IndexedDB database (`archcanvas`) with one object store (`handles`). The key is the same `path` string used in `RecentProject`.

**fileStore integration:**

When a project is successfully loaded on web:
1. `addToRecent()` also calls `storeHandle(path, handle)` to persist the directory handle in IndexedDB
2. The `WebFileSystem` needs to expose its underlying handle — add a `getHandle(): FileSystemDirectoryHandle | null` method to the `FileSystem` interface (optional, returns null for non-web implementations)

New `openRecent(path: string)` method:
1. Retrieve handle from IndexedDB via `getHandle(path)`
2. If not found → show toast/error "Project no longer accessible" and remove from recents
3. If found → call `handle.requestPermission({ mode: 'readwrite' })` to re-authorize
4. If permission denied → show toast "Permission denied" (don't remove from recents, user might grant later)
5. If permission granted → create `WebFileSystem(handle)` and open in new tab (consistent with `open()` behavior — always new tab)

Actually, since our model is "always new tab/window", `openRecent` should open a new tab and pass the handle key. The new tab retrieves the handle from IndexedDB, re-requests permission, and loads the project. This can be done via a URL param like `?recent=<key>`.

**Tauri/Node path:** On Tauri/Node, recents already store filesystem paths. `openRecent` can directly construct a `TauriFileSystem(path)` / `NodeFileSystem(path)` — no IndexedDB needed. Platform detection determines which path to take.

### Edge cases:
- Browser may revoke handle permission after some time → `requestPermission()` re-prompts
- User deletes the directory → `openProject()` will fail with error (existing error handling covers this)
- IndexedDB not available (private browsing in some browsers) → gracefully degrade, Open Recent stays non-functional with console warning
- Multiple tabs could race on the same IndexedDB — not a real issue since we only read/write individual keys

### Acceptance criteria:
- Opening a project on web stores the handle in IndexedDB
- "Open Recent" items open the project in a new tab
- If the handle's permission expired, user is prompted to re-grant
- If the handle is not found, the item is removed from recents with a toast
- Graceful degradation when IndexedDB is unavailable
- Tauri/Node recents are unaffected (they use filesystem paths directly)
