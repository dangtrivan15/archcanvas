# UX Improvements: Scroll, Collapse, Project Info

**Date**: 2026-03-19
**Status**: Approved

## Overview

Three independent UX improvements to the ArchCanvas shell:

1. **Scroll = Pan** — Mouse scroll pans the canvas; Cmd+Scroll zooms (Figma-style)
2. **Collapsible detail pane** — Right panel toggle for full-width canvas
3. **Project info display** — Project name in top menubar, filename in status bar

---

## 1. Scroll = Pan

### Current behavior
ReactFlow defaults: scroll wheel zooms, middle-click drag or right-click drag pans. No `panOnScroll` or `zoomOnScroll` props set explicitly.

### Target behavior
| Input | Action |
|-------|--------|
| Scroll wheel | Pan vertically |
| Shift + Scroll | Pan horizontally |
| Cmd + Scroll (macOS) | Zoom in/out |
| Trackpad pinch | Zoom in/out |
| Middle/right-click drag | Pan (unchanged) |

### Implementation
**File**: `src/components/canvas/Canvas.tsx`

Add three ReactFlow props to the `<ReactFlow>` element:
- `panOnScroll={true}` — scroll wheel pans instead of zooms
- `zoomOnScroll={false}` — disable default scroll-to-zoom
- `zoomOnPinch={true}` — keep pinch-to-zoom on trackpads

ReactFlow's `panOnScroll` natively supports Cmd+Scroll (macOS) / Ctrl+Scroll (Windows/Linux) for zooming when `panOnScroll` is enabled. No custom event handling needed — this is built into ReactFlow.

**Note**: `panOnScroll` is always active regardless of tool mode (`select`/`pan`/`connect`). This is intentional — scroll-panning is a viewport navigation mechanism independent of the editing tool, matching Figma's behavior where scroll always pans regardless of the selected tool.

### Scope
- No new files
- No new dependencies
- No settings / configurability

---

## 2. Collapsible Detail Pane

### Current behavior
The right panel (`ResizablePanel` in `App.tsx` lines 123-132) already has `collapsible` and `collapsedSize="0px"` set. It can be collapsed via:
- `uiStore.toggleRightPanel()` (called from View menu and LeftToolbar)

When collapsed, the panel disappears entirely (0px) — no visual affordance to re-open it other than the View menu or left toolbar button.

### Target behavior
When collapsed, show a thin vertical strip (~28px) with a chevron icon that the user can click to re-expand the panel. This provides a persistent, discoverable toggle on the panel edge itself.

### Implementation
**File**: `src/App.tsx`

Change `collapsedSize` from `"0px"` to `"28px"` so the collapsed panel remains visible as a thin strip.

Add `onResize` callback to the right `ResizablePanel` to keep `uiStore.rightPanelCollapsed` in sync when the user drags the resize handle past the collapse threshold (not just when using `toggleRightPanel`):
```tsx
onResize={() => {
  useUiStore.setState({
    rightPanelCollapsed: rightPanelRef.current?.isCollapsed() ?? false,
  });
}}
```

**File**: `src/components/layout/RightPanel.tsx`

When `rightPanelCollapsed` is true, return early with only the collapsed strip — no existing content renders. When expanded, render current content (detail panel / chat / entities).

The collapsed strip shows a `ChevronLeft` icon (pointing left = "pull this panel open from the right edge"). Click calls `uiStore.toggleRightPanel()` to expand.

**File**: `src/store/uiStore.ts`

Add `rightPanelCollapsed: boolean` state (default: `false`). Update in `toggleRightPanel` and via `onResize` callback in `App.tsx`.

### Collapsed strip design
- Width: 28px (via `collapsedSize="28px"`)
- Content: single `ChevronLeft` icon centered vertically
- Click anywhere on the strip → `toggleRightPanel()` to expand
- Background: same as panel (`bg-background`), left border (`border-l border-border`)

### Keyboard shortcut
Deferred — toggle is accessible via View menu, left toolbar button, and the new collapse strip. A dedicated shortcut (e.g., Cmd+\) can be added later if needed.

### Scope
- Modified files: `App.tsx`, `RightPanel.tsx`, `uiStore.ts`
- No new files
- No new dependencies (Lucide `ChevronLeft` already available)

---

## 3. Project Info Display

### Current behavior
- Project name shown in document title (`App.tsx` lines 42-57): `"● ProjectName — ArchCanvas"`
- Status bar shows: version, "Modified" badge, scope name, node/edge counts
- Top menubar shows: logo icon, File/Edit/View menus
- No project name or filename visible in the app UI itself

### Target behavior
- **Top menubar**: Project name displayed between logo and File menu, styled as a subtle label
- **Status bar**: Project filename (the root canvas file name, e.g. `my-project.archcanvas.yaml`) displayed after version string

### Implementation

**File**: `src/components/layout/TopMenubar.tsx`

Add a project name span between the logo `<div>` and the first `<MenubarMenu>`:
```tsx
<span className="text-sm font-medium text-muted-foreground px-2 truncate max-w-[200px]">
  {projectName}
</span>
```

Source: `useFileStore((s) => s.project?.root.data.project?.name ?? null)`

When no project is open, hide the span.

**File**: `src/components/layout/StatusBar.tsx`

Add the project filename after the version string. Source: `useFileStore((s) => s.project?.root.fileName ?? null)` — this is the actual file name on disk (e.g. `my-project.archcanvas.yaml`), distinct from the project display name shown in the menubar.

Display as a subdued text span: `<span className="text-muted-foreground/60">{fileName}</span>`

When no project is open, hide the span.

### Scope
- Modified files: `TopMenubar.tsx`, `StatusBar.tsx`
- No new files
- No new store changes

---

## Testing

### Unit tests
- `uiStore.ts`: Test `rightPanelCollapsed` is toggled correctly by `toggleRightPanel`

### E2E tests
Add assertions to existing `app-shell.spec.ts` or create targeted checks:

1. **Scroll = pan**: Verify `panOnScroll` is set on the ReactFlow container (attribute check or functional scroll test)
2. **Collapse toggle**: Click toggle → verify panel collapses → click strip → verify expands
3. **Project info**: Open a project → verify project name in menubar, filename in status bar

---

## Summary of changes

| File | Change |
|------|--------|
| `Canvas.tsx` | Add `panOnScroll`, `zoomOnScroll={false}`, `zoomOnPinch` |
| `App.tsx` | Change `collapsedSize` to `"28px"`, add `onResize` sync |
| `RightPanel.tsx` | Add collapsed strip with expand chevron |
| `uiStore.ts` | Add `rightPanelCollapsed` boolean |
| `TopMenubar.tsx` | Add project name display |
| `StatusBar.tsx` | Add project filename display |
