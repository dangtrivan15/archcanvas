# Node Type Overlay Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a hover overlay on the "Add Node" toolbar button that lists NodeDef types grouped by namespace, with drag-to-canvas and click-to-add support, plus a `+` prefix in the CommandPalette for keyboard-first node type search.

**Architecture:** New standalone `NodeTypeOverlay` component rendered by `LeftToolbar`, using HTML5 drag-and-drop with ReactFlow's `screenToFlowPosition()` for canvas drops. Shared `createNodeFromType` helper extracted from `NodeTypeProvider.onSelect`. CommandPalette gets a new `+` prefix routing to `NodeTypeProvider`.

**Tech Stack:** React 19, Zustand 5, ReactFlow 12, motion/react, HTML5 Drag and Drop API, Vitest, Playwright

**Spec:** `docs/specs/2026-03-19-node-type-overlay-design.md`

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `src/lib/createNodeFromType.ts` | Create | Shared helper: resolve NodeDef, generate unique name, create node via graphStore |
| `src/components/layout/NodeTypeOverlay.tsx` | Create | Overlay UI: grouped grid, filter, hover/pin state, drag source, click-to-add |
| `src/components/layout/LeftToolbar.tsx` | Modify | Render overlay, replace palette dispatch with hover/pin management |
| `src/components/canvas/Canvas.tsx` | Modify | Add `onDragOver`/`onDrop` on wrapper div |
| `src/components/canvas/hooks/useCanvasKeyboard.ts` | Modify | Add `N` key binding dispatching `archcanvas:open-palette` with `+` prefix |
| `src/components/shared/CommandPalette.tsx` | Modify | Add `PREFIX_ADD = '+'` → `NodeTypeProvider`, update placeholder |
| `test/unit/lib/createNodeFromType.test.ts` | Create | Unit tests for shared helper |
| `test/unit/components/layout/NodeTypeOverlay.test.tsx` | Create | Unit tests for overlay rendering, filter, click-to-add, drag |
| `test/unit/components/shared/CommandPalette.test.tsx` | Modify | Add tests for `+` prefix routing |
| `test/e2e/node-type-overlay.spec.ts` | Create | E2E tests: hover, pin, click-to-add, drag-to-canvas, N shortcut |

---

### Task 1: Extract shared `createNodeFromType` helper

**Files:**
- Create: `src/lib/createNodeFromType.ts`
- Create: `test/unit/lib/createNodeFromType.test.ts`
- Modify: `src/components/shared/CommandPalette.tsx:187-213`

- [ ] **Step 1: Write the failing test**

Create `test/unit/lib/createNodeFromType.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock stores before importing the module under test
const mockCanvas = {
  data: {
    nodes: [
      { id: 'node-1', type: 'compute/service', displayName: 'Service' },
      { id: 'node-2', type: 'compute/service', displayName: 'Service 2' },
    ],
  },
};

const mockAddNode = vi.fn().mockReturnValue({ ok: true });
vi.mock('@/store/graphStore', () => ({
  useGraphStore: { getState: () => ({ addNode: mockAddNode }) },
}));

vi.mock('@/store/fileStore', () => ({
  useFileStore: { getState: () => ({ getCanvas: () => mockCanvas }) },
}));

vi.mock('@/store/navigationStore', () => ({
  useNavigationStore: { getState: () => ({ currentCanvasId: '__root__' }) },
}));

vi.mock('@/store/registryStore', () => ({
  useRegistryStore: {
    getState: () => ({
      resolve: (type: string) => {
        if (type === 'compute/service')
          return { metadata: { displayName: 'Service', namespace: 'compute', name: 'service' } };
        return undefined;
      },
    }),
  },
}));

import { createNodeFromType } from '@/lib/createNodeFromType';

describe('createNodeFromType', () => {
  beforeEach(() => vi.clearAllMocks());

  it('calls graphStore.addNode with correct type and unique displayName', () => {
    createNodeFromType('__root__', 'compute/service');
    expect(mockAddNode).toHaveBeenCalledWith(
      '__root__',
      expect.objectContaining({
        type: 'compute/service',
        displayName: 'Service 3', // 2 existing → next is 3
      }),
    );
  });

  it('uses staggered position when no position provided', () => {
    createNodeFromType('__root__', 'compute/service');
    const node = mockAddNode.mock.calls[0][1];
    // 2 existing nodes → col=0, row=1
    expect(node.position).toEqual({ x: 0, y: 200 });
  });

  it('uses provided position when given', () => {
    createNodeFromType('__root__', 'compute/service', { x: 500, y: 300 });
    const node = mockAddNode.mock.calls[0][1];
    expect(node.position).toEqual({ x: 500, y: 300 });
  });

  it('generates a node id with node- prefix', () => {
    createNodeFromType('__root__', 'compute/service');
    const node = mockAddNode.mock.calls[0][1];
    expect(node.id).toMatch(/^node-[a-f0-9]{8}$/);
  });

  it('uses type key as fallback displayName when NodeDef not found', () => {
    createNodeFromType('__root__', 'unknown/type');
    const node = mockAddNode.mock.calls[0][1];
    expect(node.displayName).toBe('type');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:unit -- --reporter=verbose test/unit/lib/createNodeFromType.test.ts`
