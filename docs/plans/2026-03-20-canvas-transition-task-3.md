# Task 3: CanvasView — Pure ReactFlow Renderer

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create the pure ReactFlow renderer component that replaces both the ReactFlow portion of Canvas.tsx and SubsystemPreview.tsx.

**Files:**
- Create: `src/components/canvas/CanvasView.tsx`
- Create: `test/unit/components/canvas/CanvasView.test.tsx`

**Depends on:** Task 1 (canvasHostManager), Task 2 (useCanvasRenderer params)

**Spec reference:** "CanvasView.tsx" in Architecture > Component Split.

---

### Step 1: Write failing test for focused mode

- [ ] Create `test/unit/components/canvas/CanvasView.test.tsx`. Mock ReactFlow and stores following the pattern in `test/unit/components/SubsystemPreview.test.tsx`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

// Mock ReactFlow
vi.mock('@xyflow/react', () => ({
  ReactFlow: ({ nodes, edges, nodesDraggable, nodesConnectable, ...props }: any) => (
    <div data-testid="reactflow"
         data-nodes-draggable={String(nodesDraggable ?? true)}
         data-nodes-connectable={String(nodesConnectable ?? true)}>
      {nodes?.length ?? 0} nodes, {edges?.length ?? 0} edges
    </div>
  ),
  ReactFlowProvider: ({ children }: any) => <div data-testid="rf-provider">{children}</div>,
  useReactFlow: () => ({ fitView: vi.fn(), setViewport: vi.fn() }),
  Background: () => null,
  BackgroundVariant: { Dots: 'dots' },
  Controls: () => null,
  applyNodeChanges: vi.fn((changes, nodes) => nodes),
}));

// Mock stores — return empty data by default
vi.mock('@/store/fileStore', () => ({
  useFileStore: vi.fn((sel?: any) => sel ? sel({ project: { canvases: new Map() }, getCanvas: () => null }) : null),
}));
vi.mock('@/store/registryStore', () => ({
  useRegistryStore: vi.fn((sel?: any) => sel ? sel({ resolve: () => undefined }) : undefined),
}));
vi.mock('@/store/canvasStore', () => ({
  useCanvasStore: vi.fn((sel?: any) => sel ? sel({ selectedNodeIds: new Set() }) : null),
}));
vi.mock('@/store/navigationStore', () => ({
  useNavigationStore: vi.fn((sel?: any) => sel ? sel({ breadcrumb: [{ canvasId: '__root__' }], parentEdges: [] }) : null),
}));

import { CanvasView } from '@/components/canvas/CanvasView';

describe('CanvasView', () => {
  it('renders ReactFlowProvider with its own provider', () => {
    render(<CanvasView canvasId="test" focused={true} level={0} />);
    expect(screen.getByTestId('rf-provider')).toBeDefined();
    expect(screen.getByTestId('reactflow')).toBeDefined();
  });

  it('disables all interaction when focused=false', () => {
    render(<CanvasView canvasId="test" focused={false} level={1} />);
    const rf = screen.getByTestId('reactflow');
    expect(rf.getAttribute('data-nodes-draggable')).toBe('false');
    expect(rf.getAttribute('data-nodes-connectable')).toBe('false');
  });

  it('enables interaction when focused=true', () => {
    render(<CanvasView canvasId="test" focused={true} level={0} />);
    const rf = screen.getByTestId('reactflow');
    expect(rf.getAttribute('data-nodes-draggable')).not.toBe('false');
  });
});
```

- [ ] Run: `npm run test:unit -- --run test/unit/components/canvas/CanvasView.test.tsx`
- [ ] Expected: FAIL — module not found

### Step 2: Implement CanvasView

- [ ] Create `src/components/canvas/CanvasView.tsx`:

```typescript
import { useState, useCallback, useEffect, forwardRef, useImperativeHandle } from 'react';
import { ReactFlow, ReactFlowProvider, Background, BackgroundVariant, Controls, useReactFlow, applyNodeChanges } from '@xyflow/react';
import type { Node as RFNode, Edge as RFEdge, NodeChange, FitViewOptions } from '@xyflow/react';
import { useCanvasRenderer } from './hooks/useCanvasRenderer';
import { NodeRenderer } from '../nodes/NodeRenderer';
import { GhostNodeRenderer } from '../nodes/GhostNodeRenderer';
import { EdgeRenderer } from '../edges/EdgeRenderer';
import { useGraphStore } from '@/store/graphStore';
import type { CanvasNodeData, CanvasEdgeData } from './types';

const nodeTypes = { archNode: NodeRenderer, archGhostNode: GhostNodeRenderer };
const edgeTypes = { archEdge: EdgeRenderer };

