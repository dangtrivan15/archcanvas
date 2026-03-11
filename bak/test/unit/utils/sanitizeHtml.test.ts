// @vitest-environment happy-dom
/**
 * Tests for sanitizeHtml utility - XSS prevention in rendered markdown notes.
 * Verifies that dangerous HTML elements and attributes are stripped/escaped.
 */
import { describe, it, expect } from 'vitest';
import { sanitizeHtml } from '@/utils/sanitizeHtml';

describe('sanitizeHtml', () => {
  // ---- Script injection ----
  it('removes <script> tags and their content', () => {
    const result = sanitizeHtml('<p>Hello</p><script>alert("xss")</script><p>World</p>');
    expect(result).not.toContain('<script');
    expect(result).not.toContain('alert');
    expect(result).toContain('Hello');
    expect(result).toContain('World');
  });

  it('removes nested script tags', () => {
    const result = sanitizeHtml('<div><script>document.cookie</script></div>');
    expect(result).not.toContain('<script');
    expect(result).not.toContain('document.cookie');
  });

  it('removes script with various attribute forms', () => {
    const cases = [
      '<script type="text/javascript">alert(1)</script>',
      '<SCRIPT>alert(1)</SCRIPT>',
      '<script src="evil.js"></script>',
    ];
    for (const input of cases) {
      const result = sanitizeHtml(input);
      expect(result.toLowerCase()).not.toContain('<script');
      expect(result).not.toContain('alert');
    }
  });

  // ---- Event handler injection ----
  it('removes onerror handler from img tag', () => {
    const result = sanitizeHtml('<img src="x" onerror="alert(\'xss\')">');
    expect(result).not.toContain('onerror');
    expect(result).not.toContain('alert');
  });

  it('removes all on* event handlers', () => {
    const handlers = [
      '<div onclick="alert(1)">click</div>',
      '<p onmouseover="alert(1)">hover</p>',
      '<a href="#" onload="alert(1)">link</a>',
      '<img src="x" onfocus="alert(1)">',
    ];
    for (const input of handlers) {
      const result = sanitizeHtml(input);
      expect(result).not.toMatch(/on\w+=/i);
    }
  });

  // ---- Dangerous elements ----
  it('removes iframe elements', () => {
    const result = sanitizeHtml('<iframe src="evil.com"></iframe>');
    expect(result).not.toContain('<iframe');
  });

  it('removes style elements', () => {
    const result = sanitizeHtml('<style>body{display:none}</style><p>text</p>');
    expect(result).not.toContain('<style');
    expect(result).toContain('text');
  });

  it('removes form elements', () => {
    const result = sanitizeHtml(
      '<form action="evil"><input type="text"><button>Submit</button></form>',
    );
    expect(result).not.toContain('<form');
    expect(result).not.toContain('<input');
    expect(result).not.toContain('<button');
  });

  it('removes object and embed elements', () => {
    const result = sanitizeHtml('<object data="evil.swf"></object><embed src="evil.swf">');
    expect(result).not.toContain('<object');
    expect(result).not.toContain('<embed');
  });

  it('removes svg elements', () => {
    const result = sanitizeHtml('<svg onload="alert(1)"><circle r="10"></circle></svg>');
    expect(result).not.toContain('<svg');
    expect(result).not.toContain('alert');
  });

  // ---- JavaScript protocol ----
  it('removes javascript: protocol from href', () => {
    const result = sanitizeHtml('<a href="javascript:alert(1)">click me</a>');
    expect(result).not.toContain('javascript:');
    expect(result).toContain('click me');
  });

  it('removes data: protocol from img src', () => {
    const result = sanitizeHtml('<img src="data:text/html,<script>alert(1)</script>">');
    // Image with data: src should be removed entirely
    expect(result).not.toContain('data:');
  });

  // ---- Allowed elements preserved ----
  it('preserves safe markdown elements', () => {
    const html = '<h1>Title</h1><p>Paragraph with <strong>bold</strong> and <em>italic</em></p>';
    const result = sanitizeHtml(html);
    expect(result).toContain('<h1>Title</h1>');
    expect(result).toContain('<strong>bold</strong>');
    expect(result).toContain('<em>italic</em>');
  });

  it('preserves code blocks', () => {
    const html = '<pre><code class="language-js">const x = 1;</code></pre>';
    const result = sanitizeHtml(html);
    expect(result).toContain('<pre>');
    expect(result).toContain('<code');
    expect(result).toContain('const x = 1;');
  });

  it('preserves safe links', () => {
    const html = '<a href="https://example.com">Safe link</a>';
    const result = sanitizeHtml(html);
    expect(result).toContain('href="https://example.com"');
    expect(result).toContain('Safe link');
  });

  it('preserves lists', () => {
    const html = '<ul><li>Item 1</li><li>Item 2</li></ul>';
    const result = sanitizeHtml(html);
    expect(result).toContain('<ul>');
    expect(result).toContain('<li>Item 1</li>');
  });

  it('preserves tables', () => {
    const html = '<table><tr><th>Header</th></tr><tr><td>Cell</td></tr></table>';
    const result = sanitizeHtml(html);
    expect(result).toContain('<table>');
    expect(result).toContain('<th>Header</th>');
    expect(result).toContain('<td>Cell</td>');
  });

  it('preserves images with safe src', () => {
    const html = '<img src="https://example.com/image.png" alt="Photo">';
    const result = sanitizeHtml(html);
    expect(result).toContain('src="https://example.com/image.png"');
    expect(result).toContain('alt="Photo"');
  });

  // ---- Style attribute ----
  it('removes style attributes', () => {
    const result = sanitizeHtml('<p style="background:url(javascript:alert(1))">text</p>');
    expect(result).not.toContain('style=');
    expect(result).toContain('text');
  });

  // ---- Edge cases ----
  it('handles empty string', () => {
    expect(sanitizeHtml('')).toBe('');
  });

  it('handles plain text (no HTML)', () => {
    expect(sanitizeHtml('Just plain text')).toBe('Just plain text');
  });

  it('handles already-safe content', () => {
    const safe = '<p>Hello <strong>world</strong></p>';
    expect(sanitizeHtml(safe)).toContain('<p>Hello <strong>world</strong></p>');
  });

  it('strips style attribute even on allowed elements', () => {
    const result = sanitizeHtml('<strong style="color:red">bold</strong>');
    expect(result).not.toContain('style=');
    expect(result).toContain('<strong>bold</strong>');
  });

  // ---- External link safety ----
  it('adds rel="noopener noreferrer" to links', () => {
    const result = sanitizeHtml('<a href="https://example.com">link</a>');
    expect(result).toContain('rel="noopener noreferrer"');
  });

  it('adds target="_blank" to external links', () => {
    const result = sanitizeHtml('<a href="https://example.com">link</a>');
    expect(result).toContain('target="_blank"');
  });
});
