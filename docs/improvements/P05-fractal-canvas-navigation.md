# P05: Fractal Canvas Navigation

**Parallel safety**: DEPENDS ON P02 (store restructuring). The navigation stores
will be affected by P02's event bus. Can start design work immediately but defer
store changes until P02 is done.

---

## Problem

### Two Separate Navigation Systems

1. **`src/store/navigationStore.ts`** (36 lines) — Intra-file fractal zoom
   - `navigationPath: string[]` — path of node IDs for depth navigation
   - `pushNavigation(nodeId)`, `popNavigation()`, `resetNavigation()`

2. **`src/store/nestedCanvasStore.ts`** (270 lines) — Inter-file navigation
   - `fileStack: FileStackEntry[]` — stack of .archc files
   - `pushFile(filePath, graph)`, `popFile()`
   - Manages separate graph state per file

These two systems don't coordinate well. Opening a container node sometimes uses
navigationStore (same-file dive), sometimes uses nestedCanvasStore (cross-file ref).

### No Persistence

Both navigation stacks are in-memory only. Page refresh = back to root. No deep linking.

### No Viewport Restoration

When zooming out of a nested view, the parent canvas doesn't remember where you were.
The viewport resets.

### Fragile Container Detection

`Canvas.tsx` uses custom DOM events to coordinate:
```typescript
document.addEventListener('archcanvas:container-dive-in', handleDiveIn);
```

This is fragile and hard to trace.

---

## Proposed Solution

### A. Unified Navigation Model

Merge both navigation systems into a single store:

```typescript
// src/store/navigationStore.ts — unified
interface NavigationState {
  // Full breadcrumb from root to current view
  breadcrumb: BreadcrumbEntry[];

  // Viewport state per depth level (restore on zoom-out)
  viewportStack: ViewportEntry[];

  // Actions
  diveIntoNode: (nodeId: string) => void;
  diveIntoFile: (filePath: string, containerNodeId?: string) => void;
  goUp: () => void;
  goToRoot: () => void;
  goToDepth: (index: number) => void;

  // Computed
  currentDepth: number;
  currentNodePath: string[];     // just the node IDs for render API
  isAtRoot: boolean;
  parentContext: BreadcrumbEntry | null;
}

interface BreadcrumbEntry {
  type: 'node' | 'file';
  id: string;                    // nodeId or filePath
  displayName: string;
  viewport: Viewport;            // saved viewport at this level
  graph?: ArchGraph;             // for file entries, the loaded graph
}

interface ViewportEntry {
  x: number;
  y: number;
  zoom: number;
}
```

### B. Navigation Decision Logic

When user double-clicks/dives into a node:

```
Is node type "meta/canvas-ref"?
  ├─ YES: Does it reference an external .archc file?
  │   ├─ YES → diveIntoFile(filePath, nodeId)
  │   │         Load external file, push to breadcrumb
  │   └─ NO  → diveIntoNode(nodeId)
  │             Show children inline
  └─ NO: Does node have children?
      ├─ YES → diveIntoNode(nodeId)
      │         Zoom into children canvas
      └─ NO  → No action (leaf node)
```

### C. Persistent Navigation

**In .archc file** — save navigation state in CanvasState:
```protobuf
message CanvasState {
  // existing fields...
  repeated string navigation_path = 4;  // already exists, keep using
}
```

**In URL hash** — for deep linking:
```
https://app.archcanvas.dev/#/project/node-abc/node-xyz
```

**In sessionStorage** — for refresh recovery:
```typescript
// Auto-save on every navigation change
sessionStorage.setItem('archcanvas:nav', JSON.stringify(breadcrumb));
```

### D. Viewport Restoration

When diving into a node:
1. Save current viewport to `viewportStack[currentDepth]`
2. Transition to new view (animate if possible)
3. Set new viewport (fit view on children, or restore saved viewport)

When going up:
1. Restore viewport from `viewportStack[currentDepth - 1]`
2. Transition back to parent view
3. Pop breadcrumb entry

### E. Breadcrumb UI

Add a breadcrumb bar above the canvas:

```
┌─────────────────────────────────────────────┐
│ 🏠 Root  ›  Backend Services  ›  Auth Svc   │
└─────────────────────────────────────────────┘
```

- Click any breadcrumb segment to jump to that depth
- Right-click for context menu (open in new tab, copy link)
- Keyboard: Backspace or Escape to go up one level

### F. Canvas Transition Animations

Instead of instant view switches:

```typescript
// Dive in: zoom into the clicked container node
async function animateDiveIn(nodeId: string, reactFlow: ReactFlowInstance) {
  // 1. Zoom into the container node (800ms ease-out)
  await reactFlow.fitView({
    nodes: [{ id: nodeId }],
    duration: 400,
    padding: 0,
  });

  // 2. Cross-fade: hide parent nodes, show child nodes
  // (handled by render API returning different nodes for new path)
}

// Zoom out: reverse animation
async function animateZoomOut(reactFlow: ReactFlowInstance) {
  // 1. Zoom out from current view
  // 2. Cross-fade: hide current nodes, show parent nodes
  // 3. Restore parent viewport
}
```

---

## Files to Modify

| File | Action |
|------|--------|
| `src/store/navigationStore.ts` | Rewrite with unified model |
| `src/store/nestedCanvasStore.ts` | Merge into navigationStore, then delete |
| `src/components/canvas/Canvas.tsx` | Replace DOM events with store-driven navigation |
| `src/api/renderApi.ts` | Ensure it handles unified navigation path |

**New files:**
- `src/components/canvas/Breadcrumb.tsx`
- `src/components/canvas/useCanvasNavigation.ts` (hook for dive-in/zoom-out)

---

## Acceptance Criteria

1. Single navigation store (nestedCanvasStore deleted)
2. Diving into a container node works (shows children)
3. Diving into a `meta/canvas-ref` loads the external file
4. Going up restores the parent viewport exactly
5. Breadcrumb shows current path and allows jumping to any level
6. Navigation survives page refresh (sessionStorage)
7. Navigation state saved in .archc file
8. No DOM event dispatching for navigation
9. `npm run test` passes
10. `npm run build` succeeds
