# I2 Review Fixes: Panel Collapsibility + Note Identity

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix two post-review gaps from I2 Canvas Rendering — make panel toggle menu items actually work, and give notes stable identity for React keys and future I5 collaboration.

**Architecture:** (1) Replace uiStore's disconnected boolean state with imperative methods backed by `PanelImperativeHandle` refs from `react-resizable-panels`. Single source of truth = the panel component itself. (2) Add optional `id` + `createdAt` to the `Note` Zod schema, generate on creation, use as React keys. (3) Use ref string as key in CodeRefsTab (trivially unique).

**Tech Stack:** react-resizable-panels v4 (`PanelImperativeHandle`, `panelRef` prop), Zod 4, `crypto.randomUUID()`, Vitest, jsdom

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `src/store/uiStore.ts` | **Rewrite** | Remove booleans, expose imperative `toggleLeftPanel()` / `toggleRightPanel()` / `openRightPanel()` backed by panel refs |
| `src/App.tsx` | **Modify** | Create `PanelImperativeHandle` refs, pass via `panelRef` prop, register refs in uiStore on mount |
| `src/components/canvas/Canvas.tsx` | **Modify** | Replace `rightPanelOpen` read + conditional toggle with `openRightPanel()` |
| `src/components/layout/TopMenubar.tsx` | **Verify only** | `toggleLeftPanel()` / `toggleRightPanel()` — same API, no change needed |
| `src/types/schema.ts` | **Modify** | Add `id` + `createdAt` optional fields to `Note` schema |
| `src/components/panels/NotesTab.tsx` | **Modify** | Generate `id`/`createdAt` on creation, use `note.id` as React key |
| `src/components/panels/CodeRefsTab.tsx` | **Modify** | Change `key={i}` to `key={ref}` |
| `test/unit/store/uiStore.test.ts` | **Create** | Test imperative toggle/open methods with mock panel refs |
| `test/unit/types/schema.test.ts` | **Modify** | Add tests for Note with id/createdAt |
| `test/unit/components/panels/NotesTab.test.tsx` | **Create** | Test that new notes get id/createdAt, key stability |

---

## Task 1: Rewrite uiStore with imperative panel refs

**Files:**
- Rewrite: `src/store/uiStore.ts`
- Create: `test/unit/store/uiStore.test.ts`

### Context to read first
- `src/store/uiStore.ts` — current store (15 lines, two booleans + toggles)
- `src/components/canvas/Canvas.tsx:130-162` — three `rightPanelOpen` read sites
- `src/components/layout/TopMenubar.tsx:67-70` — two toggle call sites
- `node_modules/react-resizable-panels/dist/react-resizable-panels.d.ts:203-228` — `PanelImperativeHandle` interface

### Design

The new uiStore holds refs to left and right panel handles, not booleans. Methods call the imperative API directly. No bidirectional sync needed because the panel *is* the truth.

```typescript
// src/store/uiStore.ts
import { create } from 'zustand';
import type { PanelImperativeHandle } from 'react-resizable-panels';

interface UiState {
  // Ref registration — called once from App.tsx on mount
  setLeftPanelRef: (ref: PanelImperativeHandle | null) => void;
  setRightPanelRef: (ref: PanelImperativeHandle | null) => void;

  // Actions — safe to call before refs are set (no-op)
  toggleLeftPanel: () => void;
  toggleRightPanel: () => void;
  openRightPanel: () => void;
}
```

The `openRightPanel()` method is a convenience for the three call sites in Canvas.tsx that do `if (!open) toggle()` — it calls `expand()` which is already a no-op if the panel isn't collapsed.

### Steps

- [ ] **Step 1: Write failing tests for uiStore**

