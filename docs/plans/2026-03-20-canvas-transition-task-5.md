# Task 5: CanvasHost — Portal + Detached Div Registration

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create the CanvasHost component that creates a stable detached div, renders CanvasView into it via Portal, and registers with canvasHostManager.

**Files:**
- Create: `src/components/canvas/CanvasHost.tsx`
- Create: `test/unit/components/canvas/CanvasHost.test.tsx`

**Depends on:** Task 1 (canvasHostManager), Task 3 (CanvasView)

**Spec reference:** "CanvasHost.tsx" in Architecture > Component Split and "Detached Container Reparenting" section.

---

### Step 1: Write failing test

- [ ] Create `test/unit/components/canvas/CanvasHost.test.tsx`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { canvasHostManager } from '@/core/canvas/canvasHostManager';

// Mock CanvasView — we don't need ReactFlow for these tests
vi.mock('@/components/canvas/CanvasView', () => ({
  CanvasView: vi.fn(({ canvasId, focused, level }: any) => (
    <div data-testid={`canvas-view-${canvasId}`} data-focused={String(focused)} data-level={level}>
      CanvasView mock
    </div>
  )),
}));

import { CanvasHost } from '@/components/canvas/CanvasHost';

describe('CanvasHost', () => {
  beforeEach(() => {
    canvasHostManager.clear();
  });

  it('registers container with canvasHostManager on mount', () => {
    render(<CanvasHost canvasId="test" focused={true} level={0} />);
    const container = canvasHostManager.getContainer('test');
    expect(container).toBeDefined();
    expect(container).toBeInstanceOf(HTMLDivElement);
  });

  it('unregisters container on unmount', () => {
    const { unmount } = render(<CanvasHost canvasId="test" focused={true} level={0} />);
    expect(canvasHostManager.getContainer('test')).toBeDefined();
    unmount();
    expect(canvasHostManager.getContainer('test')).toBeUndefined();
  });

  it('renders CanvasView inside the detached div via portal', () => {
    render(<CanvasHost canvasId="test" focused={true} level={0} />);
    const container = canvasHostManager.getContainer('test');
    // CanvasView should be rendered inside the detached div
    expect(container?.querySelector('[data-testid="canvas-view-test"]')).toBeDefined();
  });

  it('passes focused and level props to CanvasView', () => {
    render(<CanvasHost canvasId="auth" focused={false} level={1} />);
    const container = canvasHostManager.getContainer('auth');
    const view = container?.querySelector('[data-testid="canvas-view-auth"]');
    expect(view?.getAttribute('data-focused')).toBe('false');
    expect(view?.getAttribute('data-level')).toBe('1');
  });

  it('reuses the same detached div across re-renders', () => {
    const { rerender } = render(<CanvasHost canvasId="test" focused={true} level={0} />);
    const div1 = canvasHostManager.getContainer('test');
    rerender(<CanvasHost canvasId="test" focused={true} level={0} />);
    const div2 = canvasHostManager.getContainer('test');
    expect(div1).toBe(div2);
  });
});
```

- [ ] Run: `npm run test:unit -- --run test/unit/components/canvas/CanvasHost.test.tsx`
- [ ] Expected: FAIL — module not found

### Step 2: Implement CanvasHost

- [ ] Create `src/components/canvas/CanvasHost.tsx`:

```typescript
import { useEffect, useRef, forwardRef } from 'react';
import { createPortal } from 'react-dom';
import { CanvasView } from './CanvasView';
import type { CanvasViewHandle } from './CanvasView';
import { canvasHostManager } from '@/core/canvas/canvasHostManager';

interface CanvasHostProps {
  canvasId: string;
  focused: boolean;
  level: number;
}

export const CanvasHost = forwardRef<CanvasViewHandle, CanvasHostProps>(
  function CanvasHost({ canvasId, focused, level }, ref) {
    // Create a stable detached div — once per component lifetime
    const containerRef = useRef<HTMLDivElement | null>(null);
    if (!containerRef.current) {
      containerRef.current = document.createElement('div');
      containerRef.current.style.width = '100%';
      containerRef.current.style.height = '100%';
    }

    // Register/unregister with canvasHostManager
    useEffect(() => {
      const div = containerRef.current!;
      canvasHostManager.register(canvasId, div);
      return () => {
        canvasHostManager.unregister(canvasId);
      };
    }, [canvasId]);

    // Render CanvasView into the detached div via Portal
    return createPortal(
      <CanvasView ref={ref} canvasId={canvasId} focused={focused} level={level} />,
      containerRef.current,
    );
  }
);
```

**Key decisions:**
- Detached div created in ref init (not in `useEffect`) — available synchronously on first render
- `createPortal` renders into the stable detached div — React tree is decoupled from DOM placement
- `forwardRef` passes through to `CanvasView`'s imperative handle
- Registration in `useEffect` with cleanup for unmount

- [ ] Run: `npm run test:unit -- --run test/unit/components/canvas/CanvasHost.test.tsx`
- [ ] Expected: PASS (5 tests)

### Step 3: Commit

- [ ] `git add src/components/canvas/CanvasHost.tsx test/unit/components/canvas/CanvasHost.test.tsx`
- [ ] `git commit -m "feat: add CanvasHost portal + detached div component"`
