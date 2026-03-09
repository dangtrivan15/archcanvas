/**
 * useFilePolling — React hook that polls an open .archc file's last-modified
 * timestamp every 1 second via the File System Access API's getFile() metadata.
 *
 * When an external modification is detected (lastModified differs from stored
 * value), it emits a custom event 'archcanvas:file-changed' on the window object
 * and logs a console warning. Consumers can listen for this event to prompt
 * the user to reload or merge changes.
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

/** Polling interval in milliseconds */
export const FILE_POLL_INTERVAL_MS = 1000;

/** Custom event name dispatched when external file change is detected */
export const FILE_CHANGED_EVENT = 'archcanvas:file-changed';

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

    const baselineMs = fileLastModifiedMs;

    const poll = async () => {
      try {
        const file = await handle.getFile();
        const currentModified = file.lastModified;

        if (currentModified !== useCoreStore.getState().fileLastModifiedMs) {
          console.warn(
            `[FilePolling] External modification detected: ${handle.name} ` +
              `(was ${useCoreStore.getState().fileLastModifiedMs}, now ${currentModified})`,
          );

          // Update the stored timestamp so we don't fire repeatedly
          useCoreStore.setState({ fileLastModifiedMs: currentModified });

          // Dispatch custom event for consumers
          const detail: FileChangedDetail = {
            fileName: handle.name,
            previousModified: baselineMs,
            currentModified,
          };
          window.dispatchEvent(
            new CustomEvent(FILE_CHANGED_EVENT, { detail }),
          );
        }
      } catch (err) {
        // Permission revoked or file deleted — stop polling
        console.warn('[FilePolling] Poll failed, stopping:', err);
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
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
