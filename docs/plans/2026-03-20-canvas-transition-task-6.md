# Task 6: CanvasShell + App.tsx Integration

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract chrome from Canvas.tsx into CanvasShell, wire CanvasHost instances, update App.tsx, and delete old files.

**Files:**
- Create: `src/components/canvas/CanvasShell.tsx`
- Modify: `src/App.tsx` — swap Canvas → CanvasShell, remove top-level ReactFlowProvider
- Delete: `src/components/canvas/Canvas.tsx`
- Delete: `src/components/nodes/SubsystemPreview.tsx`
- Delete: `src/components/nodes/PreviewModeContext.ts`
- Delete: `test/unit/components/SubsystemPreview.test.tsx`

**Depends on:** Task 5 (CanvasHost)

**Spec reference:** "CanvasShell.tsx" in Component Split, "CanvasHost Lifecycle", "ReactFlowProvider Placement".

**WARNING:** This is the big-bang task. All existing unit tests that import Canvas must be updated. Run the full suite after completion.

---

### Step 1: Create CanvasShell

- [ ] Create `src/components/canvas/CanvasShell.tsx`. This is a refactoring of `Canvas.tsx` — extract all chrome, replace the `<ReactFlow>` block with CanvasHost management.

The structure:

```typescript
import { useState, useCallback, useEffect, useRef } from 'react';
import { useCanvasKeyboard } from './hooks/useCanvasKeyboard';
import { useCanvasInteractions } from './hooks/useCanvasInteractions';
import { Breadcrumb } from '../shared/Breadcrumb';
import { ContextMenu } from '../shared/ContextMenu';
import type { ContextMenuState } from '../shared/ContextMenu';
import { CommandPalette } from '../shared/CommandPalette';
import { CreateSubsystemDialog } from '@/components/CreateSubsystemDialog';
import { AlertDialog, AlertDialogContent, /* ... */ } from '@/components/ui/alert-dialog';
import { CanvasHost } from './CanvasHost';
import type { CanvasViewHandle } from './CanvasView';
import { canvasHostManager } from '@/core/canvas/canvasHostManager';
import { useNavigationStore } from '@/store/navigationStore';
import { useFileStore } from '@/store/fileStore';
import { useCanvasStore } from '@/store/canvasStore';
import { useGraphStore } from '@/store/graphStore';
import { useUiStore } from '@/store/uiStore';
import { useToolStore } from '@/store/toolStore';
import { computeLayout } from '@/core/layout/elk';
import { createNodeFromType } from '@/lib/createNodeFromType';
import { useCanvasNavigation } from './hooks/useCanvasNavigation';

export function CanvasShell() {
  const currentCanvasId = useNavigationStore((s) => s.currentCanvasId);
  const shellSlotRef = useRef<HTMLDivElement>(null);
  const focusedCanvasRef = useRef<CanvasViewHandle>(null);

  // Read focused canvas's RefNode children for level-1 CanvasHosts
  const childRefNodeIds = useFileStore((s) => {
    const canvas = s.getCanvas(currentCanvasId);
    if (!canvas?.data.nodes) return [];
    return canvas.data.nodes
      .filter((n) => 'ref' in n)
      .map((n) => n.id);
  });

  // Attach focused canvas to ShellSlot when ready
  useEffect(() => {
    if (shellSlotRef.current) {
      canvasHostManager.attachToSlot(currentCanvasId, shellSlotRef.current);
    }
  }, [currentCanvasId]);

  // Attach each child canvas to its RefNodeSlot
  useEffect(() => {
    for (const childId of childRefNodeIds) {
      const slot = canvasHostManager.getSlot(childId);
      if (slot) {
        canvasHostManager.attachToSlot(childId, slot);
      }
    }
  }, [childRefNodeIds]);

  // --- All chrome from Canvas.tsx below (copy verbatim) ---
  // useCanvasKeyboard, useCanvasInteractions, context menu state,
  // command palette state, auto-layout, custom events, delete dialog,
  // drag-drop from NodeTypeOverlay, etc.
  //
  // Key changes:
  // 1. No <ReactFlow> — replaced by ShellSlot + CanvasHost instances
  // 2. reactFlow.fitView() → focusedCanvasRef.current?.fitView()
  // 3. reactFlow.screenToFlowPosition() — needs alternative or passed via ref
  // 4. onNodeDoubleClick, onNodeClick, etc. — these are ReactFlow callbacks
  //    that must be handled inside CanvasView, not CanvasShell.

  // NOTE: useCanvasInteractions returns onNodeClick, onEdgeClick, etc.
  // These are ReactFlow event handlers. They need to move INTO CanvasView
  // (or be passed as props). For now, the focused CanvasView handles
  // selection clicks internally. CanvasShell handles context menu and
  // delete confirmation via custom events or store subscriptions.

  return (
    <div data-testid="main-canvas" className="relative h-full w-full">
      <Breadcrumb />

      {/* ShellSlot: focused canvas attaches here */}
      <div ref={shellSlotRef} className="absolute inset-0" />

      {/* Expanding frame for animation (hidden by default) */}
      <div id="expand-frame" className="hidden absolute z-10" />

      {/* Focused canvas */}
      <CanvasHost
        key={`focused-${currentCanvasId}`}
        ref={focusedCanvasRef}
        canvasId={currentCanvasId}
        focused={true}
        level={0}
      />

      {/* Level-1 embedded canvases */}
      {childRefNodeIds.map((childId) => (
        <CanvasHost
          key={`embedded-${childId}`}
          canvasId={childId}
          focused={false}
          level={1}
        />
      ))}

      {/* Chrome: context menu, palette, dialogs — same as Canvas.tsx */}
      {/* ... copy ContextMenu, CommandPalette, CreateSubsystemDialog,
          AlertDialog sections from Canvas.tsx verbatim ... */}
    </div>
  );
}
```

