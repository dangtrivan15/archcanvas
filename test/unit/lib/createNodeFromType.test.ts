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
