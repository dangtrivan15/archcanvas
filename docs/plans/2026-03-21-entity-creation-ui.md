# Entity Creation UI — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add full entity CRUD UI in EntityPanel, edge entity autocomplete with quick-create, and 3 new MCP entity tools.

**Architecture:** Extends existing EntityPanel (inline create/edit/delete forms), replaces free-form edge entity input with an autocomplete combobox, and adds `add_entity`/`remove_entity`/`update_entity` to the MCP tool surface + store action dispatcher.

**Tech Stack:** React 19, Zustand 5, Zod 4, motion/react, Vitest, Playwright

**Spec:** `docs/specs/2026-03-20-entity-creation-ui-design.md`

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `src/components/panels/EntityPanel.tsx` | Modify | Add create form, edit mode on EntityRow, delete with confirmation |
| `src/components/panels/EdgeDetailPanel.tsx` | Modify | Replace free-form entity input with autocomplete combobox |
| `src/core/ai/mcpTools.ts` | Modify | Add 3 entity tools, update `MCP_TOOL_NAMES` |
| `src/core/ai/storeActionDispatcher.ts` | Modify | Add 3 entity action handlers |
| `src/core/ai/systemPrompt.ts` | Modify | Add entity tools to prompt |
| `test/components/panels/EntityPanel.test.tsx` | Modify | Add create/edit/delete tests |
| `test/components/panels/EdgeDetailPanel.test.tsx` | Create | Autocomplete + quick-create tests |
| `test/ai/storeActionDispatcher-entity.test.ts` | Create | Entity dispatcher action tests |
| `test/e2e/entity-crud.spec.ts` | Create | E2E entity creation + autocomplete flow |

---

### Task 1: Store Action Dispatcher — Entity Actions

**Files:**
- Modify: `src/core/ai/storeActionDispatcher.ts:34-70` (action switch)
- Create: `test/ai/storeActionDispatcher-entity.test.ts`

- [ ] **Step 1: Write failing tests for addEntity dispatcher**

In `test/ai/storeActionDispatcher-entity.test.ts` — follow the exact setup pattern from `test/ai/storeActionDispatcher-createSubsystem.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { enablePatches } from 'immer';
import { useFileStore } from '@/store/fileStore';
import { useRegistryStore } from '@/store/registryStore';
import { InMemoryFileSystem } from '@/platform/inMemoryFileSystem';
import { serializeCanvas } from '@/storage/yamlCodec';
import { dispatchStoreAction } from '@/core/ai/storeActionDispatcher';
import { ROOT_CANVAS_KEY } from '@/storage/fileResolver';

enablePatches();

async function setup() {
  useFileStore.setState({
    project: null, dirtyCanvases: new Set(), status: 'idle', error: null,
  });
  const fs = new InMemoryFileSystem();
  fs.seed({
    '.archcanvas/main.yaml': serializeCanvas({
      project: { name: 'Test' },
      nodes: [{ id: 'svc-a', type: 'compute/service' }],
      edges: [],
    } as any),
  });
  await useFileStore.getState().openProject(fs);
  await useRegistryStore.getState().initialize();
}

describe('dispatchStoreAction — entity actions', () => {
  beforeEach(setup);

  describe('addEntity', () => {
    it('adds entity to canvas', () => {
      const result = dispatchStoreAction('addEntity', {
        canvasId: ROOT_CANVAS_KEY,
        name: 'Order',
        description: 'A purchase order',
        codeRefs: ['src/models/order.ts'],
      });
      expect(result).toMatchObject({ ok: true });
    });

    it('returns error for duplicate entity', () => {
      dispatchStoreAction('addEntity', {
        canvasId: ROOT_CANVAS_KEY,
        name: 'Order',
      });
      const result = dispatchStoreAction('addEntity', {
        canvasId: ROOT_CANVAS_KEY,
        name: 'Order',
      });
      expect(result).toMatchObject({
        ok: false,
        error: { code: 'DUPLICATE_ENTITY' },
      });
    });
  });

  describe('removeEntity', () => {
    it('removes entity from canvas', () => {
      dispatchStoreAction('addEntity', {
        canvasId: ROOT_CANVAS_KEY,
        name: 'Order',
      });
      const result = dispatchStoreAction('removeEntity', {
        canvasId: ROOT_CANVAS_KEY,
        entityName: 'Order',
      });
      expect(result).toMatchObject({ ok: true });
    });

    it('returns error when entity not found', () => {
      const result = dispatchStoreAction('removeEntity', {
        canvasId: ROOT_CANVAS_KEY,
        entityName: 'NonExistent',
      });
      expect(result).toMatchObject({
        ok: false,
        error: { code: 'ENTITY_NOT_FOUND' },
      });
    });
  });

  describe('updateEntity', () => {
    it('updates entity description', () => {
      dispatchStoreAction('addEntity', {
        canvasId: ROOT_CANVAS_KEY,
        name: 'Order',
      });
      const result = dispatchStoreAction('updateEntity', {
        canvasId: ROOT_CANVAS_KEY,
        entityName: 'Order',
        description: 'Updated description',
      });
      expect(result).toMatchObject({ ok: true });
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test:unit -- --reporter verbose test/ai/storeActionDispatcher-entity.test.ts`
Expected: FAIL — `addEntity`, `removeEntity`, `updateEntity` not handled in dispatcher

