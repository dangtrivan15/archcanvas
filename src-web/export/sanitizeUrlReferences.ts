/**
 * Sanitize unresolvable `url()` references in inlined computed styles.
 *
 * When `getComputedStyle()` values are copied as inline styles, some
 * properties contain `url(...)` references that only work in the live page
 * context (e.g. internal SVG filter IDs, marker references). Inside a
 * foreignObject these URLs are unresolvable and can cause the SVG to fail
 * to load entirely — especially when combined with `externalResourcesRequired`.
 *
 * This function walks the cloned DOM and replaces any `url(...)` values
 * with `none` for properties where the URL is non-essential.
 */

/**
 * CSS properties that commonly carry `url()` references which become
 * unresolvable when the DOM is serialized into a foreignObject.
 *
 * We only strip URLs from these — background-image, list-style-image, etc.
 * are intentionally kept because they may have been inlined as data URLs.
 */
// Note: Custom shapes with url() clip-path values are rejected at schema
// validation time (CustomShape in nodeDefSchema.ts), so built-in NodeDefs
// will never produce url() clip-paths. This sanitization still catches any
// url() references injected by getComputedStyle() from the live document.
const URL_PROPERTIES = [
  'clip-path',
  'mask',
  'mask-image',
  'filter',
  'marker-start',
  'marker-mid',
  'marker-end',
  'fill',
  'stroke',
];

/** Matches a CSS `url(...)` value (with optional quotes inside) */
const URL_RE = /url\(["']?(?!data:)([^"')]+)["']?\)/;

/**
 * Walk every element in `root` and strip unresolvable `url()` values
 * from inline styles.
 *
 * Only affects the properties listed in {@link URL_PROPERTIES}.
 * Data URLs (`url(data:...)`) are preserved since they are self-contained.
 */
export function sanitizeUrlReferences(root: HTMLElement): void {
  sanitizeElement(root);

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
  let node = walker.nextNode() as HTMLElement | null;

  while (node) {
    sanitizeElement(node);
    node = walker.nextNode() as HTMLElement | null;
  }
}

function sanitizeElement(el: HTMLElement): void {
  for (const prop of URL_PROPERTIES) {
    const value = el.style.getPropertyValue(prop);
    if (value && URL_RE.test(value)) {
      el.style.setProperty(prop, 'none');
    }
  }
}
