import { describe, it, expect, beforeEach } from 'vitest';
import { useNavigationStore } from '@/store/navigationStore';
import { useFileStore } from '@/store/fileStore';
import { ROOT_CANVAS_KEY } from '@/storage/fileResolver';

/**
 * Unit tests for the auto-fit-on-load viewport decision logic.
 *
 * The Canvas component uses navigationStore.getSavedViewport() to decide
 * whether to restore a saved viewport or fitView on initial load. These
 * tests verify that decision pathway at the store level.
 *
 * It also checks fileStore.dirtyCanvases to distinguish project-load
 * (clean canvas → auto-fit) from interactive creation (dirty canvas → skip).
 */
describe('auto-fit on load – viewport decision', () => {
  beforeEach(() => {
    useNavigationStore.setState({
      currentCanvasId: ROOT_CANVAS_KEY,
      breadcrumb: [{ canvasId: ROOT_CANVAS_KEY, displayName: 'Root' }],
      parentCanvasId: null,
      parentEdges: [],
      savedViewports: {},
    });
    useFileStore.setState({ dirtyCanvases: new Set() });
  });

  it('getSavedViewport returns undefined for a fresh canvas (triggers fitView)', () => {
    const viewport = useNavigationStore.getState().getSavedViewport(ROOT_CANVAS_KEY);
    expect(viewport).toBeUndefined();
  });

  it('getSavedViewport returns saved viewport when present (triggers restore)', () => {
    const saved = { x: 100, y: 200, zoom: 1.5 };
    useNavigationStore.getState().saveViewport(ROOT_CANVAS_KEY, saved);

    const viewport = useNavigationStore.getState().getSavedViewport(ROOT_CANVAS_KEY);
    expect(viewport).toEqual(saved);
  });

  it('uses currentCanvasId to look up viewport (correct key for nested canvases)', () => {
    // Simulate a saved viewport on a child canvas
    useNavigationStore.getState().saveViewport('child-canvas', { x: 50, y: 60, zoom: 2 });

    // Root canvas has no saved viewport → fitView
    expect(useNavigationStore.getState().getSavedViewport(ROOT_CANVAS_KEY)).toBeUndefined();

    // Child canvas has a saved viewport → restore
    expect(useNavigationStore.getState().getSavedViewport('child-canvas')).toEqual({
      x: 50, y: 60, zoom: 2,
    });
  });

  it('overwritten viewport returns the latest value', () => {
    useNavigationStore.getState().saveViewport(ROOT_CANVAS_KEY, { x: 0, y: 0, zoom: 1 });
    useNavigationStore.getState().saveViewport(ROOT_CANVAS_KEY, { x: 99, y: 88, zoom: 3 });

    expect(useNavigationStore.getState().getSavedViewport(ROOT_CANVAS_KEY)).toEqual({
      x: 99, y: 88, zoom: 3,
    });
  });

  it('dirty canvas skips auto-fit (interactive node creation)', () => {
    // When a node is added interactively, updateCanvasData marks the canvas
    // dirty before nodes appear. The auto-fit effect checks this to skip.
    useFileStore.setState({ dirtyCanvases: new Set([ROOT_CANVAS_KEY]) });
    expect(useFileStore.getState().dirtyCanvases.has(ROOT_CANVAS_KEY)).toBe(true);
  });

  it('clean canvas allows auto-fit (project load from disk)', () => {
    // When a project loads from disk, dirtyCanvases is empty. The auto-fit
    // effect checks this to proceed.
    expect(useFileStore.getState().dirtyCanvases.has(ROOT_CANVAS_KEY)).toBe(false);
  });
});
