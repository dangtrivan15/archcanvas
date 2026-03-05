/**
 * DataFlowEdge - thick line edge for data flow connections.
 * Uses theme CSS variables for stroke colors.
 * Simplifies rendering at low zoom (LOD mode) and respects reduced motion.
 */

import { createEdgeComponent } from './createEdgeComponent';

export const DataFlowEdge = createEdgeComponent({
  displayName: 'DataFlowEdge',
  color: 'hsl(var(--foam))',
  selectedColor: 'hsl(var(--iris))',
  strokeWidth: 3,
  selectedStrokeWidth: 4,
  lodStrokeWidth: 2,
});
