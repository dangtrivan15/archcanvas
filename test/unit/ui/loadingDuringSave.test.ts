// @vitest-environment happy-dom
/**
 * Tests for Feature #196: Loading indicator during save operations.
 * Verifies that saveFile and saveFileAs set and clear loading state.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useCoreStore } from '@/store/coreStore';
import { useUIStore } from '@/store/uiStore';

// Mock the file I/O module
vi.mock('@/core/storage/fileIO', async () => {
  const actual = await vi.importActual('@/core/storage/fileIO');
  return {
    ...actual,
    saveArchcFile: vi.fn().mockResolvedValue(true),
    saveArchcFileAs: vi.fn().mockResolvedValue({
      fileHandle: { name: 'test.archc' } as any,
      fileName: 'test',
    }),
    openArchcFile: vi.fn().mockResolvedValue(null),
  };
});

// Mock the canvas store
vi.mock('@/store/canvasStore', () => ({
  useCanvasStore: {
    getState: () => ({
      viewport: { x: 0, y: 0, zoom: 1 },
      selectedNodeId: null,
      setViewport: vi.fn(),
    }),
  },
}));

describe('Feature #196: Loading indicator during save operations', () => {
  beforeEach(() => {
    // Reset stores
    useCoreStore.setState({
      initialized: false,
      isDirty: false,
      graph: { name: 'Untitled Architecture', description: '', owners: [], nodes: [], edges: [] },
      fileHandle: null,
      fileName: 'Untitled Architecture',
      nodeCount: 0,
      edgeCount: 0,
      canUndo: false,
      canRedo: false,
    });
    useCoreStore.getState().initialize();

    // Reset loading state
    useUIStore.getState().clearFileOperationLoading();
  });

  it('saveFile sets and clears loading state', async () => {
    // Setup: add a node and set file handle
    const store = useCoreStore.getState();
    store.addNode({ type: 'compute/service', displayName: 'Test' });
    useCoreStore.setState({ fileHandle: { name: 'test.archc' } as any });

    // Before save
    expect(useUIStore.getState().fileOperationLoading).toBe(false);

    // Execute save
    const result = await useCoreStore.getState().saveFile();
    expect(result).toBe(true);

    // After save completes, loading should be cleared
    expect(useUIStore.getState().fileOperationLoading).toBe(false);
    expect(useUIStore.getState().fileOperationMessage).toBeNull();
  });

  it('saveFileAs sets and clears loading state', async () => {
    const store = useCoreStore.getState();
    store.addNode({ type: 'compute/service', displayName: 'Test' });

    // Before save
    expect(useUIStore.getState().fileOperationLoading).toBe(false);

    // Execute save as
    const result = await useCoreStore.getState().saveFileAs();
    expect(result).toBe(true);

    // After save completes, loading should be cleared
    expect(useUIStore.getState().fileOperationLoading).toBe(false);
    expect(useUIStore.getState().fileOperationMessage).toBeNull();
  });

  it('loading state uses correct message for save operations', async () => {
    const store = useCoreStore.getState();
    store.addNode({ type: 'compute/service', displayName: 'Test' });
    useCoreStore.setState({ fileHandle: { name: 'test.archc' } as any });

    // Track loading message changes
    const messages: string[] = [];
    const unsubscribe = useUIStore.subscribe((state) => {
      if (state.fileOperationLoading && state.fileOperationMessage) {
        messages.push(state.fileOperationMessage);
      }
    });

    await useCoreStore.getState().saveFile();

    unsubscribe();

    // Should have set a loading message during save
    expect(messages.length).toBeGreaterThan(0);
    expect(messages[0]).toBe('Saving file...');
  });

  it('save error clears loading state', async () => {
    // Mock saveArchcFile to throw
    const { saveArchcFile } = await import('@/core/storage/fileIO');
    (saveArchcFile as any).mockRejectedValueOnce(new Error('Write failed'));

    const store = useCoreStore.getState();
    store.addNode({ type: 'compute/service', displayName: 'Test' });
    useCoreStore.setState({ fileHandle: { name: 'test.archc' } as any });

    // Execute save (should fail)
    const result = await useCoreStore.getState().saveFile();
    expect(result).toBe(false);

    // Loading should be cleared even on error
    expect(useUIStore.getState().fileOperationLoading).toBe(false);
  });
});
