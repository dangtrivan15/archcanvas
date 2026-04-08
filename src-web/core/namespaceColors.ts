/**
 * Namespace color mapping for node tinting.
 *
 * Each built-in namespace is assigned a canonical color label.
 * The actual hex values live in the theme palettes (ThemeTokens);
 * this module provides:
 *   1. `extractNamespace()` — pure function to pull the namespace
 *      segment from a node type string like "compute/service".
 *   2. `BUILT_IN_NAMESPACES` — the canonical list of 9 namespaces.
 */

/** The 9 built-in namespaces recognised by the colour system. */
export const BUILT_IN_NAMESPACES = [
  'compute',
  'data',
  'messaging',
  'network',
  'client',
  'integration',
  'security',
  'observability',
  'ai',
] as const;

export type BuiltInNamespace = (typeof BUILT_IN_NAMESPACES)[number];

/**
 * Extract the namespace segment from a node type string.
 *
 * Examples:
 *   "compute/service"  → "compute"
 *   "data/database"    → "data"
 *   "foobar"           → undefined  (no slash → unknown)
 *   ""                 → undefined
 *
 * Only returns a value when the extracted prefix matches a built-in namespace.
 */
export function extractNamespace(type: string): BuiltInNamespace | undefined {
  const slashIdx = type.indexOf('/');
  if (slashIdx <= 0) return undefined;
  const prefix = type.slice(0, slashIdx);
  return (BUILT_IN_NAMESPACES as readonly string[]).includes(prefix)
    ? (prefix as BuiltInNamespace)
    : undefined;
}
