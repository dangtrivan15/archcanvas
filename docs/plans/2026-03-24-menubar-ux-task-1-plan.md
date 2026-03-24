# Merge New/Open into "Open..." — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Merge "New Project" and "Open Project" into a single "Open..." action across all UI surfaces (menubar, command palette, project gate, keyboard shortcuts).

**Architecture:** Remove `newProject()` from fileStore (it's identical to `open()`), update all UI surfaces to use `open()` only, simplify URL param handling to `?action=open` only.

**Tech Stack:** React, Zustand, Vitest, Playwright

---

## File Structure

| File | Responsibility | Change |
|------|---------------|--------|
| `src-web/store/fileStore.ts` | Project state management | Remove `newProject()`, remove from interface |
| `src-web/components/layout/TopMenubar.tsx` | App menu bar | Replace two items with single "Open..." |
| `src-web/components/shared/CommandPalette.tsx` | Command palette actions | Merge two file actions into one |
| `src-web/components/layout/ProjectGate.tsx` | Landing screen | Single button, simplify URL params |
| `src-web/components/hooks/useAppKeyboard.ts` | Global keyboard shortcuts | No code changes needed (already correct) |
| `test/store/fileStore-newProject.test.ts` | fileStore open tests | Rename file, update to test `open()` |
| `test/unit/store/fileStore-onboarding.test.ts` | fileStore onboarding tests | Remove `newProject()` test blocks |
| `test/components/ProjectGate.test.tsx` | ProjectGate unit tests | Update for single button |
| `test/unit/components/shared/CommandPalette.test.tsx` | CommandPalette unit tests | Update mock, assertions |
| `test/e2e/app-shell.spec.ts` | E2E menu tests | Update menu item name |
| `test/e2e/canvas-operations.spec.ts` | E2E canvas tests | Update comments only |
| `test/e2e/file-operations.spec.ts` | E2E file tests | Update test name + comments |
| `test/e2e/e2e-helpers.ts` | E2E helper functions | Update comment only |

---

### Task 1: Remove `newProject()` from fileStore

**Files:**
- Modify: `src-web/store/fileStore.ts:122-160` (interface), `src-web/store/fileStore.ts:353-371` (method)

- [ ] **Step 1: Update the test file — rename and switch from `newProject()` to `open()`**

Rename `test/store/fileStore-newProject.test.ts` → `test/store/fileStore-open.test.ts`.

Replace all `newProject()` calls with `open()` and update the describe block:

```ts
// In the describe block (line 44):
describe('fileStore.open()', () => {
```

Every test that calls `useFileStore.getState().newProject()` → `useFileStore.getState().open()`.

There are 7 tests to update (lines 66, 77, 95, 112, 126, 137, 159) — each one just changes `.newProject()` to `.open()`.

- [ ] **Step 2: Run tests to verify they pass (open() already has identical behavior)**

Run: `npm test -- --run test/store/fileStore-open.test.ts`
Expected: All 7 tests PASS (since `open()` and `newProject()` are functionally identical)

- [ ] **Step 3: Remove `newProject()` from fileStore interface and implementation**

In `src-web/store/fileStore.ts`:

Remove from interface (line ~154):
```ts
  newProject: () => Promise<void>;
```

Remove the implementation (lines 353-371):
```ts
  newProject: async () => {
    // One project per tab: if a project is already loaded, open a new tab instead
    if (get().fs !== null && typeof window !== 'undefined' && typeof window.open === 'function') {
      window.open(`${window.location.origin}${window.location.pathname}?action=new`, '_blank');
      return;
    }

    const picker = getFilePicker();
    const fs = await picker.pickDirectory();
    if (!fs) return; // user cancelled

    await get().openProject(fs);

    // Update recents only on successful load (not needs_onboarding)
    if (get().status === 'loaded') {
      const projectName = get().project?.root.data.project?.name ?? 'Unknown';
      set({ recentProjects: addToRecent(get().recentProjects, projectName, projectName) });
    }
  },
```

Also update the `open()` method URL param from `?action=open` to just `?action=open` (already correct, no change needed).

- [ ] **Step 3b: Remove `newProject()` tests from fileStore-onboarding.test.ts**

In `test/unit/store/fileStore-onboarding.test.ts`:

Delete the entire `describe('newProject — onboarding flow')` block (lines 342-374). These 3 tests are now covered by `fileStore-open.test.ts` (which tests `open()` with identical behavior).

Delete the `'newProject() calls window.open when fs is already set'` test (lines 530-550). This is covered by the `open()` test at lines 507-528 in the same file.

- [ ] **Step 4: Run fileStore tests to confirm nothing broke**

Run: `npm test -- --run test/store/fileStore-open.test.ts test/unit/store/fileStore.test.ts test/unit/store/fileStore-onboarding.test.ts`
Expected: All PASS

- [ ] **Step 5: Commit**

```bash
git add test/store/fileStore-open.test.ts src-web/store/fileStore.ts test/unit/store/fileStore-onboarding.test.ts
git rm test/store/fileStore-newProject.test.ts
git commit -m "refactor: remove newProject() from fileStore, merge into open()"
```

---

### Task 2: Update TopMenubar — single "Open..." item

**Files:**
- Modify: `src-web/components/layout/TopMenubar.tsx:39-75`

- [ ] **Step 1: Replace the two menu items with single "Open..."**

In `TopMenubar.tsx`, replace lines 42-46:

```tsx
          <MenubarItem onClick={() => useFileStore.getState().newProject()}>
            New Project <MenubarShortcut>⌘N</MenubarShortcut>
          </MenubarItem>
          <MenubarItem onClick={() => useFileStore.getState().open()}>
            Open... <MenubarShortcut>⌘O</MenubarShortcut>
          </MenubarItem>
```

With:

```tsx
          <MenubarItem onClick={() => useFileStore.getState().open()}>
            Open… <MenubarShortcut>⌘O</MenubarShortcut>
          </MenubarItem>
```

Note: Use proper ellipsis character `…` instead of `...`.

- [ ] **Step 2: Update E2E test that checks for menu item name**

In `test/e2e/app-shell.spec.ts` line 61, change:

```ts
      page.getByRole("menuitem", { name: /New Project/ }),
```

To:

```ts
      page.getByRole("menuitem", { name: /Open…/ }),
```

- [ ] **Step 3: Run unit tests**

Run: `npm test -- --run`
Expected: All PASS

- [ ] **Step 4: Commit**

```bash
git add src-web/components/layout/TopMenubar.tsx test/e2e/app-shell.spec.ts
git commit -m "refactor: merge New Project + Open into single Open… menu item"
```

---

### Task 3: Update CommandPalette — single "Open..." action

**Files:**
- Modify: `src-web/components/shared/CommandPalette.tsx:129-132`
- Modify: `test/unit/components/shared/CommandPalette.test.tsx`

- [ ] **Step 1: Merge file actions in CommandPalette**

In `CommandPalette.tsx`, replace lines 129-131:

```ts
const fileActions: ActionDef[] = [
  { id: 'action:new-project', title: 'New Project', subtitle: '⌘N', icon: '📄', category: 'File', execute: () => useFileStore.getState().newProject() },
  { id: 'action:open', title: 'Open Project…', subtitle: '⌘O', icon: '📂', category: 'File', execute: () => useFileStore.getState().open() },
```

With:

```ts
const fileActions: ActionDef[] = [
  { id: 'action:open', title: 'Open…', subtitle: '⌘O', icon: '📂', category: 'File', execute: () => useFileStore.getState().open() },
```

- [ ] **Step 2: Update CommandPalette test mock and assertions**

In `test/unit/components/shared/CommandPalette.test.tsx`:

Remove `newProject` from mock (line 175):
```ts
const mockFileState = {
  project: { /* ... */ },
  getCanvas: (id: string) => mockFileState.project.canvases.get(id),
  open: vi.fn(),
  save: vi.fn(),
};
```

Update test assertion (line 368) — change `'Open Project'` to `'Open…'`:
```ts
    expect(fileGroup.textContent).toContain('Open…');
```

- [ ] **Step 3: Run CommandPalette tests**

Run: `npm test -- --run test/unit/components/shared/CommandPalette.test.tsx`
Expected: All PASS

- [ ] **Step 4: Commit**

```bash
git add src-web/components/shared/CommandPalette.tsx test/unit/components/shared/CommandPalette.test.tsx
git commit -m "refactor: merge command palette file actions into single Open…"
```

---

### Task 4: Update ProjectGate — single "Open..." button

**Files:**
- Modify: `src-web/components/layout/ProjectGate.tsx`
- Modify: `test/components/ProjectGate.test.tsx`

- [ ] **Step 1: Simplify ProjectGate URL param handling**

In `ProjectGate.tsx`, simplify the URL param effect (lines 40-44):

Replace:
```tsx
    if (action === 'open') {
      useFileStore.getState().open();
    } else if (action === 'new') {
      useFileStore.getState().newProject();
    }
```

With:
```tsx
    if (action === 'open') {
      useFileStore.getState().open();
    }
```

- [ ] **Step 2: Update subtitle text**

In `ProjectGate.tsx` line 79, replace:
```tsx
            Open an existing project or create a new one to get started.
```

With:
```tsx
            Open a project folder to get started.
```

- [ ] **Step 3: Replace two buttons with single "Open..." button**

In `ProjectGate.tsx`, replace the two-button block (lines 116-138):

```tsx
        <motion.div className="flex flex-col gap-3" {...fadeUp(0.24)}>
          <Shine enableOnHover color="white" opacity={0.15} duration={800}>
            <button
              className="w-64 rounded-md bg-accent px-4 py-3 text-sm font-medium text-accent-foreground transition-colors hover:bg-accent/80 disabled:opacity-50"
              onClick={() => useFileStore.getState().open()}
              disabled={status === 'loading'}
            >
              <span>Open Project</span>
              <span className="ml-2 text-xs text-accent-foreground/60">
                {'\u2318'}O
              </span>
            </button>
          </Shine>

          <Shine enableOnHover color="white" opacity={0.1} duration={800}>
            <button
              className="w-64 rounded-md border border-border bg-background px-4 py-3 text-sm font-medium text-foreground transition-colors hover:bg-accent/40 disabled:opacity-50"
              onClick={() => useFileStore.getState().newProject()}
              disabled={status === 'loading'}
            >
              New Project
            </button>
          </Shine>
        </motion.div>
```

With:

```tsx
        <motion.div className="flex flex-col gap-3" {...fadeUp(0.24)}>
          <Shine enableOnHover color="white" opacity={0.15} duration={800}>
            <button
              className="w-64 rounded-md bg-accent px-4 py-3 text-sm font-medium text-accent-foreground transition-colors hover:bg-accent/80 disabled:opacity-50"
              onClick={() => useFileStore.getState().open()}
              disabled={status === 'loading'}
            >
              <span>Open…</span>
              <span className="ml-2 text-xs text-accent-foreground/60">
                {'\u2318'}O
              </span>
            </button>
          </Shine>
        </motion.div>
```

- [ ] **Step 4: Update JSDoc comment at top of file**

Replace lines 8-17:
```tsx
/**
 * Full-screen gate shown when no project is open (fileStore.fs === null).
 *
 * Provides two actions:
 * - Open Project: picks an existing directory with .archcanvas/main.yaml
 * - New Project: picks a directory and scaffolds .archcanvas/main.yaml if needed
 *
 * Shows error state if the last open/new attempt failed.
 *
 * Also handles URL params for one-project-per-tab:
 * - ?action=open — auto-fires open() on mount
 * - ?action=new  — auto-fires newProject() on mount
 */
```

With:
```tsx
/**
 * Full-screen gate shown when no project is open (fileStore.fs === null).
 *
 * Provides a single "Open…" action that picks a directory. The system
 * auto-detects new vs existing projects by checking for .archcanvas/main.yaml.
 *
 * Shows error state if the last open attempt failed.
 *
 * Handles URL param for multi-tab flow:
 * - ?action=open — auto-fires open() on mount
 */
```

- [ ] **Step 5: Update ProjectGate tests**

In `test/components/ProjectGate.test.tsx`:

Update description test (line 31):
```ts
    expect(
      screen.getByText(/open a project folder to get started/i),
    ).toBeInTheDocument();
```

Update button test — replace "renders Open Project button" and "renders New Project button" tests (lines 36-49) with a single test:
```ts
  it('renders Open… button with keyboard hint', () => {
    render(<ProjectGate />);
    const openBtn = screen.getByRole('button', { name: /open…/i });
    expect(openBtn).toBeInTheDocument();
    expect(openBtn.textContent).toContain('\u2318');
    expect(openBtn.textContent).toContain('O');
  });
```

Update disabled test (lines 82-88):
```ts
  it('disables button when loading', () => {
    useFileStore.setState({ status: 'loading' });

    render(<ProjectGate />);
    expect(screen.getByRole('button', { name: /open…/i })).toBeDisabled();
  });
```

Update click test — replace both "calls fileStore.open()" and "calls fileStore.newProject()" tests (lines 94-112) with single:
```ts
  it('calls fileStore.open() when Open… is clicked', () => {
    const openSpy = vi.fn();
    useFileStore.setState({ open: openSpy } as any);

    render(<ProjectGate />);
    fireEvent.click(screen.getByRole('button', { name: /open…/i }));

    expect(openSpy).toHaveBeenCalledTimes(1);
  });
```

- [ ] **Step 6: Run ProjectGate tests**

Run: `npm test -- --run test/components/ProjectGate.test.tsx`
Expected: All PASS

- [ ] **Step 7: Commit**

```bash
git add src-web/components/layout/ProjectGate.tsx test/components/ProjectGate.test.tsx
git commit -m "refactor: ProjectGate uses single Open… button"
```

---

### Task 5: Update E2E tests and comments

**Files:**
- Modify: `test/e2e/canvas-operations.spec.ts` (comments only)
- Modify: `test/e2e/file-operations.spec.ts` (test name + comments)
- Modify: `test/e2e/e2e-helpers.ts` (comment only)

- [ ] **Step 1: Update E2E comments and test names**

In `test/e2e/canvas-operations.spec.ts`:
- Line 61: Change test name `"New Project resets the canvas"` → `"Reset resets the canvas"`
- Line 71: Update comment `// Reset via store (File > New Project now opens a native dialog` → `// Reset via store (File > Open… now opens a native dialog`

In `test/e2e/file-operations.spec.ts`:
- Line 75: Change test name `"New Project resets dirty state"` → `"Reset resets dirty state"`
- Line 88: Update comment same as above

In `test/e2e/e2e-helpers.ts`:
- Line 42: Update comment `* File > New Project menu click which now opens a native dialog).` → `* File > Open… menu click which now opens a native dialog).`

- [ ] **Step 2: Run the full test suite**

Run: `npm test -- --run`
Expected: All PASS

Run: `npm run test:e2e:no-bridge`
Expected: All E2E PASS

- [ ] **Step 3: Commit**

```bash
git add test/e2e/canvas-operations.spec.ts test/e2e/file-operations.spec.ts test/e2e/e2e-helpers.ts
git commit -m "chore: update E2E test names and comments for Open… merge"
```
