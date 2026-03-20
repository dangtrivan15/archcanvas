# Entity Creation UI — Design Spec

> **Date**: 2026-03-20 | **Status**: Approved
> **Scope**: Full entity CRUD UI in EntityPanel, edge entity autocomplete with quick-create, 3 new MCP tools

---

## Problem

The entity engine layer is complete (`addEntity`, `removeEntity`, `updateEntity` in `core/graph/engine.ts`), the GraphStore wraps them with canvas resolution and undo/redo, and entities persist via the YAML codec. However, there is no UI for creating, editing, or deleting entities at the canvas level. The EntityPanel is read-only (browse, filter, expand for details). Edge entity assignment in EdgeDetailPanel is free-form text with no validation, allowing orphan references. AI has no fine-grained entity mutation tools (only batch creation via `import_yaml`).

## Decisions

| Decision | Chose | Over | Why |
|----------|-------|------|-----|
| UI surface | Inline in EntityPanel | Dedicated dialog | Entity form is small (name, description, codeRefs) — dialog is overkill. Panel already shows expanded details. |
| Edge entity input | Autocomplete combobox + quick-create | Free-form text / Autocomplete only | Prevents orphan references without friction. Typing a new name offers "Create [name]" option. |
| MCP tools | Full CRUD (add, remove, update) | add_entity only / Defer | Consistent with node/edge tool surface. Minimal extra work since engine already exists. |
| Entity rename | Not supported (names immutable) | Atomic rename + cascade | Delete + recreate is sufficient. Avoids cascading edge reference updates. |

---

## Design

### 1. EntityPanel Enhancements

**File**: `src/components/panels/EntityPanel.tsx`

#### 1a. Create Entity

- **"New Entity" button** at the top of the panel, next to the filter input
- Clicking opens an inline creation form below the button:
  - `name` text input (required) — trimmed and rejected if empty/whitespace-only (UI-level validation before store call)
  - `description` textarea (optional)
  - `codeRefs` input (optional, comma-separated paths)
  - "Create" and "Cancel" buttons; Escape key dismisses form
- On submit: calls `graphStore.addEntity(canvasId, { name, description, codeRefs })`
- On duplicate name: show inline error from engine's `DUPLICATE_ENTITY` result
- On success: clear form, collapse. New entity appears in the list.
- Form animated with `motion/react`, gated by `useReducedMotion()`

#### 1b. Edit Entity

- When an `EntityRow` is expanded, show an **"Edit" icon button** (pencil icon)
- Clicking switches the expanded view from read-only to editable:
  - `description` becomes a textarea (pre-filled)
  - `codeRefs` becomes an editable input (pre-filled, comma-separated)
  - Name displayed but **not editable** (immutable)
  - "Save" and "Cancel" buttons; Escape key cancels
- On save: calls `graphStore.updateEntity(canvasId, entityName, { description, codeRefs })`
- To clear a field, pass an empty string for `description` or an empty array for `codeRefs`
- On cancel: reverts to read-only expanded view

#### 1c. Delete Entity

- When an `EntityRow` is expanded, show a **"Delete" icon button** (trash icon)
- If entity is referenced by edges (engine returns `ENTITY_IN_USE`): show warning listing the referencing edges. Do not delete.
- If entity is not in use: confirm with "Delete [name]?" (no misleading "cannot be undone" claim — undo/redo handles reversal)
- On confirm: calls `graphStore.removeEntity(canvasId, entityName)`

### 2. Edge Entity Autocomplete

**File**: `src/components/panels/EdgeDetailPanel.tsx`

Replace the current free-form text input with a **combobox**:

1. User clicks "+ Add Entity" → shows input with dropdown
2. As user types, dropdown filters existing canvas entities by name (case-insensitive)
3. Matching entities shown as selectable options
4. **"Create [name]" option** shown at bottom only if no case-insensitive match exists among canvas entities. This prevents near-duplicate entities like "order" and "Order".
5. Selecting an existing entity → assigns to edge's `entities` array
6. Selecting "Create [name]" → calls `graphStore.addEntity(canvasId, { name })` first. If `addEntity` returns `DUPLICATE_ENTITY` (race condition — entity created between render and click), treat the existing entity as the match and still assign to the edge. Then assigns to edge.
7. Already-assigned entities are excluded from the dropdown
8. Keyboard navigation: arrow keys to navigate, Enter to select, Escape to close
9. Click outside the dropdown dismisses it (standard combobox behavior)

**Implementation**: Custom lightweight combobox (input + filtered `<ul>` + keyboard handler). No Radix dependency. Entity lists are small (<20 per canvas), no virtualization needed. Styled to match existing EdgeDetailPanel patterns.