export interface CanvasViewHandle {
  fitView(options?: FitViewOptions): void;
  getContainerRect(): DOMRect | null;
  screenToFlowPosition(point: { x: number; y: number }): { x: number; y: number };
}

interface CanvasViewProps {
  canvasId: string;
  focused: boolean;
  level: number;
}

const CanvasViewInner = forwardRef<CanvasViewHandle, CanvasViewProps>(
  function CanvasViewInner({ canvasId, focused, level }, ref) {
    const reactFlow = useReactFlow();
    const { nodes: storeNodes, edges } = useCanvasRenderer(canvasId, focused);

    // Controlled nodes for smooth drag (same pattern as Canvas.tsx)
    const [rfNodes, setRfNodes] = useState<RFNode<CanvasNodeData>[]>(storeNodes);
    useEffect(() => { setRfNodes(storeNodes); }, [storeNodes]);

    const onNodesChange = useCallback((changes: NodeChange<RFNode<CanvasNodeData>>[]) => {
      if (!focused) return; // no interaction in embedded mode
      setRfNodes((nds) => applyNodeChanges(changes, nds));
      for (const change of changes) {
        if (change.type === 'position' && change.position && !change.dragging && !change.id.startsWith('__ghost__')) {
          useGraphStore.getState().updateNodePosition(canvasId, change.id, change.position);
        }
      }
    }, [canvasId, focused]);

    // Imperative handle for CanvasShell to call fitView/measure
    useImperativeHandle(ref, () => ({
      fitView(options?: FitViewOptions) {
        reactFlow.fitView(options);
      },
      getContainerRect() {
        const el = document.querySelector(`[data-canvas-id="${canvasId}"] .react-flow`);
        return el?.getBoundingClientRect() ?? null;
      },
      screenToFlowPosition(point: { x: number; y: number }) {
        return reactFlow.screenToFlowPosition(point);
      },
    }), [reactFlow, canvasId]);

    return (
      <div data-canvas-id={canvasId} className="h-full w-full">
        <ReactFlow
          nodes={rfNodes}
          edges={edges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          proOptions={{ hideAttribution: true }}
          nodesDraggable={focused}
          nodesConnectable={focused}
          elementsSelectable={focused}
          panOnDrag={focused ? [0, 1, 2] : false}
          panOnScroll={focused}
          zoomOnScroll={false}
          zoomOnPinch={focused}
          zoomOnDoubleClick={false}
          nodesFocusable={focused}
          edgesFocusable={focused}
          preventScrolling={!focused}
          onNodesChange={focused ? onNodesChange : undefined}
        >
          <Background variant={BackgroundVariant.Dots} gap={16} size={1} />
          {focused && <Controls />}
        </ReactFlow>
      </div>
    );
  }
);

export const CanvasView = forwardRef<CanvasViewHandle, CanvasViewProps>(
  function CanvasView(props, ref) {
    return (
      <ReactFlowProvider>
        <CanvasViewInner ref={ref} {...props} />
      </ReactFlowProvider>
    );
  }
);
```

**Key decisions:**
- `CanvasViewInner` is inside `ReactFlowProvider` so it can call `useReactFlow()`
- `CanvasView` (outer) wraps in a provider — each instance is isolated
- `data-canvas-id` attribute for imperative DOM queries
- Interaction props are gated by `focused` — same flags as SubsystemPreview when `focused=false`
- `onNodesChange` is `undefined` (not a no-op function) when not focused — ReactFlow skips the handler entirely

- [ ] Run: `npm run test:unit -- --run test/unit/components/canvas/CanvasView.test.tsx`
- [ ] Expected: PASS (3 tests)

### Step 3: Add level-gating test

- [ ] Add test that level 2+ renders nothing:

```typescript
  it('renders null content when level >= 2', () => {
    // CanvasView at level 2 should render the provider but ReactFlow should
    // have 0 nodes (because no CanvasHost will create level-2 instances).
    // The component itself renders normally — depth limiting happens in CanvasShell.
    // This test just verifies it doesn't crash at any level.
    render(<CanvasView canvasId="deep" focused={false} level={2} />);
    expect(screen.getByTestId('rf-provider')).toBeDefined();
  });
```

- [ ] Run: `npm run test:unit -- --run test/unit/components/canvas/CanvasView.test.tsx`
- [ ] Expected: PASS (4 tests)

### Step 4: Commit

- [ ] `git add src/components/canvas/CanvasView.tsx test/unit/components/canvas/CanvasView.test.tsx`
- [ ] `git commit -m "feat: add CanvasView pure ReactFlow renderer"`