Expected: FAIL — module `@/lib/createNodeFromType` does not exist

- [ ] **Step 3: Write the implementation**

Create `src/lib/createNodeFromType.ts`:

```typescript
import type { Node } from '@/types';
import { useGraphStore } from '@/store/graphStore';
import { useFileStore } from '@/store/fileStore';
import { useNavigationStore } from '@/store/navigationStore';
import { useRegistryStore } from '@/store/registryStore';

/**
 * Create a node from a NodeDef type key and add it to a canvas.
 * Generates a unique display name and either uses the provided position
 * or falls back to staggered grid placement.
 */
export function createNodeFromType(
  canvasId: string,
  typeKey: string,
  position?: { x: number; y: number },
): void {
  const canvas = useFileStore.getState().getCanvas(canvasId);
  const existingCount = canvas?.data.nodes?.length ?? 0;

  const nodeDef = useRegistryStore.getState().resolve(typeKey);
  const baseName = nodeDef?.metadata.displayName ?? typeKey.split('/').pop() ?? 'Node';

  const sameTypeCount = (canvas?.data.nodes ?? []).filter(
    (n) => 'type' in n && n.type === typeKey,
  ).length;
  const displayName = sameTypeCount === 0 ? baseName : `${baseName} ${sameTypeCount + 1}`;

  const finalPosition = position ?? {
    x: (existingCount % 2) * 300,
    y: Math.floor(existingCount / 2) * 200,
  };

  const newNode: Node = {
    id: `node-${crypto.randomUUID().slice(0, 8)}`,
    type: typeKey,
    displayName,
    position: finalPosition,
  };

  useGraphStore.getState().addNode(canvasId, newNode);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:unit -- --reporter=verbose test/unit/lib/createNodeFromType.test.ts`
Expected: 5 tests PASS

- [ ] **Step 5: Refactor `NodeTypeProvider.onSelect` to use the helper**

In `src/components/shared/CommandPalette.tsx`, replace lines 187-213 (`NodeTypeProvider.onSelect`) with:

```typescript
import { createNodeFromType } from '@/lib/createNodeFromType';

// ... inside NodeTypeProvider:
onSelect(result: PaletteResult) {
  const typeKey = result.id.replace(/^nodetype:/, '');
  const canvasId = useNavigationStore.getState().currentCanvasId;
  createNodeFromType(canvasId, typeKey);
},
```

Remove the now-unused imports: `useGraphStore`, `useFileStore` (if only used here — check first), `useRegistryStore` (if only used here).

- [ ] **Step 6: Run existing CommandPalette tests to verify no regressions**

Run: `npm run test:unit -- --reporter=verbose test/unit/components/shared/CommandPalette.test.tsx`
Expected: all 16 tests PASS (the "clicking a node type calls graphStore.addNode" test should still pass since the mock still intercepts `addNode`)

- [ ] **Step 7: Commit**

```bash
git add src/lib/createNodeFromType.ts test/unit/lib/createNodeFromType.test.ts src/components/shared/CommandPalette.tsx
git commit -m "refactor: extract createNodeFromType helper from CommandPalette"
```

---

