// @vitest-environment happy-dom
/**
 * Tests for Feature #196: Loading indicator during save operations.
 * Verifies that saveFile and saveFileAs set and clear loading state.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useGraphStore } from '@/store/graphStore';
import { useFileStore } from '@/store/fileStore';
import { useEngineStore } from '@/store/engineStore';
import { useHistoryStore } from '@/store/historyStore';
import { useUIStore } from '@/store/uiStore';
import type { StorageHandle } from '@/core/storage/types';

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

// Create mock StorageManager
const fakeStorageHandle: StorageHandle = {
  backend: 'test',
  name: 'test.archc',
  _internal: { name: 'test.archc' },
};

const mockSaveArchitecture = vi.fn().mockResolvedValue(fakeStorageHandle);
const mockSaveArchitectureAs = vi.fn().mockResolvedValue({ handle: fakeStorageHandle });

const mockStorageManager = {
  saveArchitecture: mockSaveArchitecture,
  saveArchitectureAs: mockSaveArchitectureAs,
  openArchitecture: vi.fn(),
  backendType: 'test',
  capabilities: { supportsDirectWrite: true, supportsLastModified: false },
};

describe('Feature #196: Loading indicator during save operations', () => {
  beforeEach(() => {
    // Reset mocks
    mockSaveArchitecture.mockReset().mockResolvedValue(fakeStorageHandle);
    mockSaveArchitectureAs.mockReset().mockResolvedValue({ handle: fakeStorageHandle });

    // Reset stores
    useGraphStore.setState({
      isDirty: false,
      graph: { name: 'Untitled Architecture', description: '', owners: [], nodes: [], edges: [] },
      nodeCount: 0,
      edgeCount: 0
    });
    useFileStore.setState({
      fileHandle: null,
      fileName: 'Untitled Architecture'
    });
    useEngineStore.setState({
      initialized: false
    });
    useHistoryStore.setState({
      canUndo: false,
      canRedo: false
    });
    useEngineStore.getState().initialize();
    // Inject mock storageManager
    useEngineStore.setState({ storageManager: mockStorageManager as any });

    // Reset loading state
    useUIStore.getState().clearFileOperationLoading();
  });

  it('saveFile sets and clears loading state', async () => {
    // Setup: add a node and set file handle
    const store = useGraphStore.getState();
    store.addNode({ type: 'compute/service', displayName: 'Test' });
    useFileStore.setState({ fileHandle: fakeStorageHandle });

    // Before save
    expect(useUIStore.getState().fileOperationLoading).toBe(false);

    // Execute save
    const result = await useFileStore.getState().saveFile();
    expect(result).toBe(true);

    // After save completes, loading should be cleared
    expect(useUIStore.getState().fileOperationLoading).toBe(false);
    expect(useUIStore.getState().fileOperationMessage).toBeNull();
  });

  it('saveFileAs sets and clears loading state', async () => {
    const store = useGraphStore.getState();
    store.addNode({ type: 'compute/service', displayName: 'Test' });

    // Before save
    expect(useUIStore.getState().fileOperationLoading).toBe(false);

    // Execute save as
    const result = await useFileStore.getState().saveFileAs();
    expect(result).toBe(true);

    // After save completes, loading should be cleared
    expect(useUIStore.getState().fileOperationLoading).toBe(false);
    expect(useUIStore.getState().fileOperationMessage).toBeNull();
  });

  it('loading state uses correct message for save operations', async () => {
    const store = useGraphStore.getState();
    store.addNode({ type: 'compute/service', displayName: 'Test' });
    useFileStore.setState({ fileHandle: fakeStorageHandle });

    // Track loading message changes
    const messages: string[] = [];
    const unsubscribe = useUIStore.subscribe((state) => {
      if (state.fileOperationLoading && state.fileOperationMessage) {
        messages.push(state.fileOperationMessage);
      }
    });

    await useFileStore.getState().saveFile();

    unsubscribe();

    // Should have set a loading message during save
    expect(messages.length).toBeGreaterThan(0);
    expect(messages[0]).toBe('Saving file...');
  });

  it('save error clears loading state', async () => {
    // Mock storageManager.saveArchitecture to throw
    mockSaveArchitecture.mockRejectedValueOnce(new Error('Write failed'));

    const store = useGraphStore.getState();
    store.addNode({ type: 'compute/service', displayName: 'Test' });
    useFileStore.setState({ fileHandle: fakeStorageHandle });

    // Execute save (should fail)
    const result = await useFileStore.getState().saveFile();
    expect(result).toBe(false);

    // Loading should be cleared even on error
    expect(useUIStore.getState().fileOperationLoading).toBe(false);
  });
});