Create `test/unit/store/uiStore.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { useUiStore, _resetPanelRefs } from '@/store/uiStore';
import type { PanelImperativeHandle } from 'react-resizable-panels';

function mockPanelRef(collapsed = false): PanelImperativeHandle {
  let _collapsed = collapsed;
  return {
    collapse: () => { _collapsed = true; },
    expand: () => { _collapsed = false; },
    getSize: () => ({ asPercentage: _collapsed ? 0 : 20, inPixels: _collapsed ? 0 : 300 }),
    isCollapsed: () => _collapsed,
    resize: (_size: number | string) => {},
  };
}

describe('uiStore', () => {
  beforeEach(() => {
    // Reset module-level refs between tests. Do NOT call useUiStore.setState({}, true)
    // — the store only contains functions (no primitive state), and wiping them
    // would make all methods undefined.
    _resetPanelRefs();
  });

  it('toggleLeftPanel collapses an expanded panel', () => {
    const ref = mockPanelRef(false);
    useUiStore.getState().setLeftPanelRef(ref);
    useUiStore.getState().toggleLeftPanel();
    expect(ref.isCollapsed()).toBe(true);
  });

  it('toggleLeftPanel expands a collapsed panel', () => {
    const ref = mockPanelRef(true);
    useUiStore.getState().setLeftPanelRef(ref);
    useUiStore.getState().toggleLeftPanel();
    expect(ref.isCollapsed()).toBe(false);
  });

  it('toggleRightPanel collapses an expanded panel', () => {
    const ref = mockPanelRef(false);
    useUiStore.getState().setRightPanelRef(ref);
    useUiStore.getState().toggleRightPanel();
    expect(ref.isCollapsed()).toBe(true);
  });

  it('toggleRightPanel expands a collapsed panel', () => {
    const ref = mockPanelRef(true);
    useUiStore.getState().setRightPanelRef(ref);
    useUiStore.getState().toggleRightPanel();
    expect(ref.isCollapsed()).toBe(false);
  });

  it('openRightPanel expands a collapsed panel', () => {
    const ref = mockPanelRef(true);
    useUiStore.getState().setRightPanelRef(ref);
    useUiStore.getState().openRightPanel();
    expect(ref.isCollapsed()).toBe(false);
  });

  it('openRightPanel is a no-op if already expanded', () => {
    const ref = mockPanelRef(false);
    useUiStore.getState().setRightPanelRef(ref);
    useUiStore.getState().openRightPanel();
    expect(ref.isCollapsed()).toBe(false);
  });

  it('toggle methods are safe to call before refs are set', () => {
    // Should not throw
    useUiStore.getState().toggleLeftPanel();
    useUiStore.getState().toggleRightPanel();
    useUiStore.getState().openRightPanel();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run test/unit/store/uiStore.test.ts`
Expected: FAIL — uiStore doesn't have `setLeftPanelRef` etc.

- [ ] **Step 3: Rewrite uiStore implementation**

Replace `src/store/uiStore.ts` entirely:

```typescript
import { create } from 'zustand';
import type { PanelImperativeHandle } from 'react-resizable-panels';

interface UiState {
  setLeftPanelRef: (ref: PanelImperativeHandle | null) => void;
  setRightPanelRef: (ref: PanelImperativeHandle | null) => void;
  toggleLeftPanel: () => void;
  toggleRightPanel: () => void;
  openRightPanel: () => void;
}

// Refs stored outside Zustand state — they're mutable handles, not
// serializable state. Zustand only exposes the methods that act on them.
let leftPanelRef: PanelImperativeHandle | null = null;
let rightPanelRef: PanelImperativeHandle | null = null;

export const useUiStore = create<UiState>(() => ({
  setLeftPanelRef: (ref) => { leftPanelRef = ref; },
  setRightPanelRef: (ref) => { rightPanelRef = ref; },

  toggleLeftPanel: () => {
    if (!leftPanelRef) return;
    leftPanelRef.isCollapsed() ? leftPanelRef.expand() : leftPanelRef.collapse();
  },

  toggleRightPanel: () => {
    if (!rightPanelRef) return;
    rightPanelRef.isCollapsed() ? rightPanelRef.expand() : rightPanelRef.collapse();
  },

  openRightPanel: () => {
    rightPanelRef?.expand();
  },
}));

// For testing: allow resetting module-level refs
export function _resetPanelRefs() {
  leftPanelRef = null;
  rightPanelRef = null;
}
```

