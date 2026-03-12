# Task 15: Auto-Layout + Keyboard Shortcuts + Final Wiring

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:writing-plans to plan
> the implementation steps for this task.

**Scope:** Auto-layout engine + remaining keyboard shortcuts + toolbar/menu wiring
**Parent feature:** [I2 Canvas Rendering](./2026-03-12-i2-canvas-rendering-index.md)

## Write Set

- Create: `src/core/layout/elk.ts` (~60 lines) — auto-layout via elkjs
- Modify: `src/components/canvas/hooks/useCanvasKeyboard.ts` (~30 lines) — add remaining shortcuts
- Modify: `src/components/layout/LeftToolbar.tsx` (~20 lines) — wire tool buttons to store actions
- Modify: `src/components/layout/TopMenubar.tsx` (~30 lines) — wire menu items
- Modify: `src/components/layout/StatusBar.tsx` (~15 lines) — show canvas info
- Test: Create `test/unit/core/layout/elk.test.ts`

## Read Set (context needed)

- `src/components/canvas/hooks/useCanvasKeyboard.ts` — current state after Task 13 (Cmd+Z, Cmd+Shift+Z)
- `src/components/layout/LeftToolbar.tsx` — current placeholder (49 lines, 8 tool buttons)
- `src/components/layout/TopMenubar.tsx` — current placeholder (54 lines, File/Edit/View menus)
- `src/components/layout/StatusBar.tsx` — current placeholder (13 lines)
- `src/store/graphStore.ts` — `updateNodePosition` (for applying layout results)
- `src/store/canvasStore.ts` — `deleteSelection`, `clearSelection`, `selectNodes`
- `src/store/navigationStore.ts` — `goUp`, `currentCanvasId`
- `src/store/historyStore.ts` — `undo`, `redo`
- `src/store/fileStore.ts` — `getCanvas` (for canvas info in status bar)
- `src/types/schema.ts` — `CanvasFile`, `Position`
- `docs/specs/2026-03-12-i2-canvas-rendering-design.md` — Layer 7: Auto-Layout, useCanvasKeyboard

## Dependencies

- **Blocked by:** Task 13 (useCanvasKeyboard created there), Task 14 (command palette for Cmd+K trigger)
- **Blocks:** None (final task)

## Description

### npm install

```bash
npm install elkjs
```

### core/layout/elk.ts

Pure TypeScript, no React dependency. In the Core Layer.

```typescript
interface LayoutResult {
  positions: Map<string, Position>;
}

async function computeLayout(
  canvas: CanvasFile,
  options?: { direction?: 'horizontal' | 'vertical' }
): Promise<LayoutResult>;
```

Implementation:
1. Map `CanvasFile.nodes` → ELK graph nodes (default width/height: 200x100, or from NodeDef shape hints)
2. Map `CanvasFile.edges` → ELK edges (from.node → to.node)
3. Configure ELK with `elk.layered` algorithm, direction from options
4. Run `elk.layout()` (async)
5. Extract computed x/y positions → return as `Map<string, Position>`

### Trigger points

- First load with no positions: auto-run in useCanvasRenderer (check if all nodes lack positions)
- "Auto Layout" button in toolbar / Cmd+Shift+L shortcut / command palette action
- Apply results via batch `graphStore.updateNodePosition` for each node (generates one history entry per node — could batch, but individual calls are simpler)

### useCanvasKeyboard extensions

Add remaining shortcuts to the hook created in Task 13:

| Key | Action |
|-----|--------|
| `Delete` / `Backspace` | `canvasStore.deleteSelection()` |
| `Cmd+K` | Open command palette (set state in Canvas or use a small palette store) |
| `Cmd+Shift+L` | Run auto-layout |
| `Cmd+A` | `canvasStore.selectNodes(allNodeIds)` |
| `Escape` | Clear selection, or `navigationStore.goUp()` if nothing selected |

### LeftToolbar.tsx wiring

Connect the 8 existing tool buttons to store actions:
- Select tool → default (no-op, selection via click)
- Add Node → open command palette with `@` prefix
- Add Edge → visual hint (handled by ReactFlow connect)
- Auto Layout → `computeLayout` + apply
- Fit View → `reactFlow.fitView()`
- Undo → `historyStore.undo()`
- Redo → `historyStore.redo()`
- Delete → `canvasStore.deleteSelection()`

### TopMenubar.tsx wiring

Connect existing menu structure items:
- File > Save → `fileStore.saveAll()`
- Edit > Undo/Redo → `historyStore.undo()`/`redo()`
- Edit > Delete → `canvasStore.deleteSelection()`
- View > Fit View → `reactFlow.fitView()`
- View > Auto Layout → `computeLayout` + apply

### StatusBar.tsx wiring

Show dynamic canvas info:
- Node count from current canvas
- Edge count
- Current scope name (from navigationStore breadcrumb)
- Dirty indicator (from fileStore.dirtyCanvases)

### Tests (elk.ts)

- Returns positions for all nodes in a simple graph
- Respects horizontal direction option
- Respects vertical direction option
- Handles empty canvas (no nodes)
- Handles canvas with no edges (nodes still positioned)
- Positions don't overlap (basic check: no two positions identical)

### Acceptance Criteria

- Auto-layout produces reasonable positions for test graphs
- All keyboard shortcuts functional
- Toolbar buttons wired to actions
- Menu items wired to actions
- Status bar shows live canvas info
- `tsc --noEmit` passes
