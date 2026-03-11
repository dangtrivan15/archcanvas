/**
 * Template Metadata & Storage Types
 *
 * Defines how predefined stack templates are stored, indexed, and bundled.
 * Each template includes display metadata and a serialized Architecture snapshot.
 */

/**
 * Metadata for a template — used for display in the template gallery.
 */
export interface TemplateMetadata {
  /** Unique template identifier (e.g., "saas-starter", "microservices-platform") */
  id: string;
  /** Human-readable template name */
  name: string;
  /** Short description of what this template provides */
  description: string;
  /** Lucide icon name (e.g., "Rocket", "Layers") */
  icon: string;
  /** Category/domain tag (e.g., "saas", "enterprise", "ai") */
  category: string;
  /** Number of nodes in the template */
  nodeCount: number;
  /** Number of edges in the template */
  edgeCount: number;
  /** When the template was created (ISO 8601 or epoch ms) */
  createdAt: number;
  /** Whether this is a built-in or user-imported template */
  source: 'builtin' | 'imported';
  /** Optional tags for search/filtering */
  tags?: string[];
}

/**
 * A complete template record: metadata plus the serialized Architecture data.
 * For built-in templates, the data is the raw YAML string.
 * For imported templates, the data is the serialized Architecture proto bytes.
 */
export interface TemplateRecord {
  /** Template metadata for display and indexing */
  metadata: TemplateMetadata;
  /**
   * Serialized template data.
   * - Built-in templates: raw YAML string (parsed at runtime by stackLoader)
   * - Imported templates: Uint8Array of serialized Architecture proto bytes
   */
  data: string | Uint8Array;
}
