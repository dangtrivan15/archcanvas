/**
 * NodeDef Registry Core.
 *
 * A pure RegistryManager implementation that accepts nodedefs via initialize(defs).
 * No dependency on Vite-specific YAML loaders or ?raw imports.
 *
 * This is the base class used by:
 * - The web app (via RegistryManager subclass in registryManager.ts)
 * - The CLI/Node.js (directly, with nodedefs loaded from disk)
 * - Tests (via RegistryManager subclass)
 *
 * Supports runtime registration of custom/URL-loaded nodedefs after initialization.
 */

import type { NodeDef } from '@/types/nodedef';
import type { NodeDefEntry, NodeDefSource } from './registrySource';
import { validateNodeDef } from './nodedefValidator';

export class RegistryManagerCore {
  private readonly registry = new Map<string, NodeDefEntry>();
  private initialized = false;
  private onChange?: (type: string, entry: NodeDefEntry | null) => void;

  /**
   * Initialize the registry with the provided nodedefs.
   * Validates each nodedef against the Zod schema.
   * All defs loaded via initialize() are tagged as 'builtin' source.
   *
   * @param defs - Array of NodeDef objects to register
   */
  initialize(defs: NodeDef[]): void {
    if (this.initialized) {
      return;
    }

    const now = new Date().toISOString();

    for (const def of defs) {
      // Validate each nodedef against Zod schema
      const validated = validateNodeDef(def);

      const key = `${validated.metadata.namespace}/${validated.metadata.name}`;
      if (this.registry.has(key)) {
        console.warn(`[RegistryManager] Duplicate nodedef: ${key}, skipping`);
        continue;
      }

      const entry: NodeDefEntry = {
        def,
        source: { kind: 'builtin', origin: key, registeredAt: now },
      };
      this.registry.set(key, entry);
    }

    this.initialized = true;
    console.log(`[RegistryManager] Loaded ${this.registry.size} built-in nodedefs`);
  }

  /**
   * Returns whether the registry has been initialized.
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Get total count of registered nodedefs.
   */
  get size(): number {
    return this.registry.size;
  }

  /**
   * Set a callback that fires on register/unregister.
   * Used by the reactive registryStore to stay in sync.
   */
  setOnChange(cb: (type: string, entry: NodeDefEntry | null) => void): void {
    this.onChange = cb;
  }

  /**
   * Register a new nodedef at runtime.
   * Validates via Zod. Cannot overwrite built-in nodedefs.
   */
  register(def: NodeDef, source: NodeDefSource): void {
    this.ensureInitialized();
    // Validate for correctness (throws on invalid), but store the original def
    // to match initialize() behavior and avoid Zod/TS shape enum mismatch
    const validated = validateNodeDef(def);
    const key = `${validated.metadata.namespace}/${validated.metadata.name}`;

    const existing = this.registry.get(key);
    if (existing?.source.kind === 'builtin') {
      console.warn(`[RegistryManager] Cannot overwrite built-in nodedef: ${key}`);
      return;
    }

    const entry: NodeDefEntry = { def, source };
    this.registry.set(key, entry);
    this.onChange?.(key, entry);
  }

  /**
   * Unregister a nodedef at runtime.
   * Cannot unregister built-in nodedefs.
   * @returns true if the nodedef was removed
   */
  unregister(type: string): boolean {
    this.ensureInitialized();
    const existing = this.registry.get(type);
    if (!existing) {
      console.warn(`[RegistryManager] Cannot unregister unknown type: ${type}`);
      return false;
    }
    if (existing.source.kind === 'builtin') {
      console.warn(`[RegistryManager] Cannot unregister built-in nodedef: ${type}`);
      return false;
    }
    this.registry.delete(type);
    this.onChange?.(type, null);
    return true;
  }

  /**
   * Resolve a nodedef by its full type key (e.g., "compute/service").
   */
  resolve(type: string): NodeDef | undefined {
    this.ensureInitialized();
    return this.registry.get(type)?.def;
  }

  /**
   * List all nodedefs in a given namespace.
   */
  listByNamespace(namespace: string): NodeDef[] {
    this.ensureInitialized();
    const results: NodeDef[] = [];
    for (const [key, entry] of this.registry) {
      if (key.startsWith(`${namespace}/`)) {
        results.push(entry.def);
      }
    }
    return results;
  }

  /**
   * List all registered nodedefs.
   */
  listAll(): NodeDef[] {
    this.ensureInitialized();
    return Array.from(this.registry.values()).map((e) => e.def);
  }

  /**
   * List all registered entries (nodedefs with source info).
   * Used by the reactive store bridge for initial sync.
   */
  listAllEntries(): NodeDefEntry[] {
    this.ensureInitialized();
    return Array.from(this.registry.values());
  }

  /**
   * List all registered entries with their registry keys.
   * Avoids external key reconstruction from metadata.
   */
  listAllEntriesWithKeys(): [string, NodeDefEntry][] {
    this.ensureInitialized();
    return Array.from(this.registry.entries());
  }

  /**
   * List all registered nodedef type keys.
   */
  listTypes(): string[] {
    this.ensureInitialized();
    return Array.from(this.registry.keys());
  }

  /**
   * List all unique namespaces.
   */
  listNamespaces(): string[] {
    this.ensureInitialized();
    const namespaces = new Set<string>();
    for (const key of this.registry.keys()) {
      const ns = key.split('/')[0];
      if (ns) {
        namespaces.add(ns);
      }
    }
    return Array.from(namespaces);
  }

  /**
   * Search nodedefs by query string (matches name, displayName, description, tags).
   */
  search(query: string): NodeDef[] {
    this.ensureInitialized();
    const lowerQuery = query.toLowerCase();
    const results: NodeDef[] = [];

    for (const entry of this.registry.values()) {
      const { metadata } = entry.def;
      const searchable = [
        metadata.name,
        metadata.displayName,
        metadata.description,
        ...metadata.tags,
      ]
        .join(' ')
        .toLowerCase();

      if (searchable.includes(lowerQuery)) {
        results.push(entry.def);
      }
    }

    return results;
  }

  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error('[RegistryManager] Not initialized. Call initialize() first.');
    }
  }
}
