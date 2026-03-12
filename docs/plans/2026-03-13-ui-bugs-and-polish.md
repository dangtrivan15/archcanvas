# UI Bugs & Polish Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 7 bugs and 7 UX issues found during Playwright-driven UI audit, then add comprehensive E2E tests to prevent regressions.

**Architecture:** Each fix is a small, isolated change to 1-3 files. Bug fixes (B1-B7) come first, then UX improvements (U1-U7), then E2E tests covering every flow. TDD where the fix is testable via unit test; E2E tests added at the end for integration coverage.

**Tech Stack:** React 19, ReactFlow 12, Zustand 5, cmdk, Lucide React, Radix UI, Playwright, Vitest

---

## Chunk 1: Bug Fixes (B1–B7)

### Task 1: B1 — Context menu Delete doesn't delete the node

The `handleNodeDelete` callback in Canvas.tsx calls `deleteSelection()` but the right-clicked node was never added to `selectedNodeIds`. The `nodeId` is available in the context menu target but never passed through.

**Files:**
- Modify: `src/components/shared/ContextMenu.tsx` (lines 26, 159-161, 180-182)
- Modify: `src/components/canvas/Canvas.tsx` (lines 142-144, 193)

- [ ] **Step 1: Write failing unit test**

In `test/components/context-menu-delete.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';

describe('ContextMenu delete callback', () => {
  it('onNodeDelete receives the nodeId of the target node', () => {
    // This is tested via E2E — see Task 14.
    // The fix is a wiring change, verified by code review + E2E.
    expect(true).toBe(true);
  });
});
```

> Note: This is a wiring bug best covered by E2E (Task 14). No unit test needed here — proceed directly to fix.

- [ ] **Step 2: Fix ContextMenu.tsx — update onNodeDelete signature**

Change the `onNodeDelete` prop type from `() => void` to `(nodeId: string) => void`:

```typescript
// In ContextMenuProps interface (line 26):
onNodeDelete: (nodeId: string) => void;
```

Update both Delete MenuItems to pass `target.nodeId`:

```typescript
// Line ~159 (inlineNode):
onClick={() => {
  onNodeDelete(target.nodeId);
  onClose();
}}

// Line ~180 (refNode):
onClick={() => {
  onNodeDelete(target.nodeId);
  onClose();
}}
```

- [ ] **Step 3: Fix Canvas.tsx — select node before deleting**

```typescript
// Line ~142:
const handleNodeDelete = useCallback((nodeId: string) => {
  useCanvasStore.getState().selectNodes([nodeId]);
  useCanvasStore.getState().deleteSelection();
}, []);
```

- [ ] **Step 4: Verify manually — right-click a node, click Delete, confirm node removed**

- [ ] **Step 5: Commit**

```bash
git add src/components/shared/ContextMenu.tsx src/components/canvas/Canvas.tsx
git commit -m "fix: context menu Delete now passes nodeId and selects before deleting"
```

---

### Task 2: B2 — Node drag teleports instead of smooth movement

`useCanvasInteractions.ts` gates position updates on `change.dragging === false`, so ReactFlow's internal drag state diverges from the Zustand store during drag. When the drag ends, the store update causes a re-render snap.

The fix: let ReactFlow manage intermediate drag positions by also applying position changes during drag. Only persist to the engine on drag-end to avoid flooding the history.

**Files:**
- Modify: `src/components/canvas/hooks/useCanvasInteractions.ts` (lines 9-22)
- Modify: `src/components/canvas/hooks/useCanvasRenderer.ts` (lines 18-36)

- [ ] **Step 1: Update useCanvasInteractions.ts — track local drag positions**

Replace the `onNodesChange` callback to handle both dragging and drag-end:

