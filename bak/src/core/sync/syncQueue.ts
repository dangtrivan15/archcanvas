/**
 * Background Sync Queue — Queues file save operations in IndexedDB
 * when offline and flushes them when connectivity is restored.
 *
 * Uses IndexedDB as a durable store so queued operations survive
 * app restarts. Supports conflict detection via timestamps.
 */

const DB_NAME = 'archcanvas-sync';
const DB_VERSION = 1;
const STORE_NAME = 'pending-saves';

/**
 * Type-safe helper to extract result from IDBRequest.
 * IndexedDB returns untyped results; this provides a single assertion point.
 */
function getTypedResult<T>(request: IDBRequest): T {
  return request.result as T;
}

/** Status of the sync queue */
export type SyncStatus = 'idle' | 'pending' | 'syncing' | 'synced' | 'error';

/** A queued save operation */
export interface QueuedSaveOperation {
  /** Auto-incremented ID */
  id?: number;
  /** The file identifier (handle name or filename) */
  fileName: string;
  /** Serialized .archc binary data */
  data: Uint8Array;
  /** Timestamp when the operation was queued */
  queuedAt: number;
  /** Optional: file handle serialized info for re-save (web only; handles can't be serialized) */
  handleInfo?: string;
  /** Number of retry attempts */
  retryCount: number;
}

/**
 * Open (or create) the IndexedDB database for the sync queue.
 */
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
        const store = db.createObjectStore(STORE_NAME, {
          keyPath: 'id',
          autoIncrement: true,
        });
        store.createIndex('fileName', 'fileName', { unique: false });
        store.createIndex('queuedAt', 'queuedAt', { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Enqueue a save operation for later sync.
 * If there's already a pending save for the same fileName, replaces it
 * (only the latest version matters).
 */
export async function enqueueSave(fileName: string, data: Uint8Array): Promise<void> {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const index = store.index('fileName');

    // First, remove any existing pending saves for this file
    const getRequest = index.getAll(fileName);

    getRequest.onsuccess = () => {
      const existing = getTypedResult<QueuedSaveOperation[]>(getRequest);
      for (const entry of existing) {
        if (entry.id !== undefined) {
          store.delete(entry.id);
        }
      }

      // Then add the new save operation
      const op: QueuedSaveOperation = {
        fileName,
        data,
        queuedAt: Date.now(),
        retryCount: 0,
      };

      store.add(op);
    };

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
 * Get all pending save operations, ordered by queuedAt.
 */
export async function getPendingSaves(): Promise<QueuedSaveOperation[]> {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const index = store.index('queuedAt');
    const request = index.getAll();

    request.onsuccess = () => {
      db.close();
      resolve(getTypedResult<QueuedSaveOperation[]>(request));
    };
    request.onerror = () => {
      db.close();
      reject(request.error);
    };
  });
}

/**
 * Get the count of pending save operations.
 */
export async function getPendingSaveCount(): Promise<number> {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.count();

    request.onsuccess = () => {
      db.close();
      resolve(request.result);
    };
    request.onerror = () => {
      db.close();
      reject(request.error);
    };
  });
}

/**
 * Remove a successfully synced operation from the queue.
 */
export async function removeSyncedOperation(id: number): Promise<void> {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.delete(id);

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
 * Increment the retry count for a failed operation.
 */
export async function incrementRetryCount(id: number): Promise<void> {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const getReq = store.get(id);

    getReq.onsuccess = () => {
      const op = getTypedResult<QueuedSaveOperation | undefined>(getReq);
      if (op) {
        op.retryCount += 1;
        store.put(op);
      }
    };

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
 * Clear all pending operations (e.g., after user dismisses conflicts).
 */
export async function clearQueue(): Promise<void> {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.clear();

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
