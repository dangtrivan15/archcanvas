# UX Improvements Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add three independent UX improvements: Figma-style scroll-to-pan, collapsible right panel with expand strip, and project info display in menubar/statusbar.

**Architecture:** Three independent changes touching 6 files total. The scroll change is a 3-prop addition to ReactFlow. The collapsible panel adds a `rightPanelCollapsed` boolean to `uiStore` with `onResize` sync and a collapsed strip in `RightPanel`. The project info adds read-only display spans to `TopMenubar` and `StatusBar`.

**Tech Stack:** React 19, ReactFlow 12, Zustand 5, react-resizable-panels v4, Lucide React, Tailwind 4

**Spec:** `docs/specs/2026-03-19-ux-improvements-design.md`

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `src/components/canvas/Canvas.tsx` | Modify | Add 3 ReactFlow scroll/zoom props |
| `src/store/uiStore.ts` | Modify | Add `rightPanelCollapsed` boolean, update `toggleRightPanel` |
| `src/App.tsx` | Modify | Change `collapsedSize` to `"28px"`, add `onResize` callback |
| `src/components/layout/RightPanel.tsx` | Modify | Add collapsed strip with expand chevron |
| `src/components/layout/TopMenubar.tsx` | Modify | Add project name display |
| `src/components/layout/StatusBar.tsx` | Modify | Add project filename display |
| `test/unit/store/uiStore.test.ts` | Modify | Add tests for `rightPanelCollapsed` |
| `test/e2e/app-shell.spec.ts` | Modify | Add E2E tests for all 3 features |

---

### Task 1: Scroll = Pan

**Files:**
- Modify: `src/components/canvas/Canvas.tsx:252-276` (ReactFlow element)

- [ ] **Step 1: Add scroll/zoom props to ReactFlow**

In `src/components/canvas/Canvas.tsx`, add three props to the `<ReactFlow>` element (after the existing `panOnDrag` prop at line 259):

```tsx
panOnScroll
zoomOnScroll={false}
zoomOnPinch
```

These are boolean props — `panOnScroll` and `zoomOnPinch` default to `true` when present without a value. `zoomOnScroll={false}` disables the default scroll-to-zoom. ReactFlow natively handles Cmd+Scroll for zoom when `panOnScroll` is enabled.

- [ ] **Step 2: Verify build succeeds**

Run: `npm run typecheck`
Expected: No type errors

- [ ] **Step 3: Commit**

```bash
git add src/components/canvas/Canvas.tsx
git commit -m "feat: switch scroll to pan, Cmd+Scroll to zoom (Figma-style)"
```

---

### Task 2: Collapsible Detail Pane — Store

**Files:**
- Modify: `src/store/uiStore.ts`
- Modify: `test/unit/store/uiStore.test.ts`

- [ ] **Step 1: Write failing tests for rightPanelCollapsed**

Add to `test/unit/store/uiStore.test.ts` after the existing `toggleRightPanel` tests (around line 50):

Also add a Zustand state reset to the existing `beforeEach` block to prevent state leaking between tests:

```ts
beforeEach(() => {
  _resetPanelRefs();
  useUiStore.setState({ rightPanelCollapsed: false });
});
```

Then add the new tests:

```ts
it('rightPanelCollapsed defaults to false', () => {
  expect(useUiStore.getState().rightPanelCollapsed).toBe(false);
});

it('toggleRightPanel sets rightPanelCollapsed to true when collapsing', () => {
  const ref = mockPanelRef(false);
  useUiStore.getState().setRightPanelRef(ref);
  useUiStore.getState().toggleRightPanel();
  expect(useUiStore.getState().rightPanelCollapsed).toBe(true);
});

it('toggleRightPanel sets rightPanelCollapsed to false when expanding', () => {
  const ref = mockPanelRef(true);
  useUiStore.getState().setRightPanelRef(ref);
  useUiStore.getState().toggleRightPanel();
  expect(useUiStore.getState().rightPanelCollapsed).toBe(false);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- test/unit/store/uiStore.test.ts`
Expected: FAIL — `rightPanelCollapsed` is not defined on state

- [ ] **Step 3: Implement rightPanelCollapsed in uiStore**

In `src/store/uiStore.ts`:

1. Add `rightPanelCollapsed: boolean` to the `UiState` interface.
2. Initialize `rightPanelCollapsed: false` in the store.
3. Update `toggleRightPanel` to set `rightPanelCollapsed` based on the *intended* state (read before calling collapse/expand, then invert):

```ts
toggleRightPanel: () => {
  const handle = rightPanelRef?.current;
  if (!handle) return;
  const wasCollapsed = handle.isCollapsed();
  wasCollapsed ? handle.expand() : handle.collapse();
  set({ rightPanelCollapsed: !wasCollapsed });
},
```

Note: We read `isCollapsed()` *before* toggling and invert it, because the real react-resizable-panels library may update `isCollapsed()` asynchronously via React setState. The `onResize` callback in `App.tsx` provides a secondary sync as a safety net.

Also update `openRightPanel` to sync:

```ts
openRightPanel: () => {
  rightPanelRef?.current?.expand();
  set({ rightPanelCollapsed: false });
},
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- test/unit/store/uiStore.test.ts`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/store/uiStore.ts test/unit/store/uiStore.test.ts
git commit -m "feat: add rightPanelCollapsed state to uiStore"
```

---

### Task 3: Collapsible Detail Pane — UI

**Files:**
- Modify: `src/App.tsx:123-132` (right ResizablePanel)
- Modify: `src/components/layout/RightPanel.tsx`

- [ ] **Step 1: Update collapsedSize and add onResize in App.tsx**

In `src/App.tsx`, modify the right `ResizablePanel` (line 123-132):

1. Change `collapsedSize="0px"` to `collapsedSize="28px"`.
2. Add `onResize` callback to sync collapsed state when user drags the resize handle:

```tsx
<ResizablePanel
  panelRef={rightPanelRef}
  defaultSize="22%"
  minSize="180px"
  maxSize="40%"
  collapsible
  collapsedSize="28px"
  onResize={() => {
    useUiStore.setState({
      rightPanelCollapsed: rightPanelRef.current?.isCollapsed() ?? false,
    });
  }}
>
  <RightPanel />
</ResizablePanel>
```

Add `import { useUiStore }` if not already imported (it is — line 22).

- [ ] **Step 2: Add collapsed strip to RightPanel**

In `src/components/layout/RightPanel.tsx`, add the collapsed state check at the top of the component, and return a collapsed strip early when collapsed:

```tsx
import { ChevronLeft } from 'lucide-react';
// ... existing imports ...

