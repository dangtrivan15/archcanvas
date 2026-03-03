/**
 * Spatial navigation for arrow-key node traversal.
 *
 * Navigates between nodes by spatial position. From the selected node:
 * - Right arrow: select nearest node to the right
 * - Left arrow: select nearest node to the left
 * - Up arrow: select nearest node above
 * - Down arrow: select nearest node below
 *
 * Algorithm: angular cone (+-60 degrees) with distance ranking.
 * Fallback: if no node in cone, find closest in hemisphere.
 */

import type { CanvasNode } from '@/types/canvas';

export type Direction = 'up' | 'down' | 'left' | 'right';

interface NodePosition {
  id: string;
  x: number;
  y: number;
}

/**
 * Direction angles (in radians):
 * Right = 0, Down = PI/2, Left = PI, Up = -PI/2
 */
const DIRECTION_ANGLES: Record<Direction, number> = {
  right: 0,
  down: Math.PI / 2,
  left: Math.PI,
  up: -Math.PI / 2,
};

/**
 * Angular cone half-width (60 degrees = PI/3 radians).
 * Candidates within +-60 degrees of the target direction are preferred.
 */
const CONE_HALF_ANGLE = Math.PI / 3; // 60 degrees

/**
 * Hemisphere half-width (90 degrees = PI/2 radians).
 * Used as fallback when no candidate is in the cone.
 */
const HEMISPHERE_HALF_ANGLE = Math.PI / 2; // 90 degrees

/**
 * Extract positions from React Flow CanvasNodes.
 */
export function extractPositions(nodes: CanvasNode[]): NodePosition[] {
  return nodes.map((n) => ({
    id: n.id,
    x: n.position.x + (n.measured?.width ?? n.width ?? 200) / 2,
    y: n.position.y + (n.measured?.height ?? n.height ?? 100) / 2,
  }));
}

/**
 * Compute the angular difference between two angles, normalized to [-PI, PI].
 */
function angleDifference(a: number, b: number): number {
  let diff = a - b;
  while (diff > Math.PI) diff -= 2 * Math.PI;
  while (diff < -Math.PI) diff += 2 * Math.PI;
  return diff;
}

/**
 * Find the nearest node in the given direction from the current position.
 *
 * Algorithm:
 * 1. Compute angle from current node center to each candidate node center
 * 2. Filter candidates within +-60 degree cone of the target direction
 * 3. Rank by distance
 * 4. Fallback: if no cone match, try hemisphere (+-90 degrees)
 *
 * @param currentId - The ID of the currently selected node
 * @param direction - The navigation direction
 * @param positions - All node positions (centers)
 * @returns The ID of the nearest node, or null if none found
 */
export function findNearestNode(
  currentId: string,
  direction: Direction,
  positions: NodePosition[],
): string | null {
  const current = positions.find((p) => p.id === currentId);
  if (!current) return null;

  const candidates = positions.filter((p) => p.id !== currentId);
  if (candidates.length === 0) return null;

  const targetAngle = DIRECTION_ANGLES[direction];

  // Score candidates by distance, filtering by angular cone
  const scored = candidates
    .map((candidate) => {
      const dx = candidate.x - current.x;
      const dy = candidate.y - current.y;
      const angle = Math.atan2(dy, dx);
      const diff = Math.abs(angleDifference(angle, targetAngle));
      const distance = Math.sqrt(dx * dx + dy * dy);
      return { id: candidate.id, diff, distance };
    })
    .filter((c) => c.distance > 0); // exclude overlapping nodes

  // Try cone first (+-60 degrees)
  const coneMatches = scored
    .filter((c) => c.diff <= CONE_HALF_ANGLE)
    .sort((a, b) => a.distance - b.distance);

  if (coneMatches.length > 0) {
    return coneMatches[0]!.id;
  }

  // Fallback: hemisphere (+-90 degrees)
  const hemisphereMatches = scored
    .filter((c) => c.diff <= HEMISPHERE_HALF_ANGLE)
    .sort((a, b) => a.distance - b.distance);

  if (hemisphereMatches.length > 0) {
    return hemisphereMatches[0]!.id;
  }

  return null;
}

/**
 * Find the top-left-most node (minimum x + y).
 * Used when no node is selected and arrow key is pressed.
 */
export function findTopLeftNode(positions: NodePosition[]): string | null {
  if (positions.length === 0) return null;

  let best = positions[0]!;
  let bestScore = best.x + best.y;

  for (let i = 1; i < positions.length; i++) {
    const pos = positions[i]!;
    const score = pos.x + pos.y;
    if (score < bestScore) {
      best = pos;
      bestScore = score;
    }
  }

  return best.id;
}