### Task 2: Add `+` prefix to CommandPalette and `N` keyboard shortcut

**Files:**
- Modify: `src/components/shared/CommandPalette.tsx:40-42,320-331,422`
- Modify: `src/components/canvas/hooks/useCanvasKeyboard.ts`
- Modify: `test/unit/components/shared/CommandPalette.test.tsx`

- [ ] **Step 1: Write the failing tests**

Add to `test/unit/components/shared/CommandPalette.test.tsx`:

```typescript
// --- Prefix filtering: + Add node ---

it('+ prefix: shows only Node types group', async () => {
  renderPalette(true);
  await setQuery('+');
  expect(screen.queryByTestId('cmdk-group-Node types')).not.toBeNull();
  expect(screen.queryByTestId('cmdk-group-File')).toBeNull();
  expect(screen.queryByTestId('cmdk-group-Edit')).toBeNull();
  expect(screen.queryByTestId('cmdk-group-View')).toBeNull();
  expect(screen.queryByTestId('cmdk-group-Tool')).toBeNull();
  expect(screen.queryByTestId('cmdk-group-Nodes')).toBeNull();
  expect(screen.queryByTestId('cmdk-group-Entities')).toBeNull();
  expect(screen.queryByTestId('cmdk-group-Scopes')).toBeNull();
});

it('+ prefix with query: filters node types by name', async () => {
  renderPalette(true);
  await setQuery('+service');
  const typesGroup = screen.getByTestId('cmdk-group-Node types');
  expect(typesGroup.textContent).toContain('Service');
  expect(typesGroup.textContent).not.toContain('Database');
});

it('+ prefix: clicking a node type calls graphStore.addNode', async () => {
  const onClose = vi.fn();
  renderPalette(true, onClose);
  await setQuery('+');
  const typesGroup = screen.getByTestId('cmdk-group-Node types');
  const serviceItem = Array.from(
    typesGroup.querySelectorAll('[data-testid="cmdk-item"]'),
  ).find((el) => el.textContent?.includes('Service'));
  expect(serviceItem).toBeDefined();
  await act(async () => { fireEvent.click(serviceItem!); });
  expect(mockGraphState.addNode).toHaveBeenCalledWith(
    'root',
    expect.objectContaining({ type: 'compute/service' }),
  );
  expect(onClose).toHaveBeenCalledTimes(1);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test:unit -- --reporter=verbose test/unit/components/shared/CommandPalette.test.tsx`
Expected: 3 new tests FAIL — `+` prefix not recognized, shows all groups

- [ ] **Step 3: Implement `+` prefix routing**

In `src/components/shared/CommandPalette.tsx`:

Add the constant (after line 42):
```typescript
const PREFIX_ADD = '+';
```

Add the routing case in `resolveProviders` (before the `return` on line 330):
```typescript
if (raw.startsWith(PREFIX_ADD)) {
  return { providers: [NodeTypeProvider], query: raw.slice(1).trimStart() };
}
```

Update the placeholder text (line ~422):
```typescript
placeholder={mode === 'subsystem'
  ? "Pick a node type for the subsystem..."
  : "Type a command or search… (> actions, @ nodes, # entities, + add node)"}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test:unit -- --reporter=verbose test/unit/components/shared/CommandPalette.test.tsx`
Expected: all 19 tests PASS

- [ ] **Step 5: Add `N` key binding to `useCanvasKeyboard`**

Note: The `N` shortcut intentionally opens the **palette** (keyboard-first search), while the toolbar button opens the **overlay** (visual browsing + drag). This is by design — two paths to the same goal optimized for different input methods. The tooltip showing `N` on the "Add Node" button serves as a general hint that `N` is the keyboard shortcut for adding nodes.

In `src/components/canvas/hooks/useCanvasKeyboard.ts`, add after the `Cmd+K` block (line ~56):

```typescript
// Add Node palette — N (no modifier)
if (e.key === 'n' || e.key === 'N') {
  if (!mod && !e.shiftKey) {
    e.preventDefault();
    window.dispatchEvent(
      new CustomEvent('archcanvas:open-palette', { detail: { prefix: '+' } }),
    );
    return;
  }
}
```

- [ ] **Step 6: Run full test suite to check for regressions**