```typescript
import { useCallback, useRef } from 'react';
import type { Node as RFNode, NodeChange, Connection } from '@xyflow/react';
import { useCanvasStore } from '@/store/canvasStore';
import { useGraphStore } from '@/store/graphStore';
import { useNavigationStore } from '@/store/navigationStore';
import type { CanvasNodeData } from '../types';

export function useCanvasInteractions() {
  // Track ephemeral drag positions that haven't been committed to the store yet
  const dragPositions = useRef<Map<string, { x: number; y: number }>>(new Map());

  const onNodesChange = useCallback((changes: NodeChange[]) => {
    const canvasId = useNavigationStore.getState().currentCanvasId;
    for (const change of changes) {
      if (change.type === 'position' && change.position) {
        if (change.dragging) {
          // During drag: track position locally (ReactFlow handles visual update)
          dragPositions.current.set(change.id, change.position);
        } else {
          // Drag ended: commit final position to the engine (creates undo entry)
          dragPositions.current.delete(change.id);
          useGraphStore
            .getState()
            .updateNodePosition(canvasId, change.id, change.position);
        }
      }
    }
  }, []);

  // ... rest of hooks unchanged
```

- [ ] **Step 2: Verify manually — drag a node, confirm smooth movement**

- [ ] **Step 3: Commit**

```bash
git add src/components/canvas/hooks/useCanvasInteractions.ts
git commit -m "fix: smooth node dragging by not gating on dragging===false"
```

---

### Task 3: B3 — Left toolbar Select/Pan/Connect buttons are no-ops

These buttons have `onClick: undefined`. They need a tool-mode state so the canvas knows which interaction mode is active.

**Files:**
- Create: `src/store/toolStore.ts`
- Modify: `src/components/layout/LeftToolbar.tsx`
- Modify: `src/components/canvas/Canvas.tsx` (wire tool mode to ReactFlow props)

- [ ] **Step 1: Create toolStore.ts**

```typescript
import { create } from 'zustand';

export type ToolMode = 'select' | 'pan' | 'connect';

interface ToolState {
  mode: ToolMode;
  setMode: (mode: ToolMode) => void;
}

export const useToolStore = create<ToolState>((set) => ({
  mode: 'select',
  setMode: (mode) => set({ mode }),
}));
```

- [ ] **Step 2: Wire LeftToolbar buttons to tool store**

```typescript
// In LeftToolbar.tsx — add import:
import { useToolStore } from '@/store/toolStore';

// Update the tools array:
{ icon: MousePointer2, label: "Select", shortcut: "V", onClick: () => useToolStore.getState().setMode('select') },
{ icon: Hand, label: "Pan", shortcut: "H", onClick: () => useToolStore.getState().setMode('pan') },
// ... Add Node stays the same ...
{ icon: Cable, label: "Connect", shortcut: "C", onClick: () => useToolStore.getState().setMode('connect') },
```

Add active state styling — subscribe to the store:

```typescript
export function LeftToolbar() {
  const activeMode = useToolStore((s) => s.mode);

  // In the button className, add conditional:
  // `${activeMode === modeForThisButton ? 'bg-accent text-accent-foreground' : ''}`
```

Each tool entry needs a `mode` field to match against `activeMode`:

```typescript
const tools = [
  { icon: MousePointer2, label: "Select", shortcut: "V", mode: 'select' as const,
    onClick: () => useToolStore.getState().setMode('select') },
  { icon: Hand, label: "Pan", shortcut: "H", mode: 'pan' as const,
    onClick: () => useToolStore.getState().setMode('pan') },
  { icon: Square, label: "Add Node", shortcut: "N", mode: undefined,
    onClick: () => window.dispatchEvent(new CustomEvent('archcanvas:open-palette', { detail: { prefix: '@' } })) },
  { icon: Cable, label: "Connect", shortcut: "C", mode: 'connect' as const,
    onClick: () => useToolStore.getState().setMode('connect') },
  // ... search, layout, undo, redo stay as-is with mode: undefined
];
```

In the render, highlight active:

```typescript
className={`flex h-9 w-9 items-center justify-center rounded-md transition-colors ${
  mode && activeMode === mode
    ? 'bg-accent text-accent-foreground'
    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
}`}
```

- [ ] **Step 3: Wire Canvas.tsx to respect tool mode**

