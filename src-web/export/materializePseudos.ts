/**
 * Materialize `::before` and `::after` pseudo-elements as real DOM nodes.
 *
 * `html-to-image` clones the DOM but cannot capture pseudo-element rendering
 * because `::before` / `::after` are not part of the DOM tree. This module
 * reads the live computed styles of pseudo-elements from the *original* tree
 * and inserts real `<span>` elements into the *clone* with equivalent inline
 * styles.
 *
 * This is critical for:
 *  - Cylinder shape caps (top/bottom ellipses via `::before` / `::after`)
 *  - Document shape wavy bottom (via `::after`)
 */

const PSEUDO_SELECTORS = ['::before', '::after'] as const;

/**
 * Walk the original and cloned trees in parallel. For every element that has
 * a visible `::before` or `::after` pseudo-element, insert a real `<span>`
 * into the clone with the pseudo-element's computed styles.
 */
export function materializePseudos(original: HTMLElement, clone: HTMLElement): void {
  materializeForElement(original, clone);

  const origWalker = document.createTreeWalker(original, NodeFilter.SHOW_ELEMENT);
  const cloneWalker = document.createTreeWalker(clone, NodeFilter.SHOW_ELEMENT);

  let origNode = origWalker.nextNode() as HTMLElement | null;
  let cloneNode = cloneWalker.nextNode() as HTMLElement | null;

  while (origNode && cloneNode) {
    materializeForElement(origNode, cloneNode);
    origNode = origWalker.nextNode() as HTMLElement | null;
    cloneNode = cloneWalker.nextNode() as HTMLElement | null;
  }
}

/**
 * Check a single original/clone pair for pseudo-elements and materialize them.
 */
function materializeForElement(origEl: HTMLElement, cloneEl: HTMLElement): void {
  for (const pseudo of PSEUDO_SELECTORS) {
    const computed = getComputedStyle(origEl, pseudo);

    // No pseudo-element exists if content is 'none' or truly absent.
    // Note: `content: ''` (CSS empty string) is returned by getComputedStyle as
    // `'""'` or `"''"` — these are VALID decorative pseudo-elements (e.g. cylinder
    // caps, document wave) and must be materialized even though they have no text.
    const content = computed.getPropertyValue('content');
    if (!content || content === 'none') {
      continue;
    }

    // Skip if the pseudo-element has no visual contribution
    const display = computed.getPropertyValue('display');
    if (display === 'none') continue;

    const span = document.createElement('span');
    span.setAttribute('data-pseudo', pseudo);

    // Copy all computed styles to the span's inline style
    const len = computed.length;
    for (let i = 0; i < len; i++) {
      const prop = computed[i];
      const value = computed.getPropertyValue(prop);
      span.style.setProperty(prop, value);
    }

    // Resolve content: strip quotes for text content, handle empty pseudo-elements
    const resolvedContent = resolveContent(content);
    if (resolvedContent) {
      span.textContent = resolvedContent;
    }

    // Insert at the correct position
    if (pseudo === '::before') {
      cloneEl.insertBefore(span, cloneEl.firstChild);
    } else {
      cloneEl.appendChild(span);
    }
  }
}

/**
 * Resolve the CSS `content` property value to a text string.
 *
 * Common cases:
 *  - `'text'` or `"text"` → `text`
 *  - `""` or `''` → empty string (used for decorative pseudo-elements)
 *  - `none` → null (no pseudo-element)
 */
function resolveContent(raw: string): string | null {
  if (raw === 'none') return null;

  // Strip surrounding quotes
  const match = raw.match(/^['"](.*)['"]$/);
  if (match) return match[1];

  return raw;
}