export function RightPanel() {
  const rightPanelCollapsed = useUiStore((s) => s.rightPanelCollapsed);
  // ... existing hooks ...

  if (rightPanelCollapsed) {
    return (
      <button
        className="flex h-full w-full items-center justify-center border-l border-border bg-background text-muted-foreground hover:text-foreground"
        onClick={() => useUiStore.getState().toggleRightPanel()}
        aria-label="Expand right panel"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
    );
  }

  // ... rest of existing component unchanged ...
```

The collapsed strip is a full-height button that fills the 28px collapsed panel width.

- [ ] **Step 3: Verify build succeeds**

Run: `npm run typecheck`
Expected: No type errors

- [ ] **Step 4: Commit**

```bash
git add src/App.tsx src/components/layout/RightPanel.tsx
git commit -m "feat: add collapsible right panel with expand strip"
```

---

### Task 4: Project Info Display

**Files:**
- Modify: `src/components/layout/TopMenubar.tsx`
- Modify: `src/components/layout/StatusBar.tsx`

- [ ] **Step 1: Add project name to TopMenubar**

In `src/components/layout/TopMenubar.tsx`:

1. Add selector at the top of the component:
```tsx
const projectName = useFileStore((s) => s.project?.root.data.project?.name ?? null);
```

(`useFileStore` is already imported at line 16.)

2. Add a span between the logo `<div>` (line 25-27) and the first `<MenubarMenu>` (line 32):
```tsx
{projectName && (
  <span className="text-sm font-medium text-muted-foreground px-2 truncate max-w-[200px]">
    {projectName}
  </span>
)}
```

- [ ] **Step 2: Add project filename to StatusBar**

In `src/components/layout/StatusBar.tsx`:

1. Add selector:
```tsx
const projectFilePath = useFileStore((s) => s.project?.root.filePath ?? null);
```

2. Derive the display filename (just the last path segment):
```tsx
const fileName = projectFilePath ? projectFilePath.split('/').pop() : null;
```

3. Add after the version `<span>` (line 20), inside the left flex container:
```tsx
{fileName && (
  <span className="text-muted-foreground/60">{fileName}</span>
)}
```

Note: For E2E tests (which use `initializeEmptyProject`), the root `filePath` is `''`, so `fileName` will be falsy and nothing displays — correct behavior.

- [ ] **Step 3: Verify build succeeds**

Run: `npm run typecheck`
Expected: No type errors

- [ ] **Step 4: Commit**

```bash
git add src/components/layout/TopMenubar.tsx src/components/layout/StatusBar.tsx
git commit -m "feat: show project name in menubar and filename in status bar"
```

---

### Task 5: E2E Tests

**Files:**
- Modify: `test/e2e/app-shell.spec.ts`

- [ ] **Step 1: Add scroll-to-pan E2E test**

Add a new `test.describe` block to `test/e2e/app-shell.spec.ts`:

```ts
test.describe('scroll behavior', () => {
  test('ReactFlow is configured for pan-on-scroll', async ({ page }) => {
    await gotoApp(page);

    // ReactFlow renders panOnScroll as a class or data attribute on the container
    // Check that scrolling doesn't zoom by verifying the viewport transform stays at same scale
    const reactFlow = page.locator('.react-flow');
    const viewportBefore = await reactFlow.locator('.react-flow__viewport').getAttribute('style');

    // Scroll on the canvas
    await reactFlow.hover();
    await page.mouse.wheel(0, 200);
    await page.waitForTimeout(300);

    const viewportAfter = await reactFlow.locator('.react-flow__viewport').getAttribute('style');

    // Extract scale from transform: translate(...) scale(X)
    const scaleBefore = viewportBefore?.match(/scale\(([^)]+)\)/)?.[1] ?? '1';
    const scaleAfter = viewportAfter?.match(/scale\(([^)]+)\)/)?.[1] ?? '1';

    // Scale should NOT change (scroll = pan, not zoom)
    expect(scaleAfter).toBe(scaleBefore);
  });
});
```

- [ ] **Step 2: Add collapse toggle E2E test**

```ts
test.describe('right panel collapse', () => {
  test('right panel collapses and expands via strip', async ({ page }) => {
    await gotoApp(page);

    // Right panel should show Detail Panel heading initially
    const detailHeading = page.getByRole('heading', { name: 'Detail Panel' });
    await expect(detailHeading).toBeVisible();

    // Collapse via View menu
    await page.getByRole('menuitem', { name: 'View' }).click();
    await page.getByRole('menuitem', { name: 'Toggle Right Panel' }).click();
    await page.waitForTimeout(300);

    // Detail heading should be hidden, expand button should appear
    await expect(detailHeading).not.toBeVisible();
    const expandBtn = page.getByRole('button', { name: 'Expand right panel' });
    await expect(expandBtn).toBeVisible();

    // Click expand strip to re-open
    await expandBtn.click();
    await page.waitForTimeout(300);

    // Detail heading should be visible again
    await expect(detailHeading).toBeVisible();
  });
});
```

- [ ] **Step 3: Add project info E2E test**

```ts
test.describe('project info display', () => {
  test('shows project name in menubar', async ({ page }) => {
    await gotoApp(page);

    // initializeEmptyProject() sets name to 'Untitled Project'
    const menubar = page.locator('[data-slot="menubar"]');
    await expect(menubar.getByText('Untitled Project')).toBeVisible();
  });
});
```

Note: The status bar filename is not tested in E2E because `initializeEmptyProject` sets `filePath` to `''`, so no filename displays. This is a known gap — filename display is verified via manual testing or a future E2E test with a real project file.

- [ ] **Step 4: Run E2E tests**

Run: `npm run test:e2e:no-bridge`
Expected: All tests PASS (including new ones)

- [ ] **Step 5: Commit**

```bash
git add test/e2e/app-shell.spec.ts
git commit -m "test: add E2E tests for scroll-pan, collapse toggle, project info"
```
