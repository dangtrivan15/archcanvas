import { describe, it, expect, beforeEach } from 'vitest';
import { resolveAutoFitAction, type AutoFitAction } from '@/components/canvas/autoFitAction';
import { useNavigationStore } from '@/store/navigationStore';
import { ROOT_CANVAS_KEY } from '@/storage/fileResolver';

// ---------------------------------------------------------------------------
// Pure decision function tests — each branch of resolveAutoFitAction
// ---------------------------------------------------------------------------

describe('resolveAutoFitAction', () => {
  // ----- skip conditions ---------------------------------------------------

  describe('skip: already fitted', () => {
    it('skips when hasFitted is true (no nodes, not mounted with nodes)', () => {
      expect(resolveAutoFitAction(true, 0, false, undefined)).toEqual({ type: 'skip' });
    });

    it('skips when hasFitted is true even with nodes present', () => {
      expect(resolveAutoFitAction(true, 5, true, undefined)).toEqual({ type: 'skip' });
    });

    it('skips when hasFitted is true even with a saved viewport', () => {
      const vp = { x: 10, y: 20, zoom: 1 };
      expect(resolveAutoFitAction(true, 5, true, vp)).toEqual({ type: 'skip' });
    });
  });

  describe('skip: no nodes', () => {
    it('skips when nodeCount is 0 (empty canvas)', () => {
      expect(resolveAutoFitAction(false, 0, false, undefined)).toEqual({ type: 'skip' });
    });

    it('skips when nodeCount is 0 even if mountedWithNodes was true', () => {
      // Edge case: nodes were present at mount but then all removed before
      // the effect ran (e.g. rapid undo). nodeCount 0 means nothing to frame.
      expect(resolveAutoFitAction(false, 0, true, undefined)).toEqual({ type: 'skip' });
    });
  });

  describe('skip: interactive creation (mounted without nodes)', () => {
    it('skips when component mounted empty and nodes appeared later', () => {
      // mountedWithNodes=false means the Canvas mounted with an empty store.
      // Nodes that appear later are from interactive addNode, not project load.
      expect(resolveAutoFitAction(false, 1, false, undefined)).toEqual({ type: 'skip' });
    });

    it('skips even with many nodes if mounted without nodes', () => {
      expect(resolveAutoFitAction(false, 50, false, undefined)).toEqual({ type: 'skip' });
    });

    it('skips even with saved viewport if mounted without nodes', () => {
      const vp = { x: 100, y: 200, zoom: 1.5 };
      expect(resolveAutoFitAction(false, 3, false, vp)).toEqual({ type: 'skip' });
    });
  });

  // ----- active actions ----------------------------------------------------

  describe('fitView: project loaded from disk, no saved viewport', () => {
    it('returns fitView for a fresh multi-node canvas', () => {
      expect(resolveAutoFitAction(false, 5, true, undefined)).toEqual({ type: 'fitView' });
    });

    it('returns fitView for a single-node canvas', () => {
      expect(resolveAutoFitAction(false, 1, true, undefined)).toEqual({ type: 'fitView' });
    });

    it('returns fitView for a very large diagram', () => {
      expect(resolveAutoFitAction(false, 500, true, undefined)).toEqual({ type: 'fitView' });
    });
  });

  describe('restoreViewport: project loaded with previously saved viewport', () => {
    it('returns restoreViewport with the exact saved viewport', () => {
      const vp = { x: 100, y: 200, zoom: 1.5 };
      const action = resolveAutoFitAction(false, 5, true, vp);
      expect(action).toEqual({ type: 'restoreViewport', viewport: vp });
    });

    it('preserves viewport reference identity (no clone)', () => {
      const vp = { x: -50, y: 300, zoom: 0.5 };
      const action = resolveAutoFitAction(false, 10, true, vp);
      expect(action.type).toBe('restoreViewport');
      expect((action as Extract<AutoFitAction, { type: 'restoreViewport' }>).viewport).toBe(vp);
    });

    it('works with zoom levels < 1 (zoomed out)', () => {
      const vp = { x: 0, y: 0, zoom: 0.3 };
      expect(resolveAutoFitAction(false, 20, true, vp)).toEqual({
        type: 'restoreViewport',
        viewport: vp,
      });
    });

    it('works with zoom levels > 1 (zoomed in)', () => {
      const vp = { x: 500, y: 500, zoom: 3 };
      expect(resolveAutoFitAction(false, 2, true, vp)).toEqual({
        type: 'restoreViewport',
        viewport: vp,
      });
    });
  });

  // ----- priority / precedence ---------------------------------------------

  describe('condition priority', () => {
    it('hasFitted takes precedence over all other conditions', () => {
      // Even if everything else says "go", hasFitted means skip
      const vp = { x: 1, y: 2, zoom: 1 };
      expect(resolveAutoFitAction(true, 10, true, vp).type).toBe('skip');
    });

    it('nodeCount=0 takes precedence over mountedWithNodes', () => {
      expect(resolveAutoFitAction(false, 0, true, undefined).type).toBe('skip');
    });

    it('mountedWithNodes=false takes precedence over savedViewport', () => {
      const vp = { x: 1, y: 2, zoom: 1 };
      expect(resolveAutoFitAction(false, 5, false, vp).type).toBe('skip');
    });

    it('savedViewport takes precedence over fitView when present', () => {
      const vp = { x: 1, y: 2, zoom: 1 };
      expect(resolveAutoFitAction(false, 5, true, vp).type).toBe('restoreViewport');
    });
  });
});

