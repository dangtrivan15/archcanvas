import { describe, it, expect } from 'vitest';
import { sanitizeUrlReferences } from '@/export/sanitizeUrlReferences';

describe('sanitizeUrlReferences', () => {
  it('strips url() values from filter property', () => {
    const el = document.createElement('div');
    el.style.setProperty('filter', 'url(#shadow-filter)');

    sanitizeUrlReferences(el);

    expect(el.style.getPropertyValue('filter')).toBe('none');
  });

  it('strips url() values from clip-path property', () => {
    const el = document.createElement('div');
    el.style.setProperty('clip-path', 'url(#my-clip)');

    sanitizeUrlReferences(el);

    expect(el.style.getPropertyValue('clip-path')).toBe('none');
  });

  it('strips url() values from mask property', () => {
    const el = document.createElement('div');
    el.style.setProperty('mask', 'url(#mask-id)');

    sanitizeUrlReferences(el);

    expect(el.style.getPropertyValue('mask')).toBe('none');
  });

  it('preserves data: URL values (self-contained)', () => {
    const el = document.createElement('div');
    const dataUrl = 'url(data:image/png;base64,iVBORw0KGgo=)';
    el.style.setProperty('filter', dataUrl);

    sanitizeUrlReferences(el);

    // data: URLs should NOT be stripped
    expect(el.style.getPropertyValue('filter')).not.toBe('none');
  });

  it('does not affect properties without url() values', () => {
    const el = document.createElement('div');
    el.style.setProperty('filter', 'blur(5px)');

    sanitizeUrlReferences(el);

    expect(el.style.getPropertyValue('filter')).toBe('blur(5px)');
  });

  it('processes child elements recursively', () => {
    const parent = document.createElement('div');
    const child = document.createElement('span');
    child.style.setProperty('clip-path', 'url(#child-clip)');
    parent.appendChild(child);

    sanitizeUrlReferences(parent);

    expect(child.style.getPropertyValue('clip-path')).toBe('none');
  });

  it('leaves non-URL properties untouched', () => {
    const el = document.createElement('div');
    el.style.setProperty('color', 'red');
    el.style.setProperty('font-size', '14px');

    sanitizeUrlReferences(el);

    expect(el.style.getPropertyValue('color')).toBe('red');
    expect(el.style.getPropertyValue('font-size')).toBe('14px');
  });

  it('handles elements with no relevant inline styles', () => {
    const el = document.createElement('div');
    // No inline styles at all — should not throw
    sanitizeUrlReferences(el);
    expect(el.style.length).toBe(0);
  });

  it('preserves SVG attributes like marker-end (only strips CSS inline styles)', () => {
    // sanitizeUrlReferences only operates on el.style.getPropertyValue(),
    // NOT on DOM attributes. SVG marker-end is an SVG attribute, not a CSS
    // inline style, so it must survive sanitization.
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('marker-end', 'url(#arrowhead)');
    svg.appendChild(path);

    // Wrap in an HTMLElement since sanitizeUrlReferences expects HTMLElement root
    const wrapper = document.createElement('div');
    wrapper.appendChild(svg);

    sanitizeUrlReferences(wrapper);

    // The SVG attribute should be untouched — sanitizeUrlReferences only
    // touches el.style, not element attributes
    expect(path.getAttribute('marker-end')).toBe('url(#arrowhead)');
  });
});
