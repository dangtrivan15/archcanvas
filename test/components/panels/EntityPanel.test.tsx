import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { ResolvedProject, LoadedCanvas } from '@/storage/fileResolver';
import type { Canvas, Entity } from '@/types/schema';
import { ROOT_CANVAS_KEY } from '@/storage/fileResolver';

// ---------------------------------------------------------------------------
// Mock stores
// ---------------------------------------------------------------------------

let mockProject: ResolvedProject | null = null;
let mockCurrentCanvasId = ROOT_CANVAS_KEY;

const mockFileStoreState = {
  get project() { return mockProject; },
  getCanvas: (canvasId: string) => mockProject?.canvases.get(canvasId),
};

vi.mock('@/store/fileStore', () => ({
  useFileStore: Object.assign(
    (sel: (s: { project: ResolvedProject | null }) => unknown) => sel({ project: mockProject }),
    { getState: () => mockFileStoreState },
  ),
}));

vi.mock('@/store/navigationStore', () => ({
  useNavigationStore: Object.assign(
    (sel: (s: { currentCanvasId: string }) => unknown) => sel({ currentCanvasId: mockCurrentCanvasId }),
    { getState: () => ({ currentCanvasId: mockCurrentCanvasId }) },
  ),
}));

const mockHighlightEdges = vi.fn();
const mockClearHighlight = vi.fn();

vi.mock('@/store/canvasStore', () => ({
  useCanvasStore: {
    getState: () => ({
      highlightEdges: mockHighlightEdges,
      clearHighlight: mockClearHighlight,
    }),
  },
}));

const mockGraphState = {
  addEntity: vi.fn().mockReturnValue({ ok: true }),
  updateEntity: vi.fn().mockReturnValue({ ok: true }),
  removeEntity: vi.fn().mockReturnValue({ ok: true }),
};
vi.mock('@/store/graphStore', () => ({
  useGraphStore: Object.assign(vi.fn(() => mockGraphState), {
    getState: () => mockGraphState,
  }),
}));

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------

import { EntityPanel } from '@/components/panels/EntityPanel';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeCanvas(data: Partial<Canvas>, filePath = 'test.yaml'): LoadedCanvas {
  return {
    filePath,
    data: {
      nodes: [],
      edges: [],
      entities: [],
      ...data,
    },
    doc: undefined,
  };
}