Run: `npm run test:unit -- --reporter=verbose`
Expected: all tests PASS

- [ ] **Step 7: Commit**

```bash
git add src/components/shared/CommandPalette.tsx src/components/canvas/hooks/useCanvasKeyboard.ts test/unit/components/shared/CommandPalette.test.tsx
git commit -m "feat: add + prefix for node type search and N keyboard shortcut"
```

---

### Task 3: Build `NodeTypeOverlay` component

**Files:**
- Create: `src/components/layout/NodeTypeOverlay.tsx`
- Create: `test/unit/components/layout/NodeTypeOverlay.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `test/unit/components/layout/NodeTypeOverlay.test.tsx`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';

// Mock motion to avoid animation complexity in tests
vi.mock('motion/react', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
  useReducedMotion: () => false,
}));

const allNodeDefs = [
  {
    kind: 'NodeDef',
    apiVersion: 'v1',
    metadata: {
      namespace: 'compute',
      name: 'service',
      displayName: 'Service',
      icon: 'Server',
      shape: 'rectangle',
      version: '1.0',
    },
    spec: {},
  },
  {
    kind: 'NodeDef',
    apiVersion: 'v1',
    metadata: {
      namespace: 'compute',
      name: 'function',
      displayName: 'Function',
      icon: 'Zap',
      shape: 'hexagon',
      version: '1.0',
    },
    spec: {},
  },
  {
    kind: 'NodeDef',
    apiVersion: 'v1',
    metadata: {
      namespace: 'data',
      name: 'database',
      displayName: 'Database',
      icon: 'Database',
      shape: 'cylinder',
      version: '1.0',
    },
    spec: {},
  },
];

vi.mock('@/store/registryStore', () => ({
  useRegistryStore: {
    getState: () => ({
      list: () => allNodeDefs,
      search: (query: string) => {
        if (!query) return allNodeDefs;
        const q = query.toLowerCase();
        return allNodeDefs.filter(
          (d) =>
            d.metadata.name.includes(q) ||
            d.metadata.displayName.toLowerCase().includes(q),
        );
      },
    }),
  },
}));

vi.mock('@/store/navigationStore', () => ({
  useNavigationStore: { getState: () => ({ currentCanvasId: '__root__' }) },
}));

vi.mock('@/lib/createNodeFromType', () => ({
  createNodeFromType: vi.fn(),
}));

vi.mock('@/components/nodes/iconMap', () => ({
  resolveIcon: () => null,
}));

import { NodeTypeOverlay } from '@/components/layout/NodeTypeOverlay';
import { createNodeFromType } from '@/lib/createNodeFromType';

describe('NodeTypeOverlay', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders nothing when not visible', () => {
    render(<NodeTypeOverlay visible={false} pinned={false} onPin={vi.fn()} />);
    expect(screen.queryByTestId('node-type-overlay')).toBeNull();
  });

  it('renders overlay with namespace groups when visible', () => {
    render(<NodeTypeOverlay visible={true} pinned={false} onPin={vi.fn()} />);
    const overlay = screen.getByTestId('node-type-overlay');
    expect(overlay).toBeDefined();
    expect(overlay.textContent).toContain('compute');
    expect(overlay.textContent).toContain('data');
    expect(overlay.textContent).toContain('Service');
    expect(overlay.textContent).toContain('Function');
    expect(overlay.textContent).toContain('Database');
  });

  it('filters types by search query', async () => {
    render(<NodeTypeOverlay visible={true} pinned={false} onPin={vi.fn()} />);
    const input = screen.getByPlaceholderText('Filter types...');
    await act(async () => {
      fireEvent.change(input, { target: { value: 'service' } });
    });
    const overlay = screen.getByTestId('node-type-overlay');
    expect(overlay.textContent).toContain('Service');
    expect(overlay.textContent).not.toContain('Database');
  });

  it('hides empty namespace groups when filter active', async () => {
    render(<NodeTypeOverlay visible={true} pinned={false} onPin={vi.fn()} />);
    const input = screen.getByPlaceholderText('Filter types...');
    await act(async () => {
      fireEvent.change(input, { target: { value: 'database' } });
    });
    const overlay = screen.getByTestId('node-type-overlay');
    expect(overlay.textContent).toContain('data');
    expect(overlay.textContent).not.toContain('compute');
  });

  it('calls createNodeFromType on click-to-add', async () => {
    render(<NodeTypeOverlay visible={true} pinned={false} onPin={vi.fn()} />);
    const items = screen.getAllByTestId('node-type-item');
    const serviceItem = items.find((el) => el.textContent?.includes('Service'));
    await act(async () => { fireEvent.click(serviceItem!); });
    expect(createNodeFromType).toHaveBeenCalledWith('__root__', 'compute/service');
  });

  it('sets correct dataTransfer on dragStart', () => {
    render(<NodeTypeOverlay visible={true} pinned={false} onPin={vi.fn()} />);
    const items = screen.getAllByTestId('node-type-item');
    const serviceItem = items.find((el) => el.textContent?.includes('Service'));

    const setData = vi.fn();
    const dataTransfer = { setData, effectAllowed: '' };
    fireEvent.dragStart(serviceItem!, { dataTransfer });
    expect(setData).toHaveBeenCalledWith('application/archcanvas-nodetype', 'compute/service');
  });

  it('auto-pins overlay on drag start', () => {
    const onPin = vi.fn();
    render(<NodeTypeOverlay visible={true} pinned={false} onPin={onPin} />);
    const items = screen.getAllByTestId('node-type-item');
    const serviceItem = items.find((el) => el.textContent?.includes('Service'));

    const dataTransfer = { setData: vi.fn(), effectAllowed: '' };
    fireEvent.dragStart(serviceItem!, { dataTransfer });
    expect(onPin).toHaveBeenCalledWith(true);
  });

  it('shows pinned indicator when pinned', () => {
    render(<NodeTypeOverlay visible={true} pinned={true} onPin={vi.fn()} />);
    const overlay = screen.getByTestId('node-type-overlay');
    expect(overlay.getAttribute('data-pinned')).toBe('true');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:unit -- --reporter=verbose test/unit/components/layout/NodeTypeOverlay.test.tsx`
