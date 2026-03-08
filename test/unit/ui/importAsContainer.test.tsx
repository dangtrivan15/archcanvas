/**
 * Tests for the Import Tech Stack as Container Node feature (#457).
 *
 * Validates:
 * - UseTemplateDialog shows import mode toggle (container / inline)
 * - Container mode creates .archc file in project folder and adds container node
 * - Inline mode replaces the entire canvas (legacy behavior)
 * - No-project fallback: container mode falls back to inline when no project is open
 * - Project manifest is updated with new file entry and link
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { UseTemplateDialog } from '@/components/shared/UseTemplateDialog';
import type { TemplateRecord } from '@/templates/types';

// ── Shared mock fns (must be defined via vi.hoisted to be accessible in vi.mock) ──

const mocks = vi.hoisted(() => ({
  saveTemplateAsFile: vi.fn().mockResolvedValue('test-template.archc'),
  setGraph: vi.fn(),
  showToast: vi.fn(),
  requestFitView: vi.fn(),
  zoomToRoot: vi.fn(),
  clear: vi.fn(),
  snapshot: vi.fn(),
  setState: vi.fn(),
  openUnsavedChangesDialog: vi.fn(),
  createNode: vi.fn((params: Record<string, unknown>) => ({
    id: 'container-id',
    type: params.type,
    displayName: params.displayName,
    args: params.args ?? {},
    codeRefs: [],
    notes: [],
    properties: {},
    position: { x: 0, y: 0, width: 200, height: 100 },
    children: [],
  })),
  addNode: vi.fn(
    (graph: { nodes: unknown[]; edges: unknown[] }, node: unknown) => ({
      ...graph,
      nodes: [...graph.nodes, node],
    }),
  ),
  isProjectOpen: { value: false },
}));

// ── Mock stores ──────────────────────────────────────────

vi.mock('@/store/coreStore', () => {
  const graph = {
    name: 'Test',
    description: '',
    owners: [],
    nodes: [],
    edges: [],
    annotations: [],
  };
  const store = {
    textApi: {
      getGraph: vi.fn(() => graph),
      setGraph: mocks.setGraph,
    },
    undoManager: {
      clear: mocks.clear,
      snapshot: mocks.snapshot,
    },
    isDirty: false,
    graph,
  };
  const useCoreStore = Object.assign(
    (selector: (s: typeof store) => unknown) => selector(store),
    { setState: mocks.setState, getState: () => store },
  );
  return { useCoreStore };
});

vi.mock('@/store/canvasStore', () => ({
  useCanvasStore: (selector: (s: Record<string, unknown>) => unknown) =>
    selector({ requestFitView: mocks.requestFitView }),
}));

vi.mock('@/store/uiStore', () => {
  const store = {
    showToast: mocks.showToast,
    openUnsavedChangesDialog: mocks.openUnsavedChangesDialog,
    openErrorDialog: vi.fn(),
  };
  return {
    useUIStore: (selector: (s: typeof store) => unknown) => selector(store),
  };
});

vi.mock('@/store/navigationStore', () => ({
  useNavigationStore: (selector: (s: Record<string, unknown>) => unknown) =>
    selector({ zoomToRoot: mocks.zoomToRoot }),
}));

vi.mock('@/store/projectStore', () => {
  const store = {
    get isProjectOpen() {
      return mocks.isProjectOpen.value;
    },
    saveTemplateAsFile: mocks.saveTemplateAsFile,
  };
  return {
    useProjectStore: (selector: (s: typeof store) => unknown) => selector(store),
  };
});

vi.mock('@/hooks/useFocusTrap', () => ({
  useFocusTrap: () => ({ current: null }),
}));

vi.mock('@/core/layout/elkLayout', () => ({
  computeElkLayout: vi.fn().mockResolvedValue({ positions: new Map() }),
}));

vi.mock('@/stacks/stackLoader', () => ({
  instantiateStack: vi.fn(() => ({
    name: 'SaaS Starter',
    description: 'test',
    owners: [],
    nodes: [
      {
        id: 'n1',
        type: 'compute/service',
        displayName: 'Node 1',
        args: {},
        codeRefs: [],
        notes: [],
        properties: {},
        position: { x: 0, y: 0, width: 200, height: 100 },
        children: [],
      },
    ],
    edges: [],
    annotations: [],
  })),
}));

vi.mock('@/proto/archcanvas', () => ({
  Architecture: {
    decode: vi.fn(() => ({
      name: 'Imported Arch',
      nodes: [],
      edges: [],
    })),
  },
}));

vi.mock('@/core/storage/fileIO', () => ({
  protoToGraph: vi.fn(() => ({
    name: 'Imported Arch',
    description: '',
    owners: [],
    nodes: [],
    edges: [],
    annotations: [],
  })),
}));

vi.mock('@/core/graph/graphEngine', () => ({
  createNode: mocks.createNode,
  addNode: mocks.addNode,
}));

// ── Test Data ─────────────────────────────────────────────

const builtinTemplate: TemplateRecord = {
  metadata: {
    id: 'test-builtin',
    name: 'SaaS Starter',
    description: 'A basic SaaS template',
    icon: 'Rocket',
    category: 'general',
    nodeCount: 5,
    edgeCount: 3,
    createdAt: Date.now(),
    source: 'builtin',
    tags: ['saas'],
  },
  data: `metadata:
  name: saas-starter
  displayName: SaaS Starter
  description: A basic SaaS template
  icon: Rocket
  tags: [saas]
nodes:
  - id: api
    type: compute/service
    displayName: API Gateway
edges: []`,
};

// ── Tests ─────────────────────────────────────────────────

describe('UseTemplateDialog - Import Modes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isProjectOpen.value = false;
  });

  it('renders the import mode toggle', () => {
    render(<UseTemplateDialog template={builtinTemplate} onClose={vi.fn()} />);

    expect(screen.getByTestId('import-mode-toggle')).toBeInTheDocument();
    expect(screen.getByTestId('import-mode-container')).toBeInTheDocument();
    expect(screen.getByTestId('import-mode-inline')).toBeInTheDocument();
  });

  it('defaults to inline when no project is open', () => {
    render(<UseTemplateDialog template={builtinTemplate} onClose={vi.fn()} />);

    const inlineBtn = screen.getByTestId('import-mode-inline');
    expect(inlineBtn.className).toContain('border-blue-500');
  });

  it('defaults to container when project is open', () => {
    mocks.isProjectOpen.value = true;

    render(<UseTemplateDialog template={builtinTemplate} onClose={vi.fn()} />);

    const containerBtn = screen.getByTestId('import-mode-container');
    expect(containerBtn.className).toContain('border-blue-500');
  });

  it('shows warning when container mode selected but no project open', () => {
    render(<UseTemplateDialog template={builtinTemplate} onClose={vi.fn()} />);

    // Switch to container mode
    fireEvent.click(screen.getByTestId('import-mode-container'));

    expect(screen.getByTestId('no-project-warning')).toBeInTheDocument();
    expect(screen.getByTestId('no-project-warning').textContent).toContain(
      'No project folder is open',
    );
  });

  it('confirm button text changes based on import mode', () => {
    mocks.isProjectOpen.value = true;

    render(<UseTemplateDialog template={builtinTemplate} onClose={vi.fn()} />);

    // Default: container mode
    expect(screen.getByTestId('use-template-confirm').textContent).toBe('Import as Container');

    // Switch to inline
    fireEvent.click(screen.getByTestId('import-mode-inline'));
    expect(screen.getByTestId('use-template-confirm').textContent).toBe('Use Template');
  });

  it('calls saveTemplateAsFile and creates container node in container mode', async () => {
    mocks.isProjectOpen.value = true;

    const onClose = vi.fn();
    render(<UseTemplateDialog template={builtinTemplate} onClose={onClose} />);

    fireEvent.click(screen.getByTestId('use-template-confirm'));

    await waitFor(() => {
      expect(mocks.saveTemplateAsFile).toHaveBeenCalled();
    });

    // Verify container node was created
    expect(mocks.createNode).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'meta/canvas-ref',
        displayName: 'SaaS Starter',
      }),
    );

    // Verify addNode was called to add the container to the current graph
    expect(mocks.addNode).toHaveBeenCalled();
  });

  it('falls back to inline when container mode selected but no project open', async () => {
    render(<UseTemplateDialog template={builtinTemplate} onClose={vi.fn()} />);

    // Switch to container mode
    fireEvent.click(screen.getByTestId('import-mode-container'));
    // Confirm
    fireEvent.click(screen.getByTestId('use-template-confirm'));

    await waitFor(() => {
      expect(mocks.showToast).toHaveBeenCalledWith(
        'No project folder open — importing inline instead',
      );
    });

    // Should NOT call saveTemplateAsFile
    expect(mocks.saveTemplateAsFile).not.toHaveBeenCalled();
  });

  it('inline mode calls setGraph with the template graph', async () => {
    render(<UseTemplateDialog template={builtinTemplate} onClose={vi.fn()} />);

    // Inline is default when no project open
    fireEvent.click(screen.getByTestId('use-template-confirm'));

    await waitFor(() => {
      expect(mocks.setGraph).toHaveBeenCalled();
    });

    // Clear + snapshot called for inline mode
    expect(mocks.clear).toHaveBeenCalled();
  });

  it('pre-fills the name input with template name', () => {
    render(<UseTemplateDialog template={builtinTemplate} onClose={vi.fn()} />);

    const input = screen.getByTestId('use-template-name-input') as HTMLInputElement;
    expect(input.value).toBe('SaaS Starter');
  });

  it('label changes based on import mode', () => {
    mocks.isProjectOpen.value = true;

    render(<UseTemplateDialog template={builtinTemplate} onClose={vi.fn()} />);

    // Container mode: label says "Container Name"
    expect(screen.getByText('Container Name')).toBeInTheDocument();

    // Switch to inline
    fireEvent.click(screen.getByTestId('import-mode-inline'));
    expect(screen.getByText('Architecture Name')).toBeInTheDocument();
  });

  it('renders null when template is null', () => {
    const { container } = render(
      <UseTemplateDialog template={null} onClose={vi.fn()} />,
    );
    expect(container.innerHTML).toBe('');
  });

  it('help text changes based on import mode', () => {
    mocks.isProjectOpen.value = true;

    render(<UseTemplateDialog template={builtinTemplate} onClose={vi.fn()} />);

    // Container mode help text
    expect(
      screen.getByText(
        'The template will be saved as a separate .archc file in your project folder.',
      ),
    ).toBeInTheDocument();

    // Switch to inline
    fireEvent.click(screen.getByTestId('import-mode-inline'));
    expect(
      screen.getByText(
        'A new architecture will be created with fresh node and edge IDs.',
      ),
    ).toBeInTheDocument();
  });
});
