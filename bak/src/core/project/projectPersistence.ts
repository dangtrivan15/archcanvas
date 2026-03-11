/**
 * Project Persistence — saves/restores the last-opened project directory handle
 * across page reloads using IndexedDB.
 *
 * Browser: stores FileSystemDirectoryHandle (structured-clonable) in IndexedDB,
 *          re-checks permission on restore via queryPermission/requestPermission.
 * Desktop: future implementation can swap to localStorage + path string.
 */

const DB_NAME = 'archcanvas-project';
const DB_VERSION = 1;
const STORE_NAME = 'last-project';
const RECORD_KEY = 'current';

interface SavedProjectRecord {
  key: string;
  name: string;
  handle: FileSystemDirectoryHandle;
  savedAtMs: number;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB is not available'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'key' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Save the current project's directory handle for restoration after reload.
 */
export async function saveLastProject(
  name: string,
  handle: FileSystemDirectoryHandle,
): Promise<void> {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const record: SavedProjectRecord = {
      key: RECORD_KEY,
      name,
      handle,
      savedAtMs: Date.now(),
    };
    store.put(record);

    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}

/**
 * Restore the last-opened project directory handle.
 *
 * Returns null if:
 * - No project was saved
 * - IndexedDB is unavailable
 * - The stored handle's permission was revoked and re-request was denied
 */
export async function restoreLastProject(): Promise<{
  name: string;
  handle: FileSystemDirectoryHandle;
} | null> {
  let db: IDBDatabase;
  try {
    db = await openDB();
  } catch {
    return null;
  }

  const record = await new Promise<SavedProjectRecord | null>(
    (resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.get(RECORD_KEY);

      request.onsuccess = () => {
        db.close();
        resolve((request.result as SavedProjectRecord) ?? null);
      };
      request.onerror = () => {
        db.close();
        reject(request.error);
      };
    },
  );

  if (!record) return null;

  // Re-check filesystem permission (may have been revoked)
  try {
    const perm = await record.handle.queryPermission({ mode: 'readwrite' });
    if (perm === 'granted') {
      return { name: record.name, handle: record.handle };
    }

    // Permission not granted — request it (may show a browser prompt)
    const requested = await record.handle.requestPermission({ mode: 'readwrite' });
    if (requested === 'granted') {
      return { name: record.name, handle: record.handle };
    }

    // User denied — clear stale record
    await clearLastProject();
    return null;
  } catch {
    // Handle is no longer valid (e.g., directory was deleted)
    await clearLastProject();
    return null;
  }
}

/**
 * Clear the saved project handle (e.g., on Close Project).
 */
export async function clearLastProject(): Promise<void> {
  let db: IDBDatabase;
  try {
    db = await openDB();
  } catch {
    return;
  }

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.delete(RECORD_KEY);

    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}
