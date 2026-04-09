import { describe, it, expect, beforeEach } from 'vitest';
import { useCanvasStore, zoomToTier } from '@/store/canvasStore';

describe('zoomToTier', () => {
  it('returns "far" for zoom < 0.4', () => {
    expect(zoomToTier(0.1)).toBe('far');
    expect(zoomToTier(0.3)).toBe('far');
    expect(zoomToTier(0.39)).toBe('far');
  });

  it('returns "medium" for zoom between 0.4 and 0.75', () => {
    expect(zoomToTier(0.4)).toBe('medium');
    expect(zoomToTier(0.5)).toBe('medium');
    expect(zoomToTier(0.75)).toBe('medium');
  });

  it('returns "close" for zoom > 0.75', () => {
    expect(zoomToTier(0.76)).toBe('close');
    expect(zoomToTier(1.0)).toBe('close');
    expect(zoomToTier(2.0)).toBe('close');
  });
});

describe('canvasStore — zoomTier', () => {
  beforeEach(() => {
    useCanvasStore.setState({ zoomTier: 'close' });
  });

  it('defaults to "close"', () => {
    expect(useCanvasStore.getState().zoomTier).toBe('close');
  });

  it('setZoomTier updates the tier', () => {
    useCanvasStore.getState().setZoomTier('far');
    expect(useCanvasStore.getState().zoomTier).toBe('far');
  });

  it('setZoomTier does not update when tier is the same', () => {
    // Set up a spy to watch state changes
    let updateCount = 0;
    const unsub = useCanvasStore.subscribe(() => { updateCount++; });

    useCanvasStore.getState().setZoomTier('close'); // same as default
    expect(updateCount).toBe(0); // no state change

    useCanvasStore.getState().setZoomTier('medium'); // different
    expect(updateCount).toBe(1);

    unsub();
  });
});
