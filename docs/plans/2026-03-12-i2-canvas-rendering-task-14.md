# Task 14: Command Palette

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:writing-plans to plan
> the implementation steps for this task.

**Scope:** Command palette with cmdk + PaletteProvider system
**Parent feature:** [I2 Canvas Rendering](./2026-03-12-i2-canvas-rendering-index.md)

## Write Set

- Create: `src/components/shared/CommandPalette.tsx` (~190 lines) — cmdk wrapper + 5 providers
- Test: Create `test/unit/components/shared/CommandPalette.test.ts`

## Read Set (context needed)

- `src/store/registryStore.ts` — `search`, `list` (Task 3) — for NodeTypeProvider
- `src/store/canvasStore.ts` — `selectNodes` (Task 8) — for NodeSearchProvider
- `src/store/navigationStore.ts` — `navigateTo`, `currentCanvasId` (Task 9) — for ScopeProvider
- `src/store/fileStore.ts` — `getCanvas` (for node/entity search in current canvas)
- `src/core/graph/query.ts` — `searchGraph`, `listEntities` — for search providers
- `docs/specs/2026-03-12-i2-canvas-rendering-design.md` — Layer 6: Command Palette

## Dependencies

- **Blocked by:** Task 3 (registryStore for type search), Task 8 (canvasStore for node selection), Task 9 (navigationStore for scope navigation)
- **Blocks:** Task 15 (Cmd+K shortcut wired in useCanvasKeyboard)

## Description

### npm install

```bash
npm install cmdk
```

### PaletteProvider interface

```typescript
interface PaletteProvider {
  category: string;
  search(query: string): PaletteResult[];
  onSelect(result: PaletteResult): void;
}

interface PaletteResult {
  id: string;
  title: string;
  subtitle?: string;
  icon?: string;
  category: string;
}
```

### 5 Built-in providers

| Provider | Category | Source | On select |
|----------|----------|--------|-----------|
| `NodeSearchProvider` | Nodes | Current canvas nodes | `canvasStore.selectNodes([id])` |
| `ActionProvider` | Actions | Hardcoded list (Undo, Redo, Fit View, Auto Layout) | Execute action |
| `NodeTypeProvider` | Node types | `registryStore.search(query)` | Open add-node flow (for now: add node at center) |
| `EntityProvider` | Entities | `listEntities` from current canvas | Select referencing edge |
| `ScopeProvider` | Scopes | All canvases from fileStore | `navigationStore.navigateTo(canvasId)` |

### Prefix shortcuts

| Prefix | Filters to |
|--------|-----------|
| `>` | Actions only |
| `@` | Nodes only |
| `#` | Entities only |

### Component structure

```tsx
function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  // Register all providers
  // On query change: collect results from all providers (or filtered by prefix)
  // Render via cmdk: Command.Dialog > Command.Input > Command.List > Command.Group > Command.Item

  return (
    <Command.Dialog open={open} onOpenChange={onClose}>
      <Command.Input placeholder="Search..." />
      <Command.List>
        {groupedResults.map(group => (
          <Command.Group heading={group.category}>
            {group.results.map(result => (
              <Command.Item onSelect={() => result.provider.onSelect(result)}>
                {result.title}
              </Command.Item>
            ))}
          </Command.Group>
        ))}
      </Command.List>
    </Command.Dialog>
  );
}
```

### Tests

- Opens and closes via props
- Filters results by query text
- Prefix `>` shows only actions
- Prefix `@` shows only nodes
- Prefix `#` shows only entities
- NodeSearchProvider finds nodes in current canvas
- NodeTypeProvider finds registry types
- ScopeProvider lists all canvases
- Selecting a node result calls canvasStore.selectNodes
- Selecting a scope result calls navigationStore.navigateTo

### Acceptance Criteria

- Command palette opens/closes
- Fuzzy search across all providers
- Prefix filtering works
- All 5 providers functional
- Results grouped by category
- Keyboard navigation (arrows + Enter + Escape)
- `tsc --noEmit` passes