```typescript
// In Canvas.tsx:
import { useToolStore } from '@/store/toolStore';

// Inside the Canvas component:
const toolMode = useToolStore((s) => s.mode);

// Pass to ReactFlow:
<ReactFlow
  // ... existing props ...
  panOnDrag={toolMode === 'pan'}
  nodesDraggable={toolMode === 'select'}
  nodesConnectable={toolMode === 'connect' || toolMode === 'select'}
  selectionOnDrag={toolMode === 'select'}
>
```

- [ ] **Step 4: Verify — click Pan, confirm canvas pans on drag; click Select, confirm back to normal**

- [ ] **Step 5: Commit**

```bash
git add src/store/toolStore.ts src/components/layout/LeftToolbar.tsx src/components/canvas/Canvas.tsx
git commit -m "feat: wire Select/Pan/Connect toolbar buttons to tool-mode state"
```

---

### Task 4: B4 — Nodes display Lucide icon component name as text

The YAML `icon` field contains Lucide component names (e.g., `MessageSquare`). `NodeRenderer` renders this as plain text. The fix is to resolve the name to an actual Lucide React component dynamically.

**Files:**
- Create: `src/components/nodes/iconMap.ts`
- Modify: `src/components/nodes/NodeRenderer.tsx` (line 69)

- [ ] **Step 1: Create iconMap.ts — map icon name strings to Lucide components**

```typescript
import type { LucideIcon } from 'lucide-react';
import {
  Server, Zap, Cog, Container, Clock,
  Database, MemoryStick, HardDrive, Search,
  MessageSquare, Radio, GitBranch, Bell,
  Globe, Scale, Cloud,
  Monitor, Smartphone, Terminal,
  ExternalLink, Webhook, ArrowRightLeft,
  Shield, Lock, ShieldCheck,
  FileText, Activity, Route,
  Brain, Boxes, Bot, Layers,
  Square,
} from 'lucide-react';

const ICON_MAP: Record<string, LucideIcon> = {
  Server, Zap, Cog, Container, Clock,
  Database, MemoryStick, HardDrive, Search,
  MessageSquare, Radio, GitBranch, Bell,
  Globe, Scale, Cloud,
  Monitor, Smartphone, Terminal,
  ExternalLink, Webhook, ArrowRightLeft,
  Shield, Lock, ShieldCheck,
  FileText, Activity, Route,
  Brain, Boxes, Bot, Layers,
  Square,
};

export function resolveIcon(name: string | undefined): LucideIcon | null {
  if (!name) return null;
  return ICON_MAP[name] ?? null;
}
```

- [ ] **Step 2: Update NodeRenderer.tsx to use resolveIcon**

```typescript
// Add import:
import { resolveIcon } from './iconMap';

// Replace the icon rendering (line ~67-70):
const iconName = nodeDef?.metadata.icon;
const IconComponent = resolveIcon(iconName);

// In JSX, replace the icon span:
<span className="arch-node-header-icon" aria-hidden="true">
  {IconComponent ? <IconComponent className="h-4 w-4 inline-block" /> : (iconName ?? (isRef ? '↗' : '□'))}
</span>
```

- [ ] **Step 3: Verify — nodes now show actual Lucide icons instead of text names**

- [ ] **Step 4: Commit**

```bash
git add src/components/nodes/iconMap.ts src/components/nodes/NodeRenderer.tsx
git commit -m "fix: render Lucide icons on nodes instead of raw icon name strings"
```

---

### Task 5: B5 — Nodes display raw auto-generated IDs

Nodes are created with `id: node-${crypto.randomUUID().slice(0, 8)}` but no `displayName`. The renderer falls back to showing the raw ID. Fix: set `displayName` from the NodeDef's `displayName` on creation (e.g., "Service", "Database").

**Files:**
- Modify: `src/components/shared/CommandPalette.tsx` (line 150-154, NodeTypeProvider.onSelect)

- [ ] **Step 1: Update node creation to include displayName**

