/**
 * Node sizing tokens (numeric mirrors of CSS custom properties in index.css).
 *
 * These constants exist so JS-only consumers (NodeResizer, computeAutoSize)
 * can reference the same values without parsing CSS vars at runtime.
 *
 * If you change a value here, update the matching `--node-min-width-*` token
 * in `src-web/index.css` `@theme` block.
 */

export const NODE_MIN_WIDTH_XS = 80;
export const NODE_MIN_WIDTH_SM = 120;
export const NODE_MIN_WIDTH_MD = 140;
export const NODE_MIN_WIDTH_LG = 180;
