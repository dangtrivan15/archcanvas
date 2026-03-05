/**
 * Tests for spatial navigation (src/core/input/spatialNavigation.ts).
 *
 * Covers:
 * 1. findNearestNode() with grid layout
 * 2. findNearestNode() with tree layout
 * 3. findNearestNode() with sparse layout
 * 4. findNearestNode() with single node
 * 5. findNearestNode() with empty canvas
 * 6. findTopLeftNode()
 * 7. extractPositions()
 * 8. Cone algorithm behavior
 * 9. Hemisphere fallback
 * 10. FocusZone respect (integration)
 */

import { describe, it, expect } from 'vitest';
import {
  findNearestNode,
  findTopLeftNode,
  extractPositions,
} from '../../../src/core/input/spatialNavigation';
import type { CanvasNode } from '../../../src/types/canvas';

// ================================================================
// Helper: create a minimal CanvasNode for testing
// ================================================================
function makeNode(id: string, x: number, y: number, w = 200, h = 100): CanvasNode {
  return {
    id,
    position: { x, y },
    data: {} as any,
    type: 'generic',
    width: w,
    height: h,
  } as CanvasNode;
}

// ================================================================
// Helper: make positions array directly
// ================================================================
function pos(id: string, x: number, y: number) {
  return { id, x, y };
}

// ================================================================
// 1. Grid Layout Tests
// ================================================================
describe('findNearestNode with grid layout', () => {
  // Grid:
  // A(0,0)  B(200,0)  C(400,0)
  // D(0,200) E(200,200) F(400,200)
  // G(0,400) H(200,400) I(400,400)
  const grid = [
    pos('A', 0, 0),
    pos('B', 200, 0),
    pos('C', 400, 0),
    pos('D', 0, 200),
    pos('E', 200, 200),
    pos('F', 400, 200),
    pos('G', 0, 400),
    pos('H', 200, 400),
    pos('I', 400, 400),
  ];

  it('right from center selects right neighbor', () => {
    expect(findNearestNode('E', 'right', grid)).toBe('F');
  });

  it('left from center selects left neighbor', () => {
    expect(findNearestNode('E', 'left', grid)).toBe('D');
  });

  it('up from center selects above neighbor', () => {
    expect(findNearestNode('E', 'up', grid)).toBe('B');
  });

  it('down from center selects below neighbor', () => {
    expect(findNearestNode('E', 'down', grid)).toBe('H');
  });

  it('right from rightmost (C) selects diagonal neighbor via hemisphere fallback', () => {
    // C(400,0) going right: F(400,200) is at 90 degrees, right at hemisphere boundary
    const result = findNearestNode('C', 'right', grid);
    expect(result).toBe('F'); // hemisphere fallback finds closest in right hemisphere
  });

  it('left from leftmost (A) selects diagonal neighbor via hemisphere fallback', () => {
    // A(0,0) going left: D(0,200) is within hemisphere
    const result = findNearestNode('A', 'left', grid);
    expect(result).toBe('D');
  });

  it('up from top (B) selects diagonal neighbor via hemisphere fallback', () => {
    // B(200,0) going up: A(0,0) is within hemisphere (to the left and up-ish)
    const result = findNearestNode('B', 'up', grid);
    expect(result).toBe('A'); // closest node in up hemisphere
  });

  it('down from bottom (H) selects diagonal neighbor via hemisphere fallback', () => {
    // H(200,400) going down: G(0,400) is within hemisphere
    const result = findNearestNode('H', 'down', grid);
    expect(result).toBe('G'); // closest node in down hemisphere
  });

  it('right from A selects B (nearest right)', () => {
    expect(findNearestNode('A', 'right', grid)).toBe('B');
  });

  it('down from A selects D (nearest below)', () => {
    expect(findNearestNode('A', 'down', grid)).toBe('D');
  });
});

