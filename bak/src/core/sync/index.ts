/**
 * Background sync barrel export.
 */

// Sync queue (IndexedDB-backed)
export type { SyncStatus, QueuedSaveOperation } from './syncQueue';
export {
  enqueueSave,
  getPendingSaves,
  getPendingSaveCount,
  removeSyncedOperation,
  incrementRetryCount,
  clearQueue,
} from './syncQueue';

// Sync manager
export type { SyncManagerCallbacks } from './syncManager';
export { initSyncManager, flushQueue, getSyncStatus } from './syncManager';