> **Design note:** Refs are module-level variables, not Zustand state. `PanelImperativeHandle` is a mutable object — storing it in Zustand would be misleading (it's not serializable, not diffable). The store exposes *methods* that act on the refs. `_resetPanelRefs()` is exported for test cleanup only.

- [ ] **Step 4: Verify test imports include `_resetPanelRefs`**

The test file (written in Step 1) should already import `_resetPanelRefs` and call it in `beforeEach`. Verify the import line reads:

```typescript
import { useUiStore, _resetPanelRefs } from '@/store/uiStore';
```

> **Why no `setState` reset?** The store only contains functions that close over module-level refs — there's no primitive state to reset. Calling `setState({}, true)` would *wipe the functions themselves*, making every subsequent test fail with "toggleLeftPanel is not a function".

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run test/unit/store/uiStore.test.ts`
Expected: 7 tests PASS

- [ ] **Step 6: Commit**

```bash
git add src/store/uiStore.ts test/unit/store/uiStore.test.ts
git commit -m "refactor(uiStore): replace booleans with imperative panel ref methods"
```

---

## Task 2: Wire panel refs in App.tsx and update consumers

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/components/canvas/Canvas.tsx`
- Verify: `src/components/layout/TopMenubar.tsx` (no changes expected)

### Context to read first
- `src/App.tsx` — current layout (57 lines)
- `src/components/canvas/Canvas.tsx:130-162` — three `rightPanelOpen` usage sites
- `src/store/uiStore.ts` — just rewritten in Task 1
- `src/components/ui/resizable.tsx` — wrapper passes `{...props}` through

### Steps

- [ ] **Step 1: Modify App.tsx to create and register panel refs**

```typescript
// Add imports
import { useRef, useEffect } from 'react';
import type { PanelImperativeHandle } from 'react-resizable-panels';
import { useUiStore } from '@/store/uiStore';

// Inside App():
const leftPanelRef = useRef<PanelImperativeHandle>(null);
const rightPanelRef = useRef<PanelImperativeHandle>(null);

useEffect(() => {
  useUiStore.getState().setLeftPanelRef(leftPanelRef.current);
  useUiStore.getState().setRightPanelRef(rightPanelRef.current);
  return () => {
    useUiStore.getState().setLeftPanelRef(null);
    useUiStore.getState().setRightPanelRef(null);
  };
}, []);

// Add panelRef prop to the two collapsible ResizablePanels:
<ResizablePanel
  defaultSize={4}
  minSize={3}
  maxSize={12}
  collapsible
  collapsedSize={0}
  panelRef={leftPanelRef}
>
  <LeftToolbar />
</ResizablePanel>

// ...

<ResizablePanel
  defaultSize={20}
  minSize={12}
  maxSize={40}
  collapsible
  collapsedSize={0}
  panelRef={rightPanelRef}
>
  <RightPanel />
</ResizablePanel>
```

> **Note:** `panelRef` is a prop of the underlying `Panel` component from `react-resizable-panels`. Our `ResizablePanel` wrapper in `resizable.tsx` uses `{...props}` spread, so `panelRef` passes through without modifying the wrapper.

- [ ] **Step 2: Simplify Canvas.tsx — replace 3 read-toggle patterns with `openRightPanel()`**

In `src/components/canvas/Canvas.tsx`, replace the three identical patterns:

```typescript
// BEFORE (appears 3 times — handleNodeEditProperties, handleNodeAddNote, handleEdgeEdit):
const { rightPanelOpen } = useUiStore.getState();
if (!rightPanelOpen) {
  useUiStore.getState().toggleRightPanel();
}

// AFTER (each site):
useUiStore.getState().openRightPanel();
```

This eliminates the `useUiStore` import's only reactive-state usage in Canvas.tsx. The import stays because we still call `getState().openRightPanel()`.

- [ ] **Step 3: Verify TopMenubar.tsx needs no changes**

Read `src/components/layout/TopMenubar.tsx:67-70`. The calls are:
```typescript
onClick={() => useUiStore.getState().toggleLeftPanel()}
onClick={() => useUiStore.getState().toggleRightPanel()}
```
These call the same method names as the new store — **no change needed**.

- [ ] **Step 4: Run full test suite + tsc**

Run: `npx tsc --noEmit && npx vitest run`
Expected: All pass. The `resizable.tsx` wrapper doesn't need modification because it spreads all props.

- [ ] **Step 5: Manual smoke test (if dev server is running)**

1. Open the app
2. Click View > Toggle Right Panel — panel should collapse
3. Click View > Toggle Right Panel — panel should expand
4. Right-click a node > Edit Properties — right panel should open if collapsed
5. Drag the right panel handle to collapse it manually
6. Click View > Toggle Right Panel — panel should expand (drag-initiated collapse is also recognized)

- [ ] **Step 6: Commit**

```bash
git add src/App.tsx src/components/canvas/Canvas.tsx
git commit -m "feat(ui): wire panel refs to uiStore for menu-driven collapse/expand"
```

---

## Task 3: Add `id` + `createdAt` to Note schema

**Files:**
- Modify: `src/types/schema.ts`
- Modify: `test/unit/types/schema.test.ts`

### Context to read first
- `src/types/schema.ts:18-23` — current Note schema
- `test/unit/types/schema.test.ts:46-63` — current Note tests
- `src/components/panels/NotesTab.tsx:42-48` — Note creation site

### Design

Both fields are `.optional()` so existing YAML files (notes without `id`/`createdAt`) parse without error. New notes get both fields auto-populated. This is a non-breaking schema evolution.

`createdAt` is ISO 8601 string (not a Date object) because it serializes cleanly to YAML and JSON.

### Steps

- [ ] **Step 1: Write failing tests for Note schema additions**

Add to `test/unit/types/schema.test.ts` inside the existing `describe('Note', ...)` block:

```typescript
it('accepts note with id and createdAt', () => {
  const note = {
    id: 'abc-123',
    author: 'van',
    content: 'test',
    createdAt: '2026-03-12T10:00:00.000Z',
  };
  expect(Note.parse(note)).toEqual(note);
});

it('accepts note with id only (createdAt optional)', () => {
  const note = { id: 'abc-123', author: 'van', content: 'test' };
  expect(Note.parse(note)).toEqual(note);
});

it('preserves existing notes without id or createdAt', () => {
  const legacy = { author: 'van', content: 'old note' };
  const parsed = Note.parse(legacy);
  expect(parsed).toEqual(legacy);
  expect(parsed).not.toHaveProperty('id');
  expect(parsed).not.toHaveProperty('createdAt');
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run test/unit/types/schema.test.ts`
Expected: FAIL — `id` and `createdAt` are unknown keys and Zod 4 strips them (the parse succeeds but the fields are stripped, so `toEqual` fails).

- [ ] **Step 3: Add fields to Note schema**

In `src/types/schema.ts`, update the Note schema:

```typescript
export const Note = z.object({
  id: z.string().optional(),
  author: z.string(),
  content: z.string(),
  tags: z.array(z.string()).optional(),
  createdAt: z.string().optional(),
});
```

> **Field ordering:** `id` first (identifier), then content fields (`author`, `content`, `tags`), then metadata (`createdAt`). This matches the YAML serialization order convention in the project.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run test/unit/types/schema.test.ts`
Expected: All Note tests pass (existing 4 + new 3 = 7 tests).

- [ ] **Step 5: Run full test suite to check for downstream effects**

Run: `npx tsc --noEmit && npx vitest run`
Expected: All 422+ tests pass. Adding optional fields to a Zod schema is backward-compatible — no consumer breaks.

- [ ] **Step 6: Commit**

```bash
git add src/types/schema.ts test/unit/types/schema.test.ts
git commit -m "feat(schema): add optional id and createdAt to Note for identity and I5 readiness"
```

---

## Task 4: Generate note identity in NotesTab + fix CodeRefsTab keys

**Files:**
- Modify: `src/components/panels/NotesTab.tsx`
- Modify: `src/components/panels/CodeRefsTab.tsx`
- Create: `test/unit/components/panels/NotesTab.test.tsx`

### Context to read first
- `src/components/panels/NotesTab.tsx` — full file (213 lines)
- `src/components/panels/CodeRefsTab.tsx:44-46` — `key={i}` usage
- `src/types/schema.ts:18-23` — Note schema (after Task 3 changes)

### Design

**NotesTab changes:**
- `commitAdd()` sets `id: crypto.randomUUID()` and `createdAt: new Date().toISOString()` on new notes
- `commitEdit()` preserves existing `id` and `createdAt` (only updates `author`, `content`, `tags`)
- React key uses `note.id ?? \`legacy-${index}\`` — graceful fallback for pre-existing notes without IDs

**CodeRefsTab changes:**
- `key={i}` → `key={ref}` — file paths are unique within a node's codeRefs

### Steps

- [ ] **Step 1: Write failing tests for note identity generation**

Create `test/unit/components/panels/NotesTab.test.tsx`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { NotesTab } from '@/components/panels/NotesTab';
import { useGraphStore } from '@/store/graphStore';

// Mock graphStore to capture what gets saved
vi.mock('@/store/graphStore', () => ({
  useGraphStore: {
    getState: vi.fn(() => ({
      updateNode: vi.fn(),
      updateEdge: vi.fn(),
    })),
  },
}));

describe('NotesTab', () => {
  let mockUpdateNode: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockUpdateNode = vi.fn();
    vi.mocked(useGraphStore.getState).mockReturnValue({
      updateNode: mockUpdateNode,
      updateEdge: vi.fn(),
    } as any);
  });

  it('generates id and createdAt when adding a new note', async () => {
    render(
      <NotesTab notes={[]} canvasId="main" nodeId="api" />,
    );

    // Click "+ Add Note"
    fireEvent.click(screen.getByText('+ Add Note'));

    // Fill in content (minimum required field for save)
    const contentInput = screen.getByPlaceholderText('Note content...');
    fireEvent.change(contentInput, { target: { value: 'test note' } });

    // Click Save
    fireEvent.click(screen.getByText('Save'));

    // Verify updateNode was called with a note that has id and createdAt
    expect(mockUpdateNode).toHaveBeenCalledWith('main', 'api', {
      notes: [
        expect.objectContaining({
          id: expect.any(String),
          createdAt: expect.any(String),
          author: 'anonymous',
          content: 'test note',
        }),
      ],
    });

    const savedNotes = mockUpdateNode.mock.calls[0][2].notes;
    // id should look like a UUID fragment
    expect(savedNotes[0].id).toMatch(/^[0-9a-f-]+$/);
    // createdAt should be ISO format
    expect(new Date(savedNotes[0].createdAt).toISOString()).toBe(savedNotes[0].createdAt);
  });

  it('preserves id and createdAt when editing an existing note', () => {
    const existingNote = {
      id: 'existing-id',
      author: 'van',
      content: 'original',
      createdAt: '2026-03-12T10:00:00.000Z',
    };

    render(
      <NotesTab notes={[existingNote]} canvasId="main" nodeId="api" />,
    );

    // Click Edit on the existing note
    fireEvent.click(screen.getByText('Edit'));

    // Change content
    const contentInput = screen.getByDisplayValue('original');
    fireEvent.change(contentInput, { target: { value: 'updated' } });

    // Click Save
    fireEvent.click(screen.getByText('Save'));

    const savedNotes = mockUpdateNode.mock.calls[0][2].notes;
    expect(savedNotes[0].id).toBe('existing-id');
    expect(savedNotes[0].createdAt).toBe('2026-03-12T10:00:00.000Z');
    expect(savedNotes[0].content).toBe('updated');
  });

  it('renders existing notes without id using fallback key (no crash)', () => {
    const legacyNote = { author: 'van', content: 'old note' };

    // Should render without errors
    const { container } = render(
      <NotesTab notes={[legacyNote]} canvasId="main" nodeId="api" />,
    );

    expect(screen.getByText('old note')).toBeDefined();
    // Verify it rendered (no key warning crash)
    expect(container.querySelectorAll('.group')).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run test/unit/components/panels/NotesTab.test.tsx`
Expected: FAIL — new notes don't have `id` or `createdAt`.

- [ ] **Step 3: Update NotesTab — generate identity on creation, preserve on edit**

In `src/components/panels/NotesTab.tsx`:

**Change `commitAdd`** (around line 42):
```typescript
const commitAdd = () => {
  if (!form.content.trim()) return;
  const newNote: Note = {
    id: crypto.randomUUID(),
    author: form.author.trim() || 'anonymous',
    content: form.content.trim(),
    tags: form.tags.trim() ? form.tags.split(',').map((t) => t.trim()).filter(Boolean) : undefined,
    createdAt: new Date().toISOString(),
  };
  saveNotes(props, [...notes, newNote]);
  setForm(emptyForm);
  setShowForm(false);
};
```

**Change `commitEdit`** (around line 52) — preserve `id` and `createdAt`:
```typescript
const commitEdit = (index: number) => {
  if (!form.content.trim()) return;
  const updated = notes.map((n, i) => {
    if (i !== index) return n;
    return {
      ...n, // preserves id, createdAt, and any other existing fields
      author: form.author.trim() || 'anonymous',
      content: form.content.trim(),
      tags: form.tags.trim() ? form.tags.split(',').map((t) => t.trim()).filter(Boolean) : undefined,
    };
  });
  saveNotes(props, updated);
  setEditIndex(null);
  setForm(emptyForm);
};
```

**Change the React key** (around line 91):
```typescript
// BEFORE:
{notes.map((note, i) => (
  <div key={i} className="group rounded border p-2 text-xs space-y-1">

// AFTER:
{notes.map((note, i) => (
  <div key={note.id ?? `legacy-${i}`} className="group rounded border p-2 text-xs space-y-1">
```

- [ ] **Step 4: Fix CodeRefsTab key + add duplicate guard**

In `src/components/panels/CodeRefsTab.tsx`:

**Change the React key** (around line 44):
```typescript
// BEFORE:
{codeRefs.map((ref, i) => (
  <div key={i} ...>

// AFTER:
{codeRefs.map((ref, i) => (
  <div key={ref} ...>
```

The `i` parameter stays because `deleteRef(index)` still needs it.

**Add duplicate guard in `addRef`** (around line 21):
```typescript
const addRef = () => {
  const trimmed = value.trim();
  if (!trimmed || codeRefs.includes(trimmed)) return;  // ← added duplicate check
  save([...codeRefs, trimmed]);
  setValue('');
  setShowInput(false);
};
```

This ensures `key={ref}` never produces duplicate React keys.

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run test/unit/components/panels/NotesTab.test.tsx`
Expected: 3 tests PASS

- [ ] **Step 6: Run full suite + tsc**

Run: `npx tsc --noEmit && npx vitest run`
Expected: All tests pass.

- [ ] **Step 7: Commit**

```bash
git add src/components/panels/NotesTab.tsx src/components/panels/CodeRefsTab.tsx test/unit/components/panels/NotesTab.test.tsx
git commit -m "feat(notes): generate id + createdAt on creation, use stable React keys"
```

---

## Verification Checklist

After all 4 tasks:

- [ ] `npx tsc --noEmit` — clean
- [ ] `npx vitest run` — all tests pass (422 existing + ~13 new)
- [ ] Manual: View > Toggle Right Panel collapses/expands the panel
- [ ] Manual: View > Toggle Left Panel collapses/expands the toolbar
- [ ] Manual: Right-click node > Edit Properties opens collapsed right panel
- [ ] Manual: Add a note, inspect saved YAML — `id` and `createdAt` fields present
- [ ] Manual: Edit a note — `id` and `createdAt` preserved, not overwritten
- [ ] No `uiStore.leftPanelOpen` or `uiStore.rightPanelOpen` references remain in codebase

## Dependency Graph

```
Task 1 (uiStore rewrite)  →  Task 2 (wire refs + update consumers)
Task 3 (Note schema)      →  Task 4 (NotesTab + CodeRefsTab keys)
```

Tasks 1-2 and Tasks 3-4 are independent groups — can be parallelized.