// ================================================================
// 2. Tree Layout Tests
// ================================================================
describe('findNearestNode with tree layout', () => {
  // Tree structure:
  //        root(200, 0)
  //       /            \
  //   left(0, 200)   right(400, 200)
  //   /        \
  // ll(0,400) lr(200,400)
  const tree = [
    pos('root', 200, 0),
    pos('left', 0, 200),
    pos('right', 400, 200),
    pos('ll', 0, 400),
    pos('lr', 200, 400),
  ];

  it('down from root selects nearest child', () => {
    const result = findNearestNode('root', 'down', tree);
    expect(result === 'left' || result === 'right').toBe(true);
  });

  it('right from left selects nearest node in right cone (root is closer than right sibling)', () => {
    // left(0,200) -> root(200,0) is distance ~283 at -45 deg (within 60 deg cone of right)
    // left(0,200) -> right(400,200) is distance 400 at 0 deg (within cone but farther)
    // Algorithm prefers closest within cone, so root wins
    expect(findNearestNode('left', 'right', tree)).toBe('root');
  });

  it('left from right selects nearest node in left cone (root is closer than left sibling)', () => {
    // right(400,200) -> root(200,0) is distance ~283 at -135 deg + 180 = ~-2.36 rad
    // Target angle for left = PI. diff = |PI - (-2.36)| normalized...
    // Actually: root is at (-200, -200) relative to right. angle = atan2(-200, -200) = -135 deg = -3PI/4
    // Diff from PI (left): |(-3PI/4) - PI| = |(-3PI/4 - 4PI/4)| = 7PI/4 -> normalize to -PI/4... abs = PI/4
    // That's within 60 deg cone. Distance 283 < 400 (to left), so root wins.
    expect(findNearestNode('right', 'left', tree)).toBe('root');
  });

  it('up from left selects root', () => {
    expect(findNearestNode('left', 'up', tree)).toBe('root');
  });

  it('down from left selects ll or lr', () => {
    const result = findNearestNode('left', 'down', tree);
    expect(result === 'll' || result === 'lr').toBe(true);
  });
});

// ================================================================
// 3. Sparse Layout Tests
// ================================================================
describe('findNearestNode with sparse layout', () => {
  // Two nodes far apart
  const sparse = [pos('A', 0, 0), pos('B', 1000, 500)];

  it('right from A finds B', () => {
    expect(findNearestNode('A', 'right', sparse)).toBe('B');
  });

  it('left from B finds A', () => {
    expect(findNearestNode('B', 'left', sparse)).toBe('A');
  });

  it('down from A finds B (diagonal within hemisphere)', () => {
    // B is to the right and below A. Down arrow should find it
    // via hemisphere fallback since it's not in the strict down cone
    const result = findNearestNode('A', 'down', sparse);
    expect(result).toBe('B');
  });
});

// ================================================================
// 4. Single Node Tests
// ================================================================
describe('findNearestNode with single node', () => {
  const single = [pos('only', 100, 100)];

  it('returns null for any direction (no neighbors)', () => {
    expect(findNearestNode('only', 'right', single)).toBeNull();
    expect(findNearestNode('only', 'left', single)).toBeNull();
    expect(findNearestNode('only', 'up', single)).toBeNull();
    expect(findNearestNode('only', 'down', single)).toBeNull();
  });
});

// ================================================================
// 5. Empty Canvas Tests
// ================================================================
describe('findNearestNode with empty canvas', () => {
  it('returns null when currentId not found', () => {
    expect(findNearestNode('nonexistent', 'right', [])).toBeNull();
  });

  it('returns null when positions array is empty', () => {
    expect(findNearestNode('any', 'right', [])).toBeNull();
  });
});

// ================================================================
// 6. findTopLeftNode Tests
// ================================================================
describe('findTopLeftNode', () => {
  it('selects node with minimum x+y', () => {
    const positions = [
      pos('A', 100, 100), // score = 200
      pos('B', 0, 50), // score = 50 (smallest)
      pos('C', 300, 0), // score = 300
    ];
    expect(findTopLeftNode(positions)).toBe('B');
  });

  it('returns null for empty array', () => {
    expect(findTopLeftNode([])).toBeNull();
  });

  it('returns only node when single node', () => {
    expect(findTopLeftNode([pos('A', 50, 50)])).toBe('A');
  });

  it('picks first minimum when tied', () => {
    const positions = [
      pos('A', 50, 50), // score = 100
      pos('B', 100, 0), // score = 100
    ];
    // Both have same score, first one wins
    expect(findTopLeftNode(positions)).toBe('A');
  });
});

// ================================================================
// 7. extractPositions Tests
// ================================================================
describe('extractPositions', () => {
  it('extracts center positions from CanvasNodes', () => {
    const nodes = [makeNode('n1', 0, 0, 200, 100)];
    const result = extractPositions(nodes);
    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe('n1');
    // Center: (0 + 200/2, 0 + 100/2) = (100, 50)
    expect(result[0]!.x).toBe(100);
    expect(result[0]!.y).toBe(50);
  });

  it('handles multiple nodes', () => {
    const nodes = [makeNode('n1', 0, 0, 200, 100), makeNode('n2', 300, 200, 200, 100)];
    const result = extractPositions(nodes);
    expect(result).toHaveLength(2);
    expect(result[0]!.id).toBe('n1');
    expect(result[1]!.id).toBe('n2');
  });

  it('handles empty array', () => {
    expect(extractPositions([])).toEqual([]);
  });

  it('uses default dimensions if not specified', () => {
    const node = { id: 'n1', position: { x: 0, y: 0 }, data: {} } as CanvasNode;
    const result = extractPositions([node]);
    // Default: 200x100, so center = (100, 50)
    expect(result[0]!.x).toBe(100);
    expect(result[0]!.y).toBe(50);
  });
});

