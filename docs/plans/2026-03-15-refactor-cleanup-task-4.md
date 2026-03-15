# Task 4: U4 Menu-Deselect Bug + @radix-ui Explicit Dependency

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:writing-plans to plan
> the implementation steps for this task.

**Scope:** Fix context menu click deselecting the node + add explicit @radix-ui dep
**Parent feature:** [Phase 13 Index](./2026-03-15-refactor-cleanup-index.md)

## Write Set

- Modify: `src/components/canvas/Canvas.tsx:218` (~+3 lines — suppress deselect during menu)
- Modify: `package.json` (~+1 line — add `@radix-ui/react-visually-hidden`)
- Create: `test/unit/components/canvas/contextMenuDeselect.test.ts` (test, unlimited)

## Read Set (context needed)

- `src/components/canvas/Canvas.tsx` — `onPaneClick` handler, context menu state
- `src/components/canvas/hooks/useCanvasInteractions.ts` — `onPaneClick` implementation
- `src/components/shared/ContextMenu.tsx` — current close-on-click-outside behavior
- `src/store/canvasStore.ts` — `selectNodes`, `clearSelection` methods
- `src/components/shared/CommandPalette.tsx:3` — existing `@radix-ui/react-visually-hidden` import
- `package.json` — current dependencies

## Dependencies

- **Blocked by:** Nothing (independent)
- **Blocks:** Task 7 (E2E tests will cover this fix)

## Description

### Bug: U4 — Menu click deselects node

**Symptom:** Right-click a node → context menu appears → click a menu item → the node gets deselected before the action executes.

**Root cause:** ReactFlow's `onPaneClick` fires when clicking anywhere on the canvas pane, including the area behind the context menu. The context menu is rendered as an overlay (`position: fixed`), but the underlying `click` event still reaches ReactFlow's pane handler.

The `MenuItem` component uses `onMouseDown` with `e.stopPropagation()` (ContextMenu.tsx:48–53), which stops mousedown/pointerdown propagation. However, the `click` event is a separate event that fires after mouseup — ReactFlow's `onPaneClick` likely listens to click, not mousedown. The propagation stop on mousedown does NOT prevent the subsequent click event from reaching the pane.

Additionally, the close-on-click-outside `pointerdown` listener (ContextMenu.tsx:84–88) only fires for clicks **outside** the menu ref — clicks on menu items are inside the ref and don't trigger `onClose()` via that path. The `onClose()` is called explicitly inside each `MenuItem.onClick`.

**Fix approach:** Use a ref-based flag to suppress the next pane click after a context menu is open. A ref avoids stale-closure issues that would arise from checking React state in a `useCallback`:

```typescript
// In Canvas.tsx:
const contextMenuOpenRef = useRef(false);

// Keep ref in sync with state:
useEffect(() => {
  contextMenuOpenRef.current = contextMenu !== null;
}, [contextMenu]);

const onPaneClickGuarded = useCallback(() => {
  // Suppress deselection when the context menu was just open.
  // The ref is always current (no stale closure), so this is safe
  // regardless of React's batching behavior.
  if (contextMenuOpenRef.current) {
    setContextMenu(null);
    return;
  }
  onPaneClick();
}, [onPaneClick]);
```

Then use `onPaneClickGuarded` instead of `onPaneClick` in the ReactFlow props.

### Explicit dependency: @radix-ui/react-visually-hidden

`src/components/shared/CommandPalette.tsx` imports `@radix-ui/react-visually-hidden` but this package is only available as a transitive dependency of `cmdk`. Add it explicitly:

```bash
npm install @radix-ui/react-visually-hidden
```

### Testing strategy

**Unit test:** Mock ReactFlow's pane click behavior and verify:
1. Right-click node → context menu opens → pane click does NOT deselect
2. Context menu closes → next pane click DOES deselect (normal behavior restored)
3. Pane click without context menu → deselects normally (regression check)

**Note:** Full E2E coverage for this fix is in Task 7 (`ui-polish.spec.ts`).

### Acceptance criteria

- [ ] Clicking a context menu item does not deselect the right-clicked node
- [ ] Pane clicks still deselect when no context menu is open
- [ ] `@radix-ui/react-visually-hidden` is an explicit dependency in `package.json`
- [ ] Unit tests cover the guarded pane click behavior
- [ ] Existing canvas operation E2E tests still pass