// ---------------------------------------------------------------------------
// Store integration — verifies that the stores provide the data the decision
// function consumes. These test the "wiring" between stores and the decision.
// ---------------------------------------------------------------------------

describe('auto-fit store integration', () => {
  beforeEach(() => {
    useNavigationStore.setState({
      currentCanvasId: ROOT_CANVAS_KEY,
      breadcrumb: [{ canvasId: ROOT_CANVAS_KEY, displayName: 'Root' }],
      parentCanvasId: null,
      parentEdges: [],
      savedViewports: {},
    });
  });

  it('getSavedViewport returns undefined for a fresh canvas', () => {
    const vp = useNavigationStore.getState().getSavedViewport(ROOT_CANVAS_KEY);
    expect(vp).toBeUndefined();
  });

  it('getSavedViewport returns saved viewport when present', () => {
    const saved = { x: 100, y: 200, zoom: 1.5 };
    useNavigationStore.getState().saveViewport(ROOT_CANVAS_KEY, saved);
    expect(useNavigationStore.getState().getSavedViewport(ROOT_CANVAS_KEY)).toEqual(saved);
  });

  it('getSavedViewport uses canvasId as key (different canvases are independent)', () => {
    useNavigationStore.getState().saveViewport('child-canvas', { x: 50, y: 60, zoom: 2 });
    expect(useNavigationStore.getState().getSavedViewport(ROOT_CANVAS_KEY)).toBeUndefined();
    expect(useNavigationStore.getState().getSavedViewport('child-canvas')).toEqual({
      x: 50, y: 60, zoom: 2,
    });
  });

  it('latest saveViewport wins (overwrite)', () => {
    useNavigationStore.getState().saveViewport(ROOT_CANVAS_KEY, { x: 0, y: 0, zoom: 1 });
    useNavigationStore.getState().saveViewport(ROOT_CANVAS_KEY, { x: 99, y: 88, zoom: 3 });
    expect(useNavigationStore.getState().getSavedViewport(ROOT_CANVAS_KEY)).toEqual({
      x: 99, y: 88, zoom: 3,
    });
  });

  it('decision function integrates with store: fresh load → fitView', () => {
    const canvasId = ROOT_CANVAS_KEY;
    const saved = useNavigationStore.getState().getSavedViewport(canvasId);
    // Simulating: hasFitted=false, 5 nodes, mounted with nodes, no saved viewport
    expect(resolveAutoFitAction(false, 5, true, saved)).toEqual({ type: 'fitView' });
  });

  it('decision function integrates with store: saved viewport → restore', () => {
    const canvasId = ROOT_CANVAS_KEY;
    const vp = { x: 42, y: 84, zoom: 1.2 };
    useNavigationStore.getState().saveViewport(canvasId, vp);
    const saved = useNavigationStore.getState().getSavedViewport(canvasId);
    expect(resolveAutoFitAction(false, 5, true, saved)).toEqual({
      type: 'restoreViewport',
      viewport: vp,
    });
  });
});
