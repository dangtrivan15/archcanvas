/**
 * Inline all computed styles from an original DOM tree onto a cloned copy.
 *
 * By reading `getComputedStyle()` from the *live* original element and writing
 * the resolved values as inline styles on the *clone*, we bypass every CSS
 * resolution issue that trips up `html-to-image`:
 *
 *  - Tailwind CSS 4 `@layer` / `@theme` directives
 *  - CSS custom properties (`var(--color-*)`)
 *  - `color-mix()` and other modern CSS functions
 *  - Cascade layer ordering
 *
 * The browser's style engine has already resolved all of these by the time
 * `getComputedStyle()` is called, so the cloned DOM receives plain values.
 */

/**
 * Properties to skip when inlining styles.
 * These are either not meaningful for export or cause rendering artefacts.
 */
const SKIP_PROPERTIES = new Set([
  // Transition / animation properties cause visual glitches in static exports
  'transition',
  'transition-property',
  'transition-duration',
  'transition-timing-function',
  'transition-delay',
  'animation',
  'animation-name',
  'animation-duration',
  'animation-timing-function',
  'animation-delay',
  'animation-iteration-count',
  'animation-direction',
  'animation-fill-mode',
  'animation-play-state',
  // Cursor is irrelevant for a static image
  'cursor',
]);

/**
 * Walk the original and cloned trees in parallel, copying every computed
 * style property from the original to the clone's inline style.
 *
 * Uses `TreeWalker` for efficient DOM traversal. Both walkers step in
 * lock-step so element N in the original always corresponds to element N
 * in the clone.
 */
export function inlineStyles(original: HTMLElement, clone: HTMLElement): void {
  copyComputedStyles(original, clone);

  const origWalker = document.createTreeWalker(original, NodeFilter.SHOW_ELEMENT);
  const cloneWalker = document.createTreeWalker(clone, NodeFilter.SHOW_ELEMENT);

  let origNode = origWalker.nextNode() as HTMLElement | null;
  let cloneNode = cloneWalker.nextNode() as HTMLElement | null;

  while (origNode && cloneNode) {
    copyComputedStyles(origNode, cloneNode);
    origNode = origWalker.nextNode() as HTMLElement | null;
    cloneNode = cloneWalker.nextNode() as HTMLElement | null;
  }
}

/**
 * Copy all computed style properties from `source` to `target`'s inline style.
 */
function copyComputedStyles(source: HTMLElement, target: HTMLElement): void {
  const computed = getComputedStyle(source);
  const len = computed.length;

  for (let i = 0; i < len; i++) {
    const prop = computed[i];
    if (SKIP_PROPERTIES.has(prop)) continue;
    const value = computed.getPropertyValue(prop);
    target.style.setProperty(prop, value);
  }
}
