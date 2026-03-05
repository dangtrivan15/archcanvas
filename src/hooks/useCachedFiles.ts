import { useState, useEffect, useCallback } from 'react';

export interface CachedFileEntry {
  /** URL of the cached file */
  url: string;
  /** Display name extracted from URL */
  name: string;
  /** When the entry was cached (if available) */
  cachedAt?: Date;
}

const ARCHC_CACHE_NAME = 'archc-files';

/**
 * Hook that provides information about .archc files stored in the service worker cache.
 * This helps users understand which files are available offline.
 */
export function useCachedFiles() {
  const [cachedFiles, setCachedFiles] = useState<CachedFileEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const refreshCachedFiles = useCallback(async () => {
    if (typeof caches === 'undefined') {
      setIsLoading(false);
      return;
    }

    try {
      const cache = await caches.open(ARCHC_CACHE_NAME);
      const keys = await cache.keys();
      const entries: CachedFileEntry[] = keys
        .filter((req) => req.url.endsWith('.archc'))
        .map((req) => {
          const url = req.url;
          const urlObj = new URL(url);
          const name = decodeURIComponent(urlObj.pathname.split('/').pop() || url);
          return { url, name };
        });
      setCachedFiles(entries);
    } catch (err) {
      console.warn('[useCachedFiles] Failed to read cache:', err);
      setCachedFiles([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshCachedFiles();
  }, [refreshCachedFiles]);

  const removeCachedFile = useCallback(
    async (url: string) => {
      if (typeof caches === 'undefined') return;
      try {
        const cache = await caches.open(ARCHC_CACHE_NAME);
        await cache.delete(url);
        await refreshCachedFiles();
      } catch (err) {
        console.warn('[useCachedFiles] Failed to remove cached file:', err);
      }
    },
    [refreshCachedFiles],
  );

  const clearAllCachedFiles = useCallback(async () => {
    if (typeof caches === 'undefined') return;
    try {
      await caches.delete(ARCHC_CACHE_NAME);
      setCachedFiles([]);
    } catch (err) {
      console.warn('[useCachedFiles] Failed to clear cache:', err);
    }
  }, []);

  return {
    cachedFiles,
    cachedFileCount: cachedFiles.length,
    isLoading,
    refreshCachedFiles,
    removeCachedFile,
    clearAllCachedFiles,
  };
}
