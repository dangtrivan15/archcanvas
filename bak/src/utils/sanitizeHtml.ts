/**
 * sanitizeHtml - lightweight HTML sanitizer for markdown output.
 *
 * Strips dangerous elements (script, iframe, object, embed, form, style, etc.)
 * and removes all event-handler attributes (onclick, onerror, onload, etc.)
 * as well as javascript: / data: / vbscript: protocol links.
 *
 * Uses the browser's DOMParser for robust parsing, then walks the tree
 * and removes anything dangerous. This is NOT a full-featured sanitizer
 * like DOMPurify, but handles the common XSS vectors for rendered markdown.
 */

/** Elements that are always dangerous and should be completely removed (with children). */
const DANGEROUS_ELEMENTS = new Set([
  'SCRIPT',
  'STYLE',
  'IFRAME',
  'OBJECT',
  'EMBED',
  'APPLET',
  'FORM',
  'TEXTAREA',
  'SELECT',
  'BUTTON',
  'INPUT',
  'LINK',
  'META',
  'BASE',
  'NOSCRIPT',
  'TEMPLATE',
  'MATH',
  'SVG',
]);

/** Allowed elements for markdown output. Everything else gets unwrapped (children kept). */
const ALLOWED_ELEMENTS = new Set([
  'P',
  'BR',
  'HR',
  'H1',
  'H2',
  'H3',
  'H4',
  'H5',
  'H6',
  'STRONG',
  'B',
  'EM',
  'I',
  'U',
  'S',
  'DEL',
  'INS',
  'CODE',
  'PRE',
  'KBD',
  'SAMP',
  'VAR',
  'BLOCKQUOTE',
  'Q',
  'CITE',
  'A',
  'IMG',
  'UL',
  'OL',
  'LI',
  'TABLE',
  'THEAD',
  'TBODY',
  'TFOOT',
  'TR',
  'TH',
  'TD',
  'CAPTION',
  'DL',
  'DT',
  'DD',
  'DIV',
  'SPAN',
  'FIGURE',
  'FIGCAPTION',
  'DETAILS',
  'SUMMARY',
  'ABBR',
  'SUP',
  'SUB',
  'SMALL',
  'MARK',
]);

/** Allowed attributes per element (all lowercase). */
const ALLOWED_ATTRS: Record<string, Set<string>> = {
  '*': new Set(['class', 'id', 'title', 'lang', 'dir', 'data-testid']),
  A: new Set(['href', 'target', 'rel']),
  IMG: new Set(['src', 'alt', 'width', 'height']),
  TD: new Set(['colspan', 'rowspan']),
  TH: new Set(['colspan', 'rowspan', 'scope']),
  OL: new Set(['start', 'type']),
  CODE: new Set(['class']), // for language-* classes
};

/** Protocols considered safe for href/src attributes. */
const SAFE_URL_PROTOCOLS = new Set(['http:', 'https:', 'mailto:', '#']);

function isSafeUrl(url: string): boolean {
  const trimmed = url.trim().toLowerCase();
  // Allow relative URLs (no protocol), anchor links, and safe protocols
  if (
    trimmed.startsWith('#') ||
    trimmed.startsWith('/') ||
    trimmed.startsWith('./') ||
    trimmed.startsWith('../')
  ) {
    return true;
  }
  try {
    const parsed = new URL(trimmed, 'https://example.com');
    return SAFE_URL_PROTOCOLS.has(parsed.protocol);
  } catch {
    // If URL parsing fails, treat as unsafe
    return false;
  }
}

function isEventHandlerAttr(name: string): boolean {
  return name.toLowerCase().startsWith('on');
}

function isAllowedAttr(tagName: string, attrName: string): boolean {
  const lower = attrName.toLowerCase();
  // Never allow event handlers
  if (isEventHandlerAttr(lower)) return false;
  // Never allow style attribute (can contain expressions in some browsers)
  if (lower === 'style') return false;

  const globalAllowed = ALLOWED_ATTRS['*'];
  const tagAllowed = ALLOWED_ATTRS[tagName];

  return globalAllowed?.has(lower) || tagAllowed?.has(lower) || false;
}

function sanitizeNode(node: Node): void {
  if (node.nodeType === Node.ELEMENT_NODE) {
    const el = node as Element;
    const tagName = el.tagName;

    // Remove dangerous elements entirely (including children)
    if (DANGEROUS_ELEMENTS.has(tagName)) {
      el.parentNode?.removeChild(el);
      return;
    }

    // For non-allowed elements, unwrap: replace with children
    if (!ALLOWED_ELEMENTS.has(tagName)) {
      const parent = el.parentNode;
      if (parent) {
        while (el.firstChild) {
          parent.insertBefore(el.firstChild, el);
        }
        parent.removeChild(el);
      }
      return;
    }

    // Sanitize attributes
    const attrsToRemove: string[] = [];
    for (let i = 0; i < el.attributes.length; i++) {
      const attr = el.attributes.item(i);
      if (attr && !isAllowedAttr(tagName, attr.name)) {
        attrsToRemove.push(attr.name);
      }
    }
    for (const attrName of attrsToRemove) {
      el.removeAttribute(attrName);
    }

    // Validate URL attributes
    if (tagName === 'A') {
      const href = el.getAttribute('href');
      if (href && !isSafeUrl(href)) {
        el.removeAttribute('href');
      }
      // Force target="_blank" for external links and add noopener
      if (el.getAttribute('href')) {
        el.setAttribute('target', '_blank');
        el.setAttribute('rel', 'noopener noreferrer');
      }
    }
    if (tagName === 'IMG') {
      const src = el.getAttribute('src');
      if (src && !isSafeUrl(src)) {
        el.removeAttribute('src');
        // Remove images with unsafe src entirely
        el.parentNode?.removeChild(el);
        return;
      }
    }

    // Recursively sanitize children (iterate backwards since we may remove nodes)
    const children = Array.from(el.childNodes);
    for (const child of children) {
      sanitizeNode(child);
    }
  }
}

/**
 * Sanitize an HTML string by parsing it, walking the DOM tree,
 * removing dangerous elements/attributes, and serializing back.
 */
export function sanitizeHtml(html: string): string {
  if (!html) return '';

  const parser = new DOMParser();
  const doc = parser.parseFromString(`<div id="__sanitize__">${html}</div>`, 'text/html');
  const container = doc.getElementById('__sanitize__');

  if (!container) return '';

  // Walk all children and sanitize
  const children = Array.from(container.childNodes);
  for (const child of children) {
    sanitizeNode(child);
  }

  return container.innerHTML;
}