Expected: FAIL — module `@/components/layout/NodeTypeOverlay` does not exist

- [ ] **Step 3: Write the implementation**

Create `src/components/layout/NodeTypeOverlay.tsx`:

```tsx
import { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { useRegistryStore } from '@/store/registryStore';
import { useNavigationStore } from '@/store/navigationStore';
import { createNodeFromType } from '@/lib/createNodeFromType';
import { resolveIcon } from '@/components/nodes/iconMap';

interface NodeTypeOverlayProps {
  visible: boolean;
  pinned: boolean;
  onPin: (pinned: boolean) => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}

export function NodeTypeOverlay({
  visible,
  pinned,
  onPin,
  onMouseEnter,
  onMouseLeave,
}: NodeTypeOverlayProps) {
  const [filter, setFilter] = useState('');
  const prefersReduced = useReducedMotion();

  const types = useMemo(() => {
    const store = useRegistryStore.getState();
    const defs = filter ? store.search(filter) : store.list();
    // Group by namespace, preserving order
    const grouped = new Map<string, typeof defs>();
    for (const def of defs) {
      const ns = def.metadata.namespace;
      if (!grouped.has(ns)) grouped.set(ns, []);
      grouped.get(ns)!.push(def);
    }
    return grouped;
  }, [filter]);

  const handleClick = useCallback(
    (typeKey: string) => {
      const canvasId = useNavigationStore.getState().currentCanvasId;
      createNodeFromType(canvasId, typeKey);
    },
    [],
  );

  const handleDragStart = useCallback(
    (e: React.DragEvent, typeKey: string) => {
      e.dataTransfer.setData('application/archcanvas-nodetype', typeKey);
      e.dataTransfer.effectAllowed = 'copy';
      onPin(true);
    },
    [onPin],
  );

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          data-testid="node-type-overlay"
          data-pinned={pinned ? 'true' : undefined}
          className="absolute left-12 z-30 w-[260px] overflow-hidden rounded-lg border bg-popover text-popover-foreground shadow-2xl"
          style={{
            borderColor: pinned ? 'var(--color-accent)' : 'var(--color-border)',
            maxHeight: 'calc(100vh - 32px)',
          }}
          initial={prefersReduced ? false : { opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          exit={prefersReduced ? undefined : { opacity: 0, x: -8 }}
          transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
          onMouseEnter={onMouseEnter}
          onMouseLeave={onMouseLeave}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border px-3 py-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Node Types
            </span>
            {pinned && (
              <span className="text-[10px] text-accent">pinned</span>
            )}
          </div>

          {/* Filter */}
          <div className="px-2 py-1.5">
            <input
              placeholder="Filter types..."
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="w-full rounded-md border border-border bg-popover px-2.5 py-1.5 text-xs text-popover-foreground outline-none placeholder:text-muted-foreground focus:border-accent"
            />
          </div>

          {/* Type list */}
          <div className="overflow-y-auto px-1.5 pb-2" style={{ maxHeight: 'calc(100vh - 120px)' }}>
            {Array.from(types.entries()).map(([namespace, defs]) => (
              <div key={namespace}>
                <div className="px-2 pb-0.5 pt-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {namespace}
                </div>
                <div className="grid grid-cols-2 gap-0.5">
                  {defs.map((def) => {
                    const typeKey = `${def.metadata.namespace}/${def.metadata.name}`;
                    const Icon = resolveIcon(def.metadata.icon);
                    return (
                      <div
                        key={typeKey}
                        data-testid="node-type-item"
                        data-type={typeKey}
                        draggable
                        onClick={() => handleClick(typeKey)}
                        onDragStart={(e) => handleDragStart(e, typeKey)}
                        className="flex cursor-grab items-center gap-1.5 rounded-md px-2 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground active:cursor-grabbing"
                      >
                        <span className="shrink-0 text-sm" aria-hidden>
                          {Icon ? <Icon className="h-3.5 w-3.5" /> : '◻'}
                        </span>
                        <span className="truncate">
                          {def.metadata.displayName ?? def.metadata.name}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}

            {types.size === 0 && (
              <div className="py-4 text-center text-xs text-muted-foreground">
                No types match filter.
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test:unit -- --reporter=verbose test/unit/components/layout/NodeTypeOverlay.test.tsx`
Expected: all 8 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/layout/NodeTypeOverlay.tsx test/unit/components/layout/NodeTypeOverlay.test.tsx
git commit -m "feat: add NodeTypeOverlay component with grouped grid, filter, drag support"
```

---

### Task 4: Integrate overlay into LeftToolbar

**Files:**
- Modify: `src/components/layout/LeftToolbar.tsx`

- [ ] **Step 1: Add hover/pin state management and render overlay**

Replace the "Add Node" entry in the `tools` array and add the overlay rendering. The key changes:

1. Remove the `onClick` that dispatches `archcanvas:open-palette` with `@` prefix
2. Add state: `overlayVisible`, `pinned`, and a `hoverTimeout` ref
3. Add hover handlers shared between button and overlay
4. Render `NodeTypeOverlay` positioned relative to the toolbar

In `src/components/layout/LeftToolbar.tsx`:

Add imports at top:
```typescript
import { useState, useRef, useCallback, useEffect } from 'react';
import { NodeTypeOverlay } from '@/components/layout/NodeTypeOverlay';
```

Inside `LeftToolbar` component, add state before the `tools` array:
```typescript
const [overlayVisible, setOverlayVisible] = useState(false);
const [pinned, setPinned] = useState(false);
const hoverTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