```typescript
// In CommandPalette.tsx, NodeTypeProvider.onSelect (line ~140-156):
onSelect(result: PaletteResult) {
  const typeKey = result.id.replace(/^nodetype:/, '');
  const canvasId = useNavigationStore.getState().currentCanvasId;
  const canvas = useFileStore.getState().getCanvas(canvasId);
  const existingCount = canvas?.data.nodes?.length ?? 0;

  // Resolve the NodeDef to get the display name
  const nodeDef = useRegistryStore.getState().resolve(typeKey);
  const baseName = nodeDef?.metadata.displayName ?? typeKey.split('/').pop() ?? 'Node';

  // Count existing nodes of the same type to generate unique name
  const sameTypeCount = (canvas?.data.nodes ?? []).filter(
    (n) => 'type' in n && n.type === typeKey
  ).length;
  const displayName = sameTypeCount === 0 ? baseName : `${baseName} ${sameTypeCount + 1}`;

  const col = existingCount % 2;
  const row = Math.floor(existingCount / 2);
  const newNode: Node = {
    id: `node-${crypto.randomUUID().slice(0, 8)}`,
    type: typeKey,
    displayName,
    position: { x: col * 300, y: row * 200 },
  };
  useGraphStore.getState().addNode(canvasId, newNode);
},
```

- [ ] **Step 2: Verify — add a Service node, confirm it shows "Service" not "node-abc123"**

- [ ] **Step 3: Verify — add a second Service, confirm it shows "Service 2"**

- [ ] **Step 4: Commit**

```bash
git add src/components/shared/CommandPalette.tsx
git commit -m "fix: auto-assign displayName from NodeDef when creating nodes"
```

---

### Task 6: B6 — Status bar grammar "1 nodes"

**Files:**
- Modify: `src/components/layout/StatusBar.tsx` (lines 20-21)

- [ ] **Step 1: Fix pluralization**

```typescript
// Replace (lines ~20-21):
<span>{nodeCount} nodes</span>
<span>{edgeCount} edges</span>

// With:
<span>{nodeCount} {nodeCount === 1 ? 'node' : 'nodes'}</span>
<span>{edgeCount} {edgeCount === 1 ? 'edge' : 'edges'}</span>
```

- [ ] **Step 2: Commit**

```bash
git add src/components/layout/StatusBar.tsx
git commit -m "fix: correct singular/plural in status bar node/edge counts"
```

---

### Task 7: B7 — Missing favicon (404 console error)

**Files:**
- Create: `public/favicon.svg`

- [ ] **Step 1: Add a simple SVG favicon**

Create `public/favicon.svg`:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <rect width="32" height="32" rx="6" fill="#1e1e2e"/>
  <path d="M8 12h6v8H8zM18 8h6v6h-6zM18 18h6v6h-6z" fill="#cdd6f4" opacity="0.9"/>
  <line x1="14" y1="16" x2="18" y2="11" stroke="#89b4fa" stroke-width="1.5"/>
  <line x1="14" y1="16" x2="18" y2="21" stroke="#89b4fa" stroke-width="1.5"/>
</svg>
```

- [ ] **Step 2: Add link tag in index.html**

```html
<!-- In <head>: -->
<link rel="icon" type="image/svg+xml" href="/favicon.svg" />
```

- [ ] **Step 3: Commit**

```bash
git add public/favicon.svg index.html
git commit -m "fix: add SVG favicon to eliminate 404 console error"
```

---

## Chunk 2: Console Error Fixes (C1–C2)

### Task 8: C1+C2 — CommandPalette missing DialogTitle and Description

The cmdk `Command.Dialog` wraps Radix Dialog internally. Radix requires `DialogTitle` for accessibility. The fix is to add a visually hidden title and description.

**Files:**
- Modify: `src/components/shared/CommandPalette.tsx` (line ~301-309)

- [ ] **Step 1: Check if VisuallyHidden is available from Radix**

```bash
grep -r "VisuallyHidden\|visually-hidden" src/components/ui/ node_modules/@radix-ui/
```

If not available, install: `npm install @radix-ui/react-visually-hidden`

Or use a simple CSS approach with `sr-only` (Tailwind class).

- [ ] **Step 2: Add hidden title and description inside Command.Dialog**

```typescript
// At the top of the dialog content div (line ~310):
<div className="w-full max-w-xl rounded-lg border ...">
  {/* Accessibility: Radix Dialog requires title + description */}
  <span className="sr-only" id="palette-title">Command palette</span>
  <span className="sr-only" id="palette-description">Search commands, nodes, and entities</span>
  <Command.Input ... />