- [ ] **Step 3: Implement dispatcher actions**

In `src/core/ai/storeActionDispatcher.ts`, add to the switch statement (after existing write actions around line 55):

```typescript
case 'addEntity':
  return dispatchAddEntity(args);
case 'removeEntity':
  return dispatchRemoveEntity(args);
case 'updateEntity':
  return dispatchUpdateEntity(args);
```

Then add the dispatcher functions at the end of the file:

```typescript
function dispatchAddEntity(args: Record<string, unknown>) {
  const canvasId = (args.canvasId as string) ?? ROOT_CANVAS_KEY;
  const name = args.name as string;
  const description = args.description as string | undefined;
  const codeRefs = args.codeRefs as string[] | undefined;
  const entity: { name: string; description?: string; codeRefs?: string[] } = { name };
  if (description !== undefined) entity.description = description;
  if (codeRefs !== undefined) entity.codeRefs = codeRefs;
  return useGraphStore.getState().addEntity(canvasId, entity);
}

function dispatchRemoveEntity(args: Record<string, unknown>) {
  const canvasId = (args.canvasId as string) ?? ROOT_CANVAS_KEY;
  const entityName = args.entityName as string;
  return useGraphStore.getState().removeEntity(canvasId, entityName);
}

function dispatchUpdateEntity(args: Record<string, unknown>) {
  const canvasId = (args.canvasId as string) ?? ROOT_CANVAS_KEY;
  const entityName = args.entityName as string;
  const updates: { description?: string; codeRefs?: string[] } = {};
  if (args.description !== undefined) updates.description = args.description as string;
  if (args.codeRefs !== undefined) updates.codeRefs = args.codeRefs as string[];
  return useGraphStore.getState().updateEntity(canvasId, entityName, updates);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test:unit -- --reporter verbose test/ai/storeActionDispatcher-entity.test.ts`
Expected: PASS — all 5 tests green

- [ ] **Step 5: Commit**

```bash
git add src/core/ai/storeActionDispatcher.ts test/ai/storeActionDispatcher-entity.test.ts
git commit -m "feat: add entity CRUD actions to store action dispatcher"
```

---

### Task 2: MCP Entity Tools

**Files:**
- Modify: `src/core/ai/mcpTools.ts:30-175` (tool definitions + MCP_TOOL_NAMES)
- Modify: `src/core/ai/systemPrompt.ts:22-34` (write tools section)

