/**
 * useBackgroundSync — React hook that manages background sync for offline saves.
 *
 * Integrates the sync queue (IndexedDB) and sync manager with the React UI.
 * Provides:
 * - syncStatus: 'idle' | 'pending' | 'syncing' | 'synced' | 'error'
 * - pendingCount: number of queued operations
 * - enqueueSave: function to queue a save when offline
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { enqueueSave as enqueueOp } from '@/core/sync/syncQueue';
import { initSyncManager } from '@/core/sync/syncManager';
import type { SyncStatus, QueuedSaveOperation } from '@/core/sync/syncQueue';
import { encode } from '@/core/storage/codec';
import { graphToProto } from '@/core/storage/fileIO';
import type { ArchGraph, SavedCanvasState } from '@/types/graph';
import type { AIStateData } from '@/core/storage/fileIO';

export interface BackgroundSyncState {
  /** Current sync status */
  syncStatus: SyncStatus;
  /** Number of pending operations in the queue */
  pendingCount: number;
  /** Queue a save operation for later sync */
  queueOfflineSave: (
    fileName: string,
    graph: ArchGraph,
    canvasState?: SavedCanvasState,
    aiState?: AIStateData,
    createdAtMs?: number,
  ) => Promise<void>;
}

export function useBackgroundSync(): BackgroundSyncState {
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
  const [pendingCount, setPendingCount] = useState(0);
  const cleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const cleanup = initSyncManager({
      onStatusChange: (status, count) => {
        setSyncStatus(status);
        setPendingCount(count < 0 ? 0 : count);
      },
      onPerformSave: async (op: QueuedSaveOperation) => {
        // Re-save the queued data using the file system adapter
        try {
          const { getFileSystemAdapter } = await import('@/core/platform/fileSystemAdapter');
          const adapter = await getFileSystemAdapter();

          // Since we stored the already-encoded binary data,
          // we can write it directly using the adapter's saveFileAs
          // (we don't have the original handle, so we save as download)
          const defaultName = op.fileName.endsWith('.archc') ? op.fileName : `${op.fileName}.archc`;
          await adapter.saveFileAs(op.data, defaultName);
          console.log(`[BackgroundSync] Successfully synced "${op.fileName}"`);
          return true;
        } catch (err) {
          console.error(`[BackgroundSync] Failed to sync "${op.fileName}":`, err);
          return false;
        }
      },
      onConflict: async (op: QueuedSaveOperation) => {
        // For now, always overwrite with the local version
        // (the user's offline changes are more recent than what was on disk)
        console.log(
          `[BackgroundSync] Conflict detected for "${op.fileName}", overwriting with local changes`,
        );
        return 'overwrite';
      },
    });

    cleanupRef.current = cleanup;

    return () => {
      if (cleanupRef.current) {
        cleanupRef.current();
        cleanupRef.current = null;
      }
    };
  }, []);

  const queueOfflineSave = useCallback(
    async (
      fileName: string,
      graph: ArchGraph,
      canvasState?: SavedCanvasState,
      aiState?: AIStateData,
      createdAtMs?: number,
    ) => {
      try {
        // Encode the graph to binary .archc format
        const protoFile = graphToProto(graph, canvasState, undefined, aiState, createdAtMs);
        const binaryData = await encode(protoFile);

        // Queue in IndexedDB
        await enqueueOp(fileName, binaryData);

        setSyncStatus('pending');
        setPendingCount((prev) => prev + 1);

        console.log(`[BackgroundSync] Queued offline save for "${fileName}"`);
      } catch (err) {
        console.error(`[BackgroundSync] Failed to queue save for "${fileName}":`, err);
      }
    },
    [],
  );

  return {
    syncStatus,
    pendingCount,
    queueOfflineSave,
  };
}
