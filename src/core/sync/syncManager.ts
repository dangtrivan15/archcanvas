/**
 * Sync Manager — Coordinates background sync of queued save operations.
 *
 * Listens for connectivity restoration (online events) and flushes
 * the sync queue. Provides status updates via callbacks.
 *
 * For iOS (Capacitor), uses App lifecycle events (appStateChange)
 * as a fallback since Background Sync API isn't available in WKWebView.
 */

import {
  getPendingSaves,
  getPendingSaveCount,
  removeSyncedOperation,
  incrementRetryCount,
  type SyncStatus,
  type QueuedSaveOperation,
} from './syncQueue';

const MAX_RETRIES = 3;

export interface SyncManagerCallbacks {
  /** Called when sync status changes */
  onStatusChange: (status: SyncStatus, pendingCount: number) => void;
  /** Called to actually perform the save of queued data */
  onPerformSave: (op: QueuedSaveOperation) => Promise<boolean>;
  /** Called when a conflict is detected (file modified while offline) */
  onConflict?: (op: QueuedSaveOperation) => Promise<'overwrite' | 'skip' | 'keep-local'>;
}

let isFlushing = false;
let callbacks: SyncManagerCallbacks | null = null;
let onlineHandler: (() => void) | null = null;
let capacitorCleanup: (() => void) | null = null;

/**
 * Initialize the sync manager. Sets up listeners for connectivity
 * and Capacitor app lifecycle events.
 */
export function initSyncManager(cb: SyncManagerCallbacks): () => void {
  callbacks = cb;

  // Check for any pending operations on startup
  checkPendingOnStartup();

  // Listen for online events (works in both web and Capacitor WKWebView)
  onlineHandler = () => {
    console.log('[SyncManager] Connectivity restored, flushing queue...');
    flushQueue();
  };
  window.addEventListener('online', onlineHandler);

  // iOS fallback: listen for Capacitor App state changes
  setupCapacitorListener();

  // Return cleanup function
  return () => {
    if (onlineHandler) {
      window.removeEventListener('online', onlineHandler);
      onlineHandler = null;
    }
    if (capacitorCleanup) {
      capacitorCleanup();
      capacitorCleanup = null;
    }
    callbacks = null;
  };
}

/**
 * Check for pending operations on startup (in case app was closed while offline).
 */
async function checkPendingOnStartup(): Promise<void> {
  try {
    const count = await getPendingSaveCount();
    if (count > 0 && callbacks) {
      if (navigator.onLine) {
        // We're online and have pending saves — flush them
        callbacks.onStatusChange('pending', count);
        flushQueue();
      } else {
        callbacks.onStatusChange('pending', count);
      }
    }
  } catch (err) {
    console.warn('[SyncManager] Failed to check pending saves on startup:', err);
  }
}

/**
 * Set up Capacitor App lifecycle listener as iOS fallback.
 * When the app comes back to foreground, check connectivity and flush.
 */
async function setupCapacitorListener(): Promise<void> {
  try {
    const { App } = await import('@capacitor/app');
    const listener = await App.addListener('appStateChange', (state) => {
      if (state.isActive && navigator.onLine) {
        console.log('[SyncManager] App became active and online, flushing queue...');
        flushQueue();
      }
    });
    capacitorCleanup = () => {
      listener.remove();
    };
  } catch {
    // Not running in Capacitor — that's fine, web online events are sufficient
  }
}

/**
 * Flush all pending save operations from the queue.
 * Operations are processed in order (oldest first).
 * Failed operations are retried up to MAX_RETRIES times.
 */
export async function flushQueue(): Promise<void> {
  if (isFlushing || !callbacks) return;
  if (!navigator.onLine) return;

  isFlushing = true;

  try {
    const pending = await getPendingSaves();
    if (pending.length === 0) {
      callbacks.onStatusChange('idle', 0);
      isFlushing = false;
      return;
    }

    callbacks.onStatusChange('syncing', pending.length);
    let successCount = 0;
    let failCount = 0;

    for (const op of pending) {
      if (!navigator.onLine) {
        // Lost connectivity mid-sync — stop and wait for next online event
        console.log('[SyncManager] Lost connectivity during sync, pausing...');
        const remaining = pending.length - successCount - failCount;
        callbacks.onStatusChange('pending', remaining);
        isFlushing = false;
        return;
      }

      try {
        // Check for conflicts if handler is provided
        if (callbacks.onConflict) {
          // Simple conflict detection: if file was queued > 5 seconds ago,
          // it may have been modified elsewhere
          const ageMs = Date.now() - op.queuedAt;
          if (ageMs > 30000) {
            // More than 30 seconds old — potential conflict
            const resolution = await callbacks.onConflict(op);
            if (resolution === 'skip') {
              await removeSyncedOperation(op.id!);
              successCount++;
              continue;
            }
            // 'overwrite' and 'keep-local' both proceed with saving
          }
        }

        const success = await callbacks.onPerformSave(op);
        if (success) {
          await removeSyncedOperation(op.id!);
          successCount++;
        } else {
          await incrementRetryCount(op.id!);
          if (op.retryCount + 1 >= MAX_RETRIES) {
            console.warn(`[SyncManager] Operation for "${op.fileName}" exceeded max retries, removing`);
            await removeSyncedOperation(op.id!);
          }
          failCount++;
        }
      } catch (err) {
        console.error(`[SyncManager] Failed to sync "${op.fileName}":`, err);
        await incrementRetryCount(op.id!);
        if (op.retryCount + 1 >= MAX_RETRIES) {
          await removeSyncedOperation(op.id!);
        }
        failCount++;
      }
    }

    // Final status
    const remainingCount = await getPendingSaveCount();
    if (remainingCount === 0) {
      callbacks.onStatusChange('synced', 0);
      // Auto-clear "synced" status after 5 seconds
      setTimeout(() => {
        if (callbacks) {
          getPendingSaveCount().then((count) => {
            if (count === 0) {
              callbacks?.onStatusChange('idle', 0);
            }
          }).catch(() => {});
        }
      }, 5000);
    } else {
      callbacks.onStatusChange('error', remainingCount);
    }
  } catch (err) {
    console.error('[SyncManager] Queue flush failed:', err);
    if (callbacks) {
      callbacks.onStatusChange('error', -1);
    }
  } finally {
    isFlushing = false;
  }
}

/**
 * Get the current sync status (for one-off checks).
 */
export async function getSyncStatus(): Promise<{ status: SyncStatus; pendingCount: number }> {
  try {
    const count = await getPendingSaveCount();
    if (count === 0) return { status: 'idle', pendingCount: 0 };
    if (isFlushing) return { status: 'syncing', pendingCount: count };
    return { status: 'pending', pendingCount: count };
  } catch {
    return { status: 'error', pendingCount: -1 };
  }
}