- [ ] **Step 1: Add 3 entity tools to mcpTools.ts**

In `src/core/ai/mcpTools.ts`, add after the `create_subsystem` tool (around line 120) and before the read tools:

```typescript
server.tool(
  'add_entity',
  'Add a data entity to a canvas scope',
  { name: z.string(), description: z.string().optional(), codeRefs: z.array(z.string()).optional(), scope: z.string().optional() },
  async (args) => {
    const result = await relay('addEntity', {
      canvasId: args.scope ?? '__root__',
      name: args.name,
      ...(args.description !== undefined && { description: args.description }),
      ...(args.codeRefs !== undefined && { codeRefs: args.codeRefs }),
    });
    return toCallToolResult(result);
  },
);

server.tool(
  'remove_entity',
  'Remove a data entity from a canvas scope. Fails if referenced by edges.',
  { name: z.string(), scope: z.string().optional() },
  async (args) => {
    const result = await relay('removeEntity', {
      canvasId: args.scope ?? '__root__',
      entityName: args.name,
    });
    return toCallToolResult(result);
  },
);

server.tool(
  'update_entity',
  'Update entity description or code references. Pass empty string/array to clear.',
  { name: z.string(), description: z.string().optional(), codeRefs: z.array(z.string()).optional(), scope: z.string().optional() },
  async (args) => {
    const result = await relay('updateEntity', {
      canvasId: args.scope ?? '__root__',
      entityName: args.name,
      ...(args.description !== undefined && { description: args.description }),
      ...(args.codeRefs !== undefined && { codeRefs: args.codeRefs }),
    });
    return toCallToolResult(result);
  },
);
```

- [ ] **Step 2: Update MCP_TOOL_NAMES array**

In `src/core/ai/mcpTools.ts`, add to the `MCP_TOOL_NAMES` array (around line 168):

```typescript
'mcp__archcanvas__add_entity',
'mcp__archcanvas__remove_entity',
'mcp__archcanvas__update_entity',
```

- [ ] **Step 3: Update system prompt**

In `src/core/ai/systemPrompt.ts`, add after the existing write tools section (around line 28):

```typescript
`## Entity Tools
- add_entity: Create a data entity in a canvas scope. Entities represent logical domain objects (User, Order, Payment) that flow through connections.
- remove_entity: Remove an entity (fails if referenced by edges — remove edge references first)
- update_entity: Update entity description or code references

Define entities before referencing them on edges. Use list(type: 'entities') to see existing entities in a scope.`
```

- [ ] **Step 4: Run existing tests to verify no regressions**

Run: `npm run test:unit -- --reporter verbose test/ai/`
Expected: All existing AI tests pass, no regressions

- [ ] **Step 5: Commit**

```bash
git add src/core/ai/mcpTools.ts src/core/ai/systemPrompt.ts
git commit -m "feat: add entity CRUD MCP tools and update system prompt"
```

---

### Task 3: EntityPanel — Create Entity

**Files:**
- Modify: `src/components/panels/EntityPanel.tsx:119-161` (add create button + form)
- Modify: `test/components/panels/EntityPanel.test.tsx` (add create tests)

- [ ] **Step 1: Write failing tests for entity creation**

Add to `test/components/panels/EntityPanel.test.tsx`. **Important**: The existing test file mocks `fileStore`, `navigationStore`, and `canvasStore` but NOT `graphStore`. You must add a `graphStore` mock first:

```typescript
// Add at top of file with other mocks:
const mockGraphState = {
  addEntity: vi.fn().mockReturnValue({ ok: true }),
  updateEntity: vi.fn().mockReturnValue({ ok: true }),
  removeEntity: vi.fn().mockReturnValue({ ok: true }),
};
vi.mock('@/store/graphStore', () => ({
  useGraphStore: Object.assign(vi.fn(() => mockGraphState), {
    getState: () => mockGraphState,
  }),
}));
```

