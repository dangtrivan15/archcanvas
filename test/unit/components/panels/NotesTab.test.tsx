import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { NotesTab } from '@/components/panels/NotesTab';
import { useGraphStore } from '@/store/graphStore';

// Mock graphStore to capture what gets saved
vi.mock('@/store/graphStore', () => ({
  useGraphStore: {
    getState: vi.fn(() => ({
      updateNode: vi.fn(),
      updateEdge: vi.fn(),
    })),
  },
}));

describe('NotesTab', () => {
  let mockUpdateNode: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockUpdateNode = vi.fn();
    vi.mocked(useGraphStore.getState).mockReturnValue({
      updateNode: mockUpdateNode,
      updateEdge: vi.fn(),
    } as any);
  });

  it('generates id and createdAt when adding a new note', async () => {
    render(
      <NotesTab notes={[]} canvasId="main" nodeId="api" />,
    );

    // Click "+ Add Note"
    fireEvent.click(screen.getByText('+ Add Note'));

    // Fill in content (minimum required field for save)
    const contentInput = screen.getByPlaceholderText('Note content...');
    fireEvent.change(contentInput, { target: { value: 'test note' } });

    // Click Save
    fireEvent.click(screen.getByText('Save'));

    // Verify updateNode was called with a note that has id and createdAt
    expect(mockUpdateNode).toHaveBeenCalledWith('main', 'api', {
      notes: [
        expect.objectContaining({
          id: expect.any(String),
          createdAt: expect.any(String),
          author: 'anonymous',
          content: 'test note',
        }),
      ],
    });

    const savedNotes = mockUpdateNode.mock.calls[0][2].notes;
    // id should look like a UUID fragment
    expect(savedNotes[0].id).toMatch(/^[0-9a-f-]+$/);
    // createdAt should be ISO format
    expect(new Date(savedNotes[0].createdAt).toISOString()).toBe(savedNotes[0].createdAt);
  });

  it('preserves id and createdAt when editing an existing note', () => {
    const existingNote = {
      id: 'existing-id',
      author: 'van',
      content: 'original',
      createdAt: '2026-03-12T10:00:00.000Z',
    };

    render(
      <NotesTab notes={[existingNote]} canvasId="main" nodeId="api" />,
    );

    // Click Edit on the existing note
    fireEvent.click(screen.getByText('Edit'));

    // Change content
    const contentInput = screen.getByDisplayValue('original');
    fireEvent.change(contentInput, { target: { value: 'updated' } });

    // Click Save
    fireEvent.click(screen.getByText('Save'));

    const savedNotes = mockUpdateNode.mock.calls[0][2].notes;
    expect(savedNotes[0].id).toBe('existing-id');
    expect(savedNotes[0].createdAt).toBe('2026-03-12T10:00:00.000Z');
    expect(savedNotes[0].content).toBe('updated');
  });

  it('renders existing notes without id using fallback key (no crash)', () => {
    const legacyNote = { author: 'van', content: 'old note' };

    // Should render without errors
    const { container } = render(
      <NotesTab notes={[legacyNote]} canvasId="main" nodeId="api" />,
    );

    expect(screen.getByText('old note')).toBeDefined();
    // Verify it rendered (no key warning crash)
    expect(container.querySelectorAll('.group')).toHaveLength(1);
  });
});