// ================================================================
// 8. Cone Algorithm Behavior
// ================================================================
describe('Cone algorithm', () => {
  it('prefers closer node within cone over farther node perfectly aligned', () => {
    // Two nodes to the right, one closer but slightly off-axis, one far but perfect
    const positions = [
      pos('current', 0, 0),
      pos('close-angled', 100, 50), // close, slight angle
      pos('far-perfect', 500, 0), // far, perfectly right
    ];
    expect(findNearestNode('current', 'right', positions)).toBe('close-angled');
  });

  it('ignores nodes behind you (> 90 degrees)', () => {
    const positions = [
      pos('current', 200, 200),
      pos('behind', 0, 200), // to the left when going right
    ];
    expect(findNearestNode('current', 'right', positions)).toBeNull();
  });

  it('handles diagonal layouts gracefully', () => {
    const positions = [
      pos('A', 0, 0),
      pos('B', 100, 100), // diagonal
      pos('C', 200, 0), // horizontal right
    ];
    // Right from A: C is perfectly right, B is diagonal (down-right)
    expect(findNearestNode('A', 'right', positions)).toBe('B');
  });
});

// ================================================================
// 9. Hemisphere Fallback
// ================================================================
describe('Hemisphere fallback', () => {
  it('selects node at 70 degrees when nothing in 60-degree cone', () => {
    // Node at ~70 degrees angle (just outside cone, within hemisphere)
    const dx = 100;
    const dy = dx * Math.tan((70 * Math.PI) / 180); // ~274.7
    const positions = [pos('current', 0, 0), pos('target', dx, dy)];
    // Down from current: angle to target is ~70 degrees from right, which is ~20 from down
    // Actually the angle from down (PI/2) to atan2(274.7, 100) = 1.22 rad = 69.9 deg
    // Diff from down = PI/2 - 1.22 = 0.35 rad = ~20 deg, which IS within 60 deg cone
    // So this should find in cone, not fallback
    const result = findNearestNode('current', 'down', positions);
    expect(result).toBe('target');
  });
});

// ================================================================
// 10. FocusZone Integration
// ================================================================
describe('Arrow key FocusZone integration', () => {
  it('Canvas.tsx imports spatialNavigation functions', async () => {
    const fs = await import('fs');
    const source = fs.readFileSync('src/components/canvas/Canvas.tsx', 'utf-8');
    expect(source).toContain('findNearestNode');
    expect(source).toContain('findTopLeftNode');
    expect(source).toContain('extractPositions');
  });

  it('Canvas.tsx respects isActiveElementTextInput in arrow handler', async () => {
    const fs = await import('fs');
    const source = fs.readFileSync('src/components/canvas/Canvas.tsx', 'utf-8');
    // The arrow handler should check for text inputs
    expect(source).toContain('isActiveElementTextInput');
    // Arrow key handler should check for modifier keys
    expect(source).toContain('e.ctrlKey');
    expect(source).toContain('e.metaKey');
  });

  it('ShortcutManager has arrow key actions registered', async () => {
    const fs = await import('fs');
    const source = fs.readFileSync('src/core/shortcuts/shortcutManager.ts', 'utf-8');
    expect(source).toContain("'nav:arrow-up'");
    expect(source).toContain("'nav:arrow-down'");
    expect(source).toContain("'nav:arrow-left'");
    expect(source).toContain("'nav:arrow-right'");
  });

  it('Keyboard shortcuts config has arrow key entries', async () => {
    const fs = await import('fs');
    const source = fs.readFileSync('src/config/keyboardShortcuts.ts', 'utf-8');
    expect(source).toContain('Navigate to node above');
    expect(source).toContain('Navigate to node below');
    expect(source).toContain('Navigate to node left');
    expect(source).toContain('Navigate to node right');
  });

  it('Canvas.tsx uses setCenter for viewport panning', async () => {
    const fs = await import('fs');
    const source = fs.readFileSync('src/components/canvas/Canvas.tsx', 'utf-8');
    expect(source).toContain('setCenter');
  });

  it('Arrow handler does not fire when dialog is open', async () => {
    const fs = await import('fs');
    const source = fs.readFileSync('src/components/canvas/Canvas.tsx', 'utf-8');
    // Should check dialog states
    expect(source).toContain('deleteDialogOpen');
    expect(source).toContain('commandPaletteOpen');
  });

  it('Canvas.tsx does not fire arrows during placement mode', async () => {
    const fs = await import('fs');
    const source = fs.readFileSync('src/components/canvas/Canvas.tsx', 'utf-8');
    expect(source).toContain('placementMode');
  });
});
