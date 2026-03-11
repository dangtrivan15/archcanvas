# P07: Decouple Canvas from React Flow

**Parallel safety**: FULLY INDEPENDENT. Touches only `src/components/canvas/Canvas.tsx`
and its direct children. Does NOT conflict with P01 (which handles App.tsx and dialogs)
or P05 (which handles navigation stores).

---

## Problem

### Canvas.tsx is 1,530 Lines with 46 Hooks

`src/components/canvas/Canvas.tsx` is the second-largest file in the codebase.
It directly uses:
- React Flow hooks (`useReactFlow`, `useNodesState`, `useEdgesState`)
- 5+ Zustand stores via `useSelector`
- Render API calls inside `useMemo`
- DOM event listeners for navigation
- Context menu state management
- Keyboard shortcut capture-phase listeners
- Touch/iPad special handling

### Tight Coupling to @xyflow/react

```typescript
// Canvas.tsx — direct React Flow dependencies
import { ReactFlow, useReactFlow, Background, MiniMap, Controls } from '@xyflow/react';
import type { Node, Edge, OnConnect, OnNodeDrag } from '@xyflow/react';
```

The Render API returns React Flow-specific types:
```typescript
// renderApi.ts
render(graph, navigationPath): { nodes: CanvasNode[], edges: CanvasEdge[] }
// CanvasNode extends ReactFlow's Node type
```

### Testing is Hard

Canvas logic can't be tested without mounting React Flow, which requires
DOM, ResizeObserver polyfills, and other browser APIs.

---

## Proposed Solution

### A. Split Canvas.tsx into Composable Modules

```
src/components/canvas/
  Canvas.tsx                    -- Slim orchestrator (~100 lines)
  CanvasRenderer.tsx            -- React Flow wrapper (rendering only)
  hooks/
    useCanvasRenderer.ts        -- RenderApi → React Flow nodes/edges
    useCanvasInteractions.ts    -- Click, drag, drop, connect handlers
    useCanvasKeyboard.ts        -- Keyboard shortcut integration
    useCanvasContextMenu.ts     -- Right-click context menu
    useCanvasViewport.ts        -- Viewport sync with store
  ContextMenu.tsx               -- Extracted context menu component
  CanvasControls.tsx            -- Zoom/fit/minimap
  ModeStatusBar.tsx             -- (keep existing)
```

### B. Canvas Orchestrator (New Canvas.tsx)

```typescript
// src/components/canvas/Canvas.tsx — target: ~100 lines
export function Canvas() {
  const { nodes, edges } = useCanvasRenderer();
  const interactions = useCanvasInteractions();
  const { contextMenu, onContextMenu } = useCanvasContextMenu();

  useCanvasKeyboard();

  return (
    <div className="canvas-container">
      <CanvasRenderer
        nodes={nodes}
        edges={edges}
        onNodeClick={interactions.onNodeClick}
        onEdgeClick={interactions.onEdgeClick}
        onConnect={interactions.onConnect}
        onNodeDrag={interactions.onNodeDrag}
        onDrop={interactions.onDrop}
        onContextMenu={onContextMenu}
      />
      <CanvasControls />
      {contextMenu && <ContextMenu {...contextMenu} />}
    </div>
  );
}
```

### C. Renderer Abstraction (Lightweight)

Instead of a full adapter pattern (which would be over-engineering right now),
create a thin abstraction that isolates React Flow:

```typescript
// src/components/canvas/CanvasRenderer.tsx
// This is the ONLY file that imports from @xyflow/react

import { ReactFlow, Background, MiniMap } from '@xyflow/react';

interface CanvasRendererProps {
  nodes: CanvasNode[];
  edges: CanvasEdge[];
  onNodeClick: (nodeId: string) => void;
  onEdgeClick: (edgeId: string) => void;
  onConnect: (params: ConnectionParams) => void;
  onNodeDrag: (nodeId: string, position: Position) => void;
  onDrop: (event: DragEvent) => void;
  onContextMenu: (event: React.MouseEvent, target?: NodeOrEdge) => void;
}

export function CanvasRenderer(props: CanvasRendererProps) {
  // All React Flow configuration lives here
  return (
    <ReactFlow
      nodes={props.nodes}
      edges={props.edges}
      nodeTypes={nodeTypeMap}
      edgeTypes={edgeTypeMap}
      // ... React Flow-specific props
    >
      <Background />
      <MiniMap />
    </ReactFlow>
  );
}
```

### D. Extract Interaction Hooks

```typescript
// src/components/canvas/hooks/useCanvasInteractions.ts
export function useCanvasInteractions() {
  const addEdge = useGraphStore(s => s.addEdge);
  const selectNode = useCanvasStore(s => s.selectNode);

  const onNodeClick = useCallback((nodeId: string) => {
    selectNode(nodeId);
  }, [selectNode]);

  const onConnect = useCallback((params: ConnectionParams) => {
    addEdge({ from: params.source, to: params.target, type: 'sync' });
  }, [addEdge]);

  // ... other handlers

  return { onNodeClick, onEdgeClick, onConnect, onNodeDrag, onDrop };
}
```

```typescript
// src/components/canvas/hooks/useCanvasContextMenu.ts
export function useCanvasContextMenu() {
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);

  const onContextMenu = useCallback((event: React.MouseEvent, target?: NodeOrEdge) => {
    event.preventDefault();
    setContextMenu({
      x: event.clientX,
      y: event.clientY,
      target,
    });
  }, []);

  const closeContextMenu = useCallback(() => setContextMenu(null), []);

  return { contextMenu, onContextMenu, closeContextMenu };
}
```

```typescript
// src/components/canvas/hooks/useCanvasRenderer.ts
export function useCanvasRenderer() {
  const graph = useGraphStore(s => s.graph);
  const renderApi = useEngineStore(s => s.renderApi);
  const navigationPath = useNavigationStore(s => s.currentNodePath);

  const rendered = useMemo(() => {
    if (!renderApi) return { nodes: [], edges: [] };
    return renderApi.render(graph, navigationPath);
  }, [graph, renderApi, navigationPath]);

  return rendered;
}
```

### E. Replace DOM Event Dispatching

Currently Canvas.tsx uses custom DOM events for navigation:
```typescript
document.addEventListener('archcanvas:container-dive-in', handleDiveIn);
```

Replace with direct store calls or event bus (from P02):
```typescript
// Instead of DOM events:
const diveIntoNode = useNavigationStore(s => s.diveIntoNode);
// Called directly from interaction handler
```

---

## Files to Modify

| File | Action |
|------|--------|
| `src/components/canvas/Canvas.tsx` | Gut to ~100 lines, delegate to sub-modules |

**New files:**
- `src/components/canvas/CanvasRenderer.tsx`
- `src/components/canvas/ContextMenu.tsx`
- `src/components/canvas/CanvasControls.tsx`
- `src/components/canvas/hooks/useCanvasRenderer.ts`
- `src/components/canvas/hooks/useCanvasInteractions.ts`
- `src/components/canvas/hooks/useCanvasKeyboard.ts`
- `src/components/canvas/hooks/useCanvasContextMenu.ts`
- `src/components/canvas/hooks/useCanvasViewport.ts`

---

## Acceptance Criteria

1. Canvas.tsx is under 120 lines
2. `@xyflow/react` is imported ONLY in `CanvasRenderer.tsx` and node/edge components
3. All canvas interactions work identically (click, drag, connect, context menu, zoom)
4. No custom DOM event dispatching (`archcanvas:*`)
5. Each extracted hook is independently testable
6. `npm run test` passes
7. `npm run build` succeeds
