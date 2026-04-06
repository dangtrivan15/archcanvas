import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Canvas } from '@/types';

// Stub matchMedia for jsdom
const matchMediaMock = vi.fn().mockReturnValue({
  matches: false,
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
} as unknown as MediaQueryList);
vi.stubGlobal('matchMedia', matchMediaMock);

let useDiffStore: typeof import('@/store/diffStore').useDiffStore;
let useFileStore: typeof import('@/store/fileStore').useFileStore;

const ROOT_CANVAS_KEY = '__root__';

function makeTestCanvas(nodes: Canvas['nodes'] = [], edges: Canvas['edges'] = []): Canvas {
  return { nodes, edges, entities: [] };
}

describe('diffStore', () => {
  beforeEach(async () => {
    vi.resetModules();
    const diffMod = await import('@/store/diffStore');
    useDiffStore = diffMod.useDiffStore;
    const fileMod = await import('@/store/fileStore');
    useFileStore = fileMod.useFileStore;

    // Initialize a minimal project in fileStore
    useFileStore.getState().initializeEmptyProject('Test');
    useFileStore.getState().updateCanvasData(ROOT_CANVAS_KEY, {
      project: { name: 'Test' },
      nodes: [
        { id: 'n1', type: 'compute/service' },
        { id: 'n2', type: 'storage/database' },
      ],
      edges: [{ from: { node: 'n1' }, to: { node: 'n2' } }],
      entities: [],
    });
  });

  it('starts disabled', () => {
    expect(useDiffStore.getState().enabled).toBe(false);
    expect(useDiffStore.getState().canvasDiffs.size).toBe(0);
  });

  it('toggle enables then disables', () => {
    // Enable by computing from canvases
    const baseCanvases = new Map<string, Canvas>([
      [ROOT_CANVAS_KEY, makeTestCanvas()],
    ]);
    useDiffStore.getState().computeFromCanvases(baseCanvases, 'HEAD');
    expect(useDiffStore.getState().enabled).toBe(true);

    useDiffStore.getState().disable();
    expect(useDiffStore.getState().enabled).toBe(false);
    expect(useDiffStore.getState().canvasDiffs.size).toBe(0);
  });

  it('computeFromCanvases produces a diff', () => {
    // Base has no nodes; current has n1, n2
    const baseCanvases = new Map<string, Canvas>([
      [ROOT_CANVAS_KEY, makeTestCanvas()],
    ]);

    useDiffStore.getState().computeFromCanvases(baseCanvases, 'HEAD');

    const state = useDiffStore.getState();
    expect(state.enabled).toBe(true);
    expect(state.baseRef).toBe('HEAD');
    expect(state.canvasDiffs.size).toBe(1);

    const rootDiff = state.canvasDiffs.get(ROOT_CANVAS_KEY);
    expect(rootDiff).toBeDefined();
    expect(rootDiff!.nodes.get('n1')?.status).toBe('added');
    expect(rootDiff!.nodes.get('n2')?.status).toBe('added');
    expect(rootDiff!.summary.nodesAdded).toBe(2);
    expect(rootDiff!.summary.edgesAdded).toBe(1);
  });

  it('computeFromYaml parses and diffs', () => {
    // Base YAML with one node
    const baseYamls = new Map<string, string>([
      [ROOT_CANVAS_KEY, `
nodes:
  - id: n1
    type: compute/service
edges: []
entities: []
`],
    ]);

    useDiffStore.getState().computeFromYaml(baseYamls, 'HEAD');

    const state = useDiffStore.getState();
    expect(state.enabled).toBe(true);

    const rootDiff = state.canvasDiffs.get(ROOT_CANVAS_KEY);
    expect(rootDiff).toBeDefined();
    // n1 exists in both → should be unchanged (not in diff map)
    // n2 only in current → added
    expect(rootDiff!.nodes.has('n1')).toBe(false); // unchanged
    expect(rootDiff!.nodes.get('n2')?.status).toBe('added');
  });

  it('getNodeStatus returns correct status', () => {
    const baseCanvases = new Map<string, Canvas>([
      [ROOT_CANVAS_KEY, makeTestCanvas()],
    ]);
    useDiffStore.getState().computeFromCanvases(baseCanvases);

    expect(useDiffStore.getState().getNodeStatus(ROOT_CANVAS_KEY, 'n1')).toBe('added');
    expect(useDiffStore.getState().getNodeStatus(ROOT_CANVAS_KEY, 'nonexistent')).toBeUndefined();
  });

  it('getEdgeStatus returns correct status', () => {
    const baseCanvases = new Map<string, Canvas>([
      [ROOT_CANVAS_KEY, makeTestCanvas()],
    ]);
    useDiffStore.getState().computeFromCanvases(baseCanvases);

    expect(useDiffStore.getState().getEdgeStatus(ROOT_CANVAS_KEY, 'n1', 'n2')).toBe('added');
  });

  it('clear resets all state', () => {
    const baseCanvases = new Map<string, Canvas>([
      [ROOT_CANVAS_KEY, makeTestCanvas()],
    ]);
    useDiffStore.getState().computeFromCanvases(baseCanvases);
    expect(useDiffStore.getState().enabled).toBe(true);

    useDiffStore.getState().clear();
    expect(useDiffStore.getState().enabled).toBe(false);
    expect(useDiffStore.getState().canvasDiffs.size).toBe(0);
    expect(useDiffStore.getState().projectDiff).toBeNull();
  });

  it('filter defaults to showing all', () => {
    const filter = useDiffStore.getState().filter;
    expect(filter.showAdded).toBe(true);
    expect(filter.showRemoved).toBe(true);
    expect(filter.showModified).toBe(true);
  });

  it('setFilter updates individual filter values', () => {
    useDiffStore.getState().setFilter({ showRemoved: false });
    expect(useDiffStore.getState().filter.showRemoved).toBe(false);
    expect(useDiffStore.getState().filter.showAdded).toBe(true); // unchanged
  });

  it('isVisible respects filter and enabled state', () => {
    // Not enabled
    expect(useDiffStore.getState().isVisible('added')).toBe(false);

    // Enable
    const baseCanvases = new Map<string, Canvas>([
      [ROOT_CANVAS_KEY, makeTestCanvas()],
    ]);
    useDiffStore.getState().computeFromCanvases(baseCanvases);

    expect(useDiffStore.getState().isVisible('added')).toBe(true);
    expect(useDiffStore.getState().isVisible('removed')).toBe(true);

    // Disable showing removed
    useDiffStore.getState().setFilter({ showRemoved: false });
    expect(useDiffStore.getState().isVisible('removed')).toBe(false);
    expect(useDiffStore.getState().isVisible('added')).toBe(true);
  });

  it('handles malformed base YAML gracefully', () => {
    const baseYamls = new Map<string, string>([
      [ROOT_CANVAS_KEY, 'not valid yaml: [[['],
    ]);

    // Should not throw
    useDiffStore.getState().computeFromYaml(baseYamls, 'HEAD');
    expect(useDiffStore.getState().enabled).toBe(true);
  });

  it('sets error when no project loaded', async () => {
    vi.resetModules();
    const diffMod = await import('@/store/diffStore');
    // Don't initialize fileStore project
    const baseCanvases = new Map<string, Canvas>();
    diffMod.useDiffStore.getState().computeFromCanvases(baseCanvases);

    expect(diffMod.useDiffStore.getState().error).toBe('No project loaded');
  });
});
