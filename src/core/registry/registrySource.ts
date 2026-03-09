/**
 * NodeDef source tracking types.
 * Tracks where a NodeDef came from (builtin, custom, or URL-loaded).
 */

import type { NodeDef } from '@/types/nodedef';

/** The origin category of a registered NodeDef. */
export type NodeDefSourceKind = 'builtin' | 'custom' | 'url';

/**
 * Provenance record for a registered NodeDef.
 */
export interface NodeDefSource {
  /** Category of origin. */
  kind: NodeDefSourceKind;
  /**
   * Specific origin identifier:
   * - 'builtin': registry key, e.g. "compute/service"
   * - 'custom':  human label, e.g. "Acme NodeDef Pack v2"
   * - 'url':     full URL, e.g. "https://cdn.acme.com/nodedefs/foo.yaml"
   */
  origin: string;
  /** ISO 8601 timestamp of when this def was registered. */
  registeredAt: string;
}

/**
 * A NodeDef paired with its provenance.
 * This is what the registry stores internally.
 */
export interface NodeDefEntry {
  def: NodeDef;
  source: NodeDefSource;
}
