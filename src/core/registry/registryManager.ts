/**
 * NodeDef Registry Manager.
 * Loads, validates, and resolves nodedef YAML files.
 * Provides lookup by type (namespace/name), listing by namespace, and search.
 */

import type { NodeDef } from '@/types/nodedef';
import { BUILTIN_NODEDEFS } from './builtins';
import { validateNodeDef } from './nodedefValidator';

export class RegistryManager {
  private readonly registry = new Map<string, NodeDef>();
  private initialized = false;

  /**
   * Initialize the registry by loading and validating all built-in nodedefs.
   * Must be called before any other operations.
   */
  initialize(): void {
    if (this.initialized) {
      return;
    }

    for (const def of BUILTIN_NODEDEFS) {
      // Validate each nodedef against Zod schema
      const validated = validateNodeDef(def);

      const key = `${validated.metadata.namespace}/${validated.metadata.name}`;
      if (this.registry.has(key)) {
        console.warn(`[RegistryManager] Duplicate nodedef: ${key}, skipping`);
        continue;
      }

      this.registry.set(key, def);
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
   * Resolve a nodedef by its full type key (e.g., "compute/service").
   */
  resolve(type: string): NodeDef | undefined {
    this.ensureInitialized();
    return this.registry.get(type);
  }

  /**
   * List all nodedefs in a given namespace.
   */
  listByNamespace(namespace: string): NodeDef[] {
    this.ensureInitialized();
    const results: NodeDef[] = [];
    for (const [key, def] of this.registry) {
      if (key.startsWith(`${namespace}/`)) {
        results.push(def);
      }
    }
    return results;
  }

  /**
   * List all registered nodedefs.
   */
  listAll(): NodeDef[] {
    this.ensureInitialized();
    return Array.from(this.registry.values());
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

    for (const def of this.registry.values()) {
      const { metadata } = def;
      const searchable = [
        metadata.name,
        metadata.displayName,
        metadata.description,
        ...metadata.tags,
      ]
        .join(' ')
        .toLowerCase();

      if (searchable.includes(lowerQuery)) {
        results.push(def);
      }
    }

    return results;
  }

  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error(
        '[RegistryManager] Not initialized. Call initialize() first.',
      );
    }
  }
}