Then add the test cases:

```typescript
describe('Create Entity', () => {
  it('shows create form when New Entity button is clicked', async () => {
    const { user } = setup(canvasWithEntities);
    await user.click(screen.getByRole('button', { name: /new entity/i }));
    expect(screen.getByPlaceholderText(/entity name/i)).toBeInTheDocument();
  });

  it('creates entity on submit', async () => {
    const { user } = setup(canvasWithEntities);
    await user.click(screen.getByRole('button', { name: /new entity/i }));
    await user.type(screen.getByPlaceholderText(/entity name/i), 'Payment');
    await user.type(screen.getByPlaceholderText(/description/i), 'A payment record');
    await user.click(screen.getByRole('button', { name: /^create$/i }));
    expect(mockGraphState.addEntity).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ name: 'Payment', description: 'A payment record' }),
    );
  });

  it('shows error for duplicate entity name', async () => {
    mockGraphState.addEntity.mockReturnValue({ ok: false, error: { code: 'DUPLICATE_ENTITY', name: 'Order' } });
    const { user } = setup(canvasWithEntities);
    await user.click(screen.getByRole('button', { name: /new entity/i }));
    await user.type(screen.getByPlaceholderText(/entity name/i), 'Order');
    await user.click(screen.getByRole('button', { name: /^create$/i }));
    expect(screen.getByText(/already exists/i)).toBeInTheDocument();
  });

  it('rejects empty name', async () => {
    const { user } = setup(canvasWithEntities);
    await user.click(screen.getByRole('button', { name: /new entity/i }));
    await user.click(screen.getByRole('button', { name: /^create$/i }));
    expect(mockGraphState.addEntity).not.toHaveBeenCalled();
  });

  it('cancels form on Cancel button', async () => {
    const { user } = setup(canvasWithEntities);
    await user.click(screen.getByRole('button', { name: /new entity/i }));
    expect(screen.getByPlaceholderText(/entity name/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /cancel/i }));
    expect(screen.queryByPlaceholderText(/entity name/i)).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test:unit -- --reporter verbose test/components/panels/EntityPanel.test.tsx`
Expected: FAIL — "New Entity" button not found

- [ ] **Step 3: Implement create form in EntityPanel**

In `src/components/panels/EntityPanel.tsx`, add a `CreateEntityForm` component and wire it to a "New Entity" button next to the filter input. The form includes:
- `name` input (required, trimmed, empty check)
- `description` textarea (optional)
- `codeRefs` input (optional, comma-separated)
- Create/Cancel buttons
- Escape key dismisses form
- Inline error display for `DUPLICATE_ENTITY`
- `motion.div` + `AnimatePresence` for form animation, gated by `useReducedMotion()`

Call `useGraphStore.getState().addEntity(canvasId, entity)` on submit. On success, clear form and collapse. On error, show inline message.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test:unit -- --reporter verbose test/components/panels/EntityPanel.test.tsx`
Expected: All tests pass including new create tests

- [ ] **Step 5: Commit**

```bash
git add src/components/panels/EntityPanel.tsx test/components/panels/EntityPanel.test.tsx
git commit -m "feat: add entity creation form to EntityPanel"
```

---

### Task 4: EntityPanel — Edit & Delete Entity

**Files:**
- Modify: `src/components/panels/EntityPanel.tsx:11-96` (EntityRow edit/delete)
- Modify: `test/components/panels/EntityPanel.test.tsx` (add edit/delete tests)

- [ ] **Step 1: Write failing tests for edit and delete**

Add to `test/components/panels/EntityPanel.test.tsx`:

```typescript
describe('Edit Entity', () => {
  it('shows edit form when edit button clicked on expanded entity', async () => {
    const { user } = setup(canvasWithEntities);
    // Expand entity row
    await user.click(screen.getByText('Order'));
    // Click edit button
    await user.click(screen.getByRole('button', { name: /edit/i }));
    expect(screen.getByDisplayValue(/purchase order/i)).toBeInTheDocument();
  });

  it('saves updated description', async () => {
    const { user } = setup(canvasWithEntities);
    await user.click(screen.getByText('Order'));
    await user.click(screen.getByRole('button', { name: /edit/i }));
    const textarea = screen.getByDisplayValue(/purchase order/i);
    await user.clear(textarea);
    await user.type(textarea, 'Updated description');
    await user.click(screen.getByRole('button', { name: /save/i }));
    expect(mockGraphState.updateEntity).toHaveBeenCalledWith(
      expect.any(String), 'Order', expect.objectContaining({ description: 'Updated description' }),
    );
  });

  it('reverts on cancel', async () => {
    const { user } = setup(canvasWithEntities);
    await user.click(screen.getByText('Order'));
    await user.click(screen.getByRole('button', { name: /edit/i }));
    await user.click(screen.getByRole('button', { name: /cancel/i }));
    // Should be back to read-only
    expect(screen.queryByRole('button', { name: /save/i })).not.toBeInTheDocument();
  });
});

