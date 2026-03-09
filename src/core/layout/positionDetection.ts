/**
 * Position detection utilities for determining whether nodes need auto-layout.
 *
 * Detects when nodes at a given navigation level have missing or default positions
 * (all at 0,0 or undefined), which indicates auto-layout should trigger automatically.
 */

import type { ArchNode } from '@/types/graph';

/**
 * Check whether a single node has a default/missing position.
 * A position is considered "default" if both x and y are 0.
 *
 * @param node - The node to check
 * @returns true if the node's position is at the default (0,0)
 */
export function hasDefaultPosition(node: ArchNode): boolean {
  return node.position.x === 0 && node.position.y === 0;
}

/**
 * Detect whether nodes at a navigation level need auto-layout.
 *
 * Returns `true` when ALL nodes have missing or default positions (all at 0,0),
 * meaning no user has manually arranged them yet. Returns `false` when at least
 * one node has a non-default position, indicating intentional placement.
 *
 * Special cases:
 * - Empty array → returns `false` (nothing to layout)
 * - Single node at (0,0) → returns `true` (still needs layout to center it)
 *
 * @param nodes - Array of nodes at the current navigation level
 * @returns `true` if auto-layout should trigger (all positions are default/missing)
 */
export function needsAutoLayout(nodes: ArchNode[]): boolean {
  if (nodes.length === 0) {
    return false;
  }

  return nodes.every(hasDefaultPosition);
}

/**
 * Classify nodes into those with valid saved positions vs default/missing positions.
 *
 * Useful for partial layout scenarios where some nodes have been placed manually
 * and others are newly added (still at 0,0).
 *
 * @param nodes - Array of nodes at the current navigation level
 * @returns Object with `positioned` and `unpositioned` arrays
 */
export function classifyNodePositions(nodes: ArchNode[]): {
  positioned: ArchNode[];
  unpositioned: ArchNode[];
} {
  const positioned: ArchNode[] = [];
  const unpositioned: ArchNode[] = [];

  for (const node of nodes) {
    if (hasDefaultPosition(node)) {
      unpositioned.push(node);
    } else {
      positioned.push(node);
    }
  }

  return { positioned, unpositioned };
}