const clearHoverTimeout = useCallback(() => {
  if (hoverTimeout.current) {
    clearTimeout(hoverTimeout.current);
    hoverTimeout.current = null;
  }
}, []);

const handleMouseEnter = useCallback(() => {
  clearHoverTimeout();
  setOverlayVisible(true);
}, [clearHoverTimeout]);

const handleMouseLeave = useCallback(() => {
  clearHoverTimeout();
  hoverTimeout.current = setTimeout(() => {
    if (!pinned) setOverlayVisible(false);
  }, 150);
}, [clearHoverTimeout, pinned]);

const handlePin = useCallback((value: boolean) => {
  setPinned(value);
  if (value) setOverlayVisible(true);
}, []);

const handleAddNodeClick = useCallback(() => {
  if (pinned) {
    setPinned(false);
    setOverlayVisible(false);
  } else {
    setPinned(true);
    setOverlayVisible(true);
  }
}, [pinned]);

// Close overlay on Escape (document-level so it fires even without overlay focus)
useEffect(() => {
  if (!pinned) return;
  const handler = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.stopPropagation(); // prevent useCanvasKeyboard from also handling
      setPinned(false);
      setOverlayVisible(false);
    }
  };
  window.addEventListener('keydown', handler, { capture: true });
  return () => window.removeEventListener('keydown', handler, { capture: true });
}, [pinned]);

