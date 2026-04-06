import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildSvgString, renderToSvgString } from '@/export/buildSvgString';

// Mock sanitizeUrlReferences so we can verify it's called
vi.mock('@/export/sanitizeUrlReferences', () => ({
  sanitizeUrlReferences: vi.fn(),
}));

import { sanitizeUrlReferences } from '@/export/sanitizeUrlReferences';

describe('buildSvgString', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('wraps element in an SVG foreignObject', () => {
    const el = document.createElement('div');
    el.textContent = 'Hello';

    const svg = buildSvgString(el, { width: 800, height: 600 });

    expect(svg).toContain('<svg xmlns="http://www.w3.org/2000/svg"');
    expect(svg).toContain('width="800"');
    expect(svg).toContain('height="600"');
    expect(svg).toContain('<foreignObject');
    expect(svg).toContain('Hello');
    expect(svg).toContain('</foreignObject>');
    expect(svg).toContain('</svg>');
  });

  it('does NOT include externalResourcesRequired attribute', () => {
    const el = document.createElement('div');

    const svg = buildSvgString(el, { width: 100, height: 100 });

    expect(svg).not.toContain('externalResourcesRequired');
  });

  it('includes a background rect when backgroundColor is provided', () => {
    const el = document.createElement('div');

    const svg = buildSvgString(el, {
      width: 100,
      height: 100,
      backgroundColor: '#ffffff',
    });

    expect(svg).toContain('<rect');
    expect(svg).toContain('fill="#ffffff"');
  });

  it('omits background rect when no backgroundColor', () => {
    const el = document.createElement('div');

    const svg = buildSvgString(el, { width: 100, height: 100 });

    expect(svg).not.toContain('<rect');
  });

  it('escapes XML special characters in backgroundColor', () => {
    const el = document.createElement('div');

    const svg = buildSvgString(el, {
      width: 100,
      height: 100,
      backgroundColor: 'rgb(255, 255, 255)',
    });

    // Should be valid XML (no unescaped angle brackets, etc.)
    expect(svg).toContain('fill="rgb(255, 255, 255)"');
  });

  it('calls sanitizeUrlReferences before serialization', () => {
    const el = document.createElement('div');

    buildSvgString(el, { width: 100, height: 100 });

    expect(sanitizeUrlReferences).toHaveBeenCalledTimes(1);
    expect(sanitizeUrlReferences).toHaveBeenCalledWith(el);
  });

  it('serializes child elements correctly', () => {
    const el = document.createElement('div');
    const span = document.createElement('span');
    span.textContent = 'nested';
    el.appendChild(span);

    const svg = buildSvgString(el, { width: 200, height: 100 });

    expect(svg).toContain('nested');
    expect(svg).toContain('<span');
  });
});

describe('renderToSvgString', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns a complete SVG string', () => {
    const el = document.createElement('div');
    el.textContent = 'test content';

    const svg = renderToSvgString(el, { width: 640, height: 480 });

    expect(svg).toMatch(/^<svg/);
    expect(svg).toMatch(/<\/svg>$/);
    expect(svg).toContain('test content');
    expect(svg).toContain('foreignObject');
  });

  it('passes backgroundColor through to the SVG', () => {
    const el = document.createElement('div');

    const svg = renderToSvgString(el, {
      width: 100,
      height: 100,
      backgroundColor: '#000000',
    });

    expect(svg).toContain('fill="#000000"');
  });
});