**Important refactoring notes:**
- `useCanvasInteractions` hooks into ReactFlow events (onNodeClick, onConnect, etc.) — these must move to CanvasView or be wired via custom events. The simplest path: move `onNodeClick`, `onEdgeClick` into CanvasView (they update canvasStore selection, which is global). Keep `onNodeDoubleClick` (dive-in trigger) — wire via `useCanvasNavigation`.
- `handleAutoLayout` calls `reactFlow.fitView()` — replace with `focusedCanvasRef.current?.fitView()`.
- `handleDrop` calls `reactFlow.screenToFlowPosition()` — add this to the `CanvasViewHandle` interface.

The implementer should read Canvas.tsx carefully and migrate piece by piece. The spec acknowledges this is the hardest task.

### Step 2: Update App.tsx

- [ ] In `src/App.tsx`:

```typescript
// REPLACE:
import { Canvas } from "@/components/canvas/Canvas";
// WITH:
import { CanvasShell } from "@/components/canvas/CanvasShell";

// REMOVE the ReactFlowProvider wrapper:
// <ReactFlowProvider>
//   ...
// </ReactFlowProvider>
// Just render the content directly without the provider.

// REPLACE <Canvas /> with <CanvasShell />
```

Remove the `ReactFlowProvider` import from `@xyflow/react`.

### Step 3: Delete old files

- [ ] `git rm src/components/canvas/Canvas.tsx`
- [ ] `git rm src/components/nodes/SubsystemPreview.tsx`
- [ ] `git rm src/components/nodes/PreviewModeContext.ts`
- [ ] `git rm test/unit/components/SubsystemPreview.test.tsx`

### Step 4: Fix import references

- [ ] Search all files for imports of:
  - `Canvas` from `@/components/canvas/Canvas` → update to `CanvasShell`
  - `SubsystemPreview` → remove (only used by NodeRenderer, already updated in Task 4)
  - `PreviewModeContext` → remove (only used by NodeRenderer, already updated in Task 4)

- [ ] Run: `npm run test:unit -- --run`
- [ ] Fix any failing tests. Common fixes:
  - Tests importing `Canvas` → import `CanvasShell`
  - Tests mocking ReactFlowProvider → may no longer need the mock at shell level

### Step 5: Verify E2E smoke test

- [ ] Run: `npm run test:e2e-no-bridge -- --headed` (a few tests, visually verify)
- [ ] The app should render, show canvases, and allow basic interaction. Navigation may not animate yet (animation is Task 7). The critical test: RefNodes should show their child canvas content inside the RefNodeSlot.

### Step 6: Commit

- [ ] `git add -A`
- [ ] `git commit -m "feat: replace Canvas monolith with CanvasShell + CanvasHost architecture"`
