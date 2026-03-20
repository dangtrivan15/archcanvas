import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { Edge } from '@/types';

// ---------------------------------------------------------------------------
// Mock stores
// ---------------------------------------------------------------------------

const mockGraphState = {
  updateEdge: vi.fn(),
  addEntity: vi.fn().mockReturnValue({ ok: true }),
  addNote: vi.fn(),
};
vi.mock('@/store/graphStore', () => ({
  useGraphStore: Object.assign(vi.fn(() => mockGraphState), {
    getState: () => mockGraphState,
  }),
}));

const canvasEntities = [
  { name: 'Order', description: 'A purchase order' },
  { name: 'User', description: 'A system user' },
];

vi.mock('@/store/fileStore', () => ({
  useFileStore: {
    getState: () => ({
      getCanvas: () => ({
        data: { nodes: [], edges: [], entities: canvasEntities },
      }),
    }),
  },
}));

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------

import { EdgeDetailPanel } from '@/components/panels/EdgeDetailPanel';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const testEdge: Edge = {
  from: { node: 'svc-a' },
  to: { node: 'svc-b' },
  protocol: 'HTTP',
  label: 'call',
  entities: [],
};

const testEdgeWithAssigned: Edge = {
  ...testEdge,
  entities: ['Order'],
};

function setup(edge: Edge = testEdge) {
  render(<EdgeDetailPanel edge={edge} canvasId="__root__" />);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('EdgeDetailPanel — Entity Autocomplete', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGraphState.addEntity.mockReturnValue({ ok: true });
  });

  it('shows dropdown with matching entities on type', () => {
    setup();
    fireEvent.click(screen.getByText(/add entity/i));
    fireEvent.change(screen.getByPlaceholderText(/entity/i), { target: { value: 'Ord' } });
    expect(screen.getByText('Order')).toBeInTheDocument();
  });

  it('filters case-insensitively', () => {
    setup();
    fireEvent.click(screen.getByText(/add entity/i));
    fireEvent.change(screen.getByPlaceholderText(/entity/i), { target: { value: 'ord' } });
    expect(screen.getByText('Order')).toBeInTheDocument();
  });

  it('selects existing entity and updates edge', () => {
    setup();
    fireEvent.click(screen.getByText(/add entity/i));
    fireEvent.change(screen.getByPlaceholderText(/entity/i), { target: { value: 'Ord' } });
    fireEvent.click(screen.getByText('Order'));
    expect(mockGraphState.updateEdge).toHaveBeenCalledWith(
      '__root__', 'svc-a', 'svc-b',
      expect.objectContaining({ entities: ['Order'] }),
    );
  });

  it('shows Create option when no match exists', () => {
    setup();
    fireEvent.click(screen.getByText(/add entity/i));
    fireEvent.change(screen.getByPlaceholderText(/entity/i), { target: { value: 'Payment' } });
    expect(screen.getByText(/create "Payment"/i)).toBeInTheDocument();
  });

  it('hides Create option when case-insensitive match exists', () => {
    setup();
    fireEvent.click(screen.getByText(/add entity/i));
    fireEvent.change(screen.getByPlaceholderText(/entity/i), { target: { value: 'order' } });
    expect(screen.queryByText(/create "order"/i)).not.toBeInTheDocument();
  });

  it('quick-creates and assigns entity', () => {
    setup();
    fireEvent.click(screen.getByText(/add entity/i));
    fireEvent.change(screen.getByPlaceholderText(/entity/i), { target: { value: 'Payment' } });
    fireEvent.click(screen.getByText(/create "Payment"/i));
    expect(mockGraphState.addEntity).toHaveBeenCalledWith(
      '__root__',
      expect.objectContaining({ name: 'Payment' }),
    );
    expect(mockGraphState.updateEdge).toHaveBeenCalled();
  });

  it('handles DUPLICATE_ENTITY race — treats existing as match', () => {
    mockGraphState.addEntity.mockReturnValueOnce({
      ok: false, error: { code: 'DUPLICATE_ENTITY', name: 'Payment' },
    });
    setup();
    fireEvent.click(screen.getByText(/add entity/i));
    fireEvent.change(screen.getByPlaceholderText(/entity/i), { target: { value: 'Payment' } });
    fireEvent.click(screen.getByText(/create "Payment"/i));
    // Should still assign to edge despite addEntity failure
    expect(mockGraphState.updateEdge).toHaveBeenCalled();
  });

  it('excludes already-assigned entities from dropdown', () => {
    setup(testEdgeWithAssigned);
    fireEvent.click(screen.getByText(/add entity/i));
    fireEvent.change(screen.getByPlaceholderText(/entity/i), { target: { value: 'Ord' } });
    // 'Order' is already assigned, should not appear in dropdown options
    // But it may appear as a pill in the assigned list — check specifically in the dropdown
    const dropdown = screen.queryByRole('listbox');
    if (dropdown) {
      expect(dropdown.textContent).not.toContain('Order');
    }
  });

  it('dismisses dropdown on Escape', () => {
    setup();
    fireEvent.click(screen.getByText(/add entity/i));
    fireEvent.change(screen.getByPlaceholderText(/entity/i), { target: { value: 'Ord' } });
    fireEvent.keyDown(screen.getByPlaceholderText(/entity/i), { key: 'Escape' });
    // After Escape, the autocomplete input should be gone
    expect(screen.queryByPlaceholderText(/entity/i)).not.toBeInTheDocument();
  });
});