function makeProject(opts: {
  rootEntities?: Entity[];
  rootEdges?: Canvas['edges'];
  childCanvases?: Array<{ id: string; entities?: Entity[]; edges?: Canvas['edges']; displayName?: string }>;
}): ResolvedProject {
  const rootData: Canvas = {
    project: { name: 'Test' },
    displayName: 'Root',
    nodes: [],
    edges: opts.rootEdges ?? [],
    entities: opts.rootEntities ?? [],
  };
  const root = makeCanvas(rootData, '.archcanvas/main.yaml');
  const canvases = new Map<string, LoadedCanvas>();
  canvases.set(ROOT_CANVAS_KEY, root);

  for (const child of opts.childCanvases ?? []) {
    canvases.set(child.id, makeCanvas({
      displayName: child.displayName ?? child.id,
      entities: child.entities ?? [],
      edges: child.edges ?? [],
      nodes: [],
    }));
  }

  return { root, canvases, errors: [] };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('EntityPanel', () => {
  beforeEach(() => {
    mockProject = null;
    mockCurrentCanvasId = ROOT_CANVAS_KEY;
    mockHighlightEdges.mockClear();
    mockClearHighlight.mockClear();
    mockGraphState.addEntity.mockReset().mockReturnValue({ ok: true });
    mockGraphState.updateEntity.mockReset().mockReturnValue({ ok: true });
    mockGraphState.removeEntity.mockReset().mockReturnValue({ ok: true });
  });

  it('renders "No project loaded" when project is null', () => {
    mockProject = null;
    render(<EntityPanel />);
    expect(screen.getByText('No project loaded')).toBeInTheDocument();
  });

  it('renders entity list when project has entities', () => {
    mockProject = makeProject({
      rootEntities: [
        { name: 'UserAccount', description: 'A user account entity' },
        { name: 'Order' },
      ],
    });
    render(<EntityPanel />);

    expect(screen.getByText('UserAccount')).toBeInTheDocument();
    expect(screen.getByText('Order')).toBeInTheDocument();
    expect(screen.getByText('A user account entity')).toBeInTheDocument();
  });

  it('filters entities by name', () => {
    mockProject = makeProject({
      rootEntities: [
        { name: 'UserAccount' },
        { name: 'Order' },
        { name: 'UserProfile' },
      ],
    });
    render(<EntityPanel />);

    const input = screen.getByPlaceholderText('Filter entities...');
    fireEvent.change(input, { target: { value: 'user' } });

    expect(screen.getByText('UserAccount')).toBeInTheDocument();
    expect(screen.getByText('UserProfile')).toBeInTheDocument();
    expect(screen.queryByText('Order')).not.toBeInTheDocument();
  });

  it('shows "No entities in this scope" when canvas has no entities', () => {
    mockProject = makeProject({ rootEntities: [] });
    render(<EntityPanel />);
    expect(screen.getByText('No entities in this scope')).toBeInTheDocument();
  });

  it('expanding an entity shows usage information', () => {
    mockProject = makeProject({
      rootEntities: [
        { name: 'UserAccount', description: 'A user entity', codeRefs: ['src/models/user.ts'] },
      ],
      rootEdges: [
        {
          from: { node: 'api' },
          to: { node: 'db' },
          entities: ['UserAccount'],
          label: 'reads',
        },
      ],
    });
    render(<EntityPanel />);

    // Click to expand
    const button = screen.getByText('UserAccount').closest('button')!;
    fireEvent.click(button);

    // Should show code refs
    expect(screen.getByText('src/models/user.ts')).toBeInTheDocument();

    // Should show usage info
    expect(screen.getByText(/Root/)).toBeInTheDocument();
    expect(screen.getByText(/1 edge/)).toBeInTheDocument();
  });

  it('shows "Not referenced on any edges" when entity has no usages', () => {
    mockProject = makeProject({
      rootEntities: [
        { name: 'OrphanEntity' },
      ],
    });
    render(<EntityPanel />);

    // Click to expand
    const button = screen.getByText('OrphanEntity').closest('button')!;
    fireEvent.click(button);

    expect(screen.getByText('Not referenced on any edges')).toBeInTheDocument();
  });

  it('collapses an expanded entity when clicked again', () => {
    mockProject = makeProject({
      rootEntities: [
        { name: 'UserAccount', codeRefs: ['src/models/user.ts'] },
      ],
    });
    render(<EntityPanel />);

    const button = screen.getByText('UserAccount').closest('button')!;

    // Expand
    fireEvent.click(button);
    expect(screen.getByText('src/models/user.ts')).toBeInTheDocument();

    // Collapse
    fireEvent.click(button);
    expect(screen.queryByText('src/models/user.ts')).not.toBeInTheDocument();
  });

  it('shows entities for a child canvas when navigated there', () => {
    mockProject = makeProject({
      rootEntities: [{ name: 'RootEntity' }],
      childCanvases: [
        { id: 'child-1', entities: [{ name: 'ChildEntity' }] },
      ],
    });
    mockCurrentCanvasId = 'child-1';
    render(<EntityPanel />);

    expect(screen.getByText('ChildEntity')).toBeInTheDocument();
    expect(screen.queryByText('RootEntity')).not.toBeInTheDocument();
  });

  it('shows plural "edges" for multiple edge usages', () => {
    mockProject = makeProject({
      rootEntities: [{ name: 'SharedEntity' }],
      rootEdges: [
        { from: { node: 'a' }, to: { node: 'b' }, entities: ['SharedEntity'] },
        { from: { node: 'c' }, to: { node: 'd' }, entities: ['SharedEntity'] },
      ],
    });
    render(<EntityPanel />);

    const button = screen.getByText('SharedEntity').closest('button')!;
    fireEvent.click(button);

    expect(screen.getByText(/2 edges/)).toBeInTheDocument();
  });

  // ---------------------------------------------------------------------------
  // Create Entity
  // ---------------------------------------------------------------------------

  describe('Create Entity', () => {
    function setupWithEntities() {
      mockProject = makeProject({
        rootEntities: [
          { name: 'Order', description: 'A purchase order' },
        ],
      });
      render(<EntityPanel />);
    }

    it('shows create form when New Entity button is clicked', () => {
      setupWithEntities();
      fireEvent.click(screen.getByRole('button', { name: /new entity/i }));
      expect(screen.getByPlaceholderText(/entity name/i)).toBeInTheDocument();
    });

    it('creates entity on submit', () => {
      setupWithEntities();
      fireEvent.click(screen.getByRole('button', { name: /new entity/i }));
      fireEvent.change(screen.getByPlaceholderText(/entity name/i), { target: { value: 'Payment' } });
      fireEvent.change(screen.getByPlaceholderText(/description/i), { target: { value: 'A payment record' } });
      fireEvent.click(screen.getByRole('button', { name: /^create$/i }));
      expect(mockGraphState.addEntity).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ name: 'Payment', description: 'A payment record' }),
      );
    });

    it('shows error for duplicate entity name', () => {
      mockGraphState.addEntity.mockReturnValue({ ok: false, error: { code: 'DUPLICATE_ENTITY', name: 'Order' } });
      setupWithEntities();
      fireEvent.click(screen.getByRole('button', { name: /new entity/i }));
      fireEvent.change(screen.getByPlaceholderText(/entity name/i), { target: { value: 'Order' } });
      fireEvent.click(screen.getByRole('button', { name: /^create$/i }));
      expect(screen.getByText(/already exists/i)).toBeInTheDocument();
    });

    it('rejects empty name', () => {
      setupWithEntities();
      fireEvent.click(screen.getByRole('button', { name: /new entity/i }));
      fireEvent.click(screen.getByRole('button', { name: /^create$/i }));
      expect(mockGraphState.addEntity).not.toHaveBeenCalled();
    });

    it('cancels form on Cancel button', () => {
      setupWithEntities();
      fireEvent.click(screen.getByRole('button', { name: /new entity/i }));
      expect(screen.getByPlaceholderText(/entity name/i)).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
      expect(screen.queryByPlaceholderText(/entity name/i)).not.toBeInTheDocument();
    });
  });

  // ---------------------------------------------------------------------------
  // Edit Entity
  // ---------------------------------------------------------------------------

  describe('Edit Entity', () => {
    function setupWithEntity() {
      mockProject = makeProject({
        rootEntities: [
          { name: 'Order', description: 'A purchase order', codeRefs: ['src/order.ts'] },
        ],
      });
      render(<EntityPanel />);
    }

    it('shows edit form when edit button clicked on expanded entity', () => {
      setupWithEntity();
      // Expand entity row
      fireEvent.click(screen.getByText('Order').closest('button')!);
      // Click edit button
      fireEvent.click(screen.getByRole('button', { name: /edit/i }));
      expect(screen.getByDisplayValue(/purchase order/i)).toBeInTheDocument();
    });

    it('saves updated description', () => {
      setupWithEntity();
      fireEvent.click(screen.getByText('Order').closest('button')!);
      fireEvent.click(screen.getByRole('button', { name: /edit/i }));
      const textarea = screen.getByDisplayValue(/purchase order/i);
      fireEvent.change(textarea, { target: { value: 'Updated description' } });
      fireEvent.click(screen.getByRole('button', { name: /save/i }));
      expect(mockGraphState.updateEntity).toHaveBeenCalledWith(
        expect.any(String), 'Order', expect.objectContaining({ description: 'Updated description' }),
      );
    });

    it('reverts on cancel', () => {
      setupWithEntity();
      fireEvent.click(screen.getByText('Order').closest('button')!);
      fireEvent.click(screen.getByRole('button', { name: /edit/i }));
      fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
      // Should be back to read-only
      expect(screen.queryByRole('button', { name: /save/i })).not.toBeInTheDocument();
    });
  });

  // ---------------------------------------------------------------------------
  // Delete Entity
  // ---------------------------------------------------------------------------

  describe('Delete Entity', () => {
    function setupWithEntity() {
      mockProject = makeProject({
        rootEntities: [
          { name: 'Order', description: 'A purchase order' },
        ],
      });
      render(<EntityPanel />);
    }

    it('deletes entity not in use', () => {
      setupWithEntity();
      fireEvent.click(screen.getByText('Order').closest('button')!);
      fireEvent.click(screen.getByRole('button', { name: /delete/i }));
      // Confirm
      fireEvent.click(screen.getByRole('button', { name: /confirm/i }));
      expect(mockGraphState.removeEntity).toHaveBeenCalledWith(expect.any(String), 'Order');
    });

    it('shows warning when entity is in use', () => {
      mockGraphState.removeEntity.mockReturnValue({
        ok: false,
        error: { code: 'ENTITY_IN_USE', name: 'Order', referencedBy: [{ from: 'a', to: 'b' }] },
      });
      setupWithEntity();
      fireEvent.click(screen.getByText('Order').closest('button')!);
      fireEvent.click(screen.getByRole('button', { name: /delete/i }));
      fireEvent.click(screen.getByRole('button', { name: /confirm/i }));
      expect(screen.getByText(/referenced by/i)).toBeInTheDocument();
    });
  });
});