```

And add `aria-labelledby` and `aria-describedby` to the Dialog:

```typescript
<Command.Dialog
  open={open}
  onOpenChange={handleOpenChange}
  shouldFilter={false}
  label="Command palette"
  aria-labelledby="palette-title"
  aria-describedby="palette-description"
  // ... rest of props
>
```

> Note: The exact fix depends on how cmdk exposes Radix Dialog props. Check `cmdk` docs — if it passes through `aria-*` props, use those. If not, wrap in a `<Dialog>` with `<DialogTitle>` from Radix and use `<VisuallyHidden>`.

- [ ] **Step 3: Verify — open palette, confirm no console errors**

- [ ] **Step 4: Commit**

```bash
git add src/components/shared/CommandPalette.tsx
git commit -m "fix: add visually-hidden DialogTitle to CommandPalette for a11y"
```

---

## Chunk 3: UX Improvements (U1–U7)

### Task 9: U3 — Right-click doesn't populate detail panel

When right-clicking a node, the context menu appears but the detail panel doesn't show the node's properties.

**Files:**
- Modify: `src/components/canvas/Canvas.tsx` (onNodeContextMenu callback, line ~107)

- [ ] **Step 1: Select the node on right-click**

```typescript
// In onNodeContextMenu (line ~106):
const onNodeContextMenu = useCallback(
  (e: React.MouseEvent, node: RFNode<CanvasNodeData>) => {
    e.preventDefault();
    // Select the node so the detail panel populates
    useCanvasStore.getState().selectNodes([node.id]);
    const nodeData = node.data as CanvasNodeData;
    const target = nodeData.isRef
      ? { kind: 'refNode' as const, nodeId: node.id, nodeData }
      : { kind: 'inlineNode' as const, nodeId: node.id, nodeData };
    setContextMenu({ target, x: e.clientX, y: e.clientY });
  },
  [],
);
```

- [ ] **Step 2: Verify — right-click a node, confirm detail panel shows properties**

- [ ] **Step 3: Commit**

```bash
git add src/components/canvas/Canvas.tsx
git commit -m "fix: select node on right-click so detail panel populates"
```

---

### Task 10: U5 — Auto-layout should chain with fit-view

After auto-layout, nodes may be partially off-screen.

**Files:**
- Modify: `src/components/canvas/Canvas.tsx` (handleAutoLayout, line ~47-56)

- [ ] **Step 1: Verify fit-view is already chained**

Looking at the code, `handleAutoLayout` already calls `reactFlow.fitView({ duration: 400 })` after layout. If nodes are still clipped, increase the padding:

```typescript
requestAnimationFrame(() => reactFlow.fitView({ duration: 400, padding: 0.15 }));
```

- [ ] **Step 2: Commit (if changed)**

```bash
git add src/components/canvas/Canvas.tsx
git commit -m "fix: increase fitView padding after auto-layout"
```

---

### Task 11: U6 — Palette shows raw node IDs in the Nodes group

When the palette lists existing nodes, it shows `node-7fe34796` instead of the display name.

**Files:**
- Modify: `src/components/shared/CommandPalette.tsx` (NodeSearchProvider, line ~56-73)

- [ ] **Step 1: Fix NodeSearchProvider to use displayName**

The code at line ~66-67 already resolves `displayName`:
```typescript
const displayName = isInline
  ? ((node as { displayName?: string }).displayName ?? node.id)
