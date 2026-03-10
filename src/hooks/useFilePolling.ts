/**
 * useFilePolling — React hook that polls an open .archc file's last-modified
 * timestamp every 1 second via the File System Access API's getFile() metadata.
 *
 * When an external modification is detected (lastModified differs from stored
 * value), it either:
 * A. Auto-reloads the file if isDirty is false (no unsaved local changes)
 * B. Sets the `fileExternallyModified` flag if isDirty is true (has unsaved changes)
 *
 * Auto-reload (isDirty=false):
 * - Re-reads the .archc binary from disk via getFile().arrayBuffer()
 * - Decodes it with decodeArchcData and applies with _applyDecodedFile
 * - No confirmation dialog is shown
 *
 * Manual resolution (isDirty=true):
 * - Sets the `fileExternallyModified` flag in coreStore
 * - Emits a custom event 'archcanvas:file-changed' on the window object
 * - Updates the stored timestamp to prevent repeated alerts
 *
 * Debouncing:
 * - When multiple external writes happen in quick succession (e.g., MCP agent),
 *   the reload is debounced: it only triggers once after DEBOUNCE_DELAY_MS of
 *   no new changes, preventing multiple reloads for a burst of writes.
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
import { useFileStore } from '@/store/fileStore';
import { useGraphStore } from '@/store/graphStore';
import { useUIStore } from '@/store/uiStore';
import { decodeArchcData } from '@/core/storage/fileIO';

/** Polling interval in milliseconds */
export const FILE_POLL_INTERVAL_MS = 1000;

/** Debounce delay in milliseconds — reload triggers this long after the last detected change */
export const DEBOUNCE_DELAY_MS = 1500;

/** Custom event name dispatched when external file change is detected */
export const FILE_CHANGED_EVENT = 'archcanvas:file-changed';

/** Warning message shown when the polled file becomes inaccessible */
export const FILE_INACCESSIBLE_MESSAGE = 'File is no longer accessible.';

/** Toast message shown when a file is auto-reloaded due to external modification */
export const FILE_RELOADED_MESSAGE = 'File updated externally. Reloaded.';

export interface FileChangedDetail {
  fileName: string;
  previousModified: number;
  currentModified: number;
}

