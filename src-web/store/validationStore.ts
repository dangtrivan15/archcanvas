import { create } from 'zustand';
import { validateArchitecture } from '@/core/validation';
import type { ValidationReport } from '@/core/validation';
import { useFileStore } from './fileStore';
import { useNavigationStore } from './navigationStore';
import { useRegistryStore } from './registryStore';

export type ValidationStatus = 'idle' | 'running' | 'done';

interface ValidationStoreState {
  report: ValidationReport | null;
  status: ValidationStatus;
  runValidation: (canvasId?: string) => ValidationReport;
  clear: () => void;
}

function emptyReport(canvasId: string): ValidationReport {
  return {
    canvasId,
    findings: [],
    summary: { critical: 0, warning: 0, info: 0, total: 0 },
    ranAt: Date.now(),
  };
}

export const useValidationStore = create<ValidationStoreState>((set) => ({
  report: null,
  status: 'idle',

  runValidation: (canvasId) => {
    set({ status: 'running' });

    const resolvedCanvasId = canvasId ?? useNavigationStore.getState().currentCanvasId;
    const canvas = useFileStore.getState().getCanvas(resolvedCanvasId)?.data;
    const registry = useRegistryStore.getState().registry;

    if (!canvas || !registry) {
      const report = emptyReport(resolvedCanvasId);
      set({ report, status: 'done' });
      return report;
    }

    const report = validateArchitecture(canvas, registry, { canvasId: resolvedCanvasId });
    set({ report, status: 'done' });
    return report;
  },

  clear: () => set({ report: null, status: 'idle' }),
}));

// ---------------------------------------------------------------------------
// Debounced auto-run subscription
// ---------------------------------------------------------------------------

const AUTO_RUN_DEBOUNCE_MS = 400;

let debounceTimer: ReturnType<typeof setTimeout> | undefined;
let unsubscribed = false;
let activeUnsubscribe: (() => void) | undefined;

/**
 * Subscribe to canvas-data mutations and active-scope changes, re-running
 * validation after a short debounce so the panel/badge stay current without
 * recomputing on every render. Guards against duplicate subscription: if a
 * subscription is already live, the existing unsubscribe is returned and no
 * second set of store listeners is registered. Returns an unsubscribe
 * function (itself idempotent — calling it more than once is a no-op).
 */
export function subscribeValidationAutoRun(): () => void {
  if (activeUnsubscribe) return activeUnsubscribe;
  unsubscribed = false;

  const scheduleRun = () => {
    if (debounceTimer !== undefined) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      debounceTimer = undefined;
      if (!unsubscribed) useValidationStore.getState().runValidation();
    }, AUTO_RUN_DEBOUNCE_MS);
  };

  const unsubFile = useFileStore.subscribe((state, prev) => {
    if (state.project !== prev.project || state.dirtyCanvases !== prev.dirtyCanvases) {
      scheduleRun();
    }
  });
  const unsubNav = useNavigationStore.subscribe((state, prev) => {
    if (state.currentCanvasId !== prev.currentCanvasId) {
      scheduleRun();
    }
  });

  activeUnsubscribe = () => {
    if (unsubscribed) return;
    unsubscribed = true;
    if (debounceTimer !== undefined) {
      clearTimeout(debounceTimer);
      debounceTimer = undefined;
    }
    unsubFile();
    unsubNav();
    activeUnsubscribe = undefined;
  };
  return activeUnsubscribe;
}

// Expose for E2E tests
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(window as any).__archcanvas_validationStore__ = useValidationStore;