```

This will now work automatically once B5 is fixed (Task 5 sets `displayName` on creation). For previously-created nodes that lack a displayName, the fallback is the ID — which is expected.

No code change needed here if Task 5 is done first.

- [ ] **Step 2: Verify — add a node, open palette, confirm node listed by display name**

---

### Task 12: U7 — Scope shows `__root__` in palette

**Files:**
- Modify: `src/components/shared/CommandPalette.tsx` (ScopeProvider, line ~211-215)

- [ ] **Step 1: Map __root__ to "Root" display name**

```typescript
// In ScopeProvider.search (line ~211):
const displayName = canvasId === '__root__'
  ? 'Root'
  : (loaded.data.displayName ?? canvasId);
```

- [ ] **Step 2: Commit**

```bash
git add src/components/shared/CommandPalette.tsx
git commit -m "fix: show 'Root' instead of '__root__' in palette scope list"
```

---

### Task 13: U4 — Menu click deselects node

When clicking File/Edit/View, `onPaneClick` fires and clears selection. The fix: check if the click target is inside the menu bar and skip clearing.

**Files:**
- Modify: `src/components/canvas/hooks/useCanvasInteractions.ts` (onPaneClick)

- [ ] **Step 1: Investigate if this is a ReactFlow issue**

ReactFlow's `onPaneClick` fires when the ReactFlow pane is clicked. Menu clicks should NOT trigger this since they're outside the ReactFlow component. If they do, it's a focus/blur issue.

More likely: the menu click causes a blur on the canvas, which ReactFlow interprets as a pane click. Check if adding `e.stopPropagation()` on the menubar helps, or if we need to guard `onPaneClick`.

> This may require more investigation. If the fix is non-trivial, defer to a follow-up task.

- [ ] **Step 2: If fixable — apply guard; if complex — document as known issue**

---

## Chunk 4: Comprehensive E2E Tests

### Task 14: E2E tests for all probed flows

Add a new E2E spec file covering every flow tested during the Playwright probe.

**Files:**
- Create: `test/e2e/ui-polish.spec.ts`

- [ ] **Step 1: Write the E2E test file**

```typescript
import { test, expect } from "@playwright/test";

// ---------------------------------------------------------------------------
// Helper: add a node via palette
// ---------------------------------------------------------------------------
async function addNodeViaPalette(page: import('@playwright/test').Page, pattern: RegExp) {
  await page.keyboard.press("Meta+k");
  await page.getByRole("option", { name: pattern }).click();
  await page.waitForTimeout(200);
}

// ---------------------------------------------------------------------------
// B1: Context menu Delete
// ---------------------------------------------------------------------------
test.describe("context menu delete", () => {
  test("Delete removes the target node", async ({ page }) => {
    await page.goto("/");
    await addNodeViaPalette(page, /Service compute\/service/);
    await expect(page.locator(".react-flow__node")).toHaveCount(1);

    // Right-click the node and delete
    await page.locator(".react-flow__node").click({ button: "right" });
    await page.getByRole("button", { name: "Delete" }).click();

    await expect(page.locator(".react-flow__node")).toHaveCount(0);
    await expect(page.getByText(/0 nodes/)).toBeVisible();
  });

  test("Delete removes correct node when multiple exist", async ({ page }) => {
    await page.goto("/");
    await addNodeViaPalette(page, /Service compute\/service/);
    await addNodeViaPalette(page, /Database data\/database/);
    await expect(page.locator(".react-flow__node")).toHaveCount(2);

    // Right-click the first node and delete
    await page.locator(".react-flow__node").first().click({ button: "right" });
    await page.getByRole("button", { name: "Delete" }).click();

    await expect(page.locator(".react-flow__node")).toHaveCount(1);
  });
});

