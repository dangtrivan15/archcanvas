/**
 * AsyncEdge - dashed/animated line edge for asynchronous connections.
 * Uses CSS animation to create a flowing dash effect along the edge path.
 * Uses theme CSS variables for stroke colors.
 * Respects prefers-reduced-motion by disabling animation.
 * Simplifies rendering at low zoom (LOD mode).
 */

import { createEdgeComponent } from './createEdgeComponent';

// Inject keyframe animation once
const STYLE_ID = 'async-edge-animation';
if (typeof document !== 'undefined' && !document.getElementById(STYLE_ID)) {
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    @keyframes async-edge-flow {
      to {
        stroke-dashoffset: -24;
      }
    }
  `;
  document.head.appendChild(style);
}

export const AsyncEdge = createEdgeComponent({
  displayName: 'AsyncEdge',
  color: 'hsl(var(--gold))',
  selectedColor: 'hsl(var(--iris))',
  strokeWidth: 2,
  selectedStrokeWidth: 2.5,
  lodStrokeWidth: 1.5,
  strokeDasharray: '8,4',
  animation: 'async-edge-flow 0.6s linear infinite',
});
