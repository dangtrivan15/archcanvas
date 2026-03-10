/**
 * Backend factory — creates the appropriate StorageBackend for the current environment.
 *
 * Detects browser capabilities and returns:
 * - FileSystemAccessBackend if the File System Access API is available (Chrome/Edge)
 * - FileDownloadBackend as a fallback for other browsers (Firefox/Safari)
 */

import type { StorageBackend } from '../types';
import { FileSystemAccessBackend } from './fileSystemAccess';
import { FileDownloadBackend } from './fileDownload';

/**
 * Create the default StorageBackend for the current browser environment.
 *
 * Uses feature detection to pick the best available backend:
 * - Chrome/Edge with File System Access API → FileSystemAccessBackend
 * - All other browsers → FileDownloadBackend
 */
export function createDefaultBackend(): StorageBackend {
  if (typeof window !== 'undefined' && 'showOpenFilePicker' in window) {
    return new FileSystemAccessBackend();
  }
  return new FileDownloadBackend();
}