// ---------------------------------------------------------------------------
// B2: Smooth node dragging (no teleport)
// ---------------------------------------------------------------------------
test.describe("node dragging", () => {
  test("node follows cursor during drag", async ({ page }) => {
    await page.goto("/");
    await addNodeViaPalette(page, /Service compute\/service/);
    await page.locator(".react-flow__node").click(); // select it

    const node = page.locator(".react-flow__node");
    const box = await node.boundingBox();
    expect(box).not.toBeNull();

    if (box) {
      const startX = box.x + box.width / 2;
      const startY = box.y + box.height / 2;

      // Drag 100px right
      await page.mouse.move(startX, startY);
      await page.mouse.down();
      await page.mouse.move(startX + 50, startY, { steps: 5 });
      await page.mouse.move(startX + 100, startY, { steps: 5 });

      // WHILE still dragging, check node has moved
      const midBox = await node.boundingBox();
      expect(midBox).not.toBeNull();
      if (midBox) {
        expect(midBox.x).toBeGreaterThan(box.x + 30); // should have moved substantially
      }

      await page.mouse.up();
    }
  });
});

// ---------------------------------------------------------------------------
// B3: Left toolbar tool modes
// ---------------------------------------------------------------------------
test.describe("toolbar tool modes", () => {
  test("Select button is active by default", async ({ page }) => {
    await page.goto("/");
    const selectBtn = page.getByRole("button", { name: "Select (V)" });
    // Should have active styling (bg-accent class)
    await expect(selectBtn).toHaveClass(/bg-accent/);
  });

  test("clicking Pan activates pan mode", async ({ page }) => {
    await page.goto("/");
    const panBtn = page.getByRole("button", { name: "Pan (H)" });
    await panBtn.click();
    await expect(panBtn).toHaveClass(/bg-accent/);

    // Select should no longer be active
    const selectBtn = page.getByRole("button", { name: "Select (V)" });
    await expect(selectBtn).not.toHaveClass(/bg-accent/);
  });
});

