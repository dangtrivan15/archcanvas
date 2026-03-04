/**
 * useAppUrlOpen — Handles the iOS "Open In" flow for .archc files.
 *
 * When a user taps an .archc file in the Files app (or receives one via AirDrop),
 * iOS opens ArchCanvas and delivers the file URL via Capacitor's `appUrlOpen` event.
 *
 * This hook:
 * 1. Listens for `appUrlOpen` events from `@capacitor/app`
 * 2. Checks if the URL points to an .archc file
 * 3. Reads the file data via `@capacitor/filesystem`
 * 4. Decodes the protobuf binary and loads it into the core store
 *
 * Also checks `App.getLaunchUrl()` on mount for the cold-start case where
 * the app was launched (not already running) by tapping a file.
 *
 * On web (non-native), this hook is a no-op.
 */

import { useEffect, useRef } from 'react';
import { isNative } from '@/core/platform/platformBridge';
import { useCoreStore } from '@/store/coreStore';

/**
 * Extract a display-friendly filename from a file:// URL or path.
 * e.g. "file:///var/mobile/.../MyProject.archc" → "MyProject.archc"
 */
export function extractFileName(url: string): string {
  try {
    // Handle file:// URLs and plain paths
    const decoded = decodeURIComponent(url);
    const segments = decoded.split('/');
    return segments[segments.length - 1] || 'Opened File';
  } catch {
    return 'Opened File';
  }
}

/**
 * Check if a URL points to an .archc file.
 */
export function isArchcFileUrl(url: string): boolean {
  try {
    const decoded = decodeURIComponent(url);
    // Strip query params and fragments before checking extension
    const pathOnly = decoded.split('?')[0]?.split('#')[0] ?? decoded;
    return pathOnly.toLowerCase().endsWith('.archc');
  } catch {
    return false;
  }
}

/**
 * Read a file URL and load the .archc data into the store.
 * Returns true on success, false on failure.
 */
export async function handleFileUrl(
  url: string,
  applyDecodedFile: (
    graph: import('@/types/graph').ArchGraph,
    fileName: string,
    fileHandle: unknown,
    canvasState?: import('@/types/graph').SavedCanvasState,
    aiState?: import('@/core/storage/fileIO').AIStateData,
    createdAtMs?: number,
  ) => void,
): Promise<boolean> {
  try {
    // Dynamically import Capacitor Filesystem to keep the web bundle small
    const { Filesystem } = await import('@capacitor/filesystem');
    const { decodeArchcData } = await import('@/core/storage/fileIO');

    // Normalize the path — Capacitor Filesystem.readFile needs a file:// URI or
    // an absolute path depending on the platform and open-in-place flag.
    let filePath = url;

    // If the URL has a content:// or custom scheme, read as-is.
    // For file:// URIs, we pass the full URI to readFile.
    console.log(`[useAppUrlOpen] Reading file: ${filePath}`);

    const fileContent = await Filesystem.readFile({
      path: filePath,
    });

    // fileContent.data is base64 on native
    let data: Uint8Array;
    if (typeof fileContent.data === 'string') {
      // base64 decode
      const binary = atob(fileContent.data);
      data = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        data[i] = binary.charCodeAt(i);
      }
    } else {
      // Blob (web fallback)
      data = new Uint8Array(await (fileContent.data as Blob).arrayBuffer());
    }

    const fileName = extractFileName(url);

    // Decode the .archc binary data
    const { graph, canvasState, aiState, createdAtMs } = await decodeArchcData(data);

    // Apply to the store (same as openFile flow)
    applyDecodedFile(graph, fileName, filePath, canvasState, aiState, createdAtMs);

    console.log(`[useAppUrlOpen] Successfully loaded: ${fileName}`);
    return true;
  } catch (err) {
    console.error('[useAppUrlOpen] Failed to open file:', err);
    return false;
  }
}

/**
 * React hook that listens for Capacitor `appUrlOpen` events and loads
 * .archc files into the core store. No-op on web.
 *
 * @param initialized - Whether the core store is initialized and ready.
 */
export function useAppUrlOpen(initialized: boolean): void {
  // Track whether we've already checked the launch URL (cold-start)
  const checkedLaunchUrl = useRef(false);

  useEffect(() => {
    // Skip on web — there are no appUrlOpen events in a browser
    if (!isNative() || !initialized) return;

    let listenerHandle: { remove: () => Promise<void> } | null = null;

    const applyDecodedFile = useCoreStore.getState()._applyDecodedFile;

    // Dynamic import of @capacitor/app (not available on web)
    const setup = async () => {
      const { App } = await import('@capacitor/app');

      // 1. Check launch URL (cold-start: app was opened by tapping a file)
      if (!checkedLaunchUrl.current) {
        checkedLaunchUrl.current = true;
        try {
          const launchUrl = await App.getLaunchUrl();
          if (launchUrl?.url && isArchcFileUrl(launchUrl.url)) {
            console.log(`[useAppUrlOpen] Cold-start with file: ${launchUrl.url}`);
            await handleFileUrl(launchUrl.url, applyDecodedFile);
          }
        } catch (err) {
          console.warn('[useAppUrlOpen] Failed to get launch URL:', err);
        }
      }

      // 2. Listen for warm-start events (app already running, file tapped)
      listenerHandle = await App.addListener('appUrlOpen', async (event) => {
        console.log(`[useAppUrlOpen] Received appUrlOpen: ${event.url}`);
        if (isArchcFileUrl(event.url)) {
          // Re-read the latest applyDecodedFile in case store was re-initialized
          const currentApply = useCoreStore.getState()._applyDecodedFile;
          await handleFileUrl(event.url, currentApply);
        }
      });
    };

    setup();

    return () => {
      if (listenerHandle) {
        listenerHandle.remove();
      }
    };
  }, [initialized]);
}
