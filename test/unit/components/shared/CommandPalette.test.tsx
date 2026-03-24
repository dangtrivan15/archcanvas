/**
 * CommandPalette tests
 *
 * Strategy:
 * - Mock `cmdk` entirely (replacing Command.Dialog, Command.Input, etc. with
 *   plain DOM elements) to avoid ResizeObserver / scrollIntoView jsdom gaps.
 * - Mock all stores.
 * - Tests cover: open/close render, prefix filtering display, and
 *   selection callbacks routed to the correct store methods.
 *
 * Keyboard navigation is provided by cmdk natively and is not tested here;
 * it is better covered by Playwright E2E tests.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';

// ---------------------------------------------------------------------------
// Mock cmdk — replace all Command.* with simple plain HTML elements.
// The mock exposes the same tree structure the component renders, but without
// any of the library's internal DOM effects (ResizeObserver, scrollIntoView).
// ---------------------------------------------------------------------------
vi.mock('cmdk', () => {
  const React = require('react');

  // Dialog: renders children when `open` prop is true; calls onOpenChange(false) on Escape.
  const Dialog = ({
    open,
    onOpenChange,
    children,
    label,
  }: {
    open: boolean;
    onOpenChange?: (v: boolean) => void;
    children?: React.ReactNode;
    label?: string;
    shouldFilter?: boolean;
    className?: string;
    overlayClassName?: string;
    contentClassName?: string;
  }) => {
    if (!open) return null;
    return (
      <div
        data-testid="cmdk-dialog"
        aria-label={label}
        role="dialog"
        onKeyDown={(e: React.KeyboardEvent) => {
          if (e.key === 'Escape') onOpenChange?.(false);
        }}
      >
        {children}
      </div>
    );
  };
  Dialog.displayName = 'Command.Dialog';

  // Input: controlled input that fires onValueChange on every change
  const Input = ({
    value,
    onValueChange,
    placeholder,
    className,
  }: {
    value?: string;
    onValueChange?: (v: string) => void;
    placeholder?: string;
    className?: string;
  }) => (
    <input
      data-testid="cmdk-input"
      value={value ?? ''}
      onChange={(e) => onValueChange?.(e.target.value)}
      placeholder={placeholder}
      className={className}
    />
  );

  const List = ({ children, className }: { children?: React.ReactNode; className?: string }) => (
    <div data-testid="cmdk-list" className={className}>{children}</div>
  );

  const Group = ({
    children,
    heading,
    className,
  }: {
    children?: React.ReactNode;
    heading?: string;
    className?: string;
  }) => (
    <div data-testid={`cmdk-group-${heading}`} className={className}>
      {heading && <div data-testid="cmdk-group-heading">{heading}</div>}
      {children}
    </div>
  );

  const Item = ({
    children,
    onSelect,
    value,
    className,
  }: {
    children?: React.ReactNode;
    onSelect?: () => void;
    value?: string;
    className?: string;
  }) => (
    <div
      data-testid="cmdk-item"
      data-value={value}
      onClick={onSelect}
      className={className}
    >
      {children}
    </div>
  );

  const Empty = ({ children, className }: { children?: React.ReactNode; className?: string }) => (
    <div data-testid="cmdk-empty" className={className}>{children}</div>
  );

  const Command = { Dialog, Input, List, Group, Item, Empty };
  return { Command };
});

// ---------------------------------------------------------------------------
// Store mocks — must be registered BEFORE the component is imported
// ---------------------------------------------------------------------------

const mockNavigationState = {
  currentCanvasId: 'root',
  navigateTo: vi.fn(),
};
vi.mock('@/store/navigationStore', () => ({
  useNavigationStore: {
    getState: () => mockNavigationState,
  },
}));

const mockRootCanvas = {
  data: {
    nodes: [
      { id: 'node-1', type: 'compute/service', displayName: 'Auth Service' },
      { id: 'node-2', type: 'storage/database', displayName: 'Users DB' },
    ],
    entities: [
      { name: 'User', description: 'A system user' },
      { name: 'Order', description: 'A purchase order' },
    ],
    edges: [
      { from: { node: 'node-1' }, to: { node: 'node-2' }, entities: ['User'] },
    ],
  },
};

const mockFileState = {
  project: {
    canvases: new Map([
      ['root', mockRootCanvas],
      [
        'subsystem-a',
        {
          data: {
            displayName: 'Subsystem A',
            nodes: [],
            entities: [],
            edges: [],
          },
        },
      ],
    ]),
  },
  getCanvas: (id: string) => mockFileState.project.canvases.get(id),
  open: vi.fn(),
  save: vi.fn(),
};
vi.mock('@/store/fileStore', () => ({
  useFileStore: {
    getState: () => mockFileState,
  },
}));

const allNodeDefs = [
  {
    metadata: {
      namespace: 'compute',
      name: 'service',
      displayName: 'Service',
      icon: '⚙',
      shape: 'rectangle',
      version: '1.0',
    },
    kind: 'NodeDef',
    apiVersion: 'v1',
    spec: {},
  },
  {
    metadata: {
      namespace: 'storage',
      name: 'database',
      displayName: 'Database',
      icon: '🗄',
      shape: 'cylinder',
      version: '1.0',
    },
    kind: 'NodeDef',
    apiVersion: 'v1',
    spec: {},
  },
];

vi.mock('@/store/registryStore', () => ({
  useRegistryStore: {
    getState: () => ({
      search: (query: string) => {
        if (!query) return allNodeDefs;
        const q = query.toLowerCase();
        return allNodeDefs.filter(
          (d) =>
            d.metadata.name.includes(q) ||
            (d.metadata.displayName ?? '').toLowerCase().includes(q),
        );
      },
      resolve: (typeKey: string) => {
        return allNodeDefs.find(
          (d) => `${d.metadata.namespace}/${d.metadata.name}` === typeKey,
        ) ?? null;
      },
    }),
  },
}));

const mockCanvasState = {
  selectNodes: vi.fn(),
  selectEdge: vi.fn(),
  clearSelection: vi.fn(),
  deleteSelection: vi.fn(),
};
vi.mock('@/store/canvasStore', () => ({
  useCanvasStore: {
    getState: () => mockCanvasState,
  },
}));

const mockGraphState = {
  addNode: vi.fn().mockReturnValue({
    ok: true,
    data: {},
    patches: [],
    inversePatches: [],
    warnings: [],
  }),
};
vi.mock('@/store/graphStore', () => ({
  useGraphStore: {
    getState: () => mockGraphState,
  },
}));

const mockHistoryState = {
  undo: vi.fn(),
  redo: vi.fn(),
};
vi.mock('@/store/historyStore', () => ({
  useHistoryStore: {
    getState: () => mockHistoryState,
  },
}));

const mockUiState = {
  toggleLeftPanel: vi.fn(),
  toggleRightPanel: vi.fn(),
  toggleChat: vi.fn(),
  setRightPanelMode: vi.fn(),
  openRightPanel: vi.fn(),
};
vi.mock('@/store/uiStore', () => ({
  useUiStore: {
    getState: () => mockUiState,
  },
}));

const mockToolState = {
  setMode: vi.fn(),
};
vi.mock('@/store/toolStore', () => ({
  useToolStore: {
    getState: () => mockToolState,
  },
}));

vi.mock('@/lib/createNodeFromType', () => ({
  createNodeFromType: vi.fn(),
}));

// Import AFTER all mocks are registered
import { CommandPalette } from '@/components/shared/CommandPalette';
import { createNodeFromType } from '@/lib/createNodeFromType';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderPalette(open = true, onClose = vi.fn()) {
  return render(<CommandPalette open={open} onClose={onClose} />);
}

function getInput(): HTMLInputElement {
  return screen.getByTestId('cmdk-input') as HTMLInputElement;
}

async function setQuery(value: string) {
  await act(async () => {
    fireEvent.change(getInput(), { target: { value } });
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('CommandPalette', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // --- Open / close ---

  it('renders the dialog and input when open=true', () => {
    renderPalette(true);
    expect(screen.getByTestId('cmdk-dialog')).toBeDefined();
    expect(screen.getByTestId('cmdk-input')).toBeDefined();
  });

  it('renders nothing when open=false', () => {
    renderPalette(false);
    expect(screen.queryByTestId('cmdk-dialog')).toBeNull();
  });

  it('calls onClose when Escape is pressed', async () => {
    const onClose = vi.fn();
    renderPalette(true, onClose);
    await act(async () => {
      fireEvent.keyDown(screen.getByTestId('cmdk-dialog'), {
        key: 'Escape',
        code: 'Escape',
      });
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // --- Default results (empty query) ---

  it('shows node displayNames in the Nodes group', () => {
    renderPalette(true);
    const nodesGroup = screen.getByTestId('cmdk-group-Nodes');
    expect(nodesGroup.textContent).toContain('Auth Service');
    expect(nodesGroup.textContent).toContain('Users DB');
  });

  it('shows actions organized by category groups', () => {
    renderPalette(true);

    const fileGroup = screen.getByTestId('cmdk-group-File');
    expect(fileGroup.textContent).toContain('Save');
    expect(fileGroup.textContent).toContain('Open…');

    const editGroup = screen.getByTestId('cmdk-group-Edit');
    expect(editGroup.textContent).toContain('Undo');
    expect(editGroup.textContent).toContain('Redo');
    expect(editGroup.textContent).toContain('Delete Selection');

    const viewGroup = screen.getByTestId('cmdk-group-View');
    expect(viewGroup.textContent).toContain('Fit View');
    expect(viewGroup.textContent).toContain('Auto Layout');
    expect(viewGroup.textContent).toContain('Open AI Chat');

    const toolGroup = screen.getByTestId('cmdk-group-Tool');
    expect(toolGroup.textContent).toContain('Select Mode');
    expect(toolGroup.textContent).toContain('Pan Mode');
  });

  it('shows node type results in Node types group', () => {
    renderPalette(true);
    const typesGroup = screen.getByTestId('cmdk-group-Node types');
    expect(typesGroup.textContent).toContain('Service');
    expect(typesGroup.textContent).toContain('Database');
  });

  it('shows entity results in Entities group', () => {
    renderPalette(true);
    const entitiesGroup = screen.getByTestId('cmdk-group-Entities');
    expect(entitiesGroup.textContent).toContain('User');
    expect(entitiesGroup.textContent).toContain('Order');
  });

  it('shows canvas scope results in Scopes group', () => {
    renderPalette(true);
    const scopesGroup = screen.getByTestId('cmdk-group-Scopes');
    expect(scopesGroup.textContent).toContain('Subsystem A');
  });

  // --- Prefix filtering: > Actions ---

  it('> prefix: shows only action groups (File, Edit, View, Tool)', async () => {
    renderPalette(true);
    await setQuery('>');
    expect(screen.queryByTestId('cmdk-group-File')).not.toBeNull();
    expect(screen.queryByTestId('cmdk-group-Edit')).not.toBeNull();
    expect(screen.queryByTestId('cmdk-group-View')).not.toBeNull();
    expect(screen.queryByTestId('cmdk-group-Tool')).not.toBeNull();
    expect(screen.queryByTestId('cmdk-group-Nodes')).toBeNull();
    expect(screen.queryByTestId('cmdk-group-Node types')).toBeNull();
    expect(screen.queryByTestId('cmdk-group-Entities')).toBeNull();
    expect(screen.queryByTestId('cmdk-group-Scopes')).toBeNull();
  });

  it('> prefix with query: filters actions by text', async () => {
    renderPalette(true);
    await setQuery('> undo');
    const editGroup = screen.getByTestId('cmdk-group-Edit');
    expect(editGroup.textContent).toContain('Undo');
    expect(editGroup.textContent).not.toContain('Redo');
  });

  // --- Prefix filtering: @ Nodes ---

  it('@ prefix: shows only Nodes group', async () => {
    renderPalette(true);
    await setQuery('@');
    expect(screen.queryByTestId('cmdk-group-Nodes')).not.toBeNull();
    expect(screen.queryByTestId('cmdk-group-File')).toBeNull();
    expect(screen.queryByTestId('cmdk-group-Edit')).toBeNull();
    expect(screen.queryByTestId('cmdk-group-View')).toBeNull();
    expect(screen.queryByTestId('cmdk-group-Tool')).toBeNull();
    expect(screen.queryByTestId('cmdk-group-Node types')).toBeNull();
    expect(screen.queryByTestId('cmdk-group-Entities')).toBeNull();
    expect(screen.queryByTestId('cmdk-group-Scopes')).toBeNull();
  });

  it('@ prefix with query: filters nodes by display name', async () => {
    renderPalette(true);
    await setQuery('@auth');
    const nodesGroup = screen.getByTestId('cmdk-group-Nodes');
    expect(nodesGroup.textContent).toContain('Auth Service');
    expect(nodesGroup.textContent).not.toContain('Users DB');
  });

  // --- Prefix filtering: # Entities ---

  it('# prefix: shows only Entities group', async () => {
    renderPalette(true);
    await setQuery('#');
    expect(screen.queryByTestId('cmdk-group-Entities')).not.toBeNull();
    expect(screen.queryByTestId('cmdk-group-File')).toBeNull();
    expect(screen.queryByTestId('cmdk-group-Edit')).toBeNull();
    expect(screen.queryByTestId('cmdk-group-View')).toBeNull();
    expect(screen.queryByTestId('cmdk-group-Tool')).toBeNull();
    expect(screen.queryByTestId('cmdk-group-Nodes')).toBeNull();
    expect(screen.queryByTestId('cmdk-group-Scopes')).toBeNull();
  });

  it('# prefix with query: filters entities by name', async () => {
    renderPalette(true);
    await setQuery('#user');
    const entitiesGroup = screen.getByTestId('cmdk-group-Entities');
    expect(entitiesGroup.textContent).toContain('User');
    expect(entitiesGroup.textContent).not.toContain('Order');
  });

  // --- No results ---

  it('shows empty state when no results match', async () => {
    renderPalette(true);
    await setQuery('zzz_no_match_zzz');
    expect(screen.getByTestId('cmdk-empty')).toBeDefined();
    expect(screen.getByTestId('cmdk-empty').textContent).toContain('No results found');
  });

  // --- Selection callbacks ---

  it('clicking Undo calls historyStore.undo and closes', async () => {
    const onClose = vi.fn();
    renderPalette(true, onClose);
    await setQuery('>');
    const editGroup = screen.getByTestId('cmdk-group-Edit');
    const undoItem = Array.from(editGroup.querySelectorAll('[data-testid="cmdk-item"]')).find(
      (el) => el.textContent?.includes('Undo'),
    );
    expect(undoItem).toBeDefined();
    await act(async () => {
      fireEvent.click(undoItem!);
    });
    expect(mockHistoryState.undo).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('clicking Redo calls historyStore.redo and closes', async () => {
    const onClose = vi.fn();
    renderPalette(true, onClose);
    await setQuery('>');
    const editGroup = screen.getByTestId('cmdk-group-Edit');
    const redoItem = Array.from(editGroup.querySelectorAll('[data-testid="cmdk-item"]')).find(
      (el) => el.textContent?.includes('Redo'),
    );
    expect(redoItem).toBeDefined();
    await act(async () => {
      fireEvent.click(redoItem!);
    });
    expect(mockHistoryState.redo).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('clicking a node result calls canvasStore.selectNodes and closes', async () => {
    const onClose = vi.fn();
    renderPalette(true, onClose);
    await setQuery('@auth');
    const nodesGroup = screen.getByTestId('cmdk-group-Nodes');
    const nodeItem = nodesGroup.querySelector('[data-testid="cmdk-item"]');
    expect(nodeItem).toBeDefined();
    await act(async () => {
      fireEvent.click(nodeItem!);
    });
    expect(mockCanvasState.selectNodes).toHaveBeenCalledWith(['node-1']);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('clicking a node type calls createNodeFromType and closes', async () => {
    const onClose = vi.fn();
    renderPalette(true, onClose);
    await setQuery('service');
    const typesGroup = screen.getByTestId('cmdk-group-Node types');
    const serviceItem = Array.from(
      typesGroup.querySelectorAll('[data-testid="cmdk-item"]'),
    ).find((el) => el.textContent?.includes('compute/service'));
    expect(serviceItem).toBeDefined();
    await act(async () => {
      fireEvent.click(serviceItem!);
    });
    expect(createNodeFromType).toHaveBeenCalledWith(
      'root',
      'compute/service',
    );
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('clicking an entity result navigates to defining scope and opens entities panel', async () => {
    const onClose = vi.fn();
    renderPalette(true, onClose);
    await setQuery('#user');
    const entitiesGroup = screen.getByTestId('cmdk-group-Entities');
    const entityItem = entitiesGroup.querySelector('[data-testid="cmdk-item"]');
    expect(entityItem).toBeDefined();
    await act(async () => {
      fireEvent.click(entityItem!);
    });
    expect(mockNavigationState.navigateTo).toHaveBeenCalled();
    expect(mockUiState.setRightPanelMode).toHaveBeenCalledWith('entities');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('clicking a scope result calls navigationStore.navigateTo and closes', async () => {
    const onClose = vi.fn();
    renderPalette(true, onClose);
    await setQuery('subsystem');
    const scopesGroup = screen.getByTestId('cmdk-group-Scopes');
    const scopeItem = scopesGroup.querySelector('[data-testid="cmdk-item"]');
    expect(scopeItem).toBeDefined();
    await act(async () => {
      fireEvent.click(scopeItem!);
    });
    expect(mockNavigationState.navigateTo).toHaveBeenCalledWith('subsystem-a');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

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

  it('+ prefix: clicking a node type calls createNodeFromType', async () => {
    const onClose = vi.fn();
    renderPalette(true, onClose);
    await setQuery('+');
    const typesGroup = screen.getByTestId('cmdk-group-Node types');
    const serviceItem = Array.from(
      typesGroup.querySelectorAll('[data-testid="cmdk-item"]'),
    ).find((el) => el.textContent?.includes('Service'));
    expect(serviceItem).toBeDefined();
    await act(async () => { fireEvent.click(serviceItem!); });
    expect(createNodeFromType).toHaveBeenCalledWith(
      'root',
      'compute/service',
    );
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