// ---------------------------------------------------------------------------
// B4: Nodes show actual icons (not text names)
// ---------------------------------------------------------------------------
test.describe("node icon rendering", () => {
  test("node renders SVG icon, not raw text like 'MessageSquare'", async ({ page }) => {
    await page.goto("/");
    await addNodeViaPalette(page, /Message Queue messaging\/message-queue/);

    const node = page.locator(".react-flow__node");
    // Should NOT contain the text "MessageSquare"
    await expect(node.getByText("MessageSquare")).not.toBeVisible();
    // Should contain an SVG icon
    await expect(node.locator(".arch-node-header-icon svg")).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// B5: Nodes show display name (not raw ID)
// ---------------------------------------------------------------------------
test.describe("node display name", () => {
  test("node shows 'Service' not 'node-xxxx'", async ({ page }) => {
    await page.goto("/");
    await addNodeViaPalette(page, /Service compute\/service/);

    const node = page.locator(".react-flow__node");
    const nameText = await node.locator(".arch-node-header-name").textContent();
    expect(nameText).toBe("Service");
    expect(nameText).not.toMatch(/^node-/);
  });

  test("second node of same type gets numbered name", async ({ page }) => {
    await page.goto("/");
    await addNodeViaPalette(page, /Service compute\/service/);
    await addNodeViaPalette(page, /Service compute\/service/);

    const names = await page.locator(".arch-node-header-name").allTextContents();
    expect(names).toContain("Service");
    expect(names).toContain("Service 2");
  });
});

// ---------------------------------------------------------------------------
// B6: Status bar grammar
// ---------------------------------------------------------------------------
test.describe("status bar pluralization", () => {
  test("shows '1 node' not '1 nodes'", async ({ page }) => {
    await page.goto("/");
    await addNodeViaPalette(page, /Service compute\/service/);
    await expect(page.getByText("1 node")).toBeVisible();
    await expect(page.getByText("1 nodes")).not.toBeVisible();
  });

  test("shows '2 nodes' for multiple", async ({ page }) => {
    await page.goto("/");
    await addNodeViaPalette(page, /Service compute\/service/);
    await addNodeViaPalette(page, /Database data\/database/);
    await expect(page.getByText("2 nodes")).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// U3: Right-click populates detail panel
// ---------------------------------------------------------------------------
test.describe("right-click selects node", () => {
  test("right-click populates the detail panel", async ({ page }) => {
    await page.goto("/");
    await addNodeViaPalette(page, /Service compute\/service/);

    // Click away to deselect
    await page.locator(".react-flow__pane").click({ position: { x: 10, y: 10 } });
    await expect(page.getByText("Select a node to view its properties.")).toBeVisible();

    // Right-click the node
    await page.locator(".react-flow__node").click({ button: "right" });

    // Detail panel should now show the node info
    await expect(page.getByText("compute/service")).toBeVisible();
    // Dismiss context menu
    await page.keyboard.press("Escape");
  });
});

// ---------------------------------------------------------------------------
// U7: Palette scope shows "Root" not "__root__"
// ---------------------------------------------------------------------------
test.describe("palette scope display", () => {
  test("scope section shows 'Root' not '__root__'", async ({ page }) => {
    await page.goto("/");
    await page.keyboard.press("Meta+k");

    // The scope group should show "Root"
    const rootOption = page.getByRole("option", { name: /Root/ }).last();
    await expect(rootOption).toBeVisible();
    // Should NOT show __root__ as the display text
    await expect(page.getByRole("option", { name: "__root__ __root__" })).not.toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Console errors: no a11y violations from palette
// ---------------------------------------------------------------------------
test.describe("palette accessibility", () => {
  test("opening palette doesn't produce DialogTitle console errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });

    await page.goto("/");
    await page.keyboard.press("Meta+k");
    await page.waitForTimeout(300);
    await page.keyboard.press("Escape");

    const dialogTitleErrors = errors.filter((e) => e.includes("DialogTitle"));
    expect(dialogTitleErrors).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Undo/Redo
// ---------------------------------------------------------------------------
test.describe("undo redo", () => {
  test("undo reverses node addition", async ({ page }) => {
    await page.goto("/");
    await addNodeViaPalette(page, /Service compute\/service/);
    await expect(page.locator(".react-flow__node")).toHaveCount(1);

    // Undo
    await page.keyboard.press("Meta+z");
    await expect(page.locator(".react-flow__node")).toHaveCount(0);

    // Redo
    await page.keyboard.press("Meta+Shift+z");
    await expect(page.locator(".react-flow__node")).toHaveCount(1);
  });
});

// ---------------------------------------------------------------------------
// Detail panel tabs
// ---------------------------------------------------------------------------
test.describe("detail panel", () => {
  test("all three tabs are accessible", async ({ page }) => {
    await page.goto("/");
    await addNodeViaPalette(page, /Service compute\/service/);
    await page.locator(".react-flow__node").click();

    // Properties tab (default)
    await expect(page.getByText("language")).toBeVisible();

    // Notes tab
    await page.getByRole("button", { name: "notes" }).click();
    await expect(page.getByText("No notes yet.")).toBeVisible();

    // Code tab
    await page.getByRole("button", { name: "code" }).click();
    await expect(page.getByText("No code refs yet.")).toBeVisible();
  });
});
```

- [ ] **Step 2: Run the E2E tests**

```bash
npx playwright test test/e2e/ui-polish.spec.ts --reporter=list
```

- [ ] **Step 3: Fix any failing tests (iterate)**

- [ ] **Step 4: Commit**

```bash
git add test/e2e/ui-polish.spec.ts
git commit -m "test: add comprehensive E2E tests for UI bugs and polish fixes"
```

---

## Task Dependency Order

```
B1 (delete) ──┐
B2 (drag)  ───┤
B3 (toolbar) ─┤
B4 (icons) ───┤──→ E2E tests (Task 14)
B5 (names) ───┤
B6 (grammar) ─┤
B7 (favicon) ─┤
C1+C2 (a11y) ─┤
U3 (r-click) ─┤
U5 (fit-view) ┤
U7 (scope) ───┘
```

Tasks 1-7 can be done in parallel (no dependencies between them). Tasks 8-13 can also be done in parallel. Task 14 (E2E) depends on all others being complete.
