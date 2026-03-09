/**
 * useFilePolling — React hook that polls an open .archc file's last-modified
 * timestamp every 1 second via the File System Access API's getFile() metadata.
 *
 * When an external modification is detected (lastModified differs from stored
 * value), it:
 * 1. Sets the `fileExternallyModified` flag in coreStore
 * 2. Emits a custom event 'archcanvas:file-changed' on the window object
 * 3. Updates the stored timestamp to prevent repeated alerts
 *
 * False-positive prevention:
 * - Skips detection while `isSaving` is true (the web app is writing the file)
 * - The save flow updates `fileLastModifiedMs` after writing, so the next poll
 *   sees the new timestamp and won't flag it as external
 *
 * Polling is only active when:
 * - A file handle exists (File System Access API, not fallback download)
 * - A fileLastModifiedMs baseline is set (captured at open/save time)
 *
 * The getFile() call is lightweight — it reads file metadata (name, size,
 * lastModified) without reading the full file contents.
 */

import { useEffect, useRef } from 'react';
import { useCoreStore } from '@/store/coreStore';
import { useUIStore } from '@/store/uiStore';

/** Polling interval in milliseconds */
export const FILE_POLL_INTERVAL_MS = 1000;

/** Custom event name dispatched when external file change is detected */
export const FILE_CHANGED_EVENT = 'archcanvas:file-changed';

/** Warning message shown when the polled file becomes inaccessible */
export const FILE_INACCESSIBLE_MESSAGE = 'File is no longer accessible.';

export interface FileChangedDetail {
  fileName: string;
  previousModified: number;
  currentModified: number;
}

export function useFilePolling() {
  const fileHandle = useCoreStore((s) => s.fileHandle);
  const fileLastModifiedMs = useCoreStore((s) => s.fileLastModifiedMs);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    // Only poll when we have both a file handle with getFile() and a baseline timestamp
    const handle = fileHandle as FileSystemFileHandle | null;
    if (
      !handle ||
      typeof handle.getFile !== 'function' ||
      fileLastModifiedMs === null
    ) {
      // Clean up any existing interval
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    const poll = async () => {
      try {
        // Skip detection while the web app is saving to prevent false positives.
        // The save operation changes the file's lastModified, and the save flow
        // updates fileLastModifiedMs after writing. Without this guard, a poll
        // between write and timestamp update would incorrectly flag the change.
        if (useCoreStore.getState().isSaving) {
          return;
        }

        const file = await handle.getFile();
        const currentModified = file.lastModified;

        const state = useCoreStore.getState();
        if (currentModified !== state.fileLastModifiedMs) {
          const previousModified = state.fileLastModifiedMs!;

          console.warn(
            `[FilePolling] External modification detected: ${handle.name} ` +
              `(was ${previousModified}, now ${currentModified})`,
          );

          // Flag the file as externally modified and update timestamp
          useCoreStore.setState({
            fileLastModifiedMs: currentModified,
            fileExternallyModified: true,
          });

          // Dispatch custom event for consumers
          const detail: FileChangedDetail = {
            fileName: handle.name,
            previousModified,
            currentModified,
          };
          window.dispatchEvent(
            new CustomEvent(FILE_CHANGED_EVENT, { detail }),
          );
        }
      } catch (err) {
        // File deleted, moved, or permissions revoked — stop polling
        console.warn('[FilePolling] File inaccessible, stopping polling:', err);
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }

        // Show a single warning toast (polling is already stopped, so no repeats)
        useUIStore.getState().showToast(FILE_INACCESSIBLE_MESSAGE);

        // Clear the file handle so the user can't save-in-place,
        // but they can still Save As to a new location.
        // Keep fileLastModifiedMs null so polling won't restart.
        useCoreStore.setState({
          fileHandle: null,
          fileLastModifiedMs: null,
        });
      }
    };

    // Start polling
    intervalRef.current = setInterval(poll, FILE_POLL_INTERVAL_MS);
    console.log(`[FilePolling] Started polling "${handle.name}" every ${FILE_POLL_INTERVAL_MS}ms`);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
        console.log('[FilePolling] Stopped polling');
      }
    };
  }, [fileHandle, fileLastModifiedMs]);
}
