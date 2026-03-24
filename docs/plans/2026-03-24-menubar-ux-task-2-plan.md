# IndexedDB Open Recent — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist `FileSystemDirectoryHandle` in IndexedDB so "Open Recent" works on web — opens the project in a new tab.

**Architecture:** New `handleStore.ts` module wraps IndexedDB with 3 operations (store/get/remove). `WebFileSystem` exposes its handle via `getRootHandle()`. `fileStore.open()` stores the handle after successful load. New `openRecent()` method retrieves handle, requests permission (user gesture), and opens a new tab. `ProjectGate` handles `?recent=<key>` URL param to auto-load from IndexedDB.

**Tech Stack:** IndexedDB, File System Access API, fake-indexeddb (test only)

---

## File Structure

| File | Responsibility | Change |
|------|---------------|--------|
| `src-web/platform/handleStore.ts` | IndexedDB CRUD for FileSystemDirectoryHandle | Create |
| `src-web/platform/webFileSystem.ts` | Web filesystem backed by directory handle | Add `getRootHandle()` |
| `src-web/store/fileStore.ts` | Project state management | Store handle on load, add `openRecent()` |
| `src-web/components/layout/TopMenubar.tsx` | App menu bar | Wire Open Recent items |
| `src-web/components/layout/ProjectGate.tsx` | Landing screen | Handle `?recent=<key>` URL param |
| `test/platform/handleStore.test.ts` | handleStore unit tests | Create |
| `test/store/fileStore-open.test.ts` | fileStore open tests | Add openRecent tests |
| `test/components/ProjectGate.test.tsx` | ProjectGate unit tests | Add recent URL param test |

---

### Task 1: Create handleStore.ts — IndexedDB wrapper

**Files:**
- Create: `src-web/platform/handleStore.ts`
- Create: `test/platform/handleStore.test.ts`

- [ ] **Step 1: Install fake-indexeddb for testing**

Run: `npm install -D fake-indexeddb`

- [ ] **Step 2: Write failing tests for handleStore**

Create `test/platform/handleStore.test.ts`:

```ts
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { storeHandle, getHandle, removeHandle } from '@/platform/handleStore';

// fake-indexeddb supports structured clone but not real FileSystemDirectoryHandle.
// Use plain objects as proxy — IndexedDB stores/retrieves any cloneable value.
const fakeHandle = { name: 'my-project', kind: 'directory' } as unknown as FileSystemDirectoryHandle;
const fakeHandle2 = { name: 'other-project', kind: 'directory' } as unknown as FileSystemDirectoryHandle;

beforeEach(() => {
  // Clear IndexedDB between tests
  indexedDB.deleteDatabase('archcanvas');
});

describe('handleStore', () => {
  it('stores and retrieves a handle', async () => {
    await storeHandle('my-project', fakeHandle);
    const result = await getHandle('my-project');
    expect(result).toEqual(fakeHandle);
  });

  it('returns null for missing key', async () => {
    const result = await getHandle('nonexistent');
    expect(result).toBeNull();
  });

  it('removes a handle', async () => {
    await storeHandle('my-project', fakeHandle);
    await removeHandle('my-project');
    const result = await getHandle('my-project');
    expect(result).toBeNull();
  });

  it('overwrites existing handle with same key', async () => {
    await storeHandle('my-project', fakeHandle);
    await storeHandle('my-project', fakeHandle2);
    const result = await getHandle('my-project');
    expect(result).toEqual(fakeHandle2);
  });

  it('stores multiple handles independently', async () => {
    await storeHandle('project-a', fakeHandle);
    await storeHandle('project-b', fakeHandle2);
    expect(await getHandle('project-a')).toEqual(fakeHandle);
    expect(await getHandle('project-b')).toEqual(fakeHandle2);
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npm test -- --run test/platform/handleStore.test.ts`
Expected: FAIL (module not found)

- [ ] **Step 4: Implement handleStore.ts**

Create `src-web/platform/handleStore.ts`:

```ts
const DB_NAME = 'archcanvas';
const STORE_NAME = 'handles';
const DB_VERSION = 1;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE_NAME);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function storeHandle(
  key: string,
  handle: FileSystemDirectoryHandle,
): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(handle, key);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

export async function getHandle(
  key: string,
): Promise<FileSystemDirectoryHandle | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).get(key);
    req.onsuccess = () => { db.close(); resolve(req.result ?? null); };
    req.onerror = () => { db.close(); reject(req.error); };
  });
}

export async function removeHandle(key: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(key);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test -- --run test/platform/handleStore.test.ts`
Expected: All 5 PASS

