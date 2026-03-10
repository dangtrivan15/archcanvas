/**
 * useAppUrlOpen — Handles deep links, Universal Links, and file association for .archc files.
 *
 * Supports three URL entry points:
 *
 * 1. **File association** — Tapping an .archc file in Files, Mail, AirDrop, etc.
 *    iOS delivers a file:// URL via Capacitor's `appUrlOpen` event.
 *
 * 2. **Custom URL scheme** — `archcanvas://open?file=<encoded-path>`
 *    Other apps can use this to open a specific .archc file in ArchCanvas.
 *
 * 3. **Universal Links** — `https://archcanvas.app/open?file=<encoded-path>`
 *    Web-to-app handoff: tapping this in Safari opens the native app.
 *
 * This hook:
 * 1. Listens for `appUrlOpen` events from `@capacitor/app`
 * 2. Routes the URL to the appropriate handler (file, custom scheme, or Universal Link)
 * 3. Reads the file data via `@capacitor/filesystem` (for file URLs)
 * 4. Decodes the protobuf binary and loads it into the core store
 *
 * Also checks `App.getLaunchUrl()` on mount for the cold-start case where
 * the app was launched (not already running) by tapping a file or link.
 *
 * On web (non-native), this hook handles Universal Link query params from the browser URL.
 */

import { useEffect, useRef } from 'react';
import { isNative } from '@/core/platform/platformBridge';
import { useFileStore } from '@/store/fileStore';

/** The custom URL scheme registered in Info.plist */
const CUSTOM_SCHEME = 'archcanvas://';