### 3. MCP Tools

**File**: `src/core/ai/mcpTools.ts`

Three new tools added to `createArchCanvasMcpServer`:

#### add_entity

```typescript
{
  name: 'add_entity',
  description: 'Add a data entity to a canvas scope',
  inputSchema: z.object({
    name: z.string().describe('Entity name (unique within scope)'),
    description: z.string().optional().describe('Entity description'),
    codeRefs: z.array(z.string()).optional().describe('Code reference paths'),
    scope: z.string().optional().describe('Canvas ID (defaults to root)'),
  }),
}
```

#### remove_entity

```typescript
{
  name: 'remove_entity',
  description: 'Remove a data entity from a canvas scope. Fails if entity is referenced by edges.',
  inputSchema: z.object({
    name: z.string().describe('Entity name to remove'),
    scope: z.string().optional().describe('Canvas ID (defaults to root)'),
  }),
}
```

#### update_entity

```typescript
{
  name: 'update_entity',
  description: 'Update a data entity description or code references. Pass empty string for description or empty array for codeRefs to clear.',
  inputSchema: z.object({
    name: z.string().describe('Entity name to update'),
    description: z.string().optional().describe('New description (empty string to clear)'),
    codeRefs: z.array(z.string()).optional().describe('New code reference paths (empty array to clear)'),
    scope: z.string().optional().describe('Canvas ID (defaults to root)'),
  }),
}
```

**Tool names**: `mcp__archcanvas__add_entity`, `mcp__archcanvas__remove_entity`, `mcp__archcanvas__update_entity` — added to `MCP_TOOL_NAMES` array and `allowedTools` for auto-approval.

### 4. Store Action Dispatcher

**File**: `src/core/ai/storeActionDispatcher.ts`

Three new action handlers. Each constructs the appropriate object from flat args before calling the store:

| Action | Args | Store Call |
|--------|------|------------|
| `addEntity` | `canvasId, name, description?, codeRefs?` | Build `Entity` object `{ name, description, codeRefs }` (filter undefined), call `graphStore.addEntity(canvasId, entity)` |
| `removeEntity` | `canvasId, entityName` | `graphStore.removeEntity(canvasId, entityName)` |
| `updateEntity` | `canvasId, entityName, description?, codeRefs?` | Build `EntityUpdates` object `{ description, codeRefs }` (filter undefined), call `graphStore.updateEntity(canvasId, entityName, updates)` |

### 5. System Prompt

**File**: `src/core/ai/systemPrompt.ts`

Add entity tools to the write tools section with usage guidance:

```
## Entity Tools
- add_entity: Create a data entity in a canvas scope. Entities represent logical domain objects (User, Order, Payment) that flow through connections.
- remove_entity: Remove an entity (fails if referenced by edges — remove edge references first)
- update_entity: Update entity description or code references

Define entities before referencing them on edges. Use list(type: 'entities') to see existing entities in a scope.
```

---

## Files Changed

| File | Change |
|------|--------|
| `src/components/panels/EntityPanel.tsx` | Add create form, edit mode, delete with confirmation |
| `src/components/panels/EdgeDetailPanel.tsx` | Replace free-form input with autocomplete combobox + quick-create |
| `src/core/ai/mcpTools.ts` | Add 3 entity tools with Zod schemas, update `MCP_TOOL_NAMES` array |
| `src/core/ai/storeActionDispatcher.ts` | Add 3 entity action handlers with arg→object construction |
| `src/core/ai/systemPrompt.ts` | Add entity tools + usage guidance to prompt |

## Tests

| File | Coverage |
|------|----------|
| `test/components/panels/EntityPanel.test.tsx` | Create: happy path, duplicate name error, empty name rejection, cancel/Escape. Edit: save changes, clear fields, cancel revert. Delete: not-in-use confirm, in-use warning. |
| `test/components/panels/EdgeDetailPanel.test.tsx` | Autocomplete: filter, select existing, quick-create new, case-insensitive duplicate prevention, exclude assigned, keyboard nav, outside-click dismiss, DUPLICATE_ENTITY race condition fallback. |
| `test/ai/storeActionDispatcher-entity.test.ts` | 3 new actions: happy path, error cases (not found, duplicate, in use), arg construction. |
| `test/e2e/entity-crud.spec.ts` | Basic E2E: create entity in EntityPanel → verify appears in EdgeDetailPanel autocomplete → assign to edge → verify persistence after save/reload. |

## Scope

- ~350-450 lines production code
- ~250-350 lines tests
- 1 new test file (`storeActionDispatcher-entity.test.ts`), 1 new E2E spec
- No new dependencies