describe('Delete Entity', () => {
  it('deletes entity not in use', async () => {
    const { user } = setup(canvasWithEntities);
    await user.click(screen.getByText('Order'));
    await user.click(screen.getByRole('button', { name: /delete/i }));
    // Confirm
    await user.click(screen.getByRole('button', { name: /confirm/i }));
    expect(mockGraphState.removeEntity).toHaveBeenCalledWith(expect.any(String), 'Order');
  });

  it('shows warning when entity is in use', async () => {
    mockGraphState.removeEntity.mockReturnValue({
      ok: false,
      error: { code: 'ENTITY_IN_USE', name: 'Order', referencedBy: [{ from: 'a', to: 'b' }] },
    });
    const { user } = setup(canvasWithEntities);
    await user.click(screen.getByText('Order'));
    await user.click(screen.getByRole('button', { name: /delete/i }));
    await user.click(screen.getByRole('button', { name: /confirm/i }));
    expect(screen.getByText(/referenced by/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test:unit -- --reporter verbose test/components/panels/EntityPanel.test.tsx`
Expected: FAIL — edit/delete buttons not found

- [ ] **Step 3: Implement edit and delete in EntityRow**

In the `EntityRow` component within `src/components/panels/EntityPanel.tsx`:
- Add `isEditing` state
- When expanded, show pencil (edit) and trash (delete) icon buttons
- Edit mode: switch description/codeRefs to editable inputs, show Save/Cancel buttons
- Delete: show inline confirmation "Delete [name]?", on confirm call `graphStore.removeEntity()`. If `ENTITY_IN_USE`, show warning with referencing edges list.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test:unit -- --reporter verbose test/components/panels/EntityPanel.test.tsx`
Expected: All tests pass

- [ ] **Step 5: Run full unit test suite**

Run: `npm run test:unit`
Expected: All ~1450+ tests pass, no regressions

- [ ] **Step 6: Commit**

```bash
git add src/components/panels/EntityPanel.tsx test/components/panels/EntityPanel.test.tsx
git commit -m "feat: add entity edit and delete to EntityPanel"
```

---

### Task 5: Edge Entity Autocomplete

**Files:**
- Modify: `src/components/panels/EdgeDetailPanel.tsx:93-172` (entity section)
- Create: `test/components/panels/EdgeDetailPanel.test.tsx`

- [ ] **Step 1: Write failing tests for autocomplete**

Create `test/components/panels/EdgeDetailPanel.test.tsx` — this is a **new file**, so include full setup:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EdgeDetailPanel } from '@/components/panels/EdgeDetailPanel';

// Mock graphStore for entity operations
const mockGraphState = {
  addEntity: vi.fn().mockReturnValue({ ok: true }),
  // Provide canvas entities for autocomplete filtering
  resolveCanvas: vi.fn().mockReturnValue({
    entities: [
      { name: 'Order', description: 'A purchase order' },
      { name: 'User', description: 'A system user' },
    ],
  }),
};
vi.mock('@/store/graphStore', () => ({
  useGraphStore: Object.assign(vi.fn(() => mockGraphState), {
    getState: () => mockGraphState,
  }),
}));

// Mock navigationStore for current canvasId
vi.mock('@/store/navigationStore', () => ({
  useNavigationStore: vi.fn(() => ({ currentCanvasId: '__root__' })),
}));

// Test fixture: edge with canvas that has entities defined
const testEdge = {
  from: { node: 'svc-a', port: 'out' },
  to: { node: 'svc-b', port: 'in' },
  protocol: 'HTTP',
  label: 'call',
  entities: [],
};

const testEdgeWithAssigned = {
  ...testEdge,
  entities: ['Order'],
};

function setup(edge = testEdge) {
  const user = userEvent.setup();
  const onUpdate = vi.fn();
  render(<EdgeDetailPanel edge={edge} onUpdateEdge={onUpdate} />);
  return { user, onUpdate };
}

describe('EdgeDetailPanel — Entity Autocomplete', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows dropdown with matching entities on type', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: /add entity/i }));
    await user.type(screen.getByPlaceholderText(/entity/i), 'Ord');
    expect(screen.getByText('Order')).toBeInTheDocument();
  });

  it('filters case-insensitively', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: /add entity/i }));
    await user.type(screen.getByPlaceholderText(/entity/i), 'ord');
    expect(screen.getByText('Order')).toBeInTheDocument();
  });

  it('selects existing entity and updates edge', async () => {
    const { user, onUpdate } = setup();
    await user.click(screen.getByRole('button', { name: /add entity/i }));
    await user.type(screen.getByPlaceholderText(/entity/i), 'Ord');
    await user.click(screen.getByText('Order'));
    expect(onUpdate).toHaveBeenCalled();
  });

  it('shows Create option when no match exists', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: /add entity/i }));
    await user.type(screen.getByPlaceholderText(/entity/i), 'Payment');
    expect(screen.getByText(/create "Payment"/i)).toBeInTheDocument();
  });

  it('hides Create option when case-insensitive match exists', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: /add entity/i }));
    await user.type(screen.getByPlaceholderText(/entity/i), 'order');
    expect(screen.queryByText(/create "order"/i)).not.toBeInTheDocument();
  });

  it('quick-creates and assigns entity', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: /add entity/i }));
    await user.type(screen.getByPlaceholderText(/entity/i), 'Payment');
    await user.click(screen.getByText(/create "Payment"/i));
    expect(mockGraphState.addEntity).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ name: 'Payment' }),
    );
  });

  it('handles DUPLICATE_ENTITY race — treats existing as match', async () => {
    mockGraphState.addEntity.mockReturnValueOnce({
      ok: false, error: { code: 'DUPLICATE_ENTITY', name: 'Payment' },
    });
    const { user, onUpdate } = setup();
    await user.click(screen.getByRole('button', { name: /add entity/i }));
    await user.type(screen.getByPlaceholderText(/entity/i), 'Payment');
    await user.click(screen.getByText(/create "Payment"/i));
    // Should still assign to edge despite addEntity failure
    expect(onUpdate).toHaveBeenCalled();
  });

  it('excludes already-assigned entities from dropdown', async () => {
    const { user } = setup(testEdgeWithAssigned);
    await user.click(screen.getByRole('button', { name: /add entity/i }));
    await user.type(screen.getByPlaceholderText(/entity/i), 'Ord');
    // 'Order' is already assigned, should not appear
    expect(screen.queryByText('Order')).not.toBeInTheDocument();
  });

  it('navigates dropdown with arrow keys and selects with Enter', async () => {
    const { user, onUpdate } = setup();
    await user.click(screen.getByRole('button', { name: /add entity/i }));
    await user.type(screen.getByPlaceholderText(/entity/i), 'O');
    // Arrow down to first option, Enter to select
    await user.keyboard('{ArrowDown}{Enter}');
    expect(onUpdate).toHaveBeenCalled();
  });

  it('dismisses dropdown on Escape', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: /add entity/i }));
    await user.type(screen.getByPlaceholderText(/entity/i), 'Ord');
    await user.keyboard('{Escape}');
    expect(screen.queryByText('Order')).not.toBeInTheDocument();
  });

  it('dismisses dropdown on outside click', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: /add entity/i }));
    await user.type(screen.getByPlaceholderText(/entity/i), 'Ord');
    // Click outside
    await user.click(document.body);
    expect(screen.queryByText('Order')).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test:unit -- --reporter verbose test/components/panels/EdgeDetailPanel.test.tsx`
Expected: FAIL — autocomplete behavior not implemented

- [ ] **Step 3: Implement autocomplete combobox**

In `src/components/panels/EdgeDetailPanel.tsx`, replace the free-form entity input section (lines 93-172) with a custom combobox:
- Input filters canvas entities (from `useGraphStore` current canvas entities) case-insensitively
- Filtered results shown as `<ul>` dropdown below input
- "Create [name]" option at bottom only when no case-insensitive match exists
- Selecting existing entity → update edge's `entities` array
- Selecting "Create" → call `graphStore.addEntity()` first, handle `DUPLICATE_ENTITY` race (treat as match), then assign to edge
- Already-assigned entities excluded from dropdown
- Keyboard: arrow keys navigate, Enter selects, Escape closes
- Click outside dismisses dropdown
- Styled to match existing EdgeDetailPanel patterns

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test:unit -- --reporter verbose test/components/panels/EdgeDetailPanel.test.tsx`
Expected: All autocomplete tests pass

