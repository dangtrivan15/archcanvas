/**
 * Application-wide event bus instance.
 *
 * Domain stores emit these events to trigger UI side-effects
 * (toasts, loading indicators, error dialogs, canvas viewport changes)
 * without directly importing UI/canvas stores.
 */

import { createEventBus } from './eventBus';
import type { CanvasViewport } from '@/types/graph';
import { useUIStore } from '@/store/uiStore';
import { useCanvasStore } from '@/store/canvasStore';

export const appEvents = createEventBus<{
  'toast:show': { message: string };
  'file:loading': { message: string };
  'file:loading-clear': Record<string, never>;
  'error:show': { title: string; message: string };
  'integrity-warning:show': { message: string; onProceed: () => Promise<void> };
  'canvas:fit-view': Record<string, never>;
  'canvas:set-viewport': { viewport: CanvasViewport };
  'ui:open-right-panel': Record<string, never>;
  'ui:close-right-panel': Record<string, never>;
}>();

let _subscriptionsInitialized = false;

/**
 * Wire event bus to UI/canvas store actions.
 *
 * Safe to call multiple times — subscriptions are registered only once.
 * Called automatically on the first appEvents.emit() call, or can be
 * called explicitly during app initialization.
 */
export function initEventSubscriptions() {
  if (_subscriptionsInitialized) return;
  _subscriptionsInitialized = true;

  appEvents.on('toast:show', ({ message }) =>
    useUIStore.getState().showToast(message),
  );
  appEvents.on('file:loading', ({ message }) =>
    useUIStore.getState().setFileOperationLoading(message),
  );
  appEvents.on('file:loading-clear', () =>
    useUIStore.getState().clearFileOperationLoading(),
  );
  appEvents.on('error:show', ({ title, message }) =>
    useUIStore.getState().openErrorDialog({ title, message }),
  );
  appEvents.on(
    'integrity-warning:show',
    (p) => useUIStore.getState().openIntegrityWarningDialog(p),
  );
  appEvents.on('canvas:fit-view', () =>
    useCanvasStore.getState().requestFitView(),
  );
  appEvents.on('canvas:set-viewport', ({ viewport }) =>
    useCanvasStore.getState().setViewport(viewport),
  );
  appEvents.on('ui:open-right-panel', () =>
    useUIStore.getState().openRightPanel(),
  );
  appEvents.on('ui:close-right-panel', () =>
    useUIStore.getState().closeRightPanel(),
  );
}

// Auto-initialize subscriptions on module load.
// This ensures that event subscriptions are active even when
// domain stores are used directly without going through coreStore.initialize().
initEventSubscriptions();
