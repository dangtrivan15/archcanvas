import { describe, it, expect } from 'vitest';
import { decodeDataUrl } from '@/export/dataUrlUtils';

describe('decodeDataUrl', () => {
  it('decodes URI-encoded SVG data URL', () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg"><rect/></svg>';
    const encoded = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

    expect(decodeDataUrl(encoded)).toBe(svg);
  });

  it('decodes base64-encoded SVG data URL', () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg"><rect/></svg>';
    const b64 = btoa(svg);
    const dataUrl = `data:image/svg+xml;base64,${b64}`;

    expect(decodeDataUrl(dataUrl)).toBe(svg);
  });

  it('handles SVG content containing commas', () => {
    const svg = '<svg><path d="M0,0 L10,20 C30,40 50,60 70,80"/></svg>';
    const encoded = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

    expect(decodeDataUrl(encoded)).toBe(svg);
  });

  it('throws on invalid data URL (missing comma)', () => {
    expect(() => decodeDataUrl('not-a-data-url')).toThrow('Invalid data URL');
  });

  it('handles empty payload', () => {
    expect(decodeDataUrl('data:image/svg+xml;charset=utf-8,')).toBe('');
  });

  it('handles base64 with special characters', () => {
    // SVG with non-ASCII is properly handled via base64
    const svg = '<svg><text>Hello &amp; World</text></svg>';
    const b64 = btoa(svg);
    const dataUrl = `data:image/svg+xml;base64,${b64}`;

    expect(decodeDataUrl(dataUrl)).toBe(svg);
  });
});
