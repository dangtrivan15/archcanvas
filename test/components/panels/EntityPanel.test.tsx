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

vi.mock('@/store/fileStore', () => ({
  useFileStore: (sel: (s: { project: ResolvedProject | null }) => unknown) =>
    sel({ project: mockProject }),
}));

vi.mock('@/store/navigationStore', () => ({
  useNavigationStore: (sel: (s: { currentCanvasId: string }) => unknown) =>
    sel({ currentCanvasId: mockCurrentCanvasId }),
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
});