- [ ] **Step 6: Commit**

```bash
git add src-web/platform/handleStore.ts test/platform/handleStore.test.ts package.json package-lock.json
git commit -m "feat: add handleStore for IndexedDB FileSystemDirectoryHandle persistence"
```

---

### Task 2: Expose handle from WebFileSystem + store on project load

**Files:**
- Modify: `src-web/platform/webFileSystem.ts:3` (add method)
- Modify: `src-web/store/fileStore.ts:352-372` (store handle after load)

- [ ] **Step 1: Add getRootHandle() to WebFileSystem**

In `src-web/platform/webFileSystem.ts`, add after the constructor (line 4):

```ts
  getRootHandle(): FileSystemDirectoryHandle {
    return this.rootHandle;
  }
```

- [ ] **Step 2: Update fileStore.open() to store handle after successful load**

In `src-web/store/fileStore.ts`, update the `open()` method's success block (lines 365-372).

Replace:
```ts
    // Update recents only on successful load (not needs_onboarding)
    if (get().status === 'loaded') {
      const projectName = get().project?.root.data.project?.name ?? 'Unknown';
      const path = projectName;
      set({
        recentProjects: addToRecent(get().recentProjects, projectName, path),
      });
    }
```

With:
```ts
    // Update recents only on successful load (not needs_onboarding)
    if (get().status === 'loaded') {
      const projectName = get().project?.root.data.project?.name ?? 'Unknown';
      const path = fs.getPath() ?? fs.getName();
      set({
        recentProjects: addToRecent(get().recentProjects, projectName, path),
      });

      // Persist directory handle in IndexedDB for web Open Recent
      if ('getRootHandle' in fs) {
        import('../platform/handleStore')
          .then(({ storeHandle }) =>
            storeHandle(path, (fs as { getRootHandle(): FileSystemDirectoryHandle }).getRootHandle()),
          )
          .catch(() => {}); // IndexedDB unavailable — ignore
      }
    }
```

- [ ] **Step 3: Run existing fileStore tests to ensure no regression**

Run: `npm test -- --run test/store/fileStore-open.test.ts test/unit/store/fileStore.test.ts`
Expected: All PASS

- [ ] **Step 4: Commit**

```bash
git add src-web/platform/webFileSystem.ts src-web/store/fileStore.ts
git commit -m "feat: store directory handle in IndexedDB on project load"
```

---

### Task 3: Add openRecent() to fileStore + wire TopMenubar

**Files:**
- Modify: `src-web/store/fileStore.ts` (add interface method + implementation)
- Modify: `src-web/components/layout/TopMenubar.tsx:54-58` (wire click handler)

- [ ] **Step 1: Add openRecent to FileStoreState interface**

In `src-web/store/fileStore.ts`, add to the interface (after `open` on line 154):

```ts
  openRecent: (path: string) => Promise<void>;
```

- [ ] **Step 2: Implement openRecent method**

In `src-web/store/fileStore.ts`, add after the `open` method (after line 373):

```ts
  openRecent: async (path: string) => {
    const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

    if (!isTauri) {
      // Web: retrieve handle from IndexedDB
      try {
        const { getHandle, removeHandle } = await import('../platform/handleStore');
        const handle = await getHandle(path);
        if (!handle) {
          // Handle expired or deleted — remove from recents
          const recents = get().recentProjects.filter((r) => r.path !== path);
          persistRecentProjects(recents);
          set({ recentProjects: recents, error: 'Project no longer accessible. Removed from recents.' });
          return;
        }
        // Request permission (requires user gesture from the menu click)
        const perm = await (handle as FileSystemDirectoryHandle).requestPermission({ mode: 'readwrite' });
        if (perm !== 'granted') {
          set({ error: 'Permission denied. Please try again.' });
          return;
        }
        // Open in new tab — the new tab will load from IndexedDB
        window.open(
          `${window.location.origin}${window.location.pathname}?recent=${encodeURIComponent(path)}`,
          '_blank',
        );
      } catch {
        set({ error: 'Failed to open recent project.' });
      }
      return;
    }

    // Tauri: path is a filesystem path — open in new window (Task 3 will handle this)
    // For now, fall back to window.open which Task 3 will replace
    window.open(
      `${window.location.origin}${window.location.pathname}?recent=${encodeURIComponent(path)}`,
      '_blank',
    );
  },
```

- [ ] **Step 3: Wire TopMenubar Open Recent items**

In `src-web/components/layout/TopMenubar.tsx`, replace lines 52-59:

