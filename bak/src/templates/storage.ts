/**
 * Template IndexedDB Storage
 *
 * Stores user-imported templates in IndexedDB with CRUD operations.
 * Built-in templates are bundled as static assets and don't use IndexedDB.
 * User-imported templates use the same TemplateMetadata schema as built-in ones.
 */

import type { TemplateMetadata } from './types';

const DB_NAME = 'archcanvas-templates';
const DB_VERSION = 1;
const STORE_NAME = 'templates';

/**
 * An imported template record stored in IndexedDB.
 * Uses the template id as the key path.
 */
export interface ImportedTemplateRecord {
  /** Template metadata (source is always 'imported') */
  metadata: TemplateMetadata;
  /** Serialized Architecture proto bytes */
  data: Uint8Array;
}

/**
 * Open (or create) the IndexedDB database for template storage.
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
          keyPath: 'metadata.id',
        });
        store.createIndex('category', 'metadata.category', { unique: false });
        store.createIndex('createdAt', 'metadata.createdAt', { unique: false });
        store.createIndex('name', 'metadata.name', { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Save a user-imported template to IndexedDB.
 * If a template with the same id already exists, it will be replaced.
 */
export async function saveImportedTemplate(record: ImportedTemplateRecord): Promise<void> {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
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
 * Get all imported templates from IndexedDB.
 */
export async function getImportedTemplates(): Promise<ImportedTemplateRecord[]> {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onsuccess = () => {
      db.close();
      resolve(request.result as ImportedTemplateRecord[]);
    };
    request.onerror = () => {
      db.close();
      reject(request.error);
    };
  });
}

/**
 * Get a single imported template by ID.
 */
export async function getImportedTemplateById(id: string): Promise<ImportedTemplateRecord | null> {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.get(id);

    request.onsuccess = () => {
      db.close();
      resolve((request.result as ImportedTemplateRecord) ?? null);
    };
    request.onerror = () => {
      db.close();
      reject(request.error);
    };
  });
}

/**
 * Delete an imported template by ID.
 */
export async function deleteImportedTemplate(id: string): Promise<void> {
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
 * Get the count of imported templates.
 */
export async function getImportedTemplateCount(): Promise<number> {
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
 * Clear all imported templates from IndexedDB.
 */
export async function clearImportedTemplates(): Promise<void> {
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