// Close overlay when user clicks on the canvas (click-outside dismiss)
useEffect(() => {
  if (!pinned) return;
  const handler = (e: MouseEvent) => {
    const target = e.target as HTMLElement;
    // If click is outside the toolbar + overlay area, dismiss
    if (!target.closest('[data-testid="node-type-overlay"]') &&
        !target.closest('[aria-label*="Add Node"]')) {
      setPinned(false);
      setOverlayVisible(false);
    }
  };
  window.addEventListener('click', handler);
  return () => window.removeEventListener('click', handler);
}, [pinned]);
```

Change the "Add Node" entry in the tools array:
```typescript
{
  icon: Square,
  label: "Add Node",
  shortcut: "N",
  onClick: handleAddNodeClick,
  onMouseEnter: handleMouseEnter,
  onMouseLeave: handleMouseLeave,
},
```

Update the tools type to include optional mouse handlers:
```typescript
const tools: Array<{
  icon: typeof MousePointer2;
  label: string;
  shortcut: string;
  mode?: ToolMode;
  active?: boolean;
  onClick?: () => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}> = [
```

In the button JSX, spread the mouse handlers:
```tsx
<button
  aria-label={shortcut ? `${label} (${shortcut})` : label}
  data-active={isActive ? "true" : undefined}
  className="relative flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
  onClick={onClick}
  onMouseEnter={onMouseEnter}
  onMouseLeave={onMouseLeave}
>
```

After the closing `</ScrollArea>`, render the overlay (inside a wrapper div):
```tsx
return (
  <div className="relative">
    <ScrollArea className="h-full">
      {/* ...existing toolbar content... */}
    </ScrollArea>
    <NodeTypeOverlay
      visible={overlayVisible}
      pinned={pinned}
      onPin={handlePin}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    />
  </div>
);
```

- [ ] **Step 2: Run full test suite to check for regressions**

Run: `npm run test:unit -- --reporter=verbose`
Expected: all tests PASS

- [ ] **Step 3: Commit**

```bash
git add src/components/layout/LeftToolbar.tsx
git commit -m "feat: integrate NodeTypeOverlay into LeftToolbar with hover/pin"
```

---

### Task 5: Add canvas drop handling

**Files:**
- Modify: `src/components/canvas/Canvas.tsx:292-293`

- [ ] **Step 1: Add drop handlers to Canvas**

In `src/components/canvas/Canvas.tsx`, add the import at top:
```typescript
import { createNodeFromType } from '@/lib/createNodeFromType';
```

Add callbacks before the `return` statement (near the other callbacks like `handleEdgeDelete`):
```typescript
const handleDragOver = useCallback((e: React.DragEvent) => {
  if (e.dataTransfer.types.includes('application/archcanvas-nodetype')) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }
}, []);

const handleDrop = useCallback((e: React.DragEvent) => {
  const typeKey = e.dataTransfer.getData('application/archcanvas-nodetype');
  if (!typeKey) return;
  e.preventDefault();

  const position = reactFlow.screenToFlowPosition({
    x: e.clientX,
    y: e.clientY,
  });

  const canvasId = useNavigationStore.getState().currentCanvasId;
  createNodeFromType(canvasId, typeKey, position);
}, [reactFlow]);
```

Add the handlers to the wrapper div (line ~293):
```tsx
<div
  data-testid="main-canvas"
  className="relative h-full w-full"
  onDragOver={handleDragOver}
  onDrop={handleDrop}