- [ ] **Step 5: Run full unit test suite**

Run: `npm run test:unit`
Expected: All tests pass, no regressions

- [ ] **Step 6: Commit**

```bash
git add src/components/panels/EdgeDetailPanel.tsx test/components/panels/EdgeDetailPanel.test.tsx
git commit -m "feat: replace edge entity input with autocomplete combobox"
```

---

### Task 6: E2E Test

**Files:**
- Create: `test/e2e/entity-crud.spec.ts`

- [ ] **Step 1: Write E2E test for entity creation → autocomplete → assignment flow**

Create `test/e2e/entity-crud.spec.ts`:

```typescript
import { test, expect } from '@playwright/test';

test.describe('Entity CRUD', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Bootstrap a project with at least one node and one edge
    // (use existing test helpers / keyboard shortcuts)
  });

  test('create entity in EntityPanel and assign via edge autocomplete', async ({ page }) => {
    // 1. Open EntityPanel
    // 2. Click "New Entity"
    // 3. Fill name: "Order", description: "A purchase order"
    // 4. Click "Create"
    // 5. Verify entity appears in the panel

    // 6. Select an edge on canvas
    // 7. In EdgeDetailPanel, click "+ Add Entity"
    // 8. Type "Ord" — verify "Order" appears in dropdown
    // 9. Click "Order" to assign
    // 10. Verify entity pill appears on edge detail
  });

  test('entity delete blocked when in use', async ({ page }) => {
    // 1. Create entity and assign to edge (as above)
    // 2. Try to delete entity in EntityPanel
    // 3. Verify "referenced by" warning appears
  });
});
```

- [ ] **Step 2: Run E2E tests**

Run: `npm run test:e2e-no-bridge`
Expected: New tests pass alongside existing 92+ tests

- [ ] **Step 3: Commit**

```bash
git add test/e2e/entity-crud.spec.ts
git commit -m "test: add E2E tests for entity CRUD flow"
```