/** The Universal Link domain */
const UNIVERSAL_LINK_HOST = 'archcanvas.app';

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
 * Check if a URL is a custom scheme deep link (archcanvas://...).
 */
export function isCustomSchemeUrl(url: string): boolean {
  return url.toLowerCase().startsWith(CUSTOM_SCHEME);
}

/**
 * Check if a URL is a Universal Link (https://archcanvas.app/...).
 */
export function isUniversalLink(url: string): boolean {
  try {
    const parsed = new URL(url);
    return (
      (parsed.protocol === 'https:' || parsed.protocol === 'http:') &&
      parsed.hostname === UNIVERSAL_LINK_HOST
    );
  } catch {
    return false;
  }
}

/**
 * Extract the file path from a deep link URL.
 *
 * Supports:
 * - archcanvas://open?file=<encoded-path>
 * - https://archcanvas.app/open?file=<encoded-path>
 *
 * Returns the decoded file path, or null if not found.
 */
export function extractFilePathFromDeepLink(url: string): string | null {
  try {
    // For custom scheme URLs, we need to handle them specially since
    // URL constructor may not parse archcanvas:// correctly in all environments
    if (isCustomSchemeUrl(url)) {
      // archcanvas://open?file=... → extract everything after ?
      const queryStart = url.indexOf('?');
      if (queryStart === -1) return null;
      const params = new URLSearchParams(url.substring(queryStart));
      return params.get('file');
    }

    // For Universal Links (https://archcanvas.app/open?file=...)
    if (isUniversalLink(url)) {
      const parsed = new URL(url);
      return parsed.searchParams.get('file');
    }

    return null;
  } catch {
    return null;
  }
}

type ApplyDecodedFileFn = (
  graph: import('@/types/graph').ArchGraph,
  fileName: string,
  fileHandle: unknown,
  canvasState?: import('@/types/graph').SavedCanvasState,
  aiState?: import('@/core/storage/fileIO').AIStateData,
  createdAtMs?: number,
) => void;

/**
 * Read a file URL and load the .archc data into the store.
 * Returns true on success, false on failure.
 */
export async function handleFileUrl(
  url: string,
  applyDecodedFile: ApplyDecodedFileFn,
): Promise<boolean> {
  try {
    // Dynamically import Capacitor Filesystem to keep the web bundle small
    const { Filesystem } = await import('@capacitor/filesystem');
    const { decodeArchcData } = await import('@/core/storage/fileIO');

    // Normalize the path — Capacitor Filesystem.readFile needs a file:// URI or
    // an absolute path depending on the platform and open-in-place flag.
    const filePath = url;

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
 * Handle a deep link URL from either the custom scheme or Universal Links.
 * Extracts the file path from the query string and loads it.
 */
export async function handleDeepLink(
  url: string,
  applyDecodedFile: ApplyDecodedFileFn,
): Promise<boolean> {
  const filePath = extractFilePathFromDeepLink(url);
  if (!filePath) {
    console.warn(`[useAppUrlOpen] Deep link has no file parameter: ${url}`);
    return false;
  }

  console.log(`[useAppUrlOpen] Deep link file path: ${filePath}`);

  // If the file path is a URL (http/https), fetch it
  if (filePath.startsWith('http://') || filePath.startsWith('https://')) {
    return handleRemoteFileUrl(filePath, applyDecodedFile);
  }

  // Otherwise treat it as a local file path
  return handleFileUrl(filePath, applyDecodedFile);
}

/**
 * Handle a remote .archc file URL — fetch it and load into the store.
 */
export async function handleRemoteFileUrl(
  url: string,
  applyDecodedFile: ApplyDecodedFileFn,
): Promise<boolean> {
  try {
    const { decodeArchcData } = await import('@/core/storage/fileIO');

    console.log(`[useAppUrlOpen] Fetching remote file: ${url}`);
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const buffer = await response.arrayBuffer();
    const data = new Uint8Array(buffer);
    const fileName = extractFileName(url);
    const { graph, canvasState, aiState, createdAtMs } = await decodeArchcData(data);

    applyDecodedFile(graph, fileName, url, canvasState, aiState, createdAtMs);

    console.log(`[useAppUrlOpen] Successfully loaded remote file: ${fileName}`);
    return true;
  } catch (err) {
    console.error('[useAppUrlOpen] Failed to fetch remote file:', err);
    return false;
  }
}

/**
 * Route an incoming URL to the appropriate handler.
 * Returns true if the URL was handled, false otherwise.
 */
export async function routeIncomingUrl(
  url: string,
  applyDecodedFile: ApplyDecodedFileFn,
): Promise<boolean> {
  // 1. Custom scheme deep link: archcanvas://open?file=...
  if (isCustomSchemeUrl(url)) {
    console.log(`[useAppUrlOpen] Routing custom scheme URL: ${url}`);
    return handleDeepLink(url, applyDecodedFile);
  }

  // 2. Universal Link: https://archcanvas.app/open?file=...
  if (isUniversalLink(url)) {
    console.log(`[useAppUrlOpen] Routing Universal Link: ${url}`);
    return handleDeepLink(url, applyDecodedFile);
  }

  // 3. Direct .archc file URL (file://, content://, etc.)
  if (isArchcFileUrl(url)) {
    console.log(`[useAppUrlOpen] Routing file URL: ${url}`);
    return handleFileUrl(url, applyDecodedFile);
  }

  console.log(`[useAppUrlOpen] Unrecognized URL, ignoring: ${url}`);
  return false;
}

/**
 * React hook that listens for Capacitor `appUrlOpen` events and loads
 * .archc files into the core store. Handles file associations, custom URL
 * scheme (archcanvas://), and Universal Links (https://archcanvas.app/...).
 *
 * On web, checks the browser URL for Universal Link query params on mount.
 *
 * @param initialized - Whether the core store is initialized and ready.
 */
export function useAppUrlOpen(initialized: boolean): void {
  // Track whether we've already checked the launch URL (cold-start)
  const checkedLaunchUrl = useRef(false);

  // Web: check browser URL for Universal Link params (web-to-app handoff fallback)
  useEffect(() => {
    if (isNative() || !initialized || checkedLaunchUrl.current) return;
    checkedLaunchUrl.current = true;

    const currentUrl = window.location.href;
    if (currentUrl.includes('/open') && currentUrl.includes('file=')) {
      const params = new URLSearchParams(window.location.search);
      const filePath = params.get('file');
      if (filePath) {
        console.log(`[useAppUrlOpen] Web handoff — loading file from URL param: ${filePath}`);
        const applyDecodedFile = useFileStore.getState()._applyDecodedFile;
        handleRemoteFileUrl(filePath, applyDecodedFile);
      }
    }
  }, [initialized]);

  useEffect(() => {
    // Skip native setup on web
    if (!isNative() || !initialized) return;

    let listenerHandle: { remove: () => Promise<void> } | null = null;

    const applyDecodedFile = useFileStore.getState()._applyDecodedFile;

    // Dynamic import of @capacitor/app (not available on web)
    const setup = async () => {
      const { App } = await import('@capacitor/app');

      // 1. Check launch URL (cold-start: app was opened by tapping a file or link)
      if (!checkedLaunchUrl.current) {
        checkedLaunchUrl.current = true;
        try {
          const launchUrl = await App.getLaunchUrl();
          if (launchUrl?.url) {
            console.log(`[useAppUrlOpen] Cold-start URL: ${launchUrl.url}`);
            await routeIncomingUrl(launchUrl.url, applyDecodedFile);
          }
        } catch (err) {
          console.warn('[useAppUrlOpen] Failed to get launch URL:', err);
        }
      }

      // 2. Listen for warm-start events (app already running, file/link tapped)
      listenerHandle = await App.addListener('appUrlOpen', async (event) => {
        console.log(`[useAppUrlOpen] Received appUrlOpen: ${event.url}`);
        // Re-read the latest applyDecodedFile in case store was re-initialized
        const currentApply = useFileStore.getState()._applyDecodedFile;
        await routeIncomingUrl(event.url, currentApply);
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