>
```

- [ ] **Step 2: Run full test suite to check for regressions**

Run: `npm run test:unit -- --reporter=verbose`
Expected: all tests PASS

- [ ] **Step 3: Commit**

```bash
git add src/components/canvas/Canvas.tsx
git commit -m "feat: add drag-and-drop node creation on canvas"
```

---

### Task 6: E2E tests

**Files:**
- Modify: `test/e2e/canvas.spec.ts` (or create `test/e2e/node-type-overlay.spec.ts` depending on existing E2E structure)

Check existing E2E test structure first (`test/e2e/` directory) and follow the existing patterns for selectors, helpers, and test organization.

- [ ] **Step 1: Write E2E tests**

Key scenarios to cover:

```typescript
test.describe('Node Type Overlay', () => {
  test('hover Add Node button shows overlay, hover away hides it', async ({ page }) => {
    const addNodeBtn = page.getByRole('button', { name: /Add Node/ });
    await addNodeBtn.hover();
    const overlay = page.getByTestId('node-type-overlay');
    await expect(overlay).toBeVisible();
    // Move mouse away
    await page.mouse.move(0, 0);
    await expect(overlay).not.toBeVisible();
  });

  test('click Add Node pins overlay, click again unpins', async ({ page }) => {
    const addNodeBtn = page.getByRole('button', { name: /Add Node/ });
    await addNodeBtn.click();
    const overlay = page.getByTestId('node-type-overlay');
    await expect(overlay).toBeVisible();
    await expect(overlay).toHaveAttribute('data-pinned', 'true');
    await addNodeBtn.click();
    await expect(overlay).not.toBeVisible();
  });

  test('click type in overlay creates node on canvas', async ({ page }) => {
    const addNodeBtn = page.getByRole('button', { name: /Add Node/ });
    await addNodeBtn.click();
    const serviceItem = page.getByTestId('node-type-item').filter({ hasText: 'Service' }).first();
    await serviceItem.click();
    // Verify node appears on canvas
    const canvas = page.getByTestId('main-canvas');
    await expect(canvas.locator('.react-flow__node').filter({ hasText: 'Service' })).toBeVisible();
  });

  test('drag type from overlay to canvas creates node at drop position', async ({ page }) => {
    const addNodeBtn = page.getByRole('button', { name: /Add Node/ });
    await addNodeBtn.click();
    const serviceItem = page.getByTestId('node-type-item').filter({ hasText: 'Service' }).first();
    const canvas = page.getByTestId('main-canvas');
    // Drag from overlay to canvas center
    await serviceItem.dragTo(canvas, { targetPosition: { x: 400, y: 300 } });
    await expect(canvas.locator('.react-flow__node').filter({ hasText: 'Service' })).toBeVisible();
  });

  test('N key opens palette with + prefix showing node types', async ({ page }) => {
    await page.keyboard.press('n');
    const paletteInput = page.getByPlaceholder(/Type a command/);
    await expect(paletteInput).toBeVisible();
    await expect(paletteInput).toHaveValue('+');
  });
});
```

- [ ] **Step 2: Run E2E tests**

Run: `npm run test:e2e-no-bridge`
Expected: new tests PASS alongside existing E2E suite

- [ ] **Step 3: Commit**

```bash
git add test/e2e/
git commit -m "test: add E2E tests for node type overlay"
```

---

### Task 7: Manual verification

- [ ] **Step 1: Run the dev server and verify**

Run: `npm run dev`

Verify in browser:
1. Hover over "Add Node" button → overlay slides in
2. Move mouse from button to overlay → overlay stays open
3. Move mouse away from both → overlay closes after brief delay
4. Click "Add Node" button → overlay pins (highlighted border, "pinned" text)
5. Click button again → overlay unpins and closes
6. Click on canvas while pinned → overlay closes
7. Press Escape while pinned → overlay closes
8. Click a type in overlay → node appears on canvas
9. Drag a type from overlay → drop on canvas → node at cursor position
10. Press `N` key → command palette opens with `+` prefix, showing node types
11. Type `+service` in palette → shows Service node type, click to add

- [ ] **Step 2: Run full test suite**

Run: `npm run test:unit -- --reporter=verbose`
Expected: all tests PASS, zero regressions

- [ ] **Step 3: Final commit if any tweaks were needed**

```bash
git add -u
git commit -m "fix: address issues found during manual verification"
```
