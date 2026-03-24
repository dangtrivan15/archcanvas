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

const mockScreenToFlowPosition = vi.fn().mockReturnValue({ x: 100, y: 200 });
vi.mock('@/lib/reactFlowRef', () => ({
  getReactFlowInstance: () => ({
    screenToFlowPosition: mockScreenToFlowPosition,
  }),
}));

import { createNodeFromType } from '@/lib/createNodeFromType';

describe('createNodeFromType', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Set up a mock canvas element for viewport-center calculation
    const mockEl = { getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }) };
    vi.spyOn(document, 'querySelector').mockReturnValue(mockEl as unknown as Element);
  });

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

  it('uses viewport center with offset when no position provided', () => {
    createNodeFromType('__root__', 'compute/service');
    // Should have called screenToFlowPosition with screen center of the canvas
    expect(mockScreenToFlowPosition).toHaveBeenCalledWith({ x: 400, y: 300 });
    const node = mockAddNode.mock.calls[0][1];
    // Position should be near 100,200 (mocked flow center) ± 30px offset
    expect(node.position.x).toBeGreaterThanOrEqual(100 - 30);
    expect(node.position.x).toBeLessThanOrEqual(100 + 30);
    expect(node.position.y).toBeGreaterThanOrEqual(200 - 30);
    expect(node.position.y).toBeLessThanOrEqual(200 + 30);
  });

  it('uses provided position when given', () => {
    createNodeFromType('__root__', 'compute/service', { x: 500, y: 300 });
    const node = mockAddNode.mock.calls[0][1];
    expect(node.position).toEqual({ x: 500, y: 300 });
    // Should NOT call screenToFlowPosition when position is explicit
    expect(mockScreenToFlowPosition).not.toHaveBeenCalled();
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
