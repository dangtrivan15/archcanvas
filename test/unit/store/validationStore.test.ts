import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { enablePatches } from 'immer';
import { useFileStore } from '@/store/fileStore';
import { useRegistryStore } from '@/store/registryStore';
import { useNavigationStore } from '@/store/navigationStore';
import { useValidationStore, subscribeValidationAutoRun } from '@/store/validationStore';
import { InMemoryFileSystem } from '@/platform/inMemoryFileSystem';
import { serializeCanvas } from '@/storage/yamlCodec';
import { ROOT_CANVAS_KEY } from '@/storage/fileResolver';

enablePatches();

async function setupStores() {
  useFileStore.setState({ project: null, dirtyCanvases: new Set(), status: 'idle', error: null });
  useNavigationStore.setState({ currentCanvasId: ROOT_CANVAS_KEY, breadcrumb: [{ canvasId: ROOT_CANVAS_KEY, displayName: 'Root' }] });
  useValidationStore.setState({ report: null, status: 'idle' });

  const fs = new InMemoryFileSystem();
  fs.seed({
    '.archcanvas/main.yaml': serializeCanvas({
      project: { name: 'ValidationStoreTest' },
      nodes: [{ id: 'svc-a', type: 'compute/service' }],
      edges: [],
    } as any),
  });
  await useFileStore.getState().openProject(fs);
  await useRegistryStore.getState().initialize();
}

describe('validationStore.runValidation', () => {
  beforeEach(setupStores);

  it('reads the live canvas + registry and stores a report', () => {
    const report = useValidationStore.getState().runValidation();
    expect(report.canvasId).toBe(ROOT_CANVAS_KEY);
    expect(useValidationStore.getState().report).toEqual(report);
    expect(useValidationStore.getState().status).toBe('done');
  });

  it('defaults to the current navigation scope when canvasId is omitted', () => {
    const report = useValidationStore.getState().runValidation();
    expect(report.canvasId).toBe(useNavigationStore.getState().currentCanvasId);
  });

  it('returns an empty report when the canvas is missing', () => {
    const report = useValidationStore.getState().runValidation('does-not-exist');
    expect(report.findings).toEqual([]);
    expect(report.summary).toEqual({ critical: 0, warning: 0, info: 0, total: 0 });
    expect(useValidationStore.getState().status).toBe('done');
  });

  it('clear() resets report and status', () => {
    useValidationStore.getState().runValidation();
    useValidationStore.getState().clear();
    expect(useValidationStore.getState().report).toBeNull();
    expect(useValidationStore.getState().status).toBe('idle');
  });
});

describe('subscribeValidationAutoRun', () => {
  beforeEach(async () => {
    await setupStores();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('coalesces rapid canvas mutations into a single debounced run', () => {
    const unsubscribe = subscribeValidationAutoRun();
    try {
      // Simulate several rapid mutations in quick succession.
      for (let i = 0; i < 5; i++) {
        useFileStore.getState().updateCanvasData(ROOT_CANVAS_KEY, {
          nodes: [{ id: `svc-${i}`, type: 'compute/service' }],
          edges: [],
        });
      }
      expect(useValidationStore.getState().report).toBeNull();

      vi.advanceTimersByTime(500);

      expect(useValidationStore.getState().report).not.toBeNull();
      expect(useValidationStore.getState().status).toBe('done');
    } finally {
      unsubscribe();
    }
  });

  it('re-runs when the active canvas scope changes', () => {
    const unsubscribe = subscribeValidationAutoRun();
    try {
      useNavigationStore.setState({ currentCanvasId: 'some-other-scope', breadcrumb: [{ canvasId: 'some-other-scope', displayName: 'Other' }] });
      vi.advanceTimersByTime(500);
      expect(useValidationStore.getState().report).not.toBeNull();
    } finally {
      unsubscribe();
    }
  });

  it('stops re-running after unsubscribe', () => {
    const unsubscribe = subscribeValidationAutoRun();
    unsubscribe();
    useFileStore.getState().updateCanvasData(ROOT_CANVAS_KEY, { nodes: [], edges: [] });
    vi.advanceTimersByTime(500);
    expect(useValidationStore.getState().report).toBeNull();
  });

  it('is idempotent: a second subscribe returns the same unsubscribe without adding listeners', () => {
    const unsub1 = subscribeValidationAutoRun();
    const unsub2 = subscribeValidationAutoRun();
    try {
      expect(unsub2).toBe(unsub1);
      // A single mutation still yields a single debounced run (one live subscription).
      useFileStore.getState().updateCanvasData(ROOT_CANVAS_KEY, {
        nodes: [{ id: 'svc-x', type: 'compute/service' }],
        edges: [],
      });
      vi.advanceTimersByTime(500);
      expect(useValidationStore.getState().report).not.toBeNull();
    } finally {
      unsub1();
    }
  });
});
