/**
 * SyncEdge - solid line edge for synchronous connections.
 * Uses theme CSS variables for stroke colors.
 * Supports hover thickening on pointer (trackpad/mouse) devices.
 * Simplifies rendering at low zoom (LOD mode) and respects reduced motion.
 */

import { createEdgeComponent } from './createEdgeComponent';

export const SyncEdge = createEdgeComponent({
  displayName: 'SyncEdge',
  color: 'hsl(var(--muted-foreground))',
  selectedColor: 'hsl(var(--iris))',
  strokeWidth: 2,
  selectedStrokeWidth: 2.5,
  lodStrokeWidth: 1.5,
});