export function useFilePolling() {
  const fileHandle = useFileStore((s) => s.fileHandle);
  const fileLastModifiedMs = useFileStore((s) => s.fileLastModifiedMs);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Tracks the first timestamp before the debounce burst started */
  const burstStartTimestampRef = useRef<number | null>(null);

  useEffect(() => {
    // Only poll when we have both a file handle with getFile() and a baseline timestamp
    const handle = fileHandle as FileSystemFileHandle | null;
    if (
      !handle ||
      typeof handle.getFile !== 'function' ||
      fileLastModifiedMs === null
    ) {
      // Clean up any existing interval and debounce timer
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
      burstStartTimestampRef.current = null;
      return;
    }

    /**
     * Performs the actual reload/conflict resolution after the debounce settles.
     * Called once after DEBOUNCE_DELAY_MS of no new changes.
     */
    const executeReload = async (
      latestModified: number,
      previousModified: number,
    ) => {
      const state = { ...useFileStore.getState(), ...useGraphStore.getState() };

      if (!state.isDirty) {
        // No unsaved local changes — auto-reload from disk
        console.log('[FilePolling] No local changes, auto-reloading file...');

        try {
          const file = await handle.getFile();
          const data = new Uint8Array(await file.arrayBuffer());
          const { graph, canvasState, aiState, createdAtMs } =
            await decodeArchcData(data);

          // Re-apply the decoded file, keeping the same file handle
          useFileStore.getState()._applyDecodedFile(
            graph,
            handle.name,
            handle,
            canvasState,
            aiState,
            createdAtMs,
          );

          console.log(
            `[FilePolling] Auto-reloaded "${handle.name}" successfully`,
          );

          // Show a brief toast so the user knows the canvas changed
          useUIStore.getState().showToast(FILE_RELOADED_MESSAGE);
        } catch (reloadErr) {
          console.error('[FilePolling] Auto-reload failed:', reloadErr);
          // Fall back to flagging as externally modified
          useFileStore.setState({ fileExternallyModified: true });
        }
      } else {
        // Has unsaved local changes — flag for manual resolution
        useFileStore.setState({
          fileExternallyModified: true,
        });

        // Show conflict dialog with three resolution options
        const { openConflictDialog } = useUIStore.getState();
        openConflictDialog({
          fileName: handle.name,
          onReload: async () => {
            // Discard local changes and reload the externally modified file
            try {
              const reloadFile = await handle.getFile();
              const data = new Uint8Array(await reloadFile.arrayBuffer());
              const { graph, canvasState, aiState, createdAtMs } =
                await decodeArchcData(data);
              useFileStore.getState()._applyDecodedFile(
                graph,
                handle.name,
                handle,
                canvasState,
                aiState,
                createdAtMs,
              );
              console.log(
                `[FilePolling] Reloaded "${handle.name}" from disk (user chose reload)`,
              );
            } catch (reloadErr) {
              console.error(
                '[FilePolling] Reload from disk failed:',
                reloadErr,
              );
              useUIStore.getState().openErrorDialog({
                title: 'Reload Failed',
                message: `Could not reload the file from disk: ${reloadErr instanceof Error ? reloadErr.message : String(reloadErr)}`,
              });
            }
          },
          onSaveAsCopy: async () => {
            // Save local changes to a new file, then reload from disk
            const saved = await useFileStore.getState().saveFileAs();
            if (saved) {
              // After saving the copy, reload the original file
              try {
                const reloadFile = await handle.getFile();
                const data = new Uint8Array(await reloadFile.arrayBuffer());
                const { graph, canvasState, aiState, createdAtMs } =
                  await decodeArchcData(data);
                useFileStore.getState()._applyDecodedFile(
                  graph,
                  handle.name,
                  handle,
                  canvasState,
                  aiState,
                  createdAtMs,
                );
                console.log(
                  `[FilePolling] Saved copy and reloaded "${handle.name}" from disk`,
                );
              } catch (reloadErr) {
                console.error(
                  '[FilePolling] Reload after save-as-copy failed:',
                  reloadErr,
                );
                useUIStore.getState().openErrorDialog({
                  title: 'Reload Failed',
                  message: `Saved your copy, but could not reload the original file: ${reloadErr instanceof Error ? reloadErr.message : String(reloadErr)}`,
                });
              }
            }
          },
        });
      }

      // Dispatch custom event once for the entire burst
      const detail: FileChangedDetail = {
        fileName: handle.name,
        previousModified,
        currentModified: latestModified,
      };
      window.dispatchEvent(
        new CustomEvent(FILE_CHANGED_EVENT, { detail }),
      );
    };

    const poll = async () => {
      try {
        // Skip detection while the web app is saving to prevent false positives.
        // The save operation changes the file's lastModified, and the save flow
        // updates fileLastModifiedMs after writing. Without this guard, a poll
        // between write and timestamp update would incorrectly flag the change.
        if (useFileStore.getState().isSaving) {
          return;
        }

        const file = await handle.getFile();
        const currentModified = file.lastModified;

        const state = { ...useFileStore.getState(), ...useGraphStore.getState() };
        if (currentModified !== state.fileLastModifiedMs) {
          // Record the original timestamp at the start of the burst
          if (burstStartTimestampRef.current === null) {
            burstStartTimestampRef.current = state.fileLastModifiedMs!;
          }

          const previousModified = burstStartTimestampRef.current;

          console.warn(
            `[FilePolling] External modification detected: ${handle.name} ` +
              `(was ${state.fileLastModifiedMs}, now ${currentModified})` +
              (debounceRef.current ? ' — resetting debounce timer' : ''),
          );

          // Update timestamp immediately to prevent re-triggering for the same change
          useFileStore.setState({ fileLastModifiedMs: currentModified });

          // Reset the debounce timer — wait for changes to settle
          if (debounceRef.current) {
            clearTimeout(debounceRef.current);
          }

          debounceRef.current = setTimeout(() => {
            debounceRef.current = null;
            burstStartTimestampRef.current = null;
            executeReload(currentModified, previousModified);
          }, DEBOUNCE_DELAY_MS);
        }
      } catch (err) {
        // File deleted, moved, or permissions revoked — stop polling
        console.warn(
          '[FilePolling] File inaccessible, stopping polling:',
          err,
        );
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
        if (debounceRef.current) {
          clearTimeout(debounceRef.current);
          debounceRef.current = null;
        }
        burstStartTimestampRef.current = null;

        // Show a single warning toast (polling is already stopped, so no repeats)
        useUIStore.getState().showToast(FILE_INACCESSIBLE_MESSAGE);

        // Clear the file handle so the user can't save-in-place,
        // but they can still Save As to a new location.
        // Keep fileLastModifiedMs null so polling won't restart.
        useFileStore.setState({
          fileHandle: null,
          fileLastModifiedMs: null,
        });
      }
    };

    // Start polling
    intervalRef.current = setInterval(poll, FILE_POLL_INTERVAL_MS);
    console.log(
      `[FilePolling] Started polling "${handle.name}" every ${FILE_POLL_INTERVAL_MS}ms`,
    );

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
        console.log('[FilePolling] Stopped polling');
      }
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
      burstStartTimestampRef.current = null;
    };
  }, [fileHandle, fileLastModifiedMs]);
}