```tsx
                  <MenubarItem
                    key={rp.path}
                    onClick={() => {
                      // Recent projects are informational in web mode (C7.9) —
                      // directory handles are not restorable. This is a placeholder
                      // that will be wired to Tauri/Node re-open in a future task.
                      console.log('[TopMenubar] Open recent:', rp.name, rp.path);
                    }}
                  >
```

With:

```tsx
                  <MenubarItem
                    key={rp.path}
                    onClick={() => useFileStore.getState().openRecent(rp.path)}
                  >
```

- [ ] **Step 4: Run tests**

Run: `npm test -- --run`
Expected: All PASS

- [ ] **Step 5: Commit**

```bash
git add src-web/store/fileStore.ts src-web/components/layout/TopMenubar.tsx
git commit -m "feat: add openRecent() with IndexedDB handle retrieval and permission request"
```

---

### Task 4: Handle ?recent=<key> in ProjectGate

**Files:**
- Modify: `src-web/components/layout/ProjectGate.tsx` (URL param handling)
- Modify: `test/components/ProjectGate.test.tsx` (add test)

- [ ] **Step 1: Update ProjectGate URL param handling**

In `src-web/components/layout/ProjectGate.tsx`, update the useEffect that handles URL params.

Replace:
```tsx
    if (action === 'open') {
      useFileStore.getState().open();
    }
```

With:
```tsx
    if (action === 'open') {
      useFileStore.getState().open();
    } else if (params.get('recent')) {
      const recentKey = params.get('recent')!;
      // Load project from IndexedDB handle
      (async () => {
        try {
          const { getHandle } = await import('../../platform/handleStore');
          const handle = await getHandle(recentKey);
          if (!handle) {
            useFileStore.setState({
              status: 'error',
              error: 'Recent project no longer accessible.',
            });
            return;
          }
          // Permission should already be granted by the original tab
          const perm = await handle.requestPermission({ mode: 'readwrite' });
          if (perm !== 'granted') {
            useFileStore.setState({
              status: 'error',
              error: 'Permission denied for this project folder.',
            });
            return;
          }
          const { WebFileSystem } = await import('../../platform/webFileSystem');
          const fs = new WebFileSystem(handle);
          await useFileStore.getState().openProject(fs);
        } catch (err) {
          useFileStore.setState({
            status: 'error',
            error: `Failed to open recent project: ${err instanceof Error ? err.message : String(err)}`,
          });
        }
      })();
    }
```

- [ ] **Step 2: Update ProjectGate JSDoc to document ?recent param**

Add to the JSDoc:
```tsx
 * Handles URL params for multi-tab flow:
 * - ?action=open — auto-fires open() on mount
 * - ?recent=<key> — loads project from IndexedDB handle (web Open Recent)
```

- [ ] **Step 3: Add ProjectGate test for ?recent param**

In `test/components/ProjectGate.test.tsx`, add a test in the URL params describe block:

```ts
  it('loads from IndexedDB handle when ?recent param is present', async () => {
    Object.defineProperty(window, 'location', {
      value: { ...window.location, search: '?recent=my-project', pathname: '/' },
      writable: true,
    });

    const openProjectSpy = vi.fn();
    useFileStore.setState({ openProject: openProjectSpy } as any);

    // Mock the dynamic imports
    vi.doMock('@/platform/handleStore', () => ({
      getHandle: vi.fn().mockResolvedValue({
        requestPermission: vi.fn().mockResolvedValue('granted'),
        name: 'my-project',
      }),
    }));
    vi.doMock('@/platform/webFileSystem', () => ({
      WebFileSystem: vi.fn().mockImplementation(() => ({ getName: () => 'my-project' })),
    }));

    render(<ProjectGate />);

    // Wait for async load
    await vi.waitFor(() => {
      expect(openProjectSpy).toHaveBeenCalledTimes(1);
    });
  });
```

Note: The exact mock setup may need adjustment based on how vitest handles dynamic imports in the test environment. If `vi.doMock` doesn't work cleanly with dynamic `import()`, the test should be adapted to use module-level mocks or a different approach.

- [ ] **Step 4: Run tests**

Run: `npm test -- --run test/components/ProjectGate.test.tsx`
Expected: All PASS

- [ ] **Step 5: Run full test suite**

Run: `npm test -- --run`
Expected: All PASS

- [ ] **Step 6: Commit**

```bash
git add src-web/components/layout/ProjectGate.tsx test/components/ProjectGate.test.tsx
git commit -m "feat: ProjectGate handles ?recent URL param to load from IndexedDB"
```
